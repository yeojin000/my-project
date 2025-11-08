// src/index.js (또는 index.jsx)

import React from 'react';
import ReactDOM from 'react-dom/client';
// import App from './main_page.jsx';  <-- 이 줄을 삭제하거나 주석 처리
import App from './App.js';  // <-- 이 줄로 변경 (새로운 파일 이름)
import './index.css'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);