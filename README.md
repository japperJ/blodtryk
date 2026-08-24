# 🩺 Blodtryk

Danish blood pressure tracking app with AI-powered OCR. Photograph your blood pressure monitor and let AI read the numbers automatically.

## Screenshots

| Trends | Readings |
|--------|----------|
| ![Trends screen with daily/weekly averages and classification of readings](docs/screenshots/trends.png) | ![Readings screen with color-coded measurement history](docs/screenshots/readings.png) |

## Features

- **📷 Camera Scan** — Point your phone camera at a blood pressure monitor, AI reads the values
- **📁 Batch Upload** — Upload multiple photos at once for batch processing
- **👤 Multi-User** — Track blood pressure for multiple family members
- **📊 Age-Adjusted Classification** — BP status adapts based on age (ESH/ESC guidelines)
- **📄 PDF Export** — Generate professional reports with color-coded status
- **📈 Trends** — Charts of systolic/diastolic/pulse over time
- **💊 Medications** — Track medications per person alongside readings
- **🔔 Daily Reminder** — Browser notification when it is time to measure
- **✏️ Manual Editing** — Correct or enter readings by hand
- **🎨 Dark Mode** — Light / dark / system theme
- **🌙 PWA** — Install on your phone's home screen

## Internationalization

The app supports **Danish** (default) and **English**.

- Switch language with the toggle in the navbar; the choice is stored in `localStorage` (`lang`)
- On first visit the browser language is detected (`da*` → Danish, `en*` → English)
- All UI strings live in the dictionaries in `src/lib/i18n.ts` and are read through the `useI18n()` hook (`t`, `tError`, `countKey`)
- API routes return bare error codes; they are translated client-side with `tError`
- A pre-paint script in `src/app/layout.tsx` sets `<html lang>` before first render (no screen-reader flash)
- **Limitation:** static metadata (page title/description) is defined at build time and stays Danish

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** SQLite (SQLite-compatible for easy deployment)
- **AI:** Ollama with vision model (glm-ocr) for blood pressure reading
- **PDF:** jsPDF for client-side report generation

## Getting Started

### Prerequisites

- Node.js 20+
- Ollama running locally with `glm-ocr` model

### Installation

```bash
# Clone the repository
git clone https://github.com/japperJ/blodtryk.git
cd blodtryk

# Install dependencies
npm install

# Set up database
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="file:./dev.db"
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="glm-ocr"
```

### Available Scripts

```bash
npm run dev      # Start dev server on port 3010 with HTTPS (required for camera)
npm run build    # Build for production
npm start        # Start production server on port 3010
npx prisma db push   # Apply schema changes to SQLite (also `npm run db:push`)
npm run db:studio    # Open Prisma Studio
```

## Usage

1. **First time:** Go to 👤 Persons and create your first person
2. **Scan:** Select a person, then use 📷 Camera or 📁 Upload
3. **View:** Check 📋 Measurements for history with color-coded status
4. **Export:** Generate 📄 PDF reports for your doctor

## Project Structure

```
blodtryk/
├── prisma/
│   └── schema.prisma        # Database schema
├── scripts/
│   └── migrate-images.mjs   # One-off image migration helper
├── src/
│   ├── app/
│   │   ├── api/             # API routes
│   │   ├── scan/            # Camera & batch upload
│   │   ├── readings/        # History view
│   │   ├── trends/          # Charts & statistics
│   │   └── persons/         # Multi-user management
│   ├── components/          # React components
│   ├── lib/                 # Utilities (OCR, BP classification, i18n)
│   └── hooks/               # Custom React hooks
├── docs/                    # Design docs & plans
└── public/                  # PWA manifest, icons & service worker
```

## License

MIT — see [LICENSE](LICENSE).
