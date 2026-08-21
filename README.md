# 🩺 Blodtryk

Danish blood pressure tracking app with AI-powered OCR. Photograph your blood pressure monitor and let AI read the numbers automatically.

## Features

- **📷 Camera Scan** — Point your phone camera at a blood pressure monitor, AI reads the values
- **📁 Batch Upload** — Upload multiple photos at once for batch processing
- **👤 Multi-User** — Track blood pressure for multiple family members
- **📊 Age-Adjusted Classification** — BP status adapts based on age (ESH/ESC guidelines)
- **📄 PDF Export** — Generate professional reports with color-coded status
- **🌙 PWA** — Install on your phone's home screen

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** SQLite (SQLite-compatible for easy deployment)
- **AI:** Ollama with vision model (glm-ocr) for blood pressure reading
- **PDF:** jsPDF for client-side report generation

## Getting Started

### Prerequisites

- Node.js 18+
- Ollama running locally with `glm-ocr` model

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/blodtryk.git
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
npm run dev      # Start dev server with HTTPS (required for camera)
npm run build    # Build for production
npm start        # Start production server
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
├── src/
│   ├── app/
│   │   ├── api/             # API routes
│   │   ├── scan/            # Camera & batch upload
│   │   ├── readings/        # History view
│   │   └── persons/         # Multi-user management
│   ├── components/          # React components
│   ├── lib/                 # Utilities (OCR, BP classification)
│   └── hooks/               # Custom React hooks
└── public/                  # Static assets
```

## License

MIT
