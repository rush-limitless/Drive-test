export const dashboardTheme = {
  radius: 16,
  spacing: 24,
  card: {
    padding: 20,
    elevation: 6,
  },
  colors: {
    bg: '#F7FAFC',
    panel: '#FFFFFF',
    text: '#1A202C',
    subtext: '#4A5568',
    primary: '#2563EB',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    border: '#E2E8F0',
    mutedBorder: '#CBD5F5',
    accent: '#EEF2FF',
  },
  shadows: {
    card: '0 8px 24px rgba(0,0,0,0.06)',
    cardHover: '0 12px 32px rgba(0,0,0,0.08)',
  },
} as const;

export type DashboardTheme = typeof dashboardTheme;
