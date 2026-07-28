export const tokens = {
  colors: {
    bg: '#0f172a',
    card: 'rgba(15, 23, 42, 0.7)',
    accent: '#14b8a6', // Teal 500
    accentLight: '#2dd4bf', // Teal 400
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    headlineSize: 'clamp(2.5rem, 5vw, 4rem)',
    subtextSize: '1.125rem',
  },
  spacing: {
    sectionPadding: '6rem 1.5rem',
    containerMax: '64rem',
  },
  motion: {
    durationFast: '150ms',
    durationNormal: '200ms',
    easingOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
  },
} as const
