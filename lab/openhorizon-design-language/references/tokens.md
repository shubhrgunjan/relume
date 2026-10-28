# Tokens

## Colour (light scheme)
Ordered by painted weight (area × use). `aliases` are the source's own custom properties holding the same value.

| token | value | role | share | used for | dark | source aliases |
|---|---|---|---|---|---|---|
| background | `#f5f5f2` | background | 66.2% | bg | — | --primary-foreground --background --sidebar |
| surface | `#fbfbf9` | surface | 8.3% | bg | — | --card --popover |
| surface-2 | `#e6e6e0` | surface-2 | 5% | bg, border | — | --border --band --color-border |
| accent | `#2a72cf` | accent | 4.2% | bg | — | — |
| text-tertiary | `#6e6e69` | text-tertiary | 2.1% | text | — | --muted-foreground |
| text | `#171717` | text | 2% | text, accent-fill | — | --card-foreground --popover-foreground --color-neutral-900 |
| white-1000 | `#ffffff` | palette | 1.9% | text, bg | — | --sidebar-primary-foreground --tw-ring-offset-color --color-white |
| indigo-400 | `#2463c2` | palette | 1.5% | bg | — | — |
| surface-3 | `#ededea` | surface-3 | 1.4% | bg | — | --muted --panel |
| surface-4 | `#101010` | surface-4 | 1.3% | accent-fill | — | — |
| black-50 | `#000000` | palette | 1.1% | bg | — | --color-term --color-black |
| white-1000-2 | `#f8f8f8` | palette | 0.7% | bg | — | --color-app-fill --color-zinc-50 --color-app-rail |
| white-a90 | `rgb(255 255 255 / 0.9)` | palette | 0.7% | text, accent-fill | — | — |
| green-200 | `#10402c` | palette | 0.6% | bg | — | --color-botcortex |
| gray-a75 | `rgb(23 23 23 / 0.75)` | palette | 0.6% | accent-fill | — | — |
| black-a5 | `rgb(0 0 0 / 0.05)` | palette | 0.4% | shadow, gradient | — | --grid-line |
| white-a80 | `rgb(245 245 242 / 0.8)` | palette | 0.4% | bg | — | — |
| white-a70 | `rgb(255 255 255 / 0.7)` | palette | 0.2% | text | — | — |
| border | `#dfdfdf` | border | 0.1% | border | — | --color-app-line |
| green-500 | `#0c8457` | palette | 0.1% | accent-fill | — | --brand --accent-blue --ring |
| black-a15 | `rgb(0 0 0 / 0.15)` | palette | 0.1% | bg | — | — |
| white-a85 | `rgb(255 255 255 / 0.85)` | palette | 0.1% | text, accent-fill | — | — |
| border-2 | `rgb(255 255 255 / 0.55)` | border-2 | 0.1% | border | — | — |
| gray-1000 | `#f2f2f2` | palette | 0.1% | text | — | --color-zinc-100 --color-app-fill --color-term-fg |
| border-3 | `#d2d2cc` | border-3 | 0.1% | border | — | --border-strong --input |
| text-quaternary | `#8e8e93` | text-quaternary | 0.1% | text | — | --color-term-muted |
| text-secondary | `#2e2e2e` | text-secondary | 0.1% | gradient, text | — | --color-app-ink-soft |
| gray-100 | `#131514` | palette | 0% | accent-fill | — | --code-bg --sidebar-foreground --ink |
| gray-100-2 | `#1e1e20` | palette | 0% | accent-fill, bg | — | --color-term-tab |
| gray-a85 | `rgb(242 242 242 / 0.85)` | palette | 0% | text, accent-fill | — | — |
| green-a25 | `rgb(12 132 87 / 0.25)` | palette | 0% | accent-fill | — | — |

### Gradients
- `radial-gradient(lab(0 0 0 / 0.05) 1.1px, rgba(0, 0, 0, 0) 1.1px)`
- `linear-gradient(rgb(74, 74, 74) 0%, rgb(46, 46, 46) 50%, rgb(35, 35, 35) 100%)`
- `linear-gradient(rgb(255, 255, 255) 0%, rgb(250, 250, 248) 50%, rgb(239, 239, 235) 100%)`
- `linear-gradient(to right in oklab, rgb(210, 210, 204) 0%, rgba(0, 0, 0, 0) 100%)`
- `linear-gradient(to left in oklab, rgb(210, 210, 204) 0%, rgba(0, 0, 0, 0) 100%)`

## Typography
| family | share | weights | source | licence | substitute |
|---|---|---|---|---|---|
| Archivo | 77.2% | 400 500 600 | self-hosted | open (Google Fonts) — load it from Google Fonts or self-host | — |
| JetBrains Mono | 16.1% | 400 500 | self-hosted | open (Google Fonts) — load it from Google Fonts or self-host | — |
| ui-monospace | 4.3% | 400 | system | system | Geist Mono |

| style | family | size | weight | line-height | tracking | case | share | responsive | sample |
|---|---|---|---|---|---|---|---|---|---|
| h1 | Archivo | 100px | 400 | 100px (1) | -0.04em | none | 0.4% | 46.4→60→100px | Agents for the physical world. |
| h1-regular | Archivo | 76px | 400 | 77.5px (1.02) | -0.036em | none | 0.8% | — | Shared hardware. Shared problems. Shared |
| display | Archivo | 44px | 400 | 47.5px (1.08) | -0.03em | none | 4.8% | 29.6→29.6→44px | The open problems underneath it, in memo |
| title-lg | Archivo | 24px | 400 | 33.6px (1.4) | -0.008em | none | 1.6% | 18.4→18.4→24px | OpenHorizon Labs is a research company s |
| h3 | Archivo | 23.2px | 500 | 27.4px (1.181) | -0.022em | none | 2.2% | 19.2→19.2→23.2px | When Does Asynchronous Action Chunking H |
| title-lg-regular | Archivo | 23.2px | 400 | 27.4px (1.181) | -0.022em | none | 1.7% | 19.2→19.2→23.2px | from one 17 MB binary that also runs on  |
| title | Archivo | 18px | 600 | 28px (1.556) | -0.022em | none | 1.1% | — | How are intellectual property and public |
| title-medium | Archivo | 18px | 500 | 24.8px (1.378) | 0em | none | 1% | — | A fast, pure-Rust inference engine for s |
| title-semibold | Archivo | 17px | 600 | 23.4px (1.376) | -0.024em | none | 1.8% | — | A remote account on the Thor, training o |
| title-regular | Archivo | 17px | 400 | 27.2px (1.6) | 0em | none | 9.5% | — | Work from OpenHorizon Labs on perception |
| title-semibold-2 | Archivo | 16px | 600 | 16px (1) | -0.031em | none | 0.4% | — | OpenHorizon Labs |
| body-semibold | Archivo | 15px | 600 | 22.5px (1.5) | -0.027em | none | 1.2% | — | Actuators and harmonic reducers |
| body-regular | Archivo | 15px | 400 | 24.4px (1.627) | 0em | none | 8.3% | 14→14→15px | A closed-form model of how often a robot |
| body-medium | Archivo | 14px | 500 | 21px (1.5) | 0em | none | 3.3% | — | macOS, Linux and Windows, x86 and ARM |
| body | Archivo | 14px | 400 | 22.8px (1.629) | 0em | none | 30.6% | — | Last attempt the gripper closed on nothi |
| label | Archivo | 13px | 500 | 19.5px (1.5) | 0em | none | 2.7% | 14→14→13px | Writing “place_red_cube” |
| body-regular-2 | Archivo | 13px | 400 | 21.1px (1.623) | 0em | none | 2.9% | — | Manipulation research · teach-and-replay |
| small | Archivo | 12px | 400 | 16px (1.333) | 0em | none | 2.9% | — | 1 lesson: the gripper closed on nothing  |
| mono-sm | JetBrains Mono | 12px | 400 | 16px (1.333) | 0em | none | 1.6% | — | © 2026 OpenHorizon Labs Private Limited |
| mono-sm-regular | ui-monospace | 12px | 400 | 18.6px (1.55) | 0em | none | 4.3% | — | A robot arm picks up a cube and places i |
| mono-sm-regular-2 | JetBrains Mono | 11.5px | 400 | 18.4px (1.6) | 0em | none | 2% | — | def place_red_cube(ctx): cube = ctx.loca |
| mono-sm-medium | JetBrains Mono | 11px | 500 | 16.5px (1.5) | 0.164em | uppercase | 3.8% | — | Stall fraction against inference latency |
| mono-sm-regular-3 | JetBrains Mono | 11px | 400 | 17.9px (1.627) | 0em | none | 3.4% | — | Safety envelope: joint velocity capped a |
| mono-sm-regular-4 | JetBrains Mono | 11px | 400 | 16.5px (1.5) | 0.136em | uppercase | 0.5% | — | degrees of freedom on the rig |
| mono-sm-regular-5 | JetBrains Mono | 10.5px | 400 | 17.1px (1.629) | 0em | none | 4.3% | — | Measured 26 Oct 2026 · Qwen2.5-1.5B Q4_K |
| mono-sm-regular-6 | JetBrains Mono | 10px | 400 | 15px (1.5) | 0.14em | uppercase | 0.5% | — | 02 / Inference engine |

Scale: ratio 1.07 (minor second), base 14px, fit 0.85. Sizes in use: 10, 10.5, 11, 11.5, 12, 13, 14, 15, 16, 17, 18, 23.2, 24, 44, 76, 100.

## Spacing
Grid 2px (98.3% of measured paddings, margins and gaps sit on it).

| value | share |
|---|---|
| 8px | 13.2% |
| 16px | 12.9% |
| 6px | 12.1% |
| 12px | 11.6% |
| 10px | 11.1% |
| 24px | 9% |
| 20px | 6.8% |
| 2px | 4.4% |
| 4px | 3.6% |
| 40px | 2.7% |
| 32px | 2% |
| 28px | 1.6% |
| 64px | 1.3% |
| 14px | 1.3% |
| 48px | 1% |
| 5px | 0.8% |

## Radii
| radius | count | on |
|---|---|---|
| 9999px | 29 | button, small, media, surface |
| 8px | 21 | button, small, surface |
| 15px | 16 | button |
| 22px | 15 | surface, button |
| 10px | 11 | small, surface, button |
| 5px | 10 | small, button |
| 20px | 8 | surface |
| 14px | 8 | surface |

## Borders
| border | count |
|---|---|
| `1px solid #e4e4df` | 94 |
| `1px solid #dfdfdf` | 60 |
| `1px solid #d2d2cc` | 33 |
| `1px solid rgb(255 255 255 / 0.55)` | 16 |
| `1px solid rgb(245 245 242 / 0.218)` | 15 |
| `1px solid rgb(0 136 89 / 0.25)` | 8 |
| `1px solid #ebebeb` | 6 |
| `2px solid rgb(245 245 242 / 0.218)` | 5 |

## Shadows
| shadow | count | on |
|---|---|---|
| `lab(100 0 0 / 0.9) 0px 1px 0px 0px inset, lab(0 0 0 / 0.05) 0px 1px 2px 0px` | 13 | div, figure, a, article |
| `lab(100 0 0) 0px 1px 0px 0px inset, lab(0 0 0 / 0.05) 0px -2px 0px 0px inset, lab(13 0 0 / 0.16) 0px 0px 0px 1px, rgb(200, 200, 193) 0px 3px 0px 0px, lab(13 0 0 / 0.1) 0px 4px 0px 1px, lab(0 0 0 / 0.16) 0px 9px 12px -4px` | 7 | a |
| `lab(100 0 0 / 0.22) 0px 1px 0px 0px inset, lab(0 0 0 / 0.35) 0px -2px 0px 0px inset, rgb(20, 20, 20) 0px 0px 0px 1px, rgb(15, 15, 15) 0px 3px 0px 0px, rgb(10, 10, 10) 0px 4px 0px 1px, lab(0 0 0 / 0.38) 0px 9px 14px -4px` | 5 | button, a |
| `lab(100 0 0 / 0.7) 0px 1px 0px 0px inset, lab(100 0 0 / 0.18) 0px -1px 0px 0px inset, lab(7.22637 -0.0000149012 0 / 0.06) 0px 0px 0px 1px, lab(18.5617 -2.88492 -20.3069 / 0.28) 0px 8px 28px -10px` | 4 | div |
| `lab(100 0 0 / 0.22) 0px 1px 0px 0px inset, lab(0 0 0 / 0.35) 0px -2px 0px 0px inset, rgb(20, 20, 20) 0px 0px 0px 1px, rgb(15, 15, 15) 0px 2px 0px 0px, rgb(10, 10, 10) 0px 3px 0px 1px, lab(0 0 0 / 0.38) 0px 8px 14px -4px` | 4 | button |
| `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, lab(100 0 0) 0px 1px 0px 0px inset, lab(0 0 0 / 0.08) 0px 1px 2px 0px` | 3 | a |
| `lab(0 0 0 / 0.08) 0px 0px 0px 1px, lab(0 0 0 / 0.06) 0px 1px 2px 0px` | 3 | a, article |
| `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, lab(0 0 0 / 0.08) 0px 0px 0px 1px` | 3 | span |

## Backdrop
- `blur(8px)` (×12)
- `blur(14px) saturate(1.4)` (×4)
