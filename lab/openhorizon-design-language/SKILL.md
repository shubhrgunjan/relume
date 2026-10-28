---
name: openhorizon-design-language
description: "Build UI in the design language measured from openhorizon.so: Light interface, mostly neutral with a restrained accent (chromatic share 6.4%). Use whenever creating or restyling pages, sections or components that should look and move like openhorizon.so — colours, type, spacing, components and motion come from measurement, not guesswork."
---

# openhorizon.so design language

Measured from https://openhorizon.so/ (4 pages at desktop, tablet, mobile, desktop-dark) on 2026-10-28 by relume. Every value here was read from the live site — computed styles, stylesheets, animations and a frame-by-frame motion recording — so treat them as facts, not suggestions.

## The feel
- Light interface, mostly neutral with a restrained accent (chromatic share 6.4%).
- Maximum-contrast text (16.4:1).
- Headlines 100px / 400, tightly tracked (-0.04em); body 14px at 1.629 leading.
- Soft, rounded surfaces (20px).
- Layered shadows carry depth.
- Translucent, blurred (glass) layers are part of the language.
- Entrances run ~511ms; native scrolling.

## Build to the blueprint first
This language is not only its tokens. Its home page is 7 screens of 6 sections; 42% of it is covered by visuals (10 image, 6 ui-mock, 1 form, 2 code, 2 testimonial, 1 illustration), at ~34 painted elements per screen. Read `references/blueprint.md` before anything else: it lists every section of the source in order, with a crop, its layout, and what it is made of. A new page must have the same kinds of sections in the same order, filled with the same kinds of things for your product: product UI built in real HTML with the measured UI grammar, illustrations in the source's style, data visualisations, logo rows, testimonial cards. Headings over empty boxes are not this language, and the checker fails them.

## Setup
1. Copy `assets/tokens.css` (plain CSS variables, text styles, component classes, `.container` and `.section` with the measured width, gutters and rhythm — use them, don't re-derive) into the project; with Tailwind v4 also import `assets/tailwind.css` after `@import "tailwindcss"`.
2. Add `assets/motion.css` and `assets/motion.js` (scroll reveals, intro choreography, stagger and scroll feel, all with measured timings).
3. Fonts: **Archivo** for h1, h1-regular, display, title-lg — `var(--font-sans)`; **JetBrains Mono** for mono-sm, mono-sm-regular-2, mono-sm-medium, mono-sm-regular-3 — `var(--font-mono)`; **ui-monospace** (use **Geist Mono** unless you hold a licence) for mono-sm-regular — `var(--font-mono)`.
   Load the open ones: `<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">`

## Core tokens
- Background #f5f5f2, text #171717 / #2e2e2e / #6e6e69, accent #2a72cf, surface #fbfbf9, border #dfdfdf.
- Type scale ≈1.07 (minor second) from 14px: h1 100/400, h1-regular 76/400, display 44/400, title-lg 24/400, h3 23.2/500, title-lg-regular 23.2/400, title 18/600, title-medium 18/500.
- Radii 9999px, 8px, 15px, 22px, 10px. Spacing grid 2px. Container 1200px, gutters 20 / 44 / 24px (desktop / tablet / mobile).
- Motion: 300ms, 340ms, 700ms, 500ms, 120ms; curves `cubic-bezier(0.22, 1, 0.36, 1)`, `cubic-bezier(0, 0, 0.2, 1)`, `cubic-bezier(0.2, 0.8, 0.2, 1)`. Scroll: native.
- Primary action: #f5f5f5 / #181818, radius 3.35544e+07px, 400 11px/16.5px.

## Do
- Use only the colour tokens in `assets/tokens.css`; the accent (#2a72cf) covers ≤13% of any screen.
- Set text with the named styles (`.text-body`, `.text-h1` …); never invent sizes between them.
- Space on the 2px grid (8, 16, 6, 12, 10, 24 are the workhorses); sections get ~—px vertical padding on desktop.
- Reuse the measured shadows verbatim; they are layered, not single blurs.
- Floating chrome (nav, popovers) uses the measured backdrop blur over a translucent fill.

## Don't
- Do not use radii outside 9999px, 8px, 15px, 22px, 10px.
- Do not use durations or curves that are not in the motion tokens (300ms, 340ms, 700ms, 500ms, 120ms).
- Do not add smooth-scroll libraries; the source scrolls natively.
- Do not copy the source’s logo, product names, photography, illustrations or copy; describe your own product in this language.

## Motion signature
- **intro-fade-out-1** (load, ×7): filter: none; opacity: 1; → filter: blur(3px); opacity: 0; over 300ms `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 331ms.
- **intro-blur-scale-spin-2** (load, ×6): transform: translate3d(0px, 0px, 0px) scale3d(1, 1, 1) rotate(0deg); filter: blur(0px); opacity: 1; → filter: none; opacity: 1; over 320ms `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **intro-fade-3** (load, ×2): opacity: 0; translate: 0px 16px; → opacity: 1; translate: none; over 700ms `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- **intro-gridtemplaterows-4** (load): grid-template-rows: 12px; → grid-template-rows: 12px; over 500ms `cubic-bezier(0, 0, 0.2, 1)`.
- **intro-height-5** (load): height: 0px; → height: 44px; over 300ms `cubic-bezier(0.22, 1, 0.36, 1)`.
- **reveal-fade-6** (scroll, ×31): opacity: 0; translate: 0px 16px; → opacity: 1; translate: none; over 700ms `cubic-bezier(0.2, 0.7, 0.2, 1)`, stagger 80ms, starts when the element's top is at 83% of the viewport.

## Workflow
1. Read `references/tokens.md` and `references/components.md` before writing UI; open the images in `assets/reference/` to see the look.
2. Build with the component classes and text styles; take motion from `references/motion.md` (exact CSS per pattern).
3. Run `node scripts/lint.mjs <your files…>` and fix every off-system colour, size, radius, duration and curve it reports.
4. If the relume MCP server is connected, call `check_style` with your page's URL: it re-measures your page and compares its DNA (composition, tokens and motion) with this one. Fix what it reports until it passes.

## References
- `references/blueprint.md` — the page, section by section: order, layout, contents, density, crops, and the UI grammar of the product mock-ups.
- `references/tokens.md` — every colour (with dark values and the source’s own variable names), text style (with fluid sizes), spacing, radius, border, shadow, gradient.
- `references/components.md` — buttons, links, inputs, cards, badges, navigation, footer: resting style, hover/focus states and transitions.
- `references/motion.md` — scroll feel, intro choreography, scroll reveals, hover motion, loops; exact CSS.
- `references/layout.md` — containers, gutters, grids, breakpoints, section rhythm, density.
- `assets/DESIGN.md` — the same system in Google's DESIGN.md format, for other tools.
