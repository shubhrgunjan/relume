---
name: linear.app
colors:
  background: "#08090a"
  surface: "#0f1011"
  accent: "#5e69d1"
  text: "#f7f8f8"
  text-tertiary: "#8a8f98"
  border: "rgb(255 255 255 / 0.08)"
  text-secondary: "#d0d6e0"
  white-a4: "rgb(255 255 255 / 0.04)"
  surface-2: "#ffffff"
  surface-3: "#161718"
  black-a50: "rgb(8 9 10 / 0.5)"
  black-a80: "rgb(11 11 11 / 0.8)"
  white-a40: "rgb(255 255 255 / 0.4)"
  lime-900: "#e4f222"
  text-quaternary: "#62666d"
  violet-500: "#7170ff"
  indigo-800: "#b2d5ff"
  violet-900: "#dfd1ff"
  border-2: "#23252a"
  green-a7: "rgb(39 166 68 / 0.07)"
  surface-4: "#e5e5e6"
  black-50: "#000000"
  border-3: "#2e2e32"
  gray-200: "#2a2a2d"
typography:
  h2:
    fontFamily: "Inter Variable"
    fontSize: 72px
    fontWeight: 510
    lineHeight: 1
    letterSpacing: -0.022em
  display:
    fontFamily: "Inter Variable"
    fontSize: 64px
    fontWeight: 510
    lineHeight: 1
    letterSpacing: -0.022em
  h2-medium:
    fontFamily: "Inter Variable"
    fontSize: 48px
    fontWeight: 510
    lineHeight: 1
    letterSpacing: -0.023em
  title-lg:
    fontFamily: "Inter Variable"
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.125
    letterSpacing: -0.022em
  h3:
    fontFamily: "Inter Variable"
    fontSize: 24px
    fontWeight: 590
    lineHeight: 1.329
    letterSpacing: -0.012em
  title-lg-medium:
    fontFamily: "Inter Variable"
    fontSize: 24px
    fontWeight: 510
    lineHeight: 1.329
    letterSpacing: -0.012em
  title-lg-regular:
    fontFamily: "Inter Variable"
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.329
    letterSpacing: -0.012em
  h3-semibold:
    fontFamily: "Inter Variable"
    fontSize: 20px
    fontWeight: 590
    lineHeight: 1.33
    letterSpacing: -0.01em
  h3-medium:
    fontFamily: "Inter Variable"
    fontSize: 20px
    fontWeight: 510
    lineHeight: 1.33
    letterSpacing: -0.01em
  label:
    fontFamily: "Inter Variable"
    fontSize: 16px
    fontWeight: 510
    lineHeight: 2.75
    letterSpacing: 0em
  body-medium:
    fontFamily: "Inter Variable"
    fontSize: 15px
    fontWeight: 510
    lineHeight: 1.6
    letterSpacing: -0.013em
  body:
    fontFamily: "Inter Variable"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: -0.013em
  body-light:
    fontFamily: "Inter Variable"
    fontSize: 15px
    fontWeight: 300
    lineHeight: 1.333
    letterSpacing: -0.007em
  body-medium-2:
    fontFamily: "Inter Variable"
    fontSize: 14px
    fontWeight: 510
    lineHeight: 1.5
    letterSpacing: -0.014em
rounded:
  full: 9999px
  md: 5px
  lg: 4px
  xl: 9px
  2xl: 12px
  3xl: 8px
spacing:
  "1": 4px
  "2": 6px
  "3": 8px
  "4": 12px
  "5": 14px
  "6": 16px
  "7": 24px
  "8": 32px
components:
  card:
    backgroundColor: "linear-gradient(rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02)), none"
    textColor: "#f7f8f8"
    rounded: 9px
    padding: 8px 10px 12px 12px
  card-2:
    backgroundColor: "radial-gradient(circle, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0) 50%)"
    textColor: "#f7f8f8"
    padding: 0px 0px 0px 0px
  card-3:
    backgroundColor: "transparent"
    textColor: "#f7f8f8"
    rounded: 12px
    padding: 0px 0px 0px 0px
  card-4:
    backgroundColor: "#0f1011"
    textColor: "#f7f8f8"
    rounded: 4px
    padding: 0px 0px 0px 0px
  card-5:
    backgroundColor: "#0f1011"
    textColor: "#f7f8f8"
    rounded: 12px
    padding: 0px 0px 0px 0px
  card-6:
    backgroundColor: "linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03)), none"
    textColor: "#f7f8f8"
    rounded: 9px
    padding: 12px 16px 16px 16px
---

# linear.app

## Overview
Dark interface, almost entirely neutral — colour is rationed (chromatic share 2.9%). Maximum-contrast text (18.7:1). Headlines 64px / 510, tightly tracked (-0.022em); body 15px at 1.6 leading. Moderately rounded surfaces (8px). Layered shadows carry depth. Translucent, blurred (glass) layers are part of the language. Generous vertical rhythm: sections breathe with ~128px padding on desktop. Entrances run ~460ms, with spring physics (4 spring curves); native scrolling.

## Colors
- **background** `#08090a` — background
- **surface** `#0f1011` — surface
- **accent** `#5e69d1` — accent
- **text** `#f7f8f8` — text
- **text-tertiary** `#8a8f98` — text-tertiary
- **border** `rgb(255 255 255 / 0.08)` — border
- **text-secondary** `#d0d6e0` — text-secondary
- **white-a4** `rgb(255 255 255 / 0.04)` — palette
- **surface-2** `#ffffff` — surface-2
- **surface-3** `#161718` — surface-3

## Typography
- Inter Variable
- Berkeley Mono (open substitute: JetBrains Mono)

## Motion
Durations 420ms, 100ms, 160ms, 150ms, 300ms; curves cubic-bezier(0.25, 0.46, 0.45, 0.94), ease, cubic-bezier(0.215, 0.61, 0.355, 1).

## Do's and Don'ts
- Use the tokens above only.
- Keep motion within the measured durations and curves.
- Never reuse the source brand’s logo, imagery or copy.
