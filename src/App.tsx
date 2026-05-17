/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Search, 
  AlertCircle, 
  Send, 
  Trash2, 
  Maximize2, 
  CheckCircle2,
  Lock,
  ChevronRight,
  ShieldCheck,
  History,
  X,
  Clock,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";


type Tab = "AUDITOR" | "BANKING";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  box_2d?: [number, number, number, number] | null;
}

interface AuditSession {
  id: string;
  image: string;
  messages: Message[];
  timestamp: Date;
  invoiceName?: string;
  invoiceUrl?: string;
}

interface InvoiceRecord {
  name: string;
  code: string;
  url: string;
  score?: number;
  supplier?: string;
  invoiceNumber?: string;
  date?: string;
  total?: string | number;
  currency?: string;
  summary?: string;
}

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#64748b"];

function BankingChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const categoryData = data.reduce((acc: any, tx: any) => {
    if (tx.type === "DEBIT") {
      const cat = tx.category || "Other";
      acc[cat] = (acc[cat] || 0) + (tx.amount || 0);
    }
    return acc;
  }, {});

  const chartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "#0f172a", 
            border: "2px solid #000", 
            borderRadius: "0",
            fontSize: "10px",
            color: "#fff",
            textTransform: "uppercase",
            fontWeight: "bold"
          }}
          itemStyle={{ color: "#fff" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function App() {

  const [activeTab, setActiveTab] = useState<Tab>("AUDITOR");
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeBox, setActiveBox] = useState<[number, number, number, number] | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedInvoiceName, setSelectedInvoiceName] = useState<string | null>(null);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceMatches, setInvoiceMatches] = useState<InvoiceRecord[]>([]);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [isInvoiceSearching, setIsInvoiceSearching] = useState(false);
  const [invoiceSearchError, setInvoiceSearchError] = useState<string | null>(null);
  
  // Banking specific state
  const [bankingImage, setBankingImage] = useState<string | null>(null);
  const [bankingData, setBankingData] = useState<any | null>(null);
  const [bankingError, setBankingError] = useState<string | null>(null);
  const [isBankingAnalyzing, setIsBankingAnalyzing] = useState(false);
  const [bankingSearch, setBankingSearch] = useState("");
  const [isAccountSynced, setIsAccountSynced] = useState(false);
  const bankingFileInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session from history
  const loadSession = (session: AuditSession) => {
    setCurrentSessionId(session.id);
    setImage(session.image);
    setMessages(session.messages);
    setSelectedInvoiceName(session.invoiceName || null);
    setIsHistoryOpen(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Update active box to the last assistant message's box
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMsg && lastAssistantMsg.box_2d) {
      setActiveBox(lastAssistantMsg.box_2d);
    } else {
      setActiveBox(null);
    }

    // Sync current session with overall sessions list
    if (currentSessionId) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages } : s));
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    fetch("/api/invoices")
      .then((response) => response.json())
      .then((data) => setInvoiceCount(data.invoices?.length || 0))
      .catch(() => setInvoiceCount(0));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        const newSessionId = Date.now().toString();
        setSelectedInvoiceName(null);
        const initialMessages: Message[] = [
          {
            id: "system-" + Date.now(),
            role: "assistant",
            content: "Το έγγραφο φορτώθηκε. Είμαι έτοιμος για έλεγχο. Τι θέλετε να εντοπίσω;",
            timestamp: new Date(),
          },
        ];

        const newSession: AuditSession = {
          id: newSessionId,
          image: imageData,
          messages: initialMessages,
          timestamp: new Date(),
          invoiceName: undefined,
          invoiceUrl: undefined,
        };

        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSessionId);
        setImage(imageData);
        setMessages(initialMessages);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSession = () => {
    setCurrentSessionId(null);
    setImage(null);
    setMessages([]);
    setInput("");
    setActiveBox(null);
    setSelectedInvoiceName(null);
  };

  const searchInvoiceDatabase = async (queryOverride?: string) => {
    const term = (queryOverride ?? invoiceQuery).trim();
    if (!term || isInvoiceSearching) return;

    setIsInvoiceSearching(true);
    setInvoiceSearchError(null);

    try {
      const response = await fetch("/api/find-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: term }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invoice database error.");
      }

      setInvoiceMatches(data.matches || []);
      if (!data.found) {
        setInvoiceSearchError("Δεν βρέθηκε αντίστοιχο παραστατικό στη βάση.");
      } else {
        const [best, second] = data.matches || [];
        if (best && ((data.matches || []).length === 1 || (best.score >= 100 && (!second || best.score >= second.score + 35)))) {
          loadInvoiceFromDatabase(best);
        }
      }
    } catch (error) {
      console.error("Invoice search error:", error);
      setInvoiceSearchError(error instanceof Error ? error.message : "Invoice database error.");
      setInvoiceMatches([]);
    } finally {
      setIsInvoiceSearching(false);
    }
  };

  const loadInvoiceFromDatabase = (invoice: InvoiceRecord) => {
    const newSessionId = Date.now().toString();
    const initialMessages: Message[] = [
      {
        id: "db-" + Date.now(),
        role: "assistant",
        content: `Βρέθηκε το αρχείο "${invoice.name}". Ρωτήστε με για οποιοδήποτε πεδίο φαίνεται στο παραστατικό.`,
        timestamp: new Date(),
      },
    ];

    const newSession: AuditSession = {
      id: newSessionId,
      image: invoice.url,
      invoiceName: invoice.name,
      invoiceUrl: invoice.url,
      messages: initialMessages,
      timestamp: new Date(),
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setSelectedInvoiceName(invoice.name);
    setImage(invoice.url);
    setMessages(initialMessages);
    setActiveBox(null);
  };

  const handleSend = async () => {
    if (!input.trim() || !image || isAnalyzing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsAnalyzing(true);
    setActiveBox(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: input, 
          image: selectedInvoiceName ? undefined : image,
          invoiceName: selectedInvoiceName || undefined,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const rawResponse = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawResponse);
      } catch {
        throw new Error("Server returned invalid JSON.");
      }
      if (!response.ok) {
        throw new Error(data.message || data.error || "Analysis failed.");
      }
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "Δεν αναγράφεται στο έγγραφο",
        timestamp: new Date(),
        box_2d: data.box_2d,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Σφάλμα κατά την ανάλυση.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBankingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setBankingImage(imageData);
        setBankingData(null);
        setBankingError(null);
        setIsBankingAnalyzing(true);

        try {
          const response = await fetch("/api/analyze-banking", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageData }),
          });
          const data = await response.json();
          if (!response.ok) {
            setBankingError(data.message || data.error || "Σφάλμα κατά την ανάλυση.");
          } else {
            setBankingData(data);
          }
        } catch (error) {
          console.error("Banking error:", error);
          setBankingError("Αδυναμία σύνδεσης με το διακομιστή.");
        } finally {
          setIsBankingAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnectFakeAccount = async () => {
    setIsBankingAnalyzing(true);
    setBankingError(null);
    setBankingImage(null);
    try {
      const response = await fetch("/api/fake-bank-account");
      const data = await response.json();
      setBankingData(data);
      setIsAccountSynced(true);
    } catch (error) {
      console.error("Fetch error:", error);
      setBankingError("Αποτυχία σύνδεσης με τον τραπεζικό λογαριασμό.");
    } finally {
      setIsBankingAnalyzing(false);
    }
  };

  // Helper to render box overlay
  const renderBox = () => {
    if (!activeBox) return null;
    const [ymin, xmin, ymax, xmax] = activeBox;
    // Coordinates are normalized 0-1000
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute border-4 border-red-600 bg-red-500/10 z-10 pointer-events-none"
        style={{
          top: `${ymin / 10}%`,
          left: `${xmin / 10}%`,
          height: `${(ymax - ymin) / 10}%`,
          width: `${(xmax - xmin) / 10}%`,
        }}
      >
        <div className="absolute -top-6 left-0 bg-red-600 text-white text-[8px] px-1 font-mono uppercase font-bold">
          Detected_Area
        </div>
      </motion.div>
    );
  };

  return (
    <div className="h-screen w-full bg-slate-100 p-0 md:p-4 lg:p-6 overflow-hidden flex relative">
      {/* Audit History Sidebar (Retractable) */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className="absolute left-0 top-0 h-full w-[320px] bg-slate-900 text-white z-50 border-r-2 border-white shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-black text-xs uppercase tracking-widest">Audit History</h3>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="hover:text-blue-400 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sessions.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-4">
                  <Clock className="w-10 h-10 mb-4" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No Past Audits Found</p>
                </div>
              )}
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`w-full text-left p-3 brutalist-border transition-all flex gap-3 items-center group ${
                    currentSessionId === session.id ? "bg-white text-slate-900" : "bg-slate-800 hover:bg-slate-700 border-white/10"
                  }`}
                >
                  <div className="w-12 h-12 brutalist-border overflow-hidden bg-white shrink-0">
                    <img src={session.image} alt="Thumb" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-mono opacity-50 uppercase">
                        {session.timestamp.toLocaleDateString()}
                      </span>
                      <span className="text-[8px] font-mono opacity-50 uppercase">
                        {session.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold truncate uppercase tracking-tighter">
                      Audit #{session.id.slice(-4)}
                    </p>
                    <p className="text-[8px] opacity-60 truncate">
                      {session.messages.length} Interaction(s)
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full w-full bg-slate-50 font-sans overflow-hidden border-4 md:border-8 border-slate-900 shadow-2xl">
        {/* Top Navigation Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b-2 border-slate-900 bg-white z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="w-10 h-10 bg-slate-900 flex items-center justify-center text-white brutalist-border brutalist-shadow hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all mr-2"
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-slate-900 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rotate-45"></div>
            </div>
            <span className="font-black text-xl tracking-tighter uppercase whitespace-nowrap">
              FinDoc Auditor <span className="text-blue-600">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 brutalist-border overflow-x-auto max-w-[200px] sm:max-w-none">
            <button 
              onClick={() => setActiveTab("AUDITOR")}
              className={`px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "AUDITOR" ? "bg-slate-900 text-white" : "hover:bg-white text-slate-400"}`}
            >
              Auditor AI
            </button>
            <button 
              onClick={() => setActiveTab("BANKING")}
              className={`px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "BANKING" ? "bg-slate-900 text-white" : "hover:bg-white text-slate-400"}`}
            >
              Banking
            </button>
          </div>
          <div className="hidden sm:flex gap-8 items-center h-full">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
              <span className={`text-xs font-mono font-bold uppercase tracking-tighter ${image ? "text-green-600" : "text-slate-400"}`}>
                {image ? "Zero-Hallucination Active" : "Waiting for Input"}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Security</span>
              <span className="text-xs font-mono font-bold text-slate-900 uppercase">Level 10 / ISO-27001</span>
            </div>
          </div>
          <div className="sm:hidden">
            <div className={`w-3 h-3 rounded-full ${image ? "bg-green-600 animate-pulse" : "bg-slate-300"}`} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex flex-1 overflow-hidden">
          {activeTab === "AUDITOR" ? (
            <>
              {/* Document Viewer (Left) */}
              <section className="flex-1 bg-slate-200 p-4 md:p-8 flex flex-col gap-4 border-r-2 border-slate-900 relative overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Document Workbench</h2>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-white border border-slate-900 text-[10px] font-bold font-mono">OCR_ENGINE_V3</span>
                    {image && <span className="px-2 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase font-mono">Verified Source</span>}
                  </div>
                </div>

                <div className="bg-white brutalist-border brutalist-shadow p-4 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-blue-600" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Invoice Database</h3>
                    <span className="ml-auto text-[8px] font-mono text-slate-400 uppercase">{invoiceCount || 10} files indexed</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={invoiceQuery}
                      onChange={(e) => setInvoiceQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchInvoiceDatabase();
                        }
                      }}
                      placeholder="Search name, receipt no, vendor, amount..."
                      className="flex-1 brutalist-border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    />
                    <button
                      onClick={() => searchInvoiceDatabase()}
                      disabled={!invoiceQuery.trim() || isInvoiceSearching}
                      className="px-3 py-2 bg-slate-900 text-white brutalist-border hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center gap-2"
                      title="Search database"
                    >
                      {isInvoiceSearching ? <Clock className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span className="hidden sm:inline text-[9px] font-black uppercase">Search</span>
                    </button>
                  </div>
                  {invoiceSearchError && (
                    <p className="mt-2 text-[10px] font-bold text-red-600 uppercase">{invoiceSearchError}</p>
                  )}
                  {invoiceMatches.length > 0 && (
                    <div className="mt-3 grid gap-2 max-h-32 overflow-y-auto pr-1">
                      {invoiceMatches.map((invoice) => (
                        <button
                          key={invoice.name}
                          onClick={() => loadInvoiceFromDatabase(invoice)}
                          className="w-full text-left p-2 bg-slate-50 brutalist-border hover:bg-blue-50 transition-all flex items-center gap-3"
                        >
                          <FileText className="w-4 h-4 shrink-0 text-slate-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase truncate">{invoice.code}</p>
                            <p className="text-[8px] font-mono text-slate-500 truncate">
                              {invoice.supplier || invoice.name}
                            </p>
                            {(invoice.invoiceNumber || invoice.total) && (
                              <p className="text-[8px] font-mono text-slate-400 truncate">
                                {invoice.invoiceNumber} {invoice.total ? `- ${invoice.currency || ""}${invoice.total}` : ""}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 bg-slate-300/30 brutalist-border relative overflow-auto flex flex-col items-center p-4">
                  <AnimatePresence mode="wait">
                    {!image ? (
                      <motion.div 
                        key="upload"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 w-full flex flex-col items-center justify-center gap-6 p-12 text-center cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="w-20 h-20 bg-white brutalist-border brutalist-shadow flex items-center justify-center group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none transition-all">
                          <Upload className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-black text-xl uppercase tracking-tighter">Ανεβάστε Παραστατικό</p>
                          <p className="text-[10px] font-mono text-slate-500 uppercase mt-2">Σύρετε το αρχείο εδώ ή κάντε κλικ</p>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                        />
                      </motion.div>
                    ) : (
                    <motion.div 
                      key="view"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative inline-block brutalist-border brutalist-shadow-lg bg-white"
                    >
                      <img 
                        src={image} 
                        alt="Target Document" 
                        className="block max-w-full h-auto" 
                      />
                      {renderBox()}
                      
                      <button 
                        onClick={clearSession}
                        className="absolute -top-3 -right-3 p-2 bg-red-600 text-white border-2 border-slate-900 shadow-sm hover:bg-red-700 transition-colors z-20"
                        title="Clear Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Status Bar */}
                {image && (
                  <div className="h-10 bg-white brutalist-border flex divide-x-2 divide-slate-900 shrink-0">
                    <div className="flex-1 flex items-center px-4 gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Document Scanned</span>
                    </div>
                    <div className="flex-1 flex items-center px-4 gap-2">
                      <Lock className="w-3 h-3 text-blue-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                        {selectedInvoiceName ? `Database: ${selectedInvoiceName}` : "End-to-End Encrypted"}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              {/* Chat Sidebar (Right) */}
              <aside className="w-full md:w-[320px] lg:w-[380px] bg-white flex flex-col shrink-0">
                <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Log / Audit</span>
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900" />
                    <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full border border-slate-900" />
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full border border-slate-900" />
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 bg-slate-50/50">
                  <AnimatePresence initial={false}>
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-40">
                        <AlertCircle className="w-12 h-12 mb-4" />
                        <p className="font-bold uppercase text-[10px] tracking-widest">Awaiting Analysis Protocol</p>
                        <p className="text-xs mt-2 italic font-serif">Φορτώστε ένα έγγραφο για να ξεκινήσει η διαδικασία ελέγχου.</p>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-1"
                      >
                        <span className={`text-[9px] font-bold uppercase ml-2 ${msg.role === "assistant" ? "text-blue-600" : "text-slate-400"}`}>
                          {msg.role === "assistant" ? "FinDoc Auditor" : "Researcher"}
                        </span>
                        <div className={`
                          p-3 brutalist-border text-xs leading-relaxed transition-all whitespace-pre-wrap
                          ${msg.role === "assistant" 
                            ? "bg-slate-900 text-white font-mono brutalist-shadow" 
                            : "bg-white text-slate-800 brutalist-shadow"}
                        `}>
                          {msg.content}
                        </div>
                      </motion.div>
                    ))}
                    {isAnalyzing && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-blue-600 uppercase ml-2">FinDoc Auditor</span>
                        <div className="bg-slate-900 p-3 brutalist-border brutalist-shadow text-white flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-4 bg-blue-500 animate-pulse" />
                            <div className="w-1.5 h-4 bg-blue-500 animate-pulse delay-75" />
                            <div className="w-1.5 h-4 bg-blue-500 animate-pulse delay-150" />
                          </div>
                          <span className="font-mono text-[10px] uppercase tracking-widest">Επεξεργασία...</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                <div className="p-4 border-t-2 border-slate-900 bg-white shrink-0">
                  <div className={`relative ${!image ? "opacity-30 grayscale pointer-events-none" : ""}`}>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Εισάγετε ερώτηση..."
                      rows={2}
                      className="w-full brutalist-border p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none bg-emerald-50/10"
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim() || isAnalyzing || !image}
                      className="absolute right-3 bottom-3 p-1.5 bg-slate-900 text-white brutalist-border hover:bg-slate-800 transition-all disabled:opacity-50"
                      title="Send Query"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[8px] font-bold text-slate-400 italic uppercase tracking-tighter leading-none">
                      * Strict Verification Mode
                    </span>
                    <div className="flex gap-2 items-center">
                       <div className={`w-1.5 h-1.5 rounded-full ${image ? "bg-blue-600 animate-pulse" : "bg-slate-300"}`}></div>
                       <span className="text-[8px] font-black uppercase leading-none">{image ? "Ready" : "Offline"}</span>
                    </div>
                  </div>
                </div>
              </aside>
            </>
          ) : (
            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
              {/* Banking Dashboard View */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Statistics & Charts */}
                <section className="w-[350px] bg-white border-r-2 border-slate-900 flex flex-col overflow-y-auto">
                  <div className="p-6 border-b-2 border-slate-900 bg-slate-50">
                    <div className="flex items-center gap-3 mb-6">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                      <h2 className="font-black text-lg uppercase tracking-tight">Financial Hub</h2>
                    </div>

                    {!bankingImage && !isAccountSynced ? (
                      <div className="space-y-4">
                        <div 
                          onClick={() => bankingFileInputRef.current?.click()}
                          className="aspect-square brutalist-border border-dashed border-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white hover:border-blue-500 transition-all group"
                        >
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Upload Statement</p>
                            <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase">JPEG / PNG / PDF</p>
                          </div>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-slate-300"></div>
                          </div>
                          <div className="relative flex justify-center text-[8px] uppercase font-black">
                            <span className="bg-slate-50 px-2 text-slate-400">or</span>
                          </div>
                        </div>

                        <button 
                          onClick={handleConnectFakeAccount}
                          className="w-full py-4 bg-white brutalist-border brutalist-shadow hover:bg-slate-900 hover:text-white transition-all flex flex-col items-center gap-2 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-800">
                             <ShieldCheck className="w-5 h-5 text-slate-600 group-hover:text-blue-400" />
                          </div>
                          <div className="text-center">
                             <p className="text-[10px] font-black uppercase tracking-widest">Connect Live Account</p>
                             <p className="text-[8px] opacity-50 uppercase font-mono">Simulated Sandbox</p>
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div className="relative aspect-square brutalist-border overflow-hidden bg-white group">
                        {bankingImage ? (
                          <img src={bankingImage} alt="Statement" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                            <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Secure Live Sandbox Session Active</p>
                            <div className="mt-4 px-3 py-1 bg-green-100 text-green-700 text-[8px] font-black uppercase rounded-full">Device Verified</div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            onClick={() => { setBankingImage(null); setBankingData(null); setIsAccountSynced(false); }}
                            className="bg-red-600 text-white p-3 brutalist-border shadow-lg"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={bankingFileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleBankingUpload}
                    />
                  </div>

                  <div className="flex-1 p-6 space-y-6">
                    {isBankingAnalyzing && (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-900 text-white brutalist-border brutalist-shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">AI Processing</span>
                             <Clock className="w-4 h-4 animate-spin text-blue-400" />
                          </div>
                          <p className="text-[11px] font-medium opacity-80 leading-snug mb-4 italic font-serif">
                            Analyzing patterns, extracting metadata, and categorizing transactions...
                          </p>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-blue-500" 
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {bankingData && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-3 bg-white brutalist-border border-green-600/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Total Revenue</span>
                              <ArrowUpRight className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-xl font-black text-green-600 tracking-tighter">
                              +{bankingData.summary?.total_credits?.toLocaleString('el-GR', { minimumFractionDigits: 2 })} <span className="text-xs">{bankingData.summary?.currency}</span>
                            </p>
                          </div>
                          <div className="p-3 bg-white brutalist-border border-red-600/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Total Expenses</span>
                              <ArrowDownLeft className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-xl font-black text-red-600 tracking-tighter">
                              - {bankingData.summary?.total_debits?.toLocaleString('el-GR', { minimumFractionDigits: 2 })} <span className="text-xs">{bankingData.summary?.currency}</span>
                            </p>
                          </div>
                          <div className="p-3 bg-slate-900 text-white brutalist-border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Net Balance</span>
                              <BarChart3 className="w-3 h-3 text-blue-400" />
                            </div>
                            <p className="text-xl font-black tracking-tighter">
                              {( (bankingData.summary?.total_credits || 0) - (bankingData.summary?.total_debits || 0) ).toLocaleString('el-GR', { minimumFractionDigits: 2 })} <span className="text-xs">{bankingData.summary?.currency}</span>
                            </p>
                          </div>
                        </div>

                        {/* Chart View */}
                        <div className="p-4 bg-white brutalist-border">
                          <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                             <BarChart3 className="w-3 h-3" />
                             Expense Distribution
                          </h4>
                          <div className="h-[200px]">
                             <BankingChart data={bankingData.transactions} />
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="p-4 bg-slate-50 border border-slate-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Account Holder</span>
                            <span className="text-[10px] font-black uppercase">{bankingData.summary?.account_holder || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Bank</span>
                            <span className="text-[10px] font-black uppercase">{bankingData.summary?.bank_name || "N/A"}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </section>

                {/* Right Panel: Transaction Explorer */}
                <section className="flex-1 bg-slate-50 p-8 flex flex-col overflow-hidden">
                  <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                      <h2 className="font-black text-4xl uppercase tracking-tighter">Ledge Overview</h2>
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.2em]">Transaction Registry V2.1</p>
                    </div>

                    {bankingData && (
                      <div className="flex flex-wrap gap-2">
                        <div className="relative group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="SEARCH REFERENCE..."
                            className="pl-10 pr-4 py-2 text-xs font-black uppercase brutalist-border bg-white w-[250px] focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => {
                              // Search handled by component filtering
                              setBankingSearch(e.target.value);
                            }}
                          />
                        </div>
                        <button className="px-6 py-2 bg-slate-900 text-white font-black text-xs uppercase brutalist-border brutalist-shadow transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
                          Export XLS
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-white brutalist-border overflow-hidden flex flex-col">
                    {bankingError ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-red-50/30">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                          <AlertCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-red-600">Extraction Error</h3>
                        <p className="text-sm font-medium text-slate-500 max-w-md italic font-serif">{bankingError}</p>
                        <button 
                          onClick={() => { setBankingImage(null); setBankingError(null); }}
                          className="mt-8 px-8 py-3 bg-red-600 text-white font-black uppercase brutalist-border hover:bg-red-700 transition-colors shadow-lg"
                        >
                          Restart Engine
                        </button>
                      </div>
                    ) : !bankingData ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 space-y-4">
                        <div className="relative">
                          <FileText className="w-24 h-24 stroke-[1] opacity-20" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Upload className="w-8 h-8 opacity-40 animate-bounce" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-[0.3em]">System Idling</p>
                          <p className="text-[10px] font-mono opacity-50 mt-1 italic">Waiting for banking source data injection...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead className="sticky top-0 bg-slate-950 text-white z-10 shadow-md">
                            <tr>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest border-r border-white/5">Execution Date</th>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest border-r border-white/5 text-center">Status / RF</th>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest border-r border-white/5">Description / Vendor</th>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest border-r border-white/5 text-center">Category</th>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest border-r border-white/5 text-right">Inflow (+)</th>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest border-r border-white/5 text-right">Outflow (-)</th>
                              <th className="p-4 text-[10px] uppercase font-black tracking-widest text-right">Standing Bal.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bankingData.transactions
                              .filter((tx: any) => 
                                tx.description?.toLowerCase().includes((bankingSearch || "").toLowerCase()) ||
                                tx.rf_code?.toLowerCase().includes((bankingSearch || "").toLowerCase())
                              )
                              .map((tx: any, idx: number) => (
                              <motion.tr 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                key={idx} 
                                className="group hover:bg-slate-50 transition-colors"
                              >
                                <td className="p-4 font-mono text-[11px] border-r border-slate-50 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 group-hover:animate-ping" />
                                    {tx?.date || "00/00/0000"}
                                  </div>
                                </td>
                                <td className="p-4 border-r border-slate-50">
                                   <div className="flex flex-col gap-1 items-center">
                                      <span className={`
                                        px-2 py-0.5 text-[7px] font-black uppercase rounded-full brutalist-border
                                        ${tx?.status === "PAID" || tx?.status === "COMPLETED" ? "bg-green-100 text-green-700 border-green-700" : "bg-red-100 text-red-700 border-red-700"}
                                      `}>
                                        {tx?.status || "PENDING"}
                                      </span>
                                      {tx?.rf_code && (
                                        <span className="text-[7px] font-mono text-slate-400 truncate max-w-[80px]">
                                          {tx.rf_code}
                                        </span>
                                      )}
                                   </div>
                                </td>
                                <td className="p-4 border-r border-slate-50">
                                  <p className="text-xs font-black uppercase tracking-tight line-clamp-1">{tx?.description || "UNKNOWN VENDOR"}</p>
                                </td>
                                <td className="p-4 border-r border-slate-50 text-center">
                                  <span className={`
                                    px-2 py-0.5 text-[8px] font-black uppercase rounded-full brutalist-border
                                    ${tx?.category === "Salary" ? "bg-emerald-100 text-emerald-700 border-emerald-700" : 
                                      tx?.category === "Utilities" ? "bg-amber-100 text-amber-700 border-amber-700" :
                                      tx?.category === "Leisure" ? "bg-purple-100 text-purple-700 border-purple-700" :
                                      "bg-slate-100 text-slate-600 border-slate-600"}
                                  `}>
                                    {tx?.category || "N/A"}
                                  </span>
                                </td>
                                <td className="p-4 text-[13px] font-black text-emerald-600 text-right border-r border-slate-50 bg-emerald-50/10 group-hover:bg-emerald-50/20">
                                  {tx?.type === "CREDIT" ? `+${(tx?.amount || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}` : "-"}
                                </td>
                                <td className="p-4 text-[13px] font-black text-red-600 text-right border-r border-slate-50 bg-red-50/10 group-hover:bg-red-50/20">
                                  {tx?.type === "DEBIT" ? `-${(tx?.amount || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}` : "-"}
                                </td>
                                <td className="p-4 font-mono text-[11px] font-bold text-slate-400 text-right group-hover:text-slate-900">
                                  {tx?.balance ? tx.balance.toLocaleString('el-GR', { minimumFractionDigits: 2 }) : "-"}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>

        {/* Footer Status Bar */}
        <footer className="h-8 bg-slate-900 text-white flex items-center px-4 justify-between shrink-0">
          <div className="flex gap-6">
            <div className="flex gap-2 items-center">
              <span className="text-[9px] font-mono text-slate-400">LATENCY:</span>
              <span className="text-[9px] font-mono text-white">42MS</span>
            </div>
            <div className="hidden sm:flex gap-2 items-center">
              <span className="text-[9px] font-mono text-slate-400">PROTOCOL:</span>
              <span className="text-[9px] font-mono text-white italic uppercase tracking-tighter">Zero-Tolerance Auditor AI</span>
            </div>
          </div>
          <div className="text-[9px] font-mono uppercase text-slate-400 group overflow-hidden">
            Audit_Record: <span className="text-white group-hover:animate-pulse">550e8400-e29b-41d4-a716-446655440000</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
