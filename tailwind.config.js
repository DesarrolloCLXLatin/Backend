/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'custom': {
          50: '#DBD8E3',
          100: '#C8C3D1',
          200: '#A8A0B5',
          300: '#887D99',
          400: '#6E6284',
          500: '#5C5470',
          600: '#4A455C',
          700: '#352F44',
          800: '#2A2438',
          900: '#1F1A2C',
        }
      },
      animation: {
        'blob': 'blob 7s infinite',
        'blob-delay-2': 'blob 7s infinite 2s',
        'blob-delay-4': 'blob 7s infinite 4s',
        'fade-in': 'fade-in 1s ease-out',
        'fade-in-delay': 'fade-in 1s ease-out 0.5s',
      },
      keyframes: {
        blob: {
          '0%, 100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
        },
        'fade-in': {
          'from': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      animationDelay: {
        '500': '500ms',
        '2000': '2000ms',
        '4000': '4000ms',
      },
    },
  },
  plugins: [],
};