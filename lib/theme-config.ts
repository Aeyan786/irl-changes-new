/**
 * Theme Configuration
 * 
 * This file exports the theme configuration for use across the application.
 * Import this config to access theme colors, breakpoints, and utility values.
 */

export const themeConfig = {
  colors: {
    // Primary Brand Color - Blue
    primary: {
      DEFAULT: "#0070f3",
      light: "#3b82f6",
      foreground: "#ffffff",
    },
    // Secondary Color - Green
    secondary: {
      DEFAULT: "#22c55e",
      light: "#4ade80",
      foreground: "#ffffff",
    },
    // Accent Color - Red
    accent: {
      DEFAULT: "#ef4444",
      light: "#f87171",
      foreground: "#ffffff",
    },
    // Background Colors
    background: {
      light: "#f9fafb",
      dark: "#111827",
    },
    // Text Colors
    text: {
      primary: "#1f2937",
      muted: "#6b7280",
      light: "#f9fafb",
    },
    // Border Colors
    border: {
      light: "#d1d5db",
      dark: "#374151",
    },
    // Semantic Colors
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#0070f3",
  },
  
  // Breakpoints (mobile-first)
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
  
  // Spacing Scale
  spacing: {
    xs: "0.25rem",   // 4px
    sm: "0.5rem",    // 8px
    md: "1rem",      // 16px
    lg: "1.5rem",    // 24px
    xl: "2rem",      // 32px
    "2xl": "3rem",   // 48px
    "3xl": "4rem",   // 64px
  },
  
  // Border Radius
  radius: {
    sm: "0.375rem",   // 6px
    md: "0.5rem",     // 8px
    lg: "0.625rem",   // 10px
    xl: "1rem",       // 16px
    full: "9999px",
  },
  
  // Font Configuration
  fonts: {
    sans: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  
  // Font Sizes
  fontSize: {
    xs: "0.75rem",    // 12px
    sm: "0.875rem",   // 14px
    base: "1rem",     // 16px
    lg: "1.125rem",   // 18px
    xl: "1.25rem",    // 20px
    "2xl": "1.5rem",  // 24px
    "3xl": "1.875rem",// 30px
    "4xl": "2.25rem", // 36px
    "5xl": "3rem",    // 48px
  },
  
  // Transitions
  transitions: {
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
  },
} as const

// Type exports for TypeScript support
export type ThemeColors = typeof themeConfig.colors
export type ThemeBreakpoints = typeof themeConfig.breakpoints
export type ThemeSpacing = typeof themeConfig.spacing

/**
 * Helper function to get CSS variable value
 * Usage: getCssVar('--primary') returns the CSS variable value
 */
export function getCssVar(varName: string): string {
  if (typeof window === "undefined") return ""
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

/**
 * Helper function to check if current theme is dark
 * Usage: isDarkMode() returns true if dark mode is active
 */
export function isDarkMode(): boolean {
  if (typeof window === "undefined") return false
  return document.documentElement.classList.contains("dark")
}

/**
 * Responsive breakpoint helper
 * Usage: isAboveBreakpoint('md') returns true if viewport is >= 768px
 */
export function isAboveBreakpoint(breakpoint: keyof typeof themeConfig.breakpoints): boolean {
  if (typeof window === "undefined") return false
  const width = parseInt(themeConfig.breakpoints[breakpoint])
  return window.innerWidth >= width
}

export default themeConfig
