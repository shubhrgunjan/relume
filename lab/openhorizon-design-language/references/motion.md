# Motion

## Scroll feel
Native scrolling: one wheel notch moves 100px instantly. Do not add smoothing.

## Tokens
| duration | uses |
|---|---|
| 300ms | 225 |
| 340ms | 212 |
| 700ms | 147 |
| 500ms | 111 |
| 120ms | 60 |
| 160ms | 22 |
| 280ms | 10 |
| 320ms | 6 |
| 140ms | 6 |
| 134ms | 6 |

| curve | uses | kind |
|---|---|---|
| `cubic-bezier(0.22, 1, 0.36, 1)` | 535 | bezier |
| `cubic-bezier(0, 0, 0.2, 1)` | 88 | bezier |
| `cubic-bezier(0.2, 0.8, 0.2, 1)` | 66 | bezier |
| `cubic-bezier(0.2, 0.7, 0.2, 1)` | 66 | bezier |
| `ease` | 22 | bezier |
| `cubic-bezier(0.4, 0, 0.2, 1)` | 18 | bezier |
| `ease-out` | 12 | bezier |
| `cubic-bezier(0.25, 0.1, 0.35, 1)` | 3 | bezier |
| `cubic-bezier(0.44,0.02,0.11,0.84)` | 1 | bezier |
| `cubic-bezier(0.38,1.13,1,-1.41)` | 1 | bezier |

Libraries detected: next, tailwindLike.

## Intro choreography (ms after load)
- -1ms — div.animate-enter.lg:col-span-9 854×196 (intro-blur-scale-spin-2)
- -1ms — div.animate-enter.lg:col-span-9 854×224 (intro-blur-scale-spin-2)
- 13ms — div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×560 (intro-fade-3)
- 13ms — div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×560 (intro-fade-3)
- 15ms — div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×668 (intro-fade-3)
- 15ms — div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×668 (intro-fade-3)
- 72ms — h1.display-hero.animate-enter “Agents for the physical ” 896×200 (intro-blur-scale-spin-2)
- 105ms — div.animate-enter.lg:col-span-9 854×482 (intro-blur-scale-spin-2)
- 192ms — div.animate-enter.flex 768×242 (intro-blur-scale-spin-2)
- 293ms — div.window.mt-16 1152×498 (intro-blur-scale-spin-2)
- 1014ms — div.grid.transition-[grid-template-rows] 284×96 (intro-gridtemplaterows-4)
- 1014ms — span.mono.absolute “Reading the last attempt” (intro-fade-out-1)
- 1014ms — span.mono.absolute “Reading the last attempt” (intro-fade-out-1)
- 1760ms — span.mono.absolute “Reading the last attempt” (intro-fade-out-1)
- 1760ms — span.mono.absolute “Reading the last attempt” (intro-fade-out-1)
- 1760ms — span.mono.absolute “Read the last attempt · ” (intro-fade-out-1)
- 1760ms — span.mono.absolute “Read the last attempt · ” (intro-fade-out-1)
- 2091ms — span.mono.absolute “Writing a skill…” (intro-fade-out-1)
- 2091ms — span.mono.absolute “Writing a skill…” (intro-fade-out-1)
- 2852ms — span.mono.absolute “Writing a skill…” (intro-fade-out-1)
- 2852ms — span.mono.absolute “Writing a skill…” (intro-fade-out-1)

## Load / intro
Plays once when the page loads. Use `data-intro="<name>"` with motion.css; set `--i` for stagger order.

### intro-fade-out-1 — ×7
Seen on: span.mono.absolute “Reading the last attempt”; span.mono.absolute “Read the last attempt · ”; span.mono.absolute “Writing a skill…”; span.mono.absolute “Skill ready · place_red_”
- from `filter: none; opacity: 1;` to `filter: blur(3px); opacity: 0;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 331ms between siblings — source: css-transition
```css
@keyframes intro-fade-out-1 {
  from { filter: none; opacity: 1; }
  to { filter: blur(3px); opacity: 0; }
}
```
### intro-blur-scale-spin-2 — ×6
Seen on: h1.display-hero.animate-enter “Agents for the physical ” 896×200; div.animate-enter.flex 768×242; div.window.mt-16 1152×498; div.animate-enter.lg:col-span-9 854×196
- from `transform: translate3d(0px, 0px, 0px) scale3d(1, 1, 1) rotate(0deg); filter: blur(0px); opacity: 1;` to `filter: none; opacity: 1;`
- 320ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` — source: css-animation
```css
@keyframes intro-blur-scale-spin-2 { 0%{opacity:var(--tw-enter-opacity,1);transform:translate3d(var(--tw-enter-translate-x,0),var(--tw-enter-translate-y,0),0)scale3d(var(--tw-enter-scale,1),var(--tw-enter-scale,1),var(--tw-enter-scale,1))rotate(var(--tw-enter-rotate,0));filter:blur(var(--tw-enter-blur,0))} }
```
### intro-fade-3 — ×2
Seen on: div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×560; div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×668
- from `opacity: 0; translate: 0px 16px;` to `opacity: 1; translate: none;`
- 700ms, `cubic-bezier(0.2, 0.7, 0.2, 1)` — source: css-transition
```css
@keyframes intro-fade-3 {
  from { opacity: 0; translate: 0px 16px; }
  to { opacity: 1; translate: none; }
}
```
### intro-gridtemplaterows-4 — ×1
Seen on: div.grid.transition-[grid-template-rows] 284×96
- from `grid-template-rows: 12px;` to `grid-template-rows: 12px;`
- 500ms, `cubic-bezier(0, 0, 0.2, 1)` — source: css-transition
```css
@keyframes intro-gridtemplaterows-4 {
  from { grid-template-rows: 12px; }
  to { grid-template-rows: 12px; }
}
```
### intro-height-5 — ×1
Seen on: div.grid.content-center
- from `height: 0px;` to `height: 44px;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
@keyframes intro-height-5 {
  from { height: 0px; }
  to { height: 44px; }
}
```

## Scroll reveals
Triggered as elements enter the viewport. Use `data-reveal="<name>"`; motion.js observes them at the measured entry point.

### reveal-fade-6 — ×31
Seen on: div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 1152×136; div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 755×540; div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 357×462; div.motion-safe:transition-[opacity,translate].motion-safe:duration-700 755×396
- from `opacity: 0; translate: 0px 16px;` to `opacity: 1; translate: none;`
- 700ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`, stagger 80ms between siblings, starts at 83% viewport — source: css-transition
```css
[data-reveal="reveal-fade-6"] { opacity: 0; translate: 0px 16px; transition: opacity 700ms cubic-bezier(0.2, 0.7, 0.2, 1),
    translate 700ms cubic-bezier(0.2, 0.7, 0.2, 1); }
[data-reveal="reveal-fade-6"].is-in { opacity: 1; translate: none; }
```
### reveal-fade-7 — ×7
Seen on: div 209×66; div 209×96; div 209×562; div 209×114
- from `opacity: 0;` to `opacity: 1;`
- 280ms, `cubic-bezier(0.4, 0, 0.2, 1)`, stagger 554ms between siblings, starts at 70% viewport — source: waapi
```css
[data-reveal="reveal-fade-7"] { opacity: 0; transition: opacity 280ms cubic-bezier(0.4, 0, 0.2, 1); }
[data-reveal="reveal-fade-7"].is-in { opacity: 1; }
```
### reveal-fade-blur-8 — ×7
Seen on: span.mono.absolute “Recalling past attempts…”; span.mono.absolute “No past attempts · fresh”; span.mono.absolute “Writing a skill…”; span.mono.absolute “Skill ready · wave_hello”
- from `filter: blur(3px); opacity: 0;` to `filter: none; opacity: 1;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 348ms between siblings — source: css-transition
```css
[data-reveal="reveal-fade-blur-8"] { filter: blur(3px); opacity: 0; transition: filter 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 300ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-fade-blur-8"].is-in { filter: none; opacity: 1; }
```
### reveal-fade-out-9 — ×4
Seen on: div.grid.content-center; span.mono.absolute “Recalling past attempts…”; span.mono.absolute “Writing a skill…”; span.mono.absolute “Checking balance…”
- from `filter: none; opacity: 1; height: 0px;` to `filter: blur(3px); opacity: 0; height: 44px;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-fade-out-9"] { filter: none; opacity: 1; height: 0px; transition: filter 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 300ms cubic-bezier(0.22, 1, 0.36, 1),
    height 300ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-fade-out-9"].is-in { filter: blur(3px); opacity: 0; height: 44px; }
```
### reveal-tint-10 — ×3
Seen on: li.flex.items-center 207×37
- from `background-color: oklab(0.984998 -0.00000956655 0.0000230074);` to `background-color: rgba(0, 0, 0, 0);`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-tint-10"] { background-color: oklab(0.984998 -0.00000956655 0.0000230074); transition: background-color 340ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-tint-10"].is-in { background-color: rgba(0, 0, 0, 0); }
```
### reveal-fade-11 — ×2
Seen on: div.flex.items-center 196×32; span.absolute.right-3 “red cube · 0.94”
- from `opacity: 0;` to `opacity: 1;`
- 300ms, `cubic-bezier(0.25, 0.1, 0.35, 1)` — source: waapi
```css
[data-reveal="reveal-fade-11"] { opacity: 0; transition: opacity 300ms cubic-bezier(0.25, 0.1, 0.35, 1); }
[data-reveal="reveal-fade-11"].is-in { opacity: 1; }
```
### reveal-width-12 — ×1
Seen on: div.h-full.bg-term-max
- from `width: 33.3333%;` to `width: 66.6667%;`
- 700ms, `cubic-bezier(0, 0, 0.2, 1)` — source: css-transition
```css
[data-reveal="reveal-width-12"] { width: 33.3333%; transition: width 700ms cubic-bezier(0, 0, 0.2, 1); }
[data-reveal="reveal-width-12"].is-in { width: 66.6667%; }
```
### reveal-tint-13 — ×1
Seen on: button.flex.cursor-pointer 196×32
- from `background-color: rgba(0, 0, 0, 0); border-bottom-color: rgba(0, 0, 0, 0); border-left-color: rgba(0, 0, 0, 0); border-right-color: rgba(0, 0, 0, 0); border-color: rgba(0, 0, 0, 0);` to `background-color: rgb(255, 255, 255); border-bottom-color: oklab(0.904998 -0.00000870228 0.0000211); border-left-color: oklab(0.904998 -0.00000870228 0.0000211); border-right-color: oklab(0.904998 -0.00000870228 0.0000211); border-color: oklab(0.904998 -0.00000870228 0.0000211);`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)`, starts at 72% viewport — source: css-transition
```css
[data-reveal="reveal-tint-13"] { background-color: rgba(0, 0, 0, 0); border-bottom-color: rgba(0, 0, 0, 0); border-left-color: rgba(0, 0, 0, 0); border-right-color: rgba(0, 0, 0, 0); border-color: rgba(0, 0, 0, 0); transition: background-color 340ms cubic-bezier(0.22, 1, 0.36, 1),
    border-bottom-color 340ms cubic-bezier(0.22, 1, 0.36, 1),
    border-left-color 340ms cubic-bezier(0.22, 1, 0.36, 1),
    border-right-color 340ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 340ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-tint-13"].is-in { background-color: rgb(255, 255, 255); border-bottom-color: oklab(0.904998 -0.00000870228 0.0000211); border-left-color: oklab(0.904998 -0.00000870228 0.0000211); border-right-color: oklab(0.904998 -0.00000870228 0.0000211); border-color: oklab(0.904998 -0.00000870228 0.0000211); }
```
### reveal-fade-out-blur-tint-14 — ×1
Seen on: span.absolute.-bottom-1.5 128×12
- from `background-color: oklab(0.542591 -0.11227 0.0403883 / 0.25); filter: blur(3px); opacity: 1;` to `background-color: oklab(0.204625 0.00000931323 0.00000409782 / 0.1); filter: blur(4px); opacity: 0;`
- 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-fade-out-blur-tint-14"] { background-color: oklab(0.542591 -0.11227 0.0403883 / 0.25); filter: blur(3px); opacity: 1; transition: background-color 500ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 500ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 500ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-fade-out-blur-tint-14"].is-in { background-color: oklab(0.204625 0.00000931323 0.00000409782 / 0.1); filter: blur(4px); opacity: 0; }
```
### reveal-fade-out-15 — ×1
Seen on: span.relative.block 183×289
- from `filter: none; opacity: 0.95;` to `filter: grayscale(1); opacity: 0.45;`
- 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-fade-out-15"] { filter: none; opacity: 0.95; transition: filter 500ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 500ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-fade-out-15"].is-in { filter: grayscale(1); opacity: 0.45; }
```
### reveal-fade-blur-tint-16 — ×1
Seen on: span.absolute.-bottom-1.5 62×12
- from `background-color: oklab(0.204625 0.00000931323 0.00000409782 / 0.1); filter: blur(4px); opacity: 0;` to `background-color: oklab(0.542591 -0.11227 0.0403883 / 0.25); filter: blur(3px); opacity: 1;`
- 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-fade-blur-tint-16"] { background-color: oklab(0.204625 0.00000931323 0.00000409782 / 0.1); filter: blur(4px); opacity: 0; transition: background-color 500ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 500ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 500ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-fade-blur-tint-16"].is-in { background-color: oklab(0.542591 -0.11227 0.0403883 / 0.25); filter: blur(3px); opacity: 1; }
```
### reveal-fade-17 — ×1
Seen on: span.relative.block 88×326
- from `filter: grayscale(1); opacity: 0.45;` to `filter: none; opacity: 0.95;`
- 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-fade-17"] { filter: grayscale(1); opacity: 0.45; transition: filter 500ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 500ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-fade-17"].is-in { filter: none; opacity: 0.95; }
```
### reveal-tint-18 — ×1
Seen on: button.label.flex “Bimanual arm” 111×28
- from `background-color: rgb(251, 251, 249); color: rgb(23, 23, 23);` to `background-color: rgba(0, 0, 0, 0); color: rgb(110, 110, 105);`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-tint-18"] { background-color: rgb(251, 251, 249); color: rgb(23, 23, 23); transition: background-color 340ms cubic-bezier(0.22, 1, 0.36, 1),
    color 340ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-tint-18"].is-in { background-color: rgba(0, 0, 0, 0); color: rgb(110, 110, 105); }
```
### reveal-tint-19 — ×1
Seen on: button.label.flex “Humanoid” 81×28
- from `background-color: rgba(0, 0, 0, 0); color: rgb(110, 110, 105);` to `background-color: rgb(251, 251, 249); color: rgb(23, 23, 23);`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
[data-reveal="reveal-tint-19"] { background-color: rgba(0, 0, 0, 0); color: rgb(110, 110, 105); transition: background-color 340ms cubic-bezier(0.22, 1, 0.36, 1),
    color 340ms cubic-bezier(0.22, 1, 0.36, 1); }
[data-reveal="reveal-tint-19"].is-in { background-color: rgb(251, 251, 249); color: rgb(23, 23, 23); }
```

## Hover
Measured by hovering every distinct interactive element.

### hover-tint-26 — ×45
Seen on: button.flex.shrink-0 “Stop” 74×32; a.rounded-[10px].px-3 “Research” 79×32; a.rounded-[10px].px-3 “Field notes” 90×32; a.hidden.shrink-0 “Talk to the founder” 137×36
- from `color: oklab(0.57701 0.217634 0.112472);` to `color: oklab(0.509999 -0.00000505149 0.0000118911);`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
transition: color 340ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-tint-27 — ×40
Seen on: li.flex.items-center 207×36; a.rounded-[10px].px-3 “Research” 79×32; a.rounded-[10px].px-3 “Field notes” 90×32; a.hidden.shrink-0 “Talk to the founder” 137×36
- from `background-color: oklab(0.984998 -0.00000956655 0.0000230074);` to `background-color: rgba(0, 0, 0, 0);`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 39ms between siblings — source: css-transition
```css
transition: background-color 340ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-fade-blur-28 — ×25
Seen on: span.mono.absolute “Loading the map…”; span.mono.absolute “Map loaded · 3 doors”; span.mono.absolute “Checking the geofence…”; span.mono.absolute “Route inside the geofenc”
- from `filter: blur(3px); opacity: 0;` to `filter: none; opacity: 1;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 350ms between siblings — source: css-transition
```css
transition: filter 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 300ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-translate-29 — ×23
Seen on: svg.lucide.lucide-arrow-right 14×14; span.transition-transform.group-hover:translate-x-0.5 “→” 7×16; span.transition-transform.group-hover:translate-x-0.5 “→” 14×20
- from `translate: -4px;` to `translate: 0px;`
- 340ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
transition: translate 340ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-scale-30 — ×20
Seen on: img.absolute.inset-0 640×560; img.absolute.inset-0 576×668
- from `transform: scale(none);` to `transform: scale(1.03);`
- 700ms, `cubic-bezier(0, 0, 0.2, 1)` — source: css-transition
```css
transition: transform 700ms cubic-bezier(0, 0, 0.2, 1);
```
### hover-fade-out-blur-tint-31 — ×16
Seen on: span.absolute.-bottom-1.5 173×12; span.relative.block 247×163; span.absolute.-bottom-1.5 125×12; span.relative.block 179×311
- from `opacity: 1; filter: blur(3px); background-color: oklab(0.542591 -0.11227 0.0403883 / 0.25);` to `opacity: 0; filter: blur(4px); background-color: oklab(0.204625 0.00000931323 0.00000409782 / 0.1);`
- 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
transition: opacity 500ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 500ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 500ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-boxshadow-32 — ×15
Seen on: button.btn-raised-dark.relative “Request invite” 141×32; button.btn-raised-dark.group “Request invite” 160×44; a.btn-raised-light.group “Talk to the founder” 193×44; a.btn-raised-light.mt-8 “More on BotCortex” 161×36
- from `box-shadow: oklab(0.999998 -0.00000980496 0.0000234246 / 0.22) 0px 1px 0px 0px inset, oklab(0 0 0 / 0.35) 0px -2px 0px 0px inset, rgb(20, 20, 20) 0px 0px 0px 1px, rgb(15, 15, 15) 0px 2px 0px 0px, rgb(10, 10, 10) 0px 3px 0px 1px, oklab(0 0 0 / 0.38) 0px 8px 14px -4px; translate: 0px;` to `box-shadow: oklab(0.999998 -0.00000980496 0.0000234246 / 0.22) 0px 1px 0px 0px inset, oklab(0 0 0 / 0.35) 0px -2px 0px 0px inset, rgb(20, 20, 20) 0px 0px 0px 1px, rgb(15, 15, 15) 0px 3px 0px 0px, rgb(10, 10, 10) 0px 4px 0px 1px, oklab(0 0 0 / 0.38) 0px 9px 14px -4px; translate: 0px -1px;`
- 120ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` — source: css-transition
```css
transition: box-shadow 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
    translate 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
```
### hover-translate-33 — ×14
Seen on: a.card-art.group 1152×560
- from `translate: none;` to `translate: 0px -4px;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
transition: translate 300ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-filter-34 — ×11
Seen on: button.btn-raised-dark.relative “Request invite” 141×32; button.btn-raised-dark.group “Request invite” 160×44; a.btn-raised-dark.inline-flex “More on BotCortex” 180×40; a.btn-raised-dark.group “Propose a collaboration” 201×44
- from `filter: none;` to `filter: brightness(1.12);`
- 160ms, `ease` — source: css-transition
```css
transition: filter 160ms ease;
```
### hover-width-35 — ×10
Seen on: div.h-full.bg-term-max
- from `width: 33.3333%;` to `width: 66.6667%;`
- 700ms, `cubic-bezier(0, 0, 0.2, 1)` — source: css-transition
```css
transition: width 700ms cubic-bezier(0, 0, 0.2, 1);
```
### hover-gridtemplaterows-36 — ×6
Seen on: div.grid.transition-[grid-template-rows] 284×96
- from `grid-template-rows: 12px;` to `grid-template-rows: 12px;`
- 500ms, `cubic-bezier(0, 0, 0.2, 1)` — source: css-transition
```css
transition: grid-template-rows 500ms cubic-bezier(0, 0, 0.2, 1);
```
### hover-boxshadow-37 — ×6
Seen on: article.card-art.group 1152×668
- from `box-shadow: oklab(0 0 0 / 0.08) 0px 0px 0px 1px, oklab(0 0 0 / 0.06) 0px 1px 2px 0px;` to `box-shadow: oklab(0 0 0 / 0.1) 0px 0px 0px 1px, oklab(0 0 0 / 0.25) 0px 14px 28px -14px;`
- 300ms, `ease-out` — source: css-transition
```css
transition: box-shadow 300ms ease-out;
```
### hover-translate-38 — ×5
Seen on: span.relative.block 183×289; div.flex.w-full 305×108
- from `translate: none;` to `translate: 0px -4px;`
- 500ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
transition: translate 500ms cubic-bezier(0.22, 1, 0.36, 1);
```
### hover-height-39 — ×4
Seen on: div.grid.content-center
- from `height: 0px;` to `height: 44px;`
- 300ms, `cubic-bezier(0.22, 1, 0.36, 1)` — source: css-transition
```css
transition: height 300ms cubic-bezier(0.22, 1, 0.36, 1);
```
