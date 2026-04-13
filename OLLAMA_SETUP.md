# Ollama AI Guideline Extraction Setup

This system now uses Ollama AI to intelligently extract and compare guidelines. This is much more accurate than rule-based extraction.

## Prerequisites

1. **Install Ollama** from https://ollama.com

2. **Pull a model** (llama3.2 is recommended):
   ```bash
   ollama pull llama3.2
   ```

3. **Start Ollama server**:
   ```bash
   ollama serve
   ```

## How It Works

### Extraction Pipeline
The system now tries extraction in this priority order:

1. **Ollama AI** (most accurate) - Uses LLM to identify actual guidelines vs descriptive text
2. **Python/pdfplumber** - Better structure detection
3. **JavaScript fallback** - Basic extraction if others fail

### What Makes Ollama Better

Instead of extracting every sentence, Ollama:
- Understands context and identifies actual requirements
- Groups related bullet points into single guidelines
- Distinguishes between rules vs explanations
- Properly identifies categories

### Comparison Pipeline

Instead of simple keyword matching, Ollama:
- Understands semantic equivalence ("must be at least 620" == "minimum 620")
- Detects when numbers differ (640 vs 620 = MORE_RESTRICTIVE)
- Identifies truly different guidelines
- Provides confidence scores

## Usage

### Option 1: Web App
Simply upload PDFs in the app. It will automatically use Ollama if available.

### Option 2: Command Line

**Extract single PDF:**
```bash
python ollama_guideline_extractor.py "seller_guide.pdf" -o output.json
```

**Compare two PDFs:**
```bash
# Extract both
python ollama_guideline_extractor.py "seller.pdf" -o seller.json
python ollama_guideline_extractor.py "newfi.pdf" -o newfi.json

# Compare
python ollama_compare.py seller.json newfi.json -o results.xlsx
```

**Or use the batch file:**
```bash
extract_and_compare.bat "seller.pdf" "newfi.pdf"
```

## Expected Output

Instead of 288 fragmented items, you should now get:
- **~60-80 actual guidelines** (not every sentence)
- Properly grouped content
- Accurate SAME/NO_GO/REVIEW verdicts
- Confidence scores

## Troubleshooting

### "Ollama not available"
- Make sure `ollama serve` is running in a terminal
- Check it's working: `curl http://localhost:11434/api/tags`

### Extraction is slow
- First run downloads the model
- Each PDF takes 1-3 minutes depending on size
- Comparison takes ~1 minute per guideline

### Model errors
- Try a different model: `ollama pull llama3.1` or `ollama pull mistral`
- Update the model name in the scripts

## Configuration

Edit the scripts to change:
- **Model**: Change `self.model = "llama3.2"` to your preferred model
- **Temperature**: Lower = more consistent, Higher = more creative
- **Timeout**: Increase for slower machines
