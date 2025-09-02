/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // รองรับทั้ง React JS และ TypeScript
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        secondary: "#6B7280",
        accent: "#FBBF24",
        background: "#F9FAFB",
        surface: "#FFFFFF",
        error: "#EF4444",
        success: "#10B981",
        info: "#3B82F6",
      },
      fontFamily: {
        lao: ['"Noto Sans Lao"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
