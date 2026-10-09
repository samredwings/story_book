import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8b5cf6',
        secondary: '#ec4899',
        dark: '#0f172a',
      },
    },
  },
  plugins: [],
  // Keep CSS small in static export / WebView
  future: {
    hoverOnlyWhenSupported: true,
  },
};

export default config;
