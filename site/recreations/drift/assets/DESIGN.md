---
name: lenis.darkroom.engineering
colors:
  background: "#000000"
  text: "#efefef"
  text-secondary: "#ff98a2"
  surface: "#101010"
  surface-2: "rgb(239 239 239 / 0.8)"
  surface-3: "rgb(0 0 0 / 0.2)"
  surface-4: "rgb(0 0 0 / 0.5)"
  gray-600: "#8c8c8c"
  white-1000: "#ffffff"
typography:
  h1:
    fontFamily: "Anton"
    fontSize: 160px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: 0em
  display:
    fontFamily: "Anton"
    fontSize: 141.2px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: 0em
  display-regular:
    fontFamily: "Anton"
    fontSize: 96px
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: 0em
  display-medium:
    fontFamily: "Roboto"
    fontSize: 64px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0em
  display-bold:
    fontFamily: "Panchang"
    fontSize: 52px
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: 0em
  title:
    fontFamily: "Panchang"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0em
  title-medium:
    fontFamily: "Roboto"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.329
    letterSpacing: 0em
  title-regular:
    fontFamily: "Anton"
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0em
  label:
    fontFamily: "Roboto"
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.332
    letterSpacing: 0em
  body:
    fontFamily: "Roboto"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.328
    letterSpacing: 0em
  small:
    fontFamily: "Roboto"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.331
    letterSpacing: 0em
  overline:
    fontFamily: "Roboto"
    fontSize: 14px
    fontWeight: 900
    lineHeight: 1.129
    letterSpacing: 0em
  caption:
    fontFamily: "Roboto"
    fontSize: 14px
    fontWeight: 400
    lineHeight: normal
    letterSpacing: 0em
  micro:
    fontFamily: "Roboto"
    fontSize: 12px
    fontWeight: 900
    lineHeight: 1.133
    letterSpacing: 0em
rounded:
  full: 9999px
  md: 16px
  lg: 4px
  xl: 12px
spacing:
  "1": 4px
  "2": 6px
  "3": 8px
  "4": 12px
  "5": 14px
  "6": 16px
  "7": 24px
  "8": 40px
components:
  button-secondary:
    backgroundColor: "rgb(0 0 0 / 0.5)"
    textColor: "#efefef"
    rounded: 32px
    padding: 0px 14px 0px 14px
  button-secondary-2:
    backgroundColor: "#000000"
    textColor: "#000000"
    rounded: 12px
    padding: 12px 12px 12px 12px
  button-primary:
    backgroundColor: "#ff98a2"
    textColor: "#000000"
    rounded: 4px
    padding: 4px 8px 4px 8px
  button-secondary-3:
    backgroundColor: "#ff98a2"
    textColor: "#efefef"
    rounded: 4px
    padding: 6px 6px 6px 6px
  button-secondary-4:
    backgroundColor: "#ff98a2"
    textColor: "#000000"
    padding: 0px 24px 0px 24px
  button-secondary-5:
    backgroundColor: "#ff98a2"
    textColor: "#000000"
    rounded: 32px
    padding: 0px 14px 0px 14px
---

# lenis.darkroom.engineering

## Overview
Dark interface, almost entirely neutral — colour is rationed (chromatic share 2%). Maximum-contrast text (18.3:1). Headlines 160px / 400; body 18px at 1.328 leading. Crisp, near-square geometry (0px). Depth comes from hairline borders, not shadows. Translucent, blurred (glass) layers are part of the language. Generous vertical rhythm: sections breathe with ~56px padding on desktop. Entrances run ~716ms; scrolling is smoothed (lenis, lerp 0.14).

## Colors
- **background** `#000000` — background
- **text** `#efefef` — text
- **text-secondary** `#ff98a2` — text-secondary
- **surface** `#101010` — surface
- **surface-2** `rgb(239 239 239 / 0.8)` — surface-2
- **surface-3** `rgb(0 0 0 / 0.2)` — surface-3
- **surface-4** `rgb(0 0 0 / 0.5)` — surface-4
- **gray-600** `#8c8c8c` — palette
- **white-1000** `#ffffff` — palette

## Typography
- Roboto
- Panchang (open substitute: Inter)
- Anton

## Motion
Durations 600ms, 400ms, 1200ms, 300ms, 170ms; curves cubic-bezier(0.19, 1, 0.22, 1), linear, cubic-bezier(0.455, 0.03, 0.515, 0.955).

## Do's and Don'ts
- Use the tokens above only.
- Keep motion within the measured durations and curves.
- Never reuse the source brand’s logo, imagery or copy.
