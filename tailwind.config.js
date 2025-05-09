/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './client/**/*.html',      // toutes tes pages HTML statiques
//    './client/**/*.js',        // si tu as des scripts front
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',    // ton bleu custom
        accent:  '#fbbf24'     // ton jaune accent
      }
    }
  },
  plugins: []
}
