// src/main_page.jsx
import React, { useState } from "react";
import Home from "./pages/Home.jsx";
import BrowseEvents from "./pages/BrowseEvents.jsx";
import MapPage from "./pages/Map.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import Favorites from "./pages/Favorites.jsx";
import MyPage from "./pages/MyPage.jsx";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";

/* 좌측 사이드바 메뉴 */
const MENU = [
  { to: "/home", label: "HOME" },
  { to: "/browse", label: "Browse Events" }, // 라벨 표준화
  { to: "/map", label: "Map" },
  { to: "/calendar", label: "Calendar" },
  { to: "/favorites", label: "Favorites" },
  { to: "/mypage", label: "My Page" },
];

/* ① 처음 화면: 상단 SEOUL NOW + 아래 큰 사진(히어로) */
function Landing() {
  return (
    <div className="relative h-[calc(100vh-48px)] w-full overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt="hero"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}

function SearchBar() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    setResult(`"${q}" 검색 결과를 표시합니다.`);
    // 실제 검색 페이지로 이동하려면 아래 사용:
    // navigate(`/search?query=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="relative">
      {/* 입력창 */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="검색"
        className="h-7 w-44 md:w-56 border rounded pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        aria-label="검색어 입력"
      />

      {/* 돋보기 아이콘 버튼 */}
      <button
        type="button"
        onClick={handleSearch}
        className="absolute right-2 top-1.5"
        aria-label="검색"
        title="검색"
      >
        <img
          src="/images/search.png" // 실제 위치가 public/images/search.png인지 확인!
          alt=""
          className="w-4 h-4 pointer-events-none select-none"
        />
      </button>

      {/* 임시 결과 */}
      {result && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow p-2 text-sm text-gray-700">
          {result}
        </div>
      )}
    </div>
  );
}

/* 공통 레이아웃 */
function Layout({ children }) {
  const [open, setOpen] = useState(false); // 기본: 사이드바 닫힘
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* 상단바 */}
      <header className="fixed top-0 left-0 right-0 h-12 border-b bg-white z-50">
        <div className="h-full flex items-center justify-between px-3">
          {/* 햄버거 */}
          <button
            className="p-1 rounded hover:bg-gray-100"
            onClick={() => setOpen((v) => !v)}
            aria-label="toggle menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* 로고 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 font-extrabold tracking-wider cursor-pointer"
            onClick={() => navigate("/")}
            title="SEOUL NOW 페이지로 이동"
          >
            SEOUL NOW
          </div>

          {/* 검색 */}
          <SearchBar />
        </div>
      </header>

      {/* 사이드바 */}
      <aside
        className={`fixed top-12 left-0 bottom-0 w-56 bg-black text-white overflow-y-auto transition-transform duration-200 z-40 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex flex-col py-4">
          {/* 필요하면 Landing 항목 추가 가능
          <NavLink to="/" className="px-4 py-3 text-sm opacity-90 hover:bg-white/10">Main (Landing)</NavLink>
          */}
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => setOpen(false)} // 항목 누르면 닫힘
              className={({ isActive }) =>
                "px-4 py-3 text-sm " +
                (isActive ? "bg-white/10 font-semibold" : "opacity-90 hover:bg-white/10")
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 본문 */}
      <main className="pt-12">{children}</main>

      {/* 푸터 */}
      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-gray-500 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} SEOUL NOW</span>
          <a
            href="https://www.flaticon.com/free-icons/magnifying-glass"
            title="magnifying glass icons"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            Magnifying glass icons created by Royyan Wijaya - Flaticon
          </a>
        </div>
      </footer>
    </div>
  );
}

/* 앱 루트 */
export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* 랜딩 */}
          <Route path="/" element={<Landing />} />

          {/* 메뉴 페이지들 */}
          <Route path="/home" element={<Home />} />
          <Route path="/browse" element={<BrowseEvents />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/mypage" element={<MyPage />} />

          {/* 404 */}
          <Route path="*" element={<div className="p-6">페이지를 찾을 수 없습니다.</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
