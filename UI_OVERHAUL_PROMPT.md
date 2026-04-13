# UI/UX Overhaul Task

You are tasked with a comprehensive UI/UX overhaul of this Next.js mortgage compliance webapp called "NewFI Guideline Processor" (larper). The goal: make it look absolutely POLISHED, PROFESSIONAL, and MODERN — worthy of a real mortgage company (NewFI Mortgage). Be bold and creative.

CURRENT STATE: The app uses Next.js 16 + Tailwind CSS v4 + TypeScript. It has dark/light theme, glassmorphism cards, purple-blue gradients, Geist/Geist_Mono fonts. It's decent but needs major polish to look truly professional.

## 1. FONTS & TYPOGRAPHY
- Add Google Fonts: 'Inter' for body text (clean, professional), 'Plus Jakarta Sans' for headings (modern, distinctive). Add them via next/font/google in layout.tsx
- Create a clear typographic hierarchy: h1 (3xl-4xl bold), h2 (2xl semibold), h3 (xl semibold), body (base), small (sm)
- Use letter-spacing on headings for a refined look (tracking-tight on h1, tracking-normal on others)
- Use font-variant-numeric: tabular-nums for all numbers/stats

## 2. LAYOUT & SPACING
- Add a proper sticky header/navbar with the NewFI logo area, navigation tabs (Upload/Compare), and theme toggle
- Use consistent spacing scale: p-6 for cards, gap-6 for grids, mb-8 between sections
- Add max-w-7xl mx-auto with proper responsive padding
- Make the overall layout feel spacious — not cramped

## 3. COLOR SYSTEM REFINEMENT
- Primary: Shift from generic purple to a more distinguished indigo-blue (#4F46E5 to #3B82F6 gradient range) — more 'enterprise/mortgage' feeling
- Accent: Keep emerald/teal for success states, use amber for warnings, rose for errors
- Background: Use very subtle gradient from slate-950 to zinc-950 for dark mode (less pure black)
- Glass cards: Refine the glass effect — use backdrop-blur-xl with very subtle white/5 border

## 4. COMPONENT IMPROVEMENTS

### a) app/page.tsx — Main page
- Add a stunning hero section at top with animated gradient text: 'NewFI Guideline Processor'
- Add a subtle tagline: 'AI-Powered Mortgage Compliance Analysis'
- Add a proper navigation bar with the app name, tab switching, and theme toggle integrated
- Group the stats cards, upload area, and guidelines into clear visual sections with headings

### b) components/DocumentUploadCard.tsx
- Make the upload area more elegant — larger, with a subtle dashed border animation
- Add a nice file icon with gradient when file is selected
- Make the two document cards side by side (Document A | Document B) with a VS icon between them

### c) components/GuidelineList.tsx
- Add filter/search bar at top
- Make guideline cards more spacious with better padding
- Add subtle hover effects with scale transform
- Improve severity badges to be more distinct

### d) components/LarpGPT.tsx
- Make it feel like a proper chat interface — add message bubbles
- Different styling for user vs assistant messages
- Add a typing indicator animation
- Style the input area like a modern chat input (rounded, with send button)

### e) components/ComparisonPage.tsx
- Better summary dashboard with larger score ring
- Color-coded filter pills
- Animated row entrance for comparison items

### f) components/ComplianceScore.tsx
- Refine the circular score display — thicker stroke, smoother gradient
- Better grade display with larger, more prominent letter

### g) components/StatsCard.tsx
- Add subtle hover animation (lift + shadow)
- Better icon containers with gradient backgrounds

### h) components/NewfiBaselinePanel.tsx
- Make the collapsible panel smoother with CSS transitions
- Better textarea styling

### i) components/ThemeToggle.tsx
- Smoother transition animation between themes
- Better icon styling

### j) components/ProcessingIndicator.tsx
- More refined progress bar with gradient
- Better stage icons

## 5. ANIMATIONS & MICRO-INTERACTIONS
- Add CSS transitions for all interactive elements (0.2s ease)
- Add subtle hover scale on cards (hover:scale-[1.01])
- Add stagger animation on list items (each item appears 50ms after the previous)
- Add a subtle gradient animation on the hero section text
- Smooth page transitions

## 6. TAILWIND CONFIG
- Extend the theme in tailwind.config.ts with custom colors, fonts, and animation keyframes
- Add custom utilities for glass effects

## 7. GLOBALS.CSS
- Refine custom CSS — add smooth scrolling, better scrollbar styling
- Add keyframe animations for stagger entrance, shimmer, and gradient text
- Clean up redundant styles

## 8. APP LAYOUT
- Add proper meta tags and page title
- Add a subtle animated gradient background to the body
- Ensure smooth transitions between dark and light mode

## IMPORTANT RULES
- Do NOT break any existing functionality
- Keep all TypeScript types and props intact
- Make sure imports are correct
- Test that the app structure is sound
- Be thorough — update EVERY component listed above
- When modifying a component, rewrite the entire file to be clean and consistent
- Use Tailwind CSS classes preferentially, custom CSS only when needed
- Make the app feel like a $10,000 professional tool, not a hackathon project

When completely finished, run this command to notify me:
openclaw system event --text "Done: Completed comprehensive UI/UX overhaul of larper webapp" --mode now