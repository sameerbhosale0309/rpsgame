/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cf: {
          chassis: '#181b20',
          panel: '#22272e',
          bezel: '#13161a',
          metal: '#323943',
          cream: '#e5dfd3',
          warmgray: '#9aa0a6',
          beige: '#cfc6b4',
          orange: '#ff6b35',
          burntOrange: '#d34a10',
          amber: '#ffb000',
          amberGlow: '#ff9000',
          green: '#33ff55',
          greenDark: '#0b2612',
          crtBg: '#09150d',
          amberBg: '#1c1305',
          crimson: '#e63946',
          cyan: '#00e5ff',
          tapeBrown: '#3a271d',
        },
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        terminal: ['"VT323"', 'monospace'],
        industrial: ['"Chakra Petch"', 'sans-serif'],
      },
      boxShadow: {
        'bezel-outer': '0 4px 15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)',
        'bezel-inner': 'inset 0 3px 10px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.05)',
        'tactile-btn': '0 4px 0 #111417, 0 6px 10px rgba(0,0,0,0.6)',
        'tactile-btn-pressed': '0 1px 0 #111417, inset 0 2px 4px rgba(0,0,0,0.8)',
        'crt-glow-green': '0 0 20px rgba(51, 255, 85, 0.4), inset 0 0 15px rgba(51, 255, 85, 0.2)',
        'crt-glow-amber': '0 0 20px rgba(255, 176, 0, 0.4), inset 0 0 15px rgba(255, 176, 0, 0.2)',
      },
      animation: {
        'tape-spin': 'tapeSpin 2s linear infinite',
        'tape-spin-fast': 'tapeSpin 0.75s linear infinite',
        'crt-flicker': 'crtFlicker 0.15s infinite',
        'blink-slow': 'blink 1.2s infinite steps(1, start)',
      },
      keyframes: {
        tapeSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        crtFlicker: {
          '0%': { opacity: '0.98' },
          '50%': { opacity: '1.0' },
          '100%': { opacity: '0.97' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
