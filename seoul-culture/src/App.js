// src/App.js
import React from "react";
import MainPage from "./main_page"; // ✅ 기본 내보내기(default export) 컴포넌트여야 함

export default function App() {
  return <MainPage />; // ✅ 메인 레이아웃 + 라우팅은 MainPage에서
}
