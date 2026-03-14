import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark mode palette — updated from light to dark
        paper: '#0d0d12',    // was #F7F7F5 — now deep dark background
        forest: '#e0e0e0',   // was #1A3C2B — now light text on dark
        grid: '#a0a0a0',     // was #3A3A38 — now medium gray
        coral: '#FF8C69',    // accent — unchanged
        mint: '#9EFFBF',     // accent — unchanged
        gold: '#F4D35E',     // accent — unchanged
      },
      fontFamily: {
        header: ['Space Grotesk', 'sans-serif'],
        body: ['General Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'none': '0px',
        'sm': '2px',
      },
      letterSpacing: {
        'tight': '-0.02em',
        'wide': '0.1em',
      },
      lineHeight: {
        'tight': '0.9',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
