/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        qhin: "#7c3aed",
        participant: "#2563eb",
        subparticipant: "#0891b2",
        child: "#16a34a",
      },
    },
  },
  plugins: [],
};
