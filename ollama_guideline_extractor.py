#!/usr/bin/env python3
"""
Ollama AI Guideline Extractor — FAST

Pipeline:
1. pdfplumber extracts ALL text instantly (no AI)
2. Python regex extracts ~150-300 raw candidates instantly (no AI)
3. ONE Ollama call groups/merges/filters them into ~60-80 real guidelines (~15-30s)

This is dramatically faster than sending raw pages to Ollama because:
- Steps 1-2 take <2 seconds (no AI needed)
- Step 3 is a single Ollama call on pre-structured data (much smaller payload)
- No chunk-by-chunk processing needed
"""

import pdfplumber
import json
import re
import os
import sys
import requests
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed


OLLAMA_URL = "http://localhost:11434"
# Use the 3B model by default — it's 3-5x faster than llama3.1 with minimal quality loss
DEFAULT_MODEL = "llama3.2:3b"


@dataclass
class ExtractedGuideline:
    id: str
    category: str
    guideline: str
    page_reference: str
    severity: str
    section_number: Optional[str] = None
    title: str = ""
    content: str = ""


def check_ollama() -> bool:
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        return r.ok
    except:
        return False


def get_available_models() -> List[str]:
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if r.ok:
            return [m['name'] for m in r.json().get('models', [])]
    except:
        pass
    return []


def pick_model(preferred: str = DEFAULT_MODEL) -> str:
    """Pick the fastest available model."""
    available = get_available_models()
    if not available:
        return preferred

    # Prefer fast models in this order
    fast_models = ["llama3.2:3b", "llama3.2", "glm-4.7-flash", "llama3.1", "gemma4"]
    for m in fast_models:
        for avail in available:
            if m in avail:
                return avail
    return available[0]


def fast_python_extract(pdf_path: str) -> List[Dict]:
    """
    Fast deterministic extraction using pdfplumber + regex.
    Returns ~150-300 raw guideline candidates (pre-filtered, not grouped).
    This runs in <2 seconds.
    """
    import importlib
    # Use the existing pro extractor for raw extraction
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from extract_guidelines_pro import MortgageGuidelineExtractor

    extractor = MortgageGuidelineExtractor(pdf_path)
    raw = extractor.extract()

    # Convert to simple dicts for Ollama
    candidates = []
    for g in raw:
        candidates.append({
            'section': g.section_number or '',
            'title': g.section_name,
            'subsection': g.subsection_name,
            'text': g.guideline_text,
            'page': g.page_number,
            'category': g.category,
        })

    return candidates


def ollama_group_and_filter(candidates: List[Dict], model: str, doc_type: str = "A") -> List[Dict]:
    """
    Send pre-extracted candidates to Ollama in a SINGLE call.
    The LLM just needs to group/merge/filter — much faster than extracting from raw text.
    """
    # Build a compact representation for the LLM
    items_text = ""
    for i, c in enumerate(candidates, 1):
        sec = f"[{c['section']}] " if c['section'] else ""
        sub = f" — {c['subsection']}" if c['subsection'] else ""
        items_text += f"{i}. {sec}{c['title']}{sub} (p.{c['page']}): {c['text'][:300]}\n"

    prompt = f"""You are reviewing {len(candidates)} raw guideline items extracted from a mortgage {doc_type == 'A' and 'seller guide' or 'baseline'} document. Many of these overlap or are fragments of the same policy.

Your job: GROUP related items and FILTER out anything that isn't a real guideline (no headers, no cross-references, no purely descriptive text).

Rules:
- Merge items about the same topic into ONE guideline with all specific requirements included
- Target roughly 60-80 guidelines total for the whole document
- Each guideline must contain SPECIFIC requirements (numbers, thresholds, must/shall/prohibited language)
- If items overlap, keep the most complete version and merge details from the others
- Assign the most specific category

Categories: ELIGIBILITY, DOCUMENTATION, CREDIT, INCOME, ASSETS, PROPERTY, PROGRAM, COMPLIANCE, RESTRICTIONS, INSURANCE, SERVICING, RATES_PRICING, GENERAL

Severity: "critical" = hard requirement/prohibition, "standard" = policy rule, "informational" = guidance/note

Return ONLY a JSON array. Each item:
{{"category": "...", "guideline": "...(grouped requirements)...", "severity": "...", "page_reference": "page numbers"}}

Raw items:
{items_text}

Return ONLY the JSON array:"""

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 8192,
                }
            },
            timeout=120  # 2 min timeout for the single call
        )

        if not response.ok:
            print(f"  Ollama error: {response.status_code}")
            return []

        raw_text = response.json().get("response", "")
        return parse_json_response(raw_text)

    except requests.exceptions.Timeout:
        print("  Ollama timeout (2 min)")
        return []
    except Exception as e:
        print(f"  Ollama error: {e}")
        return []


def parse_json_response(raw_text: str) -> List[Dict]:
    """Parse JSON array from LLM response, handling various formats."""
    json_str = raw_text.strip()

    # Handle markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', json_str)
    if json_match:
        json_str = json_match.group(1).strip()

    # Find the JSON array
    bracket_start = json_str.find('[')
    bracket_end = json_str.rfind(']')
    if bracket_start >= 0 and bracket_end > bracket_start:
        json_str = json_str[bracket_start:bracket_end+1]

    try:
        result = json.loads(json_str)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Salvage: find individual JSON objects
    results = []
    for match in re.finditer(r'\{[^{}]*"guideline"[^{}]*\}', json_str):
        try:
            obj = json.loads(match.group(0))
            if 'guideline' in obj:
                results.append(obj)
        except:
            pass

    return results


def extract(pdf_path: str, model: str = None, output_path: str = "guidelines.json",
             doc_type: str = "A") -> List[ExtractedGuideline]:
    """Main pipeline: fast Python extract → single Ollama group/filter call."""

    print(f"\n{'='*60}")
    print(f"FAST GUIDELINE EXTRACTION")
    print(f"{'='*60}")
    print(f"File: {os.path.basename(pdf_path)}")

    # Step 1: Check Ollama
    if not check_ollama():
        print("ERROR: Ollama not running. Run: ollama serve")
        print("Falling back to Python-only extraction...")
        return _fallback_python_only(pdf_path, output_path)

    model = pick_model(model)
    print(f"Model: {model}")

    # Step 2: Fast Python extraction (<2 seconds)
    print(f"\n[1/3] Extracting structure with Python...", flush=True)
    candidates = fast_python_extract(pdf_path)
    print(f"  Found {len(candidates)} raw candidates")

    if not candidates:
        print("  No candidates found, falling back to Python-only")
        return _fallback_python_only(pdf_path, output_path)

    # Step 3: Single Ollama call to group/filter (~15-30 seconds)
    print(f"\n[2/3] Grouping with {model}...", flush=True)
    grouped = ollama_group_and_filter(candidates, model, doc_type)
    print(f"  Ollama returned {len(grouped)} guidelines")

    # If Ollama failed or returned too few, use the Python candidates directly
    if len(grouped) < 10:
        print("  Ollama returned too few results, using Python candidates directly")
        return _fallback_python_only(pdf_path, output_path)

    # Step 4: Format results
    print(f"\n[3/3] Formatting...")
    result = _format_results(grouped)

    _print_summary(result)
    _export(result, output_path)
    return result


def _fallback_python_only(pdf_path: str, output_path: str) -> List[ExtractedGuideline]:
    """Use Python pro extractor directly (no AI)."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from extract_guidelines_pro import MortgageGuidelineExtractor

    extractor = MortgageGuidelineExtractor(pdf_path)
    raw = extractor.extract()

    result = []
    for g in raw:
        result.append(ExtractedGuideline(
            id=g.id,
            category=g.category,
            guideline=g.guideline_text[:2000],
            page_reference=str(g.page_number),
            severity=_detect_severity(g.guideline_text),
            section_number=g.section_number,
            title=g.title or g.section_name,
            content=g.content[:2000] if hasattr(g, 'content') else g.guideline_text[:2000],
        ))

    _print_summary(result)
    _export(result, output_path)
    return result


def _detect_severity(text: str) -> str:
    """Quick severity detection."""
    text_lower = text.lower()
    critical = ['must', 'shall', 'required', 'mandatory', 'prohibited', 'not allowed',
                 'may not', 'cannot', 'ineligible', 'must not', 'shall not']
    if any(w in text_lower for w in critical):
        return "critical"
    if any(w in text_lower for w in ['note:', 'guidance', 'optional', 'consider']):
        return "informational"
    return "standard"


def _format_results(guidelines: List[Dict]) -> List[ExtractedGuideline]:
    """Format Ollama output into our data structure."""
    result = []
    valid_cats = {'ELIGIBILITY', 'DOCUMENTATION', 'CREDIT', 'INCOME', 'ASSETS',
                  'PROPERTY', 'PROGRAM', 'COMPLIANCE', 'RESTRICTIONS', 'INSURANCE',
                  'SERVICING', 'RATES_PRICING', 'GENERAL'}

    for i, g in enumerate(guidelines):
        category = g.get('category', 'GENERAL').upper().replace(' ', '_').rstrip('_')
        # Map common variations
        cat_map = {
            'CREDIT_REQUIREMENTS': 'CREDIT', 'LOAN_LIMITS': 'PROGRAM',
            'RATES_AND_PRICING': 'RATES_PRICING', 'SEASONING': 'CREDIT',
            'RESERVES': 'ASSETS', 'UNDERWRITING': 'PROGRAM', 'TITLE': 'COMPLIANCE',
        }
        category = cat_map.get(category, category)
        if category not in valid_cats:
            category = 'GENERAL'

        severity = g.get('severity', 'standard')
        if severity not in ('critical', 'standard', 'informational'):
            severity = _detect_severity(g.get('guideline', ''))

        page_ref = re.sub(r'[^\d,\s\-]', '', str(g.get('page_reference', ''))).strip()
        text = g.get('guideline', '').strip()
        if len(text) < 20:
            continue

        result.append(ExtractedGuideline(
            id=f"GL-{i+1:03d}",
            category=category,
            guideline=text[:2000],
            page_reference=page_ref,
            severity=severity,
            title=category.replace('_', ' ').title(),
            content=text[:2000],
        ))

    return result


def _print_summary(result: List[ExtractedGuideline]):
    print(f"\n{'='*60}")
    print(f"RESULT: {len(result)} guidelines")
    print(f"{'='*60}")
    by_cat = {}
    by_sev = {}
    for g in result:
        by_cat[g.category] = by_cat.get(g.category, 0) + 1
        by_sev[g.severity] = by_sev.get(g.severity, 0) + 1
    for cat in sorted(by_cat):
        print(f"  {cat}: {by_cat[cat]}")
    print(f"\n  Critical: {by_sev.get('critical', 0)} | Standard: {by_sev.get('standard', 0)} | Informational: {by_sev.get('informational', 0)}")


def _export(result: List[ExtractedGuideline], output_path: str):
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump([asdict(g) for g in result], f, indent=2, ensure_ascii=False)
    print(f"  Exported to: {output_path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Fast Guideline Extraction (Python + Ollama)')
    parser.add_argument('pdf_file', help='PDF file to process')
    parser.add_argument('-o', '--output', default='guidelines.json', help='Output JSON file')
    parser.add_argument('-m', '--model', default=None, help='Ollama model (auto-selected if omitted)')
    parser.add_argument('-t', '--type', default='A', choices=['A', 'B'], help='Document type: A=seller guide, B=baseline')
    args = parser.parse_args()

    if not os.path.exists(args.pdf_file):
        print(f"Error: File not found: {args.pdf_file}")
        return 1

    result = extract(args.pdf_file, model=args.model, output_path=args.output, doc_type=args.type)
    return 0 if result else 1


if __name__ == '__main__':
    exit(main())