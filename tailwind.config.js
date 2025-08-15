/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // รองรับทั้ง React JS และ TypeScript
  ],
  theme: {
    extend: {},
    colors: {
        main: "#505991",
        secondary: "#FFFFFF",
      },
      fontFamily: {
        lao: ['"Noto Sans Lao"', 'sans-serif'],
      },
  },
  plugins: [],
};
