module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './mobile/**/*.{js,jsx,ts,tsx}',
    './App.js'
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {}
  },
  plugins: []
}
