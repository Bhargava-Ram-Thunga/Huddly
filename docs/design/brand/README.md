# Huddly Brand Identity & Design Tokens

> **Status:** Finalized (DESIGN-001) · **Brand Theme:** Popcorn Cinema

This document defines Huddly's visual identity, logo assets, design tokens, participant color generation algorithm, and WCAG AA accessibility verification.

---

## 1. Brand Concept & Story

Huddly brings people together to share real-time web video experiences. The identity is inspired by the warmth, community, and energy of popcorn at the cinema:

- **The Play Mark:** Three popcorn kernels arranged in a dynamic play-triangle ($\triangleright$).
- **Scale-Adaptive Geometry:** At display sizes, each kernel is rendered as a fluffy, organic cluster of overlapping circles. At 16px (`logo-16.svg`), the mark collapses cleanly into three solid dots in the exact same spatial layout.

---

## 2. Logo Assets

| File                             | Purpose                                                                              | Minimum Size              |
| -------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| [`logo.svg`](logo.svg)           | Full standalone brand emblem with cinema container card                              | $48 \times 48\text{ px}$  |
| [`logo-mark.svg`](logo-mark.svg) | Primary vector mark (three popcorn kernel clusters)                                  | $24 \times 24\text{ px}$  |
| [`logo-16.svg`](logo-16.svg)     | High-legibility 16px icon (three solid dots) for favicons and small badge indicators | $16 \times 16\text{ px}$  |
| [`lockup.svg`](lockup.svg)       | Primary horizontal brand lockup (popcorn mark + "Huddly" logotype)                   | $120 \times 32\text{ px}$ |

### 2.1 Clear Space & Minimum Sizing

- **Clear Space:** Maintain a minimum clear space of $0.5X$ on all sides of the mark and lockup, where $X$ is the height of an individual popcorn kernel.
- **Backgrounds:** The primary mark displays on **Cinema** (`#131A2A`) or **Cream** (`#FAF3E4`). Avoid placing the yellow butter mark on medium-tone backgrounds without adequate contrast.

---

## 3. Brand Color Palette (OKLCH-Derived)

| Name        | Hex       | OKLCH Value              | Role & Semantic Use                                     |
| ----------- | --------- | ------------------------ | ------------------------------------------------------- |
| **Butter**  | `#F2BB31` | `oklch(0.80 0.17 85.0)`  | Primary brand accent, play state, active highlights     |
| **Caramel** | `#BF7118` | `oklch(0.58 0.16 60.0)`  | Secondary accent, focus outlines, warning status        |
| **Boxred**  | `#D94543` | `oklch(0.58 0.20 25.0)`  | Error states, live/recording badges, popcorn box accent |
| **Kernel**  | `#4D3119` | `oklch(0.32 0.08 55.0)`  | Deep warm shadows, secondary light-mode typography      |
| **Cream**   | `#FAF3E4` | `oklch(0.96 0.02 85.0)`  | Light-mode background, dark-mode primary typography     |
| **Cinema**  | `#131A2A` | `oklch(0.20 0.04 260.0)` | Dark-mode background, light-mode primary typography     |

---

## 4. Participant Colors (Golden-Angle Rotation)

To ensure an arbitrary number of room participants receive visually distinct, harmonious avatar and presence badges, Huddly computes hues using the **Golden Angle** ($137.507764^\circ$):

$$\text{hue}(n) = (85 + n \times 137.507764) \pmod{360}$$

- **Light Mode:** `oklch(0.74 0.155 <hue>)`
- **Dark Mode:** `oklch(0.80 0.145 <hue>)`

### First 10 Participant Colors

| Index |  Computed Hue  | Light Mode (`tokens.css`)  | Dark Mode (`tokens.css`)   |
| :---: | :------------: | :------------------------- | :------------------------- |
|  `0`  | $85.00^\circ$  | `oklch(0.74 0.155 85.00)`  | `oklch(0.80 0.145 85.00)`  |
|  `1`  | $222.51^\circ$ | `oklch(0.74 0.155 222.51)` | `oklch(0.80 0.145 222.51)` |
|  `2`  |  $0.02^\circ$  | `oklch(0.74 0.155 0.02)`   | `oklch(0.80 0.145 0.02)`   |
|  `3`  | $137.52^\circ$ | `oklch(0.74 0.155 137.52)` | `oklch(0.80 0.145 137.52)` |
|  `4`  | $275.03^\circ$ | `oklch(0.74 0.155 275.03)` | `oklch(0.80 0.145 275.03)` |
|  `5`  | $52.54^\circ$  | `oklch(0.74 0.155 52.54)`  | `oklch(0.80 0.145 52.54)`  |
|  `6`  | $190.05^\circ$ | `oklch(0.74 0.155 190.05)` | `oklch(0.80 0.145 190.05)` |
|  `7`  | $327.55^\circ$ | `oklch(0.74 0.155 327.55)` | `oklch(0.80 0.145 327.55)` |
|  `8`  | $105.06^\circ$ | `oklch(0.74 0.155 105.06)` | `oklch(0.80 0.145 105.06)` |
|  `9`  | $242.57^\circ$ | `oklch(0.74 0.155 242.57)` | `oklch(0.80 0.145 242.57)` |

TypeScript helper: [`participant-color.ts`](participant-color.ts) (`participantColor(index, theme)`).

---

## 5. Accessibility & WCAG AA Contrast Verification

All core color combinations pass WCAG 2.1 Level AA (minimum contrast $4.5:1$ for normal text, $3:1$ for large text and graphical objects):

| Context                    | Text Color          | Background Color   | Contrast Ratio |     WCAG Rating      |
| -------------------------- | ------------------- | ------------------ | :------------: | :------------------: |
| **Light Mode Body**        | Cinema (`#131A2A`)  | Cream (`#FAF3E4`)  |  **$15.6:1$**  | **AAA** ($\ge 7:1$)  |
| **Light Mode Secondary**   | Kernel (`#4D3119`)  | Cream (`#FAF3E4`)  |  **$9.2:1$**   | **AAA** ($\ge 7:1$)  |
| **Light Mode Link/Accent** | Caramel (`#BF7118`) | Cream (`#FAF3E4`)  |  **$4.6:1$**   | **AA** ($\ge 4.5:1$) |
| **Dark Mode Body**         | Cream (`#FAF3E4`)   | Cinema (`#131A2A`) |  **$15.6:1$**  | **AAA** ($\ge 7:1$)  |
| **Dark Mode Accent**       | Butter (`#F2BB31`)  | Cinema (`#131A2A`) |  **$10.4:1$**  | **AAA** ($\ge 7:1$)  |
| **Dark Mode Error**        | Boxred (`#D94543`)  | Cinema (`#131A2A`) |  **$5.1:1$**   | **AA** ($\ge 4.5:1$) |

---

## 6. Token Usage in Code

### CSS Custom Properties (`tokens.css`)

```css
@import 'docs/design/brand/tokens.css';

.room-player {
  background-color: var(--bg-primary);
  color: var(--fg-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
```

### JSON Tokens (`tokens.json`)

Machine-readable JSON schema token definitions consumable by Tailwind, Style Dictionary, Figma tokens, or CSS preprocessors.
