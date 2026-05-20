/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f1f5f9",
        coral: "#f97316",
        lake: "#0ea5e9"
      }
    }
  },
  plugins: []
};
