/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html'
  ],
  theme: {
    extend: {
      colors: {
        // Using CSS variables directly
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground): var(--primary-hover)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground): var(--accent-hover)',
        destructive: 'var(--destructive)',
        border: 'var(--border)',
        button:' var(--button)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        
        // Direct text colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-red': 'var(--text-red)',
        'text-blue': 'var(--text-blue)',
        'text-disabled': 'var(--text-disabled)',
        
        // YouTube base colors for special usage
        youtube: {
          red: {
            50: '#FFE5E5',
            100: '#FFB8B8',
            200: '#FF8A8A',
            300: '#FF5C5C',
            400: '#FF2E2E',
            500: '#FF0000',
            600: '#CC0000',
            700: '#990000',
            800: '#660000',
            900: '#330000'
          }
        }
      },
      
      // Custom animations
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite'
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      
      // Custom boxShadow styles
      boxShadow: {
        'youtube-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'youtube-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'youtube-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'youtube-dark': '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
      }
    },
  },
  plugins: [],
}
