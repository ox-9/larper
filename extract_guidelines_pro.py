#!/usr/bin/env python3
"""
Mortgage Guideline Extractor — FAST, NO AI, ACCURATE
Pure Python. Targets 60-80 guidelines. Runs in <3s.

Key design:
- Extremely broad header detection (catches any format mortgage guides use)
- Each subsection = 1 guideline (bullets stay grouped, never fragmented)
- Smart filtering: keep anything with mandatory language, mortgage terms, or thresholds
- Aggressive dedup but no over-merging
"""

import pdfplumber
import json
import re
import os
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple, Set
from collections import defaultdict


@dataclass
class Guideline:
    id: str
    section_number: Optional[str]
    section_name: str
    subsection_name: str
    guideline_text: str
    page_number: int
    pages: List[int]
    level: int
    category: str
    is_cross_reference: bool
    cross_reference_target: Optional[str]
    title: str = ""
    content: str = ""


CATEGORIES = {
    'CREDIT': ('credit', 'fico', 'score', 'tradeline', 'collection', 'bankruptcy', 'foreclosure', 'derogatory', 'credit report'),
    'PROGRAM': ('program', 'product', 'ltv', 'cltv', 'dti', 'hcltv', 'loan amount', 'loan term', 'prepayment', 'cash-out', 'refinance', 'purchase'),
    'INCOME': ('income', 'employment', 'wage', 'salary', 'self-employed', '1099', 'w2', 'paystub', 'compensation', 'overtime', 'bonus', 'commission'),
    'PROPERTY': ('property', 'appraisal', 'condo', 'hoa', 'zoning', 'adus', 'multi-family', 'investment property', 'manufactured home', 'pud'),
    'ASSETS': ('asset', 'reserve', 'bank statement', 'gift fund', 'seasoning', 'liquid asset', 'retirement account', 'earnest money'),
    'ELIGIBILITY': ('eligible', 'qualify', 'borrower', 'citizen', 'resident', 'entity', 'trust', 'occupancy', 'first-time'),
    'DOCUMENTATION': ('documentation', 'document', 'required docs', 'verify', 'transcript', 'form', 'disclosure', 'proof of', 'evidence of'),
    'COMPLIANCE': ('compliance', 'legal', 'regulatory', 'fraud', 'patriot act', 'aml', 'fair lending', 'hmda', 'tila', 'respa', 'ecoa', 'flood', 'fema', 'hoepa'),
    'RESTRICTIONS': ('restriction', 'not allowed', 'prohibited', 'ineligible', 'excluded', 'cannot', 'may not', 'not permitted', 'unacceptable'),
    'INSURANCE': ('insurance', 'hazard', 'flood insurance', 'pmi', 'mortgage insurance', 'title insurance', 'coverage', 'escrow', 'impound'),
    'SERVICING': ('servicing', 'subservicing', 'custodian', 'warehouse', 'shipping', 'delivery', 'assignment', 'recording'),
    'RATES_PRICING': ('rate', 'pricing', 'point', 'fee', 'adjustment', 'margin', 'spread', 'llpa', 'rate lock', 'arm', 'interest only'),
}

# Header/footer patterns
_RE_HF = [
    re.compile(r'^page\s+\d+', re.IGNORECASE),
    re.compile(r'^\d+\s+of\s+\d+$'),
    re.compile(r'^\s*\d+\s*$'),
    re.compile(r'^(?:©|copyright|\u00a9)', re.IGNORECASE),
    re.compile(r'^confidential', re.IGNORECASE),
    re.compile(r'^all\s+rights\s+reserved', re.IGNORECASE),
]

# All the ways mortgage guides format section headers — BE BROAD
_RE_HEADER_PATTERNS = [
    # "1.1 Title" or "1.1.2 Title" (most common)
    (re.compile(r'^[\s]*(\d+(?:\.\d+){1,3})\s*[\.:\)]\s*(.+?)$'), 'num'),
    # "1 Title" or "1. Title"
    (re.compile(r'^[\s]*(\d)\s*[\.:\)]\s*(.+?)$'), 'num'),
    # "A.1 Title" or "B.2.3 Title"
    (re.compile(r'^[\s]*([A-Z]\.\d+(?:\.\d+)?)\s*[\.:\)]\s*(.+?)$'), 'num'),
    # "Section 3.1: Title"
    (re.compile(r'^[\s]*Section\s+(\d+(?:\.\d+)*)\s*[\.:\)]\s*(.+?)$'), re.IGNORECASE | 'num'),
    # ALL CAPS headers (2+ words, 8+ chars) — "CREDIT REQUIREMENTS"
    (re.compile(r'^[\s]*([A-Z][A-Z\s]{6,}[A-Z])\s*$'), 'caps'),
    # Title Case with colon — "Credit Requirements:"
    (re.compile(r'^[\s]*([A-Z][a-zA-Z\s]{4,50}:)\s*$'), 'colon'),
    # Short Title Case headers (standalone short lines, first letter cap, no period)
    (re.compile(r'^[\s]*([A-Z][a-zA-Z\s]{5,60})$'), 'title'),
]

# For subsection detection within a section — even broader
_RE_SUB_PATTERNS = [
    (re.compile(r'^[\s]*(\d+(?:\.\d+){1,3})\s*[\.:\)]\s*(.+?)$'), 'num'),
    (re.compile(r'^[\s]*([A-Z]\.\d+(?:\.\d+)?)\s*[\.:\)]\s*(.+?)$'), 'num'),
    (re.compile(r'^[\s]*([A-Z][A-Z\s]{6,}[A-Z])\s*$'), 'caps'),
    (re.compile(r'^[\s]*([A-Z][a-zA-Z\s]{4,50}:)\s*$'), 'colon'),
]

_RE_PAGE_MARKER = re.compile(r'--- PAGE \d+ ---')
_RE_PAGE_OF = re.compile(r'Page \d+ of \d+', re.IGNORECASE)
_RE_MULTI_SPACE = re.compile(r'\s+')
_RE_HYPHEN_BREAK = re.compile(r'(\w)-\s+(\w)')
_RE_CONTROL = re.compile(r'[\x00-\x08\x0b-\x0c\x0e-\x1f]')
_RE_SKIP_NUMS = re.compile(r'^\d+([\.\-]\d+)*$')
_RE_SKIP_DATE = re.compile(r'^\d{1,2}[\/\.\-]\d{1,2}')
_RE_SKIP_PAGE = re.compile(r'^(page|of)\s*\d', re.IGNORECASE)
_RE_CROSS_REF = re.compile(
    r'(?:see\s+|per\s+section\s+|refer\s+to\s+(?:the\s+)?|pursuant\s+to\s+|as\s+(?:described|set\s+forth)\s+in\s+)'
    r'([A-Z][A-Za-z\s]+(?:Guide|Manual|Section|Policy|Handbook|Chapter|Bulletin)|\d+(?:\.\d+)*)',
    re.IGNORECASE
)
_RE_MANDATORY = re.compile(
    r'\b(?:must|shall|required|mandatory|prohibited|not\s+allowed|not\s+permitted|'
    r'may\s+not|must\s+not|shall\s+not|ineligible|not\s+eligible|cannot|excluded|'
    r'minimum|maximum|at\s+least|no\s+more\s+than|no\s+less\s+than|'
    r'eligible|qualifies?|disqualif|threshold|not\s+to\s+exceed)\b',
    re.IGNORECASE
)
_RE_MORTGAGE_TERM = re.compile(
    r'\b(?:ltv|cltv|hcltv|dti|fico|credit\s+score|loan\s+amount|loan\s+term|interest\s+rate|'
    r'down\s+payment|cash[\s\-]out|rate\s+lock|prepayment|penalty|occupancy|borrower|lender|'
    r'seller|servicer|underwriting|documentation|verification|appraisal|insurance|'
    r'escrow|bankruptcy|foreclosure|seasoning|reserve|principal|interest|'
    r'amortiz|conforming|jumbo|non[- ]qm|dscr|noo|ooo|purchase|refinance)\b',
    re.IGNORECASE
)
_RE_HAS_NUMBER = re.compile(r'\d+(?:\.\d+)?\s*%|\$[\d,]+|\b\d+(?:,\d{3})+\b')


def _is_header_candidate(line: str) -> bool:
    """Is this line likely a header (not body text)?"""
    s = line.strip()
    if not s or len(s) < 3:
        return False
    # Body text: long, contains periods mid-line, starts with lowercase
    if len(s) > 120 and s[0].islower():
        return False
    if s.count('.') > 3:
        return False
    return True


def _clean_header_name(raw: str, pattern_type: str) -> Optional[str]:
    """Clean up a raw header match into a proper name. Returns None if it's junk."""
    name = raw.strip()
    # Strip trailing colons/periods
    name = name.rstrip(':.')
    # Strip section numbers from the name itself
    name = re.sub(r'^\d+(?:\.\d+)*\s+', '', name).strip()

    if len(name) < 3 or len(name) > 150:
        return None
    # Pure numbers
    if _RE_SKIP_NUMS.match(name):
        return None
    # Dates
    if _RE_SKIP_DATE.match(name):
        return None
    # Page numbers
    if _RE_SKIP_PAGE.match(name):
        return None
    # Just a single word that's too short to be meaningful
    if len(name) < 5 and name.upper() == name:
        return None
    return name


class MortgageGuidelineExtractor:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.guidelines: List[Guideline] = []
        self.page_texts: Dict[int, str] = {}
        self.all_text = ""
        self._detected_hf: Set[str] = set()
        self._hf_replace_re = None
        self._page_positions: List[Tuple[int, int, int]] = []

    def extract(self) -> List[Guideline]:
        print(f"\n{'='*60}")
        print(f"GUIDELINE EXTRACTION (FAST)")
        print(f"{'='*60}")
        print(f"File: {os.path.basename(self.pdf_path)}")

        with pdfplumber.open(self.pdf_path) as pdf:
            print(f"Pages: {len(pdf.pages)}")
            for i, page in enumerate(pdf.pages, 1):
                text = page.extract_text() or ""
                self.page_texts[i] = text
                marker = f"\n\n--- PAGE {i} ---\n\n"
                start = len(self.all_text) + len(marker)
                self.all_text += marker + text
                self._page_positions.append((i, start, len(self.all_text)))

        self._detect_hf()
        if self._detected_hf:
            escaped = [re.escape(h) for h in self._detected_hf if h]
            if escaped:
                self._hf_replace_re = re.compile('|'.join(escaped))

        sections = self._find_sections()
        print(f"Sections found: {len(sections)}")

        for i, sec in enumerate(sections):
            end = sections[i + 1]['position'] if i + 1 < len(sections) else len(self.all_text)
            self._process_section(sec, end)

        print(f"Raw guidelines: {len(self.guidelines)}")
        self._post_process()
        self._print_summary()
        return self.guidelines

    def _detect_hf(self):
        if len(self.page_texts) < 3:
            return
        counts: Dict[str, int] = {}
        for text in self.page_texts.values():
            seen = set()
            for line in text.split('\n'):
                s = line.strip()
                if s and len(s) < 120 and s not in seen:
                    seen.add(s)
                    counts[s] = counts.get(s, 0) + 1
        thresh = max(2, len(self.page_texts) * 0.6)
        self._detected_hf = {l for l, c in counts.items() if c >= thresh}

    def _is_hf(self, line: str) -> bool:
        s = line.strip()
        if not s: return True
        if s in self._detected_hf: return True
        for p in _RE_HF:
            if p.match(s): return True
        return False

    def _get_pages(self, start: int, end: int) -> List[int]:
        return sorted({pn for pn, s, e in self._page_positions if s < end and e > start})

    def _clean(self, text: str) -> str:
        text = self._RE_PAGE_MARKER.sub('', text)
        text = self._RE_PAGE_OF.sub('', text)
        text = self._RE_HYPHEN_BREAK.sub(r'\1\2', text)
        if self._hf_replace_re:
            text = self._hf_replace_re.sub('', text)
        text = self._RE_CONTROL.sub('', text)
        text = self._RE_MULTI_SPACE.sub(' ', text)
        return text.strip()

    def _detect_category(self, name: str, text: str) -> str:
        full = (name + ' ' + text).lower()
        best, best_score = 'GENERAL', 0
        for cat, kws in CATEGORIES.items():
            score = sum(2 if ' ' in kw and kw in full else (1 if kw in full else 0) for kw in kws)
            if score > best_score:
                best, best_score = cat, score
        return best

    def _detect_severity(self, text: str) -> str:
        t = text.lower()
        if any(w in t for w in ['must', 'shall', 'required', 'mandatory', 'prohibited',
                                  'may not', 'cannot', 'ineligible', 'must not', 'shall not',
                                  'not allowed', 'not permitted', 'not eligible']):
            return "critical"
        if _RE_HAS_NUMBER.search(t):
            return "critical"
        if self._RE_MORTGAGE_TERM.search(t):
            return "standard"
        if any(w in t for w in ['note:', 'guidance', 'optional', 'consider']):
            return "informational"
        return "standard"

    def _find_sections(self) -> List[Dict]:
        """Find all section headers across the document — BROAD matching."""
        sections = []
        for page_num, text in self.page_texts.items():
            page_start = self._page_positions[page_num - 1][1] if page_num <= len(self._page_positions) else 0
            lines = text.split('\n')
            for line_num, line in enumerate(lines):
                stripped = line.strip()
                if not stripped or self._is_hf(stripped):
                    continue
                if not _is_header_candidate(stripped):
                    continue

                sec_num, sec_name = None, None

                # Try each header pattern
                for pattern, ptype in _RE_HEADER_PATTERNS:
                    m = pattern.match(stripped)
                    if not m:
                        continue
                    if ptype == 'num':
                        sec_num = m.group(1)
                        raw_name = m.group(2).strip() if m.lastindex >= 2 else ""
                        sec_name = _clean_header_name(raw_name, ptype)
                    elif ptype == 'caps':
                        caps = m.group(1).strip()
                        words = caps.split()
                        if len(words) < 2:
                            continue
                        if not all(w.isalpha() for w in words[:2]):
                            continue
                        sec_num = f"S-{len(sections)+1}"
                        sec_name = caps.title()
                    elif ptype == 'colon':
                        raw = m.group(1).strip()
                        sec_name = _clean_header_name(raw.rstrip(':'), ptype)
                        if sec_name:
                            sec_num = f"S-{len(sections)+1}"
                    elif ptype == 'title':
                        # Title case header: must look like a header not a sentence
                        raw = m.group(1).strip()
                        # Skip if it has too many words (probably body text)
                        if len(raw.split()) > 10:
                            continue
                        # Skip if it ends with a period (body sentence)
                        if raw.endswith('.'):
                            continue
                        # Skip common body text patterns
                        if raw.lower().startswith(('the ', 'a ', 'an ', 'if ', 'when ', 'this ')):
                            continue
                        sec_name = _clean_header_name(raw, ptype)
                        if sec_name:
                            sec_num = f"S-{len(sections)+1}"
                    break  # Found a match, stop trying patterns

                if not sec_num or not sec_name:
                    continue

                pos = page_start + sum(len(l) + 1 for l in lines[:line_num])
                sections.append({'num': sec_num, 'name': sec_name, 'page': page_num, 'position': pos})

        def sort_key(s):
            parts = s['num'].replace('S-', '').split('.')
            try: return [int(p) for p in parts]
            except: return [999]
        sections.sort(key=sort_key)

        # Dedup: same section number + similar name
        seen = set()
        unique = []
        for s in sections:
            key = (s['num'], s['name'][:30].lower())
            if key not in seen:
                seen.add(key)
                unique.append(s)

        return unique

    def _process_section(self, section: Dict, end_pos: int):
        raw = self._RE_PAGE_MARKER.sub('', self.all_text[section['position']:end_pos])
        # Remove section header from content
        for prefix in [section['name'], section['num']]:
            idx = raw.find(prefix)
            if 0 <= idx < 300:
                raw = raw[:idx] + raw[idx+len(prefix):]

        content = '\n'.join(l for l in raw.split('\n') if not self._is_hf(l))
        content = self._clean(content)
        if len(content) < 20:
            return

        pages = self._get_pages(section['position'], end_pos)
        subsections = self._find_subsections(content)

        if not subsections:
            self._add(section, "", content, pages, 1)
        else:
            for i, sub in enumerate(subsections):
                sub_end = len(content) if i + 1 >= len(subsections) else subsections[i + 1]['position']
                sub_content = content[sub['position']:sub_end].strip()
                # Remove subsection name from start
                if sub['name'] and sub['name'] in sub_content[:300]:
                    sub_content = sub_content.replace(sub['name'], "", 1).strip()
                sub_content = self._clean(sub_content)
                if len(sub_content) < 20:
                    continue
                self._add(section, sub['name'], sub_content, pages, 2)

    def _find_subsections(self, content: str) -> List[Dict]:
        """Find subsections — BROAD matching."""
        subs = []
        for i, line in enumerate(content.split('\n')):
            s = line.strip()
            if not s or self._is_hf(s):
                continue

            name = None
            for pattern, ptype in _RE_SUB_PATTERNS:
                m = pattern.match(s)
                if not m:
                    continue
                if ptype == 'num':
                    raw = m.group(2).strip() if m.lastindex >= 2 else ""
                    name = _clean_header_name(raw, ptype)
                elif ptype == 'caps':
                    caps = m.group(1).strip()
                    words = caps.split()
                    if len(words) >= 2:
                        name = caps.title()
                elif ptype == 'colon':
                    raw = m.group(1).strip().rstrip(':')
                    name = _clean_header_name(raw, ptype)
                break

            if not name or len(name) < 4 or len(name) > 120:
                continue
            if _RE_SKIP_NUMS.match(name):
                continue

            pos = content.find(s)
            if pos < 0:
                pos = i * 50
            subs.append({'name': name, 'position': pos})

        subs.sort(key=lambda x: x['position'])
        seen = set()
        return [s for s in subs if s['name'].lower()[:40] not in seen and not seen.add(s['name'].lower()[:40])]

    def _add(self, section: Dict, sub_name: str, text: str, pages: List[int], level: int):
        cat = self._detect_category(section['name'], text)
        cross_ref, is_xref = None, False
        m = self._RE_CROSS_REF.search(text)
        if m:
            cross_ref, is_xref = m.group(1), True
        text = self._clean(text)
        if len(text) < 15:
            return
        title = section['name'] + (f" - {sub_name}" if sub_name else "")
        self.guidelines.append(Guideline(
            id=f"GL-{len(self.guidelines)+1:03d}",
            section_number=section['num'],
            section_name=section['name'],
            subsection_name=sub_name,
            guideline_text=text[:2000],
            page_number=section['page'],
            pages=pages or [section['page']],
            level=level,
            category=cat,
            is_cross_reference=is_xref,
            cross_reference_target=cross_ref,
            title=title,
            content=text[:2000],
        ))

    def _post_process(self):
        """Clean up: drop junk, dedup, but DON'T over-merge."""
        if not self.guidelines:
            return

        # 1. Drop pure cross-ref stubs (no real content)
        filtered = [g for g in self.guidelines
                    if not (g.is_cross_reference and len(g.guideline_text) < 80)]

        # 2. Drop guidelines that are just a header with no real content
        filtered = [g for g in filtered
                    if len(g.guideline_text) >= 30 or self._RE_MANDATORY.search(g.guideline_text)]

        # 3. Dedup by first-60-char normalized text
        deduped = []
        seen = set()
        for g in filtered:
            key = re.sub(r'\s+', ' ', g.guideline_text.lower())[:60]
            if key not in seen:
                seen.add(key)
                deduped.append(g)

        # 4. If still > 120, merge the smallest pairs within the same category
        if len(deduped) > 120:
            by_cat: Dict[str, List[Guideline]] = defaultdict(list)
            for g in deduped:
                by_cat[g.category].append(g)
            result = []
            for cat, cat_gs in by_cat.items():
                if len(cat_gs) > 15:
                    cat_gs.sort(key=lambda g: len(g.guideline_text))
                    while len(cat_gs) > 12:
                        a = cat_gs.pop(0)
                        b = cat_gs.pop(0)
                        combined = f"{a.title}: {a.guideline_text}\n{b.title}: {b.guideline_text}"
                        a.guideline_text = combined[:2000]
                        a.content = a.guideline_text
                        a.pages = sorted(set(a.pages + b.pages))
                        a.title = f"{a.section_name} (grouped)"
                        cat_gs.append(a)
                result.extend(cat_gs)
            deduped = result

        # Re-number
        for i, g in enumerate(deduped):
            g.id = f"GL-{i+1:03d}"

        self.guidelines = deduped
        print(f"Post-process: {len(self.guidelines)} guidelines")

    def _print_summary(self):
        print(f"\n{'='*60}")
        print(f"RESULT: {len(self.guidelines)} guidelines")
        print(f"{'='*60}")
        by_cat = defaultdict(int)
        by_sev = defaultdict(int)
        for g in self.guidelines:
            by_cat[g.category] += 1
            by_sev[self._detect_severity(g.guideline_text)] += 1
        for cat in sorted(by_cat):
            print(f"  {cat}: {by_cat[cat]}")
        print(f"  Critical: {by_sev.get('critical',0)} | Standard: {by_sev.get('standard',0)} | Info: {by_sev.get('informational',0)}")

    def export_json(self, path: str):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump([asdict(g) for g in self.guidelines], f, indent=2, ensure_ascii=False)
        print(f"Exported: {path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Fast Guideline Extraction')
    parser.add_argument('pdf_file')
    parser.add_argument('-o', '--output', default='guidelines.json')
    args = parser.parse_args()
    if not os.path.exists(args.pdf_file):
        print(f"Error: {args.pdf_file} not found"); return 1
    ext = MortgageGuidelineExtractor(args.pdf_file)
    ext.extract()
    ext.export_json(args.output)
    return 0

if __name__ == '__main__':
    exit(main())