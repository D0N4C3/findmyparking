import { appThemeTokens } from '@/lib/theme/tokens';

export const Colors = appThemeTokens;

export type ColorTheme = (typeof Colors)[keyof typeof Colors];
