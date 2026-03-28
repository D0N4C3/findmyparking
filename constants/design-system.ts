export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  title: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
} as const;

export const elevation = {
  none: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
