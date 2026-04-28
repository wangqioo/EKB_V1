/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Apple-inspired neutral palette
        apple: {
          bg:         '#f5f5f7',  // Apple标志浅灰
          surface:    '#ffffff',  // 卡片白
          elevated:   '#fafafa',  // 悬浮
          border:      'rgba(0,0,0,.065)',
          'border-strong': 'rgba(0,0,0,.12)',
        },
        ink: {
          primary:   '#1d1d1f',  // Apple黑
          secondary: '#86868b',  // Apple灰
          tertiary:  '#acacb0',  // 占位符
        },
        accent: {
          DEFAULT:    '#0071e3',  // Apple蓝
          light:      '#f5f9ff',
          hover:      '#0077ed',
        },
        success:  '#34c759',
        warning:  '#ff9f0a',
        error:    '#ff3b30',
      },
      fontFamily: {
        sans: ['SF Pro Display', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Microsoft YaHei"', 'sans-serif'],
      },
      borderRadius: {
        'apple-sm':  '8px',
        'apple':     '12px',
        'apple-lg':  '16px',
        'apple-xl':  '20px',
        'apple-2xl': '24px',
      },
      boxShadow: {
        'apple-sm':  '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        'apple':     '0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)',
        'apple-lg':  '0 10px 30px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.06)',
        'apple-xl':  '0 20px 50px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.06)',
        'inner-soft': 'inset 0 1px 2px rgba(0,0,0,.06)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fade-up':    'fadeUp 0.3s ease-out',
        'scale-in':   'scaleIn 0.25s cubic-bezier(.34,1.56,.64,1)',
        'slide-in':   'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeUp:   { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:  { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        slideIn:  { '0%': { opacity: '0', transform: 'translateX(-8px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
