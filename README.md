# Newfi Guideline Processor

AI-powered seller guide compliance analysis against Newfi underwriting guidelines.

## Features

- **Drag & Drop Upload** - Beautiful file upload with visual feedback
- **AI-Powered Analysis** - Claude API compares seller guides against Newfi guidelines
- **Compliance Scoring** - Visual gauge showing overall compliance (0-100)
- **Tab-Based Analysis** - Separate views for NON-QM and DSCR products
- **Topic Coverage** - Shows covered and missing topics for each guideline
- **Recommendations** - AI-generated suggestions for improvement
- **Dark Mode** - System-aware theme with manual toggle
- **History** - Local storage of past analyses

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- Anthropic API key

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=AIzaSyBzT1ZDSKs4vcRAeHauF4LKNx76TfqNJv4
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Upload a seller guide PDF using drag & drop or click
2. Click "Analyze Seller Guide" to start processing
3. View compliance score, covered/missing topics, and recommendations
4. Toggle between NON-QM and DSCR tabs for detailed analysis
5. Review extracted text in the collapsible section
6. Access previous analyses in the History panel

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [pdf2json](https://github.com/modesty/pdf2json) - PDF parsing
- [Claude API](https://www.anthropic.com/) - AI analysis

## Project Structure

```
app/
  api/
    upload/route.ts    - PDF upload and text extraction
    analyze/route.ts   - AI compliance analysis
  layout.tsx           - Root layout with theme support
  page.tsx             - Main dashboard
  globals.css          - Global styles
components/
  FileUpload.tsx       - Drag & drop upload component
  ProcessingIndicator.tsx - Progress indicator
  ComplianceScore.tsx  - Circular score gauge
  TabAnalysis.tsx      - NON-QM/DSCR tab analysis
  Recommendations.tsx  - Recommendations list
  ThemeToggle.tsx      - Dark/light mode toggle
  HistoryPanel.tsx     - Analysis history sidebar
lib/
  types.ts            - TypeScript type definitions
  ai.ts                - Claude API client
  newfiGuidelines.ts   - Internal guideline data
  history.ts           - Local storage management
```

## API Endpoints

### POST /api/upload
Uploads and extracts text from a seller guide PDF.

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "success": true,
  "extractedText": "...",
  "sectionChunks": [...],
  "sectionCount": 42
}
```

### POST /api/analyze
Analyzes extracted text against Newfi guidelines using Claude API.

**Request:**
```json
{
  "extractedText": "...",
  "fileName": "guide.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "overallScore": 78,
    "summary": "...",
    "tabAnalyses": [...],
    "criticalIssues": [...],
    "recommendations": [...]
  }
}
```

## License

MIT