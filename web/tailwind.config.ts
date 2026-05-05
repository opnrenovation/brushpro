import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#f8fafc',
        'surface': '#ffffff',
        'surface-hover': '#f1f5f9',
        'border-base': '#e2e8f0',
        'primary': '#1e40af',
        'primary-dark': '#1e3a8a',
        'primary-light': '#3b82f6',
        'success': '#16a34a',
        'warning': '#d97706',
        'danger': '#dc2626',
        'accent': '#E8A838',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        admin: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '24px',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'counter': 'counter 2s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
