---
name: openhorizon.so
colors:
  background: "#f5f5f2"
  surface: "#fbfbf9"
  surface-2: "#e6e6e0"
  accent: "#2a72cf"
  text-tertiary: "#6e6e69"
  text: "#171717"
  white-1000: "#ffffff"
  indigo-400: "#2463c2"
  surface-3: "#ededea"
  surface-4: "#101010"
  black-50: "#000000"
  white-1000-2: "#f8f8f8"
  white-a90: "rgb(255 255 255 / 0.9)"
  green-200: "#10402c"
  gray-a75: "rgb(23 23 23 / 0.75)"
  black-a5: "rgb(0 0 0 / 0.05)"
  white-a80: "rgb(245 245 242 / 0.8)"
  white-a70: "rgb(255 255 255 / 0.7)"
  border: "#dfdfdf"
  green-500: "#0c8457"
  black-a15: "rgb(0 0 0 / 0.15)"
  white-a85: "rgb(255 255 255 / 0.85)"
  border-2: "rgb(255 255 255 / 0.55)"
  gray-1000: "#f2f2f2"
typography:
  h1:
    fontFamily: "Archivo"
    fontSize: 100px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -0.04em
  h1-regular:
    fontFamily: "Archivo"
    fontSize: 76px
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: -0.036em
  display:
    fontFamily: "Archivo"
    fontSize: 44px
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: -0.03em
  title-lg:
    fontFamily: "Archivo"
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: -0.008em
  h3:
    fontFamily: "Archivo"
    fontSize: 23.2px
    fontWeight: 500
    lineHeight: 1.181
    letterSpacing: -0.022em
  title-lg-regular:
    fontFamily: "Archivo"
    fontSize: 23.2px
    fontWeight: 400
    lineHeight: 1.181
    letterSpacing: -0.022em
  title:
    fontFamily: "Archivo"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.556
    letterSpacing: -0.022em
  title-medium:
    fontFamily: "Archivo"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.378
    letterSpacing: 0em
  title-semibold:
    fontFamily: "Archivo"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.376
    letterSpacing: -0.024em
  title-regular:
    fontFamily: "Archivo"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0em
  title-semibold-2:
    fontFamily: "Archivo"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.031em
  body-semibold:
    fontFamily: "Archivo"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.027em
  body-regular:
    fontFamily: "Archivo"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.627
    letterSpacing: 0em
  body-medium:
    fontFamily: "Archivo"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0em
rounded:
  full: 9999px
  md: 8px
  lg: 15px
  xl: 22px
  2xl: 10px
  3xl: 5px
spacing:
  "1": 2px
  "2": 6px
  "3": 8px
  "4": 10px
  "5": 12px
  "6": 16px
  "7": 20px
  "8": 24px
components:
  card:
    backgroundColor: "#fbfbf9"
    textColor: "#171717"
    padding: 0px 0px 0px 0px
  card-2:
    backgroundColor: "#fbfbf9"
    textColor: "#171717"
    rounded: 22px
    padding: 8px 8px 8px 8px
  card-3:
    backgroundColor: "radial-gradient(lab(0 0 0 / 0.05) 1.1px, rgba(0, 0, 0, 0) 1.1px)"
    textColor: "#171717"
    rounded: 20px
    padding: 0px 0px 0px 0px
  card-4:
    backgroundColor: "transparent"
    textColor: "#171717"
    padding: 0px 0px 0px 0px
  card-5:
    backgroundColor: "transparent"
    textColor: "#171717"
    padding: 16px 0px 0px 0px
  card-6:
    backgroundColor: "#000000"
    textColor: "#f2f2f2"
    padding: 36px 28px 36px 28px
---

# openhorizon.so

## Overview
Light interface, mostly neutral with a restrained accent (chromatic share 6.4%). Maximum-contrast text (16.4:1). Headlines 100px / 400, tightly tracked (-0.04em); body 14px at 1.629 leading. Soft, rounded surfaces (20px). Layered shadows carry depth. Translucent, blurred (glass) layers are part of the language. Entrances run ~511ms; native scrolling.

## Colors
- **background** `#f5f5f2` — background
- **surface** `#fbfbf9` — surface
- **surface-2** `#e6e6e0` — surface-2
- **accent** `#2a72cf` — accent
- **text-tertiary** `#6e6e69` — text-tertiary
- **text** `#171717` — text
- **white-1000** `#ffffff` — palette
- **indigo-400** `#2463c2` — palette
- **surface-3** `#ededea` — surface-3
- **surface-4** `#101010` — surface-4

## Typography
- Archivo
- JetBrains Mono
- ui-monospace (open substitute: Geist Mono)

## Motion
Durations 300ms, 340ms, 700ms, 500ms, 120ms; curves cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0, 0, 0.2, 1), cubic-bezier(0.2, 0.8, 0.2, 1).

## Do's and Don'ts
- Use the tokens above only.
- Keep motion within the measured durations and curves.
- Never reuse the source brand’s logo, imagery or copy.
