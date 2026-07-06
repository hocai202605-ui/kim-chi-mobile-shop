import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201c",
        muted: "#66736d",
        line: "#dce2dc",
        canvas: "#f6f7f3",
        brand: {
          DEFAULT: "#0f8b62",
          dark: "#086246",
          soft: "#e2f3eb",
        },
        gold: "#e2b33c",
        danger: "#c2412d",
      },
      boxShadow: {
        panel: "0 14px 32px rgba(24, 35, 30, 0.09)",
      },
    },
  },
  plugins: [],
};

export default config;
