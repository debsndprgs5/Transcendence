module.exports = {
  content: [
    './client/**/*.html',
    './client/**/*.js',
    './client/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',   // custom blue
        accent:  '#fbbf24',   // accent yellow
      },
      backgroundImage: {
        'chat-starry':    "url('../assets/chat-bg.png')",    // main chat background
        'pongmenu-ui':    "url('../assets/pongmenu-bg.png')",    // main chat background
        'msg1bgimage':    "url('../assets/msg1bgimage.png')",// own message bubble
        'msg2bgimage':    "url('../assets/msg2bgimage.png')",// other message bubble
      },
    },
  },
  plugins: [],
}