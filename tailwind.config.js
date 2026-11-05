/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Classic Foxboro workstation palette (I/A Series / FoxView-era gray + navy)
        fox: {
          bg: '#aeb3b8',
          panel: '#d4d7da',
          panel2: '#e6e8ea',
          edge: '#7d848b',
          navy: '#1d3b6e',
          navy2: '#2c5597',
          canvas: '#eef0f2',
          ok: '#1e8a3c',
          warn: '#c98a00',
          alarm: '#d01c1c',
          cyan: '#00a3b4',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
