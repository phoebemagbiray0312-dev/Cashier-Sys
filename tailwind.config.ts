import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { colors: { 'uc-yellow': '#FACC15', 'uc-ink': '#151923' }, fontFamily: { sans: ['Inter', 'Arial', 'sans-serif'] } } },
  plugins: []
};
export default config;
