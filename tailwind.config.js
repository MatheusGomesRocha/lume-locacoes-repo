/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Azul-noite da barra lateral e dos títulos
        noite: { 950: '#0B1530', 900: '#101C3D', 800: '#18274F', 700: '#243664', 600: '#3A4C7C' },
        // Fundo frio e bordas suaves
        gelo: { 50: '#F7F9FC', 100: '#EEF2F8', 200: '#E1E7F0', 300: '#CBD4E2' },
        // Âmbar de lâmpada: a cor da marca, usada com economia
        lume: { 50: '#FFF8E6', 100: '#FFEDBF', 300: '#FFD166', 400: '#FFC13D', 500: '#F5A524', 600: '#D9890B', 700: '#A8650A' },
        tinta: { DEFAULT: '#1B2540', soft: '#5B6785', mute: '#8590AA' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,28,61,.04), 0 6px 20px -8px rgba(16,28,61,.10)',
        pop: '0 20px 50px -12px rgba(16,28,61,.35)',
      },
      keyframes: {
        flutuar: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        pontinho: { '0%,60%,100%': { transform: 'translateY(0)', opacity: '.45' }, '30%': { transform: 'translateY(-4px)', opacity: '1' } },
        piscar: { '0%,92%,100%': { transform: 'scaleY(1)' }, '96%': { transform: 'scaleY(.1)' } },
        entrar: { from: { opacity: '0', transform: 'translateY(8px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        flutuar: 'flutuar 3.4s ease-in-out infinite',
        pontinho: 'pontinho 1.2s ease-in-out infinite',
        piscar: 'piscar 5s infinite',
        entrar: 'entrar .22s ease-out both',
      },
    },
  },
  plugins: [],
}
