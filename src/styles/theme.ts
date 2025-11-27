import { extendTheme, ThemeConfig } from '@chakra-ui/react';

export const chakraThemeConfig: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config: chakraThemeConfig,
  fonts: {
    heading: 'Inter, "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
  },
  colors: {
    brand: {
      50: '#f5f8ff',
      100: '#e4ecff',
      200: '#cdd9ff',
      300: '#a9c0ff',
      400: '#7b9eff',
      500: '#4d7cff',
      600: '#315de5',
      700: '#2346b2',
      800: '#1b3585',
      900: '#13265c',
    },
  },
  styles: {
    global: {
      body: {
        backgroundColor: 'gray.50',
        color: 'gray.900',
      },
    },
  },
});

export default theme;
