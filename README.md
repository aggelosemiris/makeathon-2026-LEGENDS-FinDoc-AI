# makeathon-2026-LEGENDS-FinDoc-AI

## Περιγραφή Project

Το **FinDoc Auditor AI** είναι μια web εφαρμογή για αναζήτηση, προβολή και έλεγχο οικονομικών παραστατικών. Ο χρήστης μπορεί να αναζητήσει ένα receipt/invoice από μια επιλεγμένη βάση αρχείων, να εμφανίσει το ακριβές παραστατικό στη βασική οθόνη και να κάνει ερωτήσεις σε AI auditor για τα στοιχεία που φαίνονται πάνω στο έγγραφο.

### Challenge που επιλέχθηκε

Επιλέχθηκε challenge σχετικό με **Financial Document Auditing / AI-powered invoice and receipt analysis**.

### Πρόβλημα που επιλύεται

Σε πραγματικές διαδικασίες οικονομικού ελέγχου, τα παραστατικά συχνά είναι σκαναρισμένα, έχουν χαμηλή ποιότητα εικόνας και περιέχουν κρίσιμες πληροφορίες όπως ποσά, ημερομηνίες, φόρους, προμηθευτές και αριθμούς τιμολογίων. Η χειροκίνητη αναζήτηση και επαλήθευση αυτών των στοιχείων είναι αργή και επιρρεπής σε λάθη.

Η εφαρμογή λύνει το πρόβλημα με:

- Αναζήτηση παραστατικών με βάση filename, προμηθευτή, αριθμό απόδειξης/τιμολογίου, ημερομηνία, ποσό ή περιεχόμενο.
- Αυτόματη εμφάνιση του σωστού εγγράφου όταν υπάρχει μοναδικό αποτέλεσμα.
- Chat με AI auditor που απαντά μόνο βάσει του ορατού περιεχομένου του παραστατικού.
- Αυστηρή λογική απαντήσεων για αποφυγή hallucinations.
- Υποστήριξη επισήμανσης περιοχής (`box_2d`) όταν το AI επιστρέφει συντεταγμένες.

## Τεχνολογίες

### Γλώσσες Προγραμματισμού

- **TypeScript**
- **JavaScript**
- **HTML**
- **CSS**

### Βιβλιοθήκες και Frameworks

- **React 19** για το frontend.
- **Vite** για development server και production build.
- **Express** για το backend API.
- **Google GenAI SDK (`@google/genai`)** για σύνδεση με Gemini.
- **Tailwind CSS / utility-first styling** για το UI.
- **Lucide React** για icons.
- **Motion** για transitions και UI animations.
- **Recharts** για banking/financial visualizations.
- **dotenv** για διαχείριση environment variables.
- **esbuild** για bundling του backend server.

## Οδηγίες Εκτέλεσης

### Προαπαιτούμενα

- Node.js
- npm
- Gemini API key

### Βήματα Εγκατάστασης

1. Κλωνοποιήστε το repository:

   ```bash
   git clone https://github.com/aggelosemiris/makeathon-2026-LEGENDS-FinDoc-AI.git
   cd makeathon-2026-LEGENDS-FinDoc-AI
   ```

2. Εγκαταστήστε τα dependencies:

   ```bash
   npm install
   ```

3. Δημιουργήστε αρχείο `.env.local` με βάση το `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

4. Συμπληρώστε το API key στο `.env.local`.

### Εκτέλεση σε Development Mode

```bash
npm run dev
```

Η εφαρμογή ξεκινάει τοπικά στο port που έχει οριστεί στο `.env.local`. Αν δεν οριστεί port, χρησιμοποιείται η προεπιλογή του project.

### Production Build

```bash
npm run build
```

### Εκτέλεση Production Build

```bash
npm run start
```

## Deployment σε Render

Το project είναι έτοιμο για deployment ως Render Web Service μέσω του αρχείου `render.yaml`.

### Βήματα στο Render

1. Ανοίξτε το Render Dashboard.
2. Επιλέξτε **New +** και μετά **Blueprint** ή **Web Service**.
3. Συνδέστε το GitHub repository:

   ```text
   https://github.com/aggelosemiris/makeathon-2026-LEGENDS-FinDoc-AI
   ```

4. Αν χρησιμοποιήσετε Blueprint, το Render θα διαβάσει αυτόματα το `render.yaml`.
5. Αν το στήσετε χειροκίνητα ως Web Service, χρησιμοποιήστε:

   ```text
   Runtime: Node
   Branch: main
   Build Command: npm ci && npm run build
   Start Command: npm run start
   ```

6. Στα Environment Variables προσθέστε:

   ```text
   GEMINI_API_KEY=your_api_key_here
   NODE_ENV=production
   ```

Το backend χρησιμοποιεί `process.env.PORT`, οπότε είναι συμβατό με το port που ορίζει αυτόματα το Render.

Μετά το deploy, το Render δίνει μόνιμο public URL τύπου:

```text
https://your-service-name.onrender.com
```

Σημείωση: στο free plan το service μπορεί να κάνει sleep όταν δεν χρησιμοποιείται. Για πάντα ενεργό service χρειάζεται paid instance ή custom setup.

## Deployment σε Railway

Το project είναι επίσης έτοιμο για deployment στο Railway μέσω GitHub repository. Το αρχείο `railway.json` ορίζει:

- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Healthcheck endpoint: `/api/invoices`

### Βήματα στο Railway

1. Ανοίξτε το Railway Dashboard.
2. Επιλέξτε **New Project**.
3. Επιλέξτε **Deploy from GitHub repo**.
4. Διαλέξτε το repository:

   ```text
   aggelosemiris/makeathon-2026-LEGENDS-FinDoc-AI
   ```

5. Στο service, ανοίξτε την καρτέλα **Variables**.
6. Προσθέστε:

   ```text
   GEMINI_API_KEY=your_api_key_here
   NODE_ENV=production
   ```

7. Κάντε deploy.
8. Από τα settings/networking του service, δημιουργήστε public domain για να πάρετε URL τύπου:

   ```text
   https://your-service.up.railway.app
   ```

Σημαντικό: Το `GEMINI_API_KEY` μπαίνει μόνο στα Variables του Railway και ποτέ μέσα στον κώδικα ή στο GitHub.

### Type Check

```bash
npm run lint
```

## Διαχείριση API

Η εφαρμογή χρησιμοποιεί Gemini μέσω του πακέτου `@google/genai`.

1. Δημιουργήστε Gemini API key από το Google AI Studio.
2. Δημιουργήστε αρχείο `.env.local`.
3. Προσθέστε:

   ```env
   GEMINI_API_KEY=your_api_key_here
   PORT=3001
   ```

Σημαντικό:

- Το `.env.local` δεν πρέπει να γίνει commit.
- Το `.env.example` υπάρχει μόνο ως template.
- Αν αλλάξει το API key, ενημερώνεται μόνο το `.env.local`.

## Βασική Δομή Project

```text
.
├── data/
│   └── active-invoice-index.json
├── public/
│   └── invoices/
├── src/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── server.ts
├── package.json
├── vite.config.ts
└── README.md
```

### Κύρια Αρχεία

- `src/App.tsx`: κύριο frontend UI, αναζήτηση εγγράφων, προβολή εικόνας και chat.
- `server.ts`: Express backend, API endpoints, Gemini integration και static serving των invoices.
- `data/active-invoice-index.json`: ενεργό searchable index των receipts.
- `public/invoices/`: τα receipt images που χρησιμοποιούνται από το demo dataset.

## Παρουσίαση

### Demo

Repository:

```text
https://github.com/aggelosemiris/makeathon-2026-LEGENDS-FinDoc-AI
```

Live demo link, αν είναι ενεργό το προσωρινό tunnel:

```text
https://gap-chronicle-superior-rhode.trycloudflare.com
```

Σημείωση: Το Cloudflare quick tunnel είναι προσωρινό και μπορεί να αλλάξει ή να λήξει.

### Ενδεικτική Ροή Χρήσης

1. Ο χρήστης ανοίγει την εφαρμογή.
2. Πληκτρολογεί αναζήτηση όπως:

   ```text
   McDonald 26.60
   ```

3. Η εφαρμογή βρίσκει το σωστό receipt.
4. Το έγγραφο εμφανίζεται στο Document Workbench.
5. Ο χρήστης κάνει ερώτηση στο chat, όπως:

   ```text
   Ποιο είναι το συνολικό ποσό;
   ```

6. Το AI απαντά βάσει του ορατού περιεχομένου του παραστατικού.

### Screenshots / Video

Μπορούν να προστεθούν screenshots ή video demo στον φάκελο `docs/` ή ως εξωτερικό link στο README.

Προτεινόμενα screenshots:

- Αρχική οθόνη με search bar.
- Αποτέλεσμα αναζήτησης και προβολή receipt.
- Chat απάντηση του auditor.
- Παράδειγμα document highlight με `box_2d`, όπου υπάρχει.

## Καλές Πρακτικές Ανάπτυξης

### Commits

Συστήνεται χρήση συχνών και μικρών commits, ώστε κάθε αλλαγή να έχει ξεκάθαρο σκοπό.

Παραδείγματα καλών commit messages:

```text
Add active invoice search index
Improve receipt search matching
Update auditor prompt handling
Polish README documentation
```

### Branches

Προτεινόμενη ροή ανάπτυξης:

- `main`: σταθερή έκδοση.
- `dev`: συγκεντρωτική ανάπτυξη πριν το merge στο main.
- `feature/search-index`: αλλαγές στην αναζήτηση.
- `feature/auditor-chat`: αλλαγές στο AI chat.
- `fix/api-errors`: διορθώσεις backend/API.

### Pull Requests

Πριν γίνει merge:

- Να τρέχει `npm run lint`.
- Να τρέχει `npm run build`.
- Να ελέγχεται ότι δεν περιλαμβάνονται `.env.local`, logs ή περιττά generated files.

### Αποφυγή Μεγάλων Αρχείων

Το repository κρατά μόνο τα απαραίτητα demo receipts. Για μεγαλύτερα datasets προτείνεται χρήση εξωτερικού storage και προσθήκη link στο README αντί για απευθείας upload στο GitHub.

Αρχεία που δεν πρέπει να γίνονται commit:

- `node_modules/`
- `dist/`
- `.env.local`
- logs
- προσωρινά folders
- μεγάλα datasets

## Ομάδα

**LEGENDS**

## Άδεια

Το project δημιουργήθηκε για makeathon/challenge σκοπούς.
