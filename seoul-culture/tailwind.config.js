// tailwind.config.js

import { defineConfig } from 'tailwindcss/config';

export default defineConfig({
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  
  theme: {
    extend: {},
  },
  
  plugins: [],
  
  //테두리 문제를 해결하기 위한 설정
  corePlugins: {
    preflight: true,
    
    outline: false, 
  }
});