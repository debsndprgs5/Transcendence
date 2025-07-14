/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './client/**/*.html',
    './client/**/*.js',
    './client/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',    // ton bleu custom
        accent:  '#fbbf24'     // ton jaune accent
      }
    }
  },
  theme: {
    extend: {
      backgroundImage: {
        'chat-starry': "url('../chat-bg.png')"   // bg-chat-starry class
      },
    },
  },
  plugins: []
}

