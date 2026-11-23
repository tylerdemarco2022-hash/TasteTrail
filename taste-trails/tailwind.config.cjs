module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1917',
        paper: '#f6f3ef',
        line: '#e7e5e4',
        mute: '#78716c',
        amberink: '#9a3412',
        brand: '#c2410c'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['Georgia', '"Iowan Old Style"', 'Palatino', 'serif']
      },
      borderRadius: {
        card: '20px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 10px 28px rgba(28,25,23,0.06)'
      }
    }
  },
  plugins: []
}
