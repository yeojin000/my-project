// tailwind.config.js

import { defineConfig } from 'tailwindcss/config';

export default defineConfig({
  // content 설정은 3.x와 동일하게 유지됩니다.
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  
  // theme 설정 (extend 포함)
  theme: {
    extend: {},
  },
  
  // ⚠️ 플러그인은 비워둡니다.
  plugins: [],
  
  // 💡 테두리 문제를 해결하기 위한 가장 핵심적인 설정
  corePlugins: {
    // 1. 브라우저의 기본 CSS(테두리, 마진 등)를 강제로 초기화 (테두리 제거의 핵심)
    preflight: true,
    
    // 2. 디버그 목적으로 실수로 켜질 수 있는 아웃라인(테두리) 기능을 강제로 비활성화
    outline: false, 
  }
});