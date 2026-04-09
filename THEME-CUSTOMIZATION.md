# IRL App - Theme & Color Customization Guide

This document explains how to change colors, fonts, and visual styles across the entire IRL application.

---

## Architecture Overview

The app uses a **design token system** powered by CSS custom properties (variables) and Tailwind CSS v4. All colors flow through a single source of truth:

\`\`\`
app/globals.css (CSS variables)
    -> @theme inline (Tailwind color mappings)
        -> Tailwind utility classes (bg-primary, text-accent, etc.)
            -> UI Components (components/ui/*.tsx)
                -> App Pages (app/**/*.tsx)
\`\`\`

---

## Where to Change Colors

### 1. Global Theme Colors: `app/globals.css`

This is the **primary file** for all color changes. Open `app/globals.css` and find the `:root` block (light mode) and `.dark` block (dark mode).

#### Core Color Tokens

| Token | Purpose | Current Light Value | Tailwind Class |
|-------|---------|-------------------|----------------|
| `--background` | Page background | `210 20% 98%` (light gray) | `bg-background` |
| `--foreground` | Main text color | `220 14% 18%` (dark gray) | `text-foreground` |
| `--primary` | Primary brand color | `212 100% 48%` (blue #0070f3) | `bg-primary`, `text-primary` |
| `--secondary` | Secondary brand color | `142 71% 45%` (green #22c55e) | `bg-secondary` |
| `--accent` | Accent/CTA color | `12 99% 53%` (orange-red #fe3a10) | `bg-accent`, `text-accent` |
| `--accent-hover` | Accent hover state | `12 91% 47%` (darker) | `text-accent-hover` |
| `--accent-light` | Accent backgrounds | `14 100% 61%` (lighter) | `bg-accent-light` |
| `--muted` | Subdued backgrounds | `220 14% 96%` | `bg-muted` |
| `--muted-foreground` | Subdued text | `220 9% 46%` | `text-muted-foreground` |
| `--destructive` | Error/danger | `0 72% 51%` (red) | `bg-destructive` |
| `--card` | Card backgrounds | `0 0% 100%` (white) | `bg-card` |
| `--border` | Border color | `220 13% 82%` | `border-border` |

#### How Color Values Work

Colors use **HSL format without the `hsl()` wrapper**: `Hue Saturation% Lightness%`

\`\`\`css
/* Example: Change the accent from orange-red to purple */
--accent: 270 80% 55%;        /* was: 12 99% 53% */
--accent-hover: 270 75% 45%;  /* was: 12 91% 47% */
--accent-light: 270 85% 70%;  /* was: 14 100% 61% */
\`\`\`

To convert a hex color to HSL, use any online converter (e.g., https://htmlcolors.com/hex-to-hsl).

#### Example: Changing the Accent Color to Teal

In `app/globals.css`:

\`\`\`css
/* Light mode - in :root */
--accent: 174 72% 40%;
--accent-hover: 174 72% 35%;
--accent-light: 174 72% 55%;

/* Dark mode - in .dark */
--accent: 174 72% 55%;
--accent-hover: 174 72% 50%;
--accent-light: 174 72% 65%;
\`\`\`

---

### 2. Tailwind Color Mappings: `@theme inline` block in `app/globals.css`

The `@theme inline` block maps CSS variables to Tailwind color names. You generally do NOT need to edit this unless you are adding entirely new color tokens.

\`\`\`css
@theme inline {
  --color-accent: var(--accent);           /* maps to bg-accent, text-accent */
  --color-accent-hover: var(--accent-hover); /* maps to text-accent-hover */
  --color-accent-light: var(--accent-light); /* maps to bg-accent-light */
  /* ... etc */
}
\`\`\`

To add a new color token:
1. Define the CSS variable in `:root` and `.dark`
2. Map it in `@theme inline` as `--color-your-name: var(--your-name);`
3. Use it as `bg-your-name` or `text-your-name` in components

---

### 3. Component-Level Styles: `components/ui/*.tsx`

These are the base shadcn/ui components. Each component uses Tailwind classes that reference the design tokens:

| Component File | What It Controls |
|---------------|-----------------|
| `components/ui/card.tsx` | Card backgrounds, borders, spacing |
| `components/ui/button.tsx` | Button variants and colors |
| `components/ui/dialog.tsx` | Modal/dialog backgrounds |
| `components/ui/sidebar.tsx` | Sidebar navigation styling |
| `components/ui/table.tsx` | Table row hovers, headers |
| `components/ui/badge.tsx` | Badge color variants |
| `components/ui/sheet.tsx` | Mobile drawer/sheet styling |
| `components/ui/dropdown-menu.tsx` | Dropdown menu backgrounds |
| `components/ui/select.tsx` | Select dropdown backgrounds |
| `components/ui/tabs.tsx` | Tab list backgrounds |
| `components/ui/toast.tsx` | Toast notification styles |
| `components/ui/tooltip.tsx` | Tooltip backgrounds |
| `components/ui/popover.tsx` | Popover backgrounds |
| `components/ui/alert-dialog.tsx` | Confirmation dialog backgrounds |

#### Translucent/Glass Effect

Many components use translucent backgrounds with backdrop blur for a glassmorphism effect:

\`\`\`tsx
// Card uses bg-card/80 (80% opacity) + backdrop blur
'bg-card/80 text-card-foreground backdrop-blur-sm'

// Dialog uses bg-background/90 (90% opacity) + backdrop blur
'bg-background/90 backdrop-blur-md'
\`\`\`

To adjust translucency:
- Change the `/80` or `/90` suffix (0-100, lower = more transparent)
- Change `backdrop-blur-sm` to `backdrop-blur-md` or `backdrop-blur-lg` for more/less blur

Custom glass utility classes are also available:
- `.glass` - Standard translucent (80% opacity, 8px blur)
- `.glass-heavy` - Heavier translucent (90% opacity, 12px blur)
- `.glass-light` - Lighter translucent (60% opacity, 6px blur)

---

### 4. Portal-Level Styles: `components/portal/*.tsx`

| File | What It Controls |
|------|-----------------|
| `components/portal/portal-header.tsx` | Top navigation bar (bg-background/80 backdrop-blur-md) |
| `components/portal/portal-footer.tsx` | Footer bar (bg-background/80 backdrop-blur-sm) |
| `components/portal/portal-sidebar.tsx` | Sidebar menu content and links |
| `components/portal/portal-layout.tsx` | Overall portal layout structure |

---

### 5. Page-Specific Styles: `app/**/*.tsx`

Individual pages may have inline Tailwind classes for custom styling:

| Page | Key Style Locations |
|------|-------------------|
| `app/auth/login/page.tsx` | Login card, demo credentials, footer |
| `app/auth/sign-up/page.tsx` | Registration form styling |
| `app/admin/dashboard/page.tsx` | Admin stat cards, charts |
| `app/manager/dashboard/dashboard-client.tsx` | Manager stat cards, team list |
| `app/runner/dashboard/dashboard-client.tsx` | Runner stat cards, race list |
| `app/manager/teams/teams-client.tsx` | Team management cards, forms |

---

## Changing Fonts

Fonts are configured in two places:

### 1. Font Import: `app/layout.tsx`

\`\`\`tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
\`\`\`

To change the font, replace `Inter` with any Google Font (e.g., `Poppins`, `Roboto`, `Open_Sans`).

### 2. Font Variable: `app/globals.css`

\`\`\`css
@theme inline {
  --font-sans: 'Inter', ui-sans-serif, system-ui, ...;
  --font-mono: ui-monospace, SFMono-Regular, ...;
}
\`\`\`

Update the `--font-sans` value to match your chosen font name.

---

## Changing Border Radius

The `--radius` variable in `:root` controls the base border radius for all components:

\`\`\`css
--radius: 0.625rem;  /* 10px - current value */
\`\`\`

- Sharper corners: `--radius: 0.375rem;` (6px)
- Rounder corners: `--radius: 0.75rem;` (12px)
- Fully rounded: `--radius: 1rem;` (16px)

---

## Dark Mode

Dark mode is controlled by the `next-themes` library. The `.dark` block in `globals.css` defines all dark mode colors. The `ThemeProvider` in `app/layout.tsx` handles toggling. Users toggle via the theme switch in the portal header.

To change dark mode colors, edit the `.dark { }` block in `app/globals.css` following the same token names as light mode.

---

## Utility Classes Reference

Custom utility classes defined in `app/globals.css`:

| Class | Description |
|-------|-------------|
| `.glass` | Translucent bg + 8px blur |
| `.glass-heavy` | Heavier translucent bg + 12px blur |
| `.glass-light` | Lighter translucent bg + 6px blur |
| `.accent-border` | Accent-colored border with hover |
| `.accent-card` | Card with accent border on hover |
| `.accent-link` | Accent-colored link with hover underline |
| `.accent-highlight` | Accent background tint |
| `.accent-focus` | Accent focus ring |
| `.container-responsive` | Responsive container with padding |
| `.grid-responsive-2` through `.grid-responsive-5` | Responsive grid layouts |
| `.section-spacing` | Consistent section vertical padding |
| `.card-spacing` | Consistent card padding |

---

## Quick Reference: File Priority

When making color changes, work in this order:

1. **`app/globals.css`** - Change the CSS variable values (affects everything)
2. **`components/ui/*.tsx`** - Change base component styles (affects all instances)
3. **`components/portal/*.tsx`** - Change portal chrome (header, footer, sidebar)
4. **`app/**/*.tsx`** - Change page-specific inline styles (affects single pages)
