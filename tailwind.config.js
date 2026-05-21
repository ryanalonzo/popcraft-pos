/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Editorial-craft palette (Design A — Popcraft).
        paper: {
          DEFAULT: '#f4ede0',
          warm: '#ece1cc',
          deep: '#e3d4b7',
        },
        ink: {
          DEFAULT: '#1a1410',
          soft: '#3a2f24',
          muted: '#7a6a55',
          faint: '#b3a48c',
        },
        accent: {
          DEFAULT: '#d23a1a',
          deep: '#a02b10',
          soft: '#f5d4c4',
        },
        gold: '#b8893d',
        green: '#4a6b3a',
        chrome: '#2a221a',
        line: 'rgba(26, 20, 16, 0.12)',
        'line-strong': 'rgba(26, 20, 16, 0.25)',
      },
      fontFamily: {
        // Display = Fraunces (serif). Body inherits from `serif`.
        serif: ['Fraunces_400Regular'],
        'serif-italic': ['Fraunces_400Regular_Italic'],
        'serif-medium': ['Fraunces_500Medium'],
        'serif-semibold': ['Fraunces_600SemiBold'],
        'serif-bold': ['Fraunces_700Bold'],
        'serif-bold-italic': ['Fraunces_700Bold_Italic'],
        // Micro labels = JetBrains Mono.
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-semibold': ['JetBrainsMono_600SemiBold'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
    },
  },
  plugins: [],
};
