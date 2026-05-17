import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = process.cwd();
const invoiceDir = path.join(rootDir, "public", "invoices");
const invoiceIndexPath = path.join(rootDir, "data", "active-invoice-index.json");

// Middleware for parsing JSON with a larger limit for images
app.use(express.json({ limit: "10mb" }));
app.use("/invoices", express.static(invoiceDir));

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const SYSTEM_PROMPT = `You are FinDoc Auditor AI, an ultra-strict, zero-tolerance digital financial auditor. Your sole task is to analyze the provided invoice or receipt image and answer the user's question with absolute factual precision and textual proof.

You must adhere to the following catastrophic-fail-safe rules without exception:

1. ABSOLUTE ZERO HALLUCINATIONS:
- You are strictly forbidden from guessing, assuming, extrapolating, or inferring any data. 
- If a specific number, name, date, or detail is not 100% visibly and clearly printed on the document, you DO NOT know it. Do not use external logic or common sense to fill in missing gaps.

2. THE "NOT FOUND" MANDATE:
- If you are not 100% certain of the answer based EXCLUSIVELY on the visible text of the image, or if the requested information is missing, obscured, or ambiguous, you must reply EXACTLY with this phrase and absolutely nothing else:
"Δεν αναγράφεται στο έγγραφο"

3. RESPONSE GROUNDING & FORMATTING (CRITICAL):
- If the information exists, your "answer" field MUST follow this exact 2-line format:
Απάντηση: [Η σύντομη, ωμή απάντηση ή ο αριθμός]
Τεκμηρίωση: "[Κάνε copy-paste ΑΚΡΙΒΩΣ τη γραμμή ή το λεκτικό από το τιμολόγιο όπου αναγράφεται αυτό το στοιχείο]"

- Do not add conversational filler, intros, or outros. Go straight to the format.
- Always respond in professional, cold, and concise Greek.

4. COORDINATES & JSON:
- You MUST return a JSON object with the following structure:
{
  "answer": "string (the Greek answer in the 2-line format specified above)",
  "box_2d": [ymin, xmin, ymax, xmax] | null (normalized coordinates 0-1000 of where the information is found)
}
- Use null for box_2d if the information is not found.

CRITICAL: Return ONLY valid JSON.`;

const BANKING_PROMPT = `You are an expert financial data extraction agent. Analyze the provided bank statement image and extract all transactions with 100% accuracy.
You MUST return a JSON object with the following structure:
{
  "summary": {
    "bank_name": "string",
    "account_holder": "string",
    "account_number": "string",
    "period": "string",
    "opening_balance": number | null,
    "closing_balance": number | null,
    "total_credits": number | null,
    "total_debits": number | null,
    "currency": "string"
  },
  "transactions": [
    {
      "date": "string",
      "description": "string",
      "amount": number,
      "type": "CREDIT" | "DEBIT",
      "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Salary" | "Transfer" | "Leisure" | "Healthcare" | "Other",
      "balance": number | null
    }
  ]
}

Rules:
1. Extract ALL visible transactions.
2. If a value is missing, use null.
3. Use absolute numbers for amount. The 'type' field indicates the sign.
4. Categorize each transaction accurately based on the description.
5. If you cannot find any banking data, return an empty transactions array and null summary fields.
6. Return ONLY valid JSON.`;

type InvoiceIndexRecord = {
  supplier?: string;
  invoiceNumber?: string;
  date?: string;
  total?: number | string;
  currency?: string;
  summary?: string;
  rawText?: string;
  searchableText?: string;
  items?: Array<{ description?: string; quantity?: number | string; unitPrice?: number | string; total?: number | string }>;
};

function readInvoiceIndex(): Record<string, InvoiceIndexRecord> {
  if (!fs.existsSync(invoiceIndexPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(invoiceIndexPath, "utf8"));
  } catch (error) {
    console.error("Failed to read active invoice index:", error);
    return {};
  }
}

function listInvoiceFiles() {
  if (!fs.existsSync(invoiceDir)) return [];
  const index = readInvoiceIndex();
  const activeNames = new Set(Object.keys(index));

  return fs
    .readdirSync(invoiceDir)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .filter((name) => activeNames.size === 0 || activeNames.has(name))
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((name) => {
      const record = index[name] || {};
      return {
        name,
        code: name.replace(/\.[^.]+$/, "").replace(/\s+\(\d+\)$/, ""),
        url: `/invoices/${encodeURIComponent(name)}`,
        supplier: record.supplier || "",
        invoiceNumber: record.invoiceNumber || "",
        date: record.date || "",
        total: record.total ?? "",
        currency: record.currency || "",
        summary: record.summary || "",
        searchableText: [
          record.supplier,
          record.invoiceNumber,
          record.date,
          record.total,
          record.currency,
          record.summary,
          record.rawText,
          record.searchableText,
          ...(record.items || []).flatMap((item) => [
            item.description,
            item.quantity,
            item.unitPrice,
            item.total,
          ]),
        ]
          .filter(Boolean)
          .join(" "),
      };
    });
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9α-ω]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreInvoice(query: string, invoice: ReturnType<typeof listInvoiceFiles>[number]) {
  const q = normalize(query);
  const filename = normalize(invoice.name);
  const code = normalize(invoice.code);
  const invoiceNumber = normalize(invoice.invoiceNumber);
  const supplier = normalize(invoice.supplier);
  const haystack = normalize([
    invoice.name,
    invoice.code,
    invoice.supplier,
    invoice.invoiceNumber,
    invoice.date,
    invoice.total,
    invoice.currency,
    invoice.summary,
    invoice.searchableText,
  ].join(" "));
  const numericParts = query.match(/\d{3,}/g) || [];

  let score = 0;
  if (!q) return score;
  if (filename === q || code === q) score += 100;
  if (invoiceNumber && invoiceNumber === q) score += 110;
  if (supplier && supplier === q) score += 95;
  if (filename.includes(q) || code.includes(q)) score += 75;
  if (haystack.includes(q)) score += 60;

  for (const number of numericParts) {
    if (invoice.name.includes(number) || invoice.code.includes(number)) score += 55;
    if (String(invoice.invoiceNumber).includes(number)) score += 65;
    if (String(invoice.searchableText).includes(number)) score += 25;
  }

  for (const term of q.split(" ").filter((item) => item.length > 2)) {
    if (filename.includes(term) || code.includes(term)) score += 8;
    if (haystack.includes(term)) score += 12;
  }

  return score;
}

app.get("/api/invoices", (_req, res) => {
  res.json({ invoices: listInvoiceFiles() });
});

app.post("/api/find-invoice", (req, res) => {
  const query = String(req.body?.query || "").trim();
  const invoices = listInvoiceFiles();
  const matches = invoices
    .map((invoice) => ({ ...invoice, score: scoreInvoice(query, invoice) }))
    .filter((invoice) => invoice.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({
    query,
    found: matches.length > 0,
    best: matches[0] || null,
    matches,
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { message, image, history, invoiceName } = req.body;

    let imageSource = image;
    if (!imageSource && invoiceName) {
      const safeName = path.basename(String(invoiceName));
      const filePath = path.join(invoiceDir, safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Invoice was not found in database" });
      }
      const mimeType = /\.png$/i.test(safeName) ? "image/png" : "image/jpeg";
      imageSource = `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
    }

    if (!imageSource) {
      return res.status(400).json({ error: "Image is required" });
    }

    const mimeType = imageSource.match(/data:([^;]+);base64,/)?.[1] || "image/jpeg";
    const base64Data = imageSource.split(",")[1] || imageSource;

    // Convert history to Gemini format if provided
    const chatHistory = (history || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatHistory,
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: message || "Analyze this document.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    let text = response.text || "";
    // Clean JSON if model wrapped it in markdown
    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error: any) {
    console.error("Analysis error:", error);
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("Quota")) {
      return res.status(429).json({ 
        error: "Quota Exceeded", 
        message: "Έχετε υπερβεί το ημερήσιο όριο χρήσης. Παρακαλώ χρησιμοποιήστε το δικό σας API Key στα Settings." 
      });
    }
    res.status(500).json({ error: error.message || "Failed to analyze image" });
  }
});

app.post("/api/analyze-banking", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    const mimeType = image.match(/data:([^;]+);base64,/)?.[1] || "image/jpeg";
    const base64Data = image.split(",")[1] || image;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: "Extract all transactions and summary information from this bank statement.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        systemInstruction: BANKING_PROMPT,
      },
    });

    let text = response.text || "";
    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(text);
    res.json(extendWithSandboxLedger(data));
  } catch (error: any) {
    console.error("Banking analysis error:", error);
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("Quota")) {
      return res.status(429).json({ 
        error: "Quota Exceeded", 
        message: "Έχετε υπερβεί το ημερήσιο όριο χρήσης (20 αιτήματα). Παρακαλώ περιμένετε ή χρησιμοποιήστε το δικό σας API Key στα Settings." 
      });
    }
    res.status(500).json({ error: error.message || "Failed to analyze banking statement" });
  }
});

// Simulated Banking API
function getMockBankingData() {
  return {
    summary: {
      bank_name: "Alpha Digital Bank",
      account_holder: "ΓΕΩΡΓΙΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ",
      account_number: "GR76 0110 1234 0000 9876 5432 101",
      period: "Μάιος 2026",
      opening_balance: 10000.00,
      closing_balance: 13341.01,
      total_credits: 5600.00,
      total_debits: 2258.99,
      currency: "EUR"
    },
    transactions: [
      {
        date: "25/12/2018",
        time: "20:13:39",
        description: "KF MODELLING CLAY KIDDY - RETAIL",
        amount: 9.00,
        type: "DEBIT",
        category: "Shopping",
        balance: 11954.21,
        rf_code: "RF81167184",
        status: "PAID"
      },
      {
        date: "25/12/2018",
        time: "20:30:15",
        description: "ΣΚΛΑΒΕΝΙΤΗΣ SUPER MARKET",
        amount: 54.20,
        type: "DEBIT",
        category: "Food",
        balance: 11900.01,
        rf_code: "RF9988776655",
        status: "PAID"
      },
      {
        date: "25/12/2018",
        time: "21:15:00",
        description: "Bazaar Supermarket - Weekly",
        amount: 42.10,
        type: "DEBIT",
        category: "Food",
        balance: 11857.91,
        rf_code: "RF1122334455",
        status: "PAID"
      },
      {
        date: "25/12/2018",
        time: "09:00:00",
        description: "ΜΙΣΘΟΔΟΣΙΑ - SALARY PAYMENT",
        amount: 1450.00,
        type: "CREDIT",
        category: "Salary",
        balance: 13350.01,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "25/12/2018",
        time: "08:30:00",
        description: "BONUS ΕΡΓΑΣΙΑΣ - ΕΤΗΣΙΟ",
        amount: 500.00,
        type: "CREDIT",
        category: "Salary",
        balance: 11900.01,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "16/05/2026",
        time: "12:15",
        description: "WOLT GREECE - FOOD DELIVERY",
        amount: 28.50,
        type: "DEBIT",
        category: "Food",
        balance: 11954.21,
        rf_code: "RF33445566778899001122334",
        status: "PAID"
      },
      {
        date: "15/05/2026",
        time: "19:40",
        description: "PUBLIC - TECH & BOOKS",
        amount: 145.00,
        type: "DEBIT",
        category: "Shopping",
        balance: 11982.71,
        rf_code: "RF22334455667788990011223",
        status: "UNPAID"
      },
      {
        date: "15/05/2026",
        time: "09:10",
        description: "APPLE.COM/BILL - ICLOUD STORAGE",
        amount: 9.99,
        type: "DEBIT",
        category: "Utilities",
        balance: 12127.71,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "14/05/2026",
        time: "14:25",
        description: "ΔΕΔΔΗΕ Α.Ε. - ΕΞΟΦΛΗΣΗ ΛΟΓΑΡΙΑΣΜΟΥ",
        amount: 345.20,
        type: "DEBIT",
        category: "Utilities",
        balance: 12137.70,
        rf_code: "RF12345678901234567890123",
        status: "PAID"
      },
      {
        date: "14/05/2026",
        time: "10:15",
        description: "UBER TRIPS - TRANSFER",
        amount: 22.50,
        type: "DEBIT",
        category: "Transport",
        balance: 12482.90,
        rf_code: "RF11223344556677889900112",
        status: "PAID"
      },
      {
        date: "13/05/2026",
        time: "15:20",
        description: "REVOLUT - ACCOUNT TOP UP",
        amount: 150.00,
        type: "DEBIT",
        category: "Transfer",
        balance: 12505.40,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "13/05/2026",
        time: "09:00",
        description: "ΜΙΣΘΟΔΟΣΙΑ ΜΑΪΟΥ",
        amount: 2200.00,
        type: "CREDIT",
        category: "Salary",
        balance: 12655.40,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "12/05/2026",
        time: "18:42",
        description: "ΣΚΛΑΒΕΝΙΤΗΣ - ΑΓΟΡΕΣ",
        amount: 156.40,
        type: "DEBIT",
        category: "Food",
        balance: 10455.40,
        rf_code: "RF98765432109876543210987",
        status: "PAID"
      },
      {
        date: "12/05/2026",
        time: "12:30",
        description: "ΦΑΡΜΑΚΕΙΟ ΠΑΠΑΓΕΩΡΓΙΟΥ",
        amount: 42.15,
        type: "DEBIT",
        category: "Healthcare",
        balance: 10611.80,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "11/05/2026",
        time: "20:15",
        description: "NETFLIX.COM - SUBSCRIPTION",
        amount: 14.99,
        type: "DEBIT",
        category: "Leisure",
        balance: 10653.95,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "11/05/2026",
        time: "10:00",
        description: "H&M GREECE - RETAIL",
        amount: 112.50,
        type: "DEBIT",
        category: "Shopping",
        balance: 10668.94,
        rf_code: "RF55667788990011223344556",
        status: "PAID"
      },
      {
        date: "10/05/2026",
        time: "11:15",
        description: "ΕΝΟΙΚΙΟ ΚΑΤΟΙΚΙΑΣ - ΜΑΪΟΣ",
        amount: 650.00,
        type: "DEBIT",
        category: "Other",
        balance: 10781.44,
        rf_code: "RF55544433322211100099988",
        status: "UNPAID"
      },
      {
        date: "10/05/2026",
        time: "15:45",
        description: "ZARA GREECE - RETAIL",
        amount: 89.90,
        type: "DEBIT",
        category: "Shopping",
        balance: 11431.44,
        rf_code: "RF66778899001122334455667",
        status: "PAID"
      },
      {
        date: "09/05/2026",
        time: "14:10",
        description: "TAXIBEAT P.C. - TRANSPORT",
        amount: 18.20,
        type: "DEBIT",
        category: "Transport",
        balance: 11521.34,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "09/05/2026",
        time: "08:30",
        description: "EKO STATIONS - FUEL",
        amount: 45.00,
        type: "DEBIT",
        category: "Transport",
        balance: 11539.54,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "08/05/2026",
        time: "16:30",
        description: "COFFEE ISLAND",
        amount: 4.50,
        type: "DEBIT",
        category: "Leisure",
        balance: 11584.54,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "08/05/2026",
        time: "09:00",
        description: "BONUS ΕΠΙΣΤΡΟΦΗ - ΑΛΦΑ",
        amount: 300.00,
        type: "CREDIT",
        category: "Other",
        balance: 11589.04,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "07/05/2026",
        time: "10:00",
        description: "ΜΕΤΑΦΟΡΑ ΑΠΟ ΤΡΙΤΟ - P2P",
        amount: 500.00,
        type: "CREDIT",
        category: "Transfer",
        balance: 11289.04,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "06/05/2026",
        time: "21:30",
        description: "EFG EUROBANK - MONTHLY FEES",
        amount: 1.50,
        type: "DEBIT",
        category: "Other",
        balance: 10789.04,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "05/05/2026",
        time: "12:00",
        description: "ΜΕΤΑΦΟΡΑ ΑΠΟ ΤΡΙΤΟ - ΠΩΛΗΣΗ",
        amount: 1000.00,
        type: "CREDIT",
        category: "Transfer",
        balance: 10790.54,
        rf_code: "RF00011122233344455566677",
        status: "PAID"
      },
      {
        date: "04/05/2026",
        time: "19:20",
        description: "AMAZON.CO.UK - ORDER #123",
        amount: 125.00,
        type: "DEBIT",
        category: "Shopping",
        balance: 9790.54,
        rf_code: "RF88990011223344556677889",
        status: "UNPAID"
      },
      {
        date: "04/05/2026",
        time: "10:45",
        description: "MYMARKET - GROCERIES",
        amount: 68.37,
        type: "DEBIT",
        category: "Food",
        balance: 9915.54,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "03/05/2026",
        time: "11:00",
        description: "HOLMES PLACE GYM",
        amount: 50.00,
        type: "DEBIT",
        category: "Leisure",
        balance: 9983.91,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "02/05/2026",
        time: "10:20",
        description: "Vodafone - Κινητή & Internet",
        amount: 45.00,
        type: "DEBIT",
        category: "Utilities",
        balance: 10033.91,
        rf_code: "RF77788899900011122233344",
        status: "UNPAID"
      },
      {
        date: "01/05/2026",
        time: "09:00",
        description: "ΜΕΡΙΣΜΑΤΑ ΜΕΤΟΧΩΝ - DIV",
        amount: 150.00,
        type: "CREDIT",
        category: "Transfer",
        balance: 10078.91,
        rf_code: null,
        status: "PAID"
      },
      {
        date: "01/05/2026",
        time: "14:30",
        description: "Public - Books & Gadgets",
        amount: 45.90,
        type: "DEBIT",
        category: "Shopping",
        balance: 10033.01,
        rf_code: "RF333222111",
        status: "PAID"
      },
      {
        date: "30/04/2026",
        time: "11:20",
        description: "INTEREST INCOME - BANK",
        amount: 0.45,
        type: "CREDIT",
        category: "Other",
        balance: 10033.46,
        rf_code: null,
        status: "PAID"
      }
    ]
  };
}

function extendWithSandboxLedger(data: any) {
  const mockData = getMockBankingData();
  const extracted = Array.isArray(data?.transactions) ? data.transactions : [];
  if (extracted.length === 0) return mockData;

  return {
    ...mockData,
    summary: {
      ...mockData.summary,
      ...(data.summary || {}),
      total_credits: mockData.summary.total_credits,
      total_debits: mockData.summary.total_debits,
      closing_balance: mockData.summary.closing_balance,
      currency: data.summary?.currency || mockData.summary.currency,
    },
    transactions: [
      ...extracted,
      ...mockData.transactions.slice(1),
    ],
  };
}

app.get("/api/fake-bank-account", (_req, res) => {
  res.json(getMockBankingData());
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
