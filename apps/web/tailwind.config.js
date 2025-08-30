/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Magpie-inspired color palette
        magpie: {
          50: '#edf1f4',   // antiflash-white - lightest
          100: '#beb1a5',  // khaki - light neutral
          200: '#127176',  // caribbean-current - primary teal
          300: '#2c5766',  // midnight-green - darker teal
          400: '#192c2c',  // gunmetal - dark neutral
          500: '#06161a',  // rich-black - darkest
        }
      }
    },
  },
  plugins: [
    require("daisyui"),
  ],
  daisyui: {
    themes: [
      {
        "magpie-light": {
          "primary": "#127176",      // caribbean-current - 主要按钮和链接
          "secondary": "#2c5766",    // midnight-green - 次要元素
          "accent": "#beb1a5",       // khaki - 强调色
          "neutral": "#192c2c",      // gunmetal - 中性色
          "base-100": "#edf1f4",     // antiflash-white - 主背景
          "base-200": "#beb1a5",     // khaki - 次要背景
          "base-300": "#2c5766",     // midnight-green - 边框等
          "base-content": "#06161a", // rich-black - 主要文字
          "info": "#127176",
          "success": "#059669",
          "warning": "#d97706",
          "error": "#dc2626"
        }
      },
      "light",
      "dark"
    ],
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    logs: false, // shows info about daisyUI version and used config in the console when building your CSS
  },
}