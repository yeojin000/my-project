// src/App.jsx (이전 main_page.jsx + Home.jsx 통합)
import React, { useMemo, useState } from "react";
import BrowseEvents from "./pages/BrowseEvents.jsx";
import MapPage from "./pages/Map.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import Favorites from "./pages/Favorites.jsx";
import MyPage from "./pages/MyPage.jsx";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { FaTheaterMasks, FaPalette, FaGraduationCap, FaQuestion } from "react-icons/fa";

// 다른 페이지 컴포넌트 (파일이 없으므로 임시로 더미 컴포넌트 사용)
// 실제 프로젝트에서 이 파일들을 import 해야 합니다.
/*
import BrowseEvents from "./pages/BrowseEvents.jsx";
import MapPage from "./pages/Map.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import Favorites from "./pages/Favorites.jsx";
import MyPage from "./pages/MyPage.jsx";
*/



/* --- Home.jsx 에서 이동된 로직/컴포넌트 시작 --- */

// 카테고리 데이터
const categories = [
    { id: 1, name: "공연", icon: FaTheaterMasks },
    { id: 2, name: "전시", icon: FaPalette },
    { id: 3, name: "교육/체험", icon: FaGraduationCap },
    { id: 4, name: "기타", icon: FaQuestion },
];

// 카테고리별 색상 매핑
const CATEGORY_COLORS = {
  공연: "bg-indigo-500",
  전시: "bg-emerald-500",
  "교육/체험": "bg-amber-500",
  기타: "bg-rose-500",
};

// 데모용 이벤트
const demoEvents = [
  { title: "서울재즈페스티벌 2025", date: "2025-06-02", category: "공연" },
  { title: "시립미술관 기획전", date: "2025-06-10", category: "전시" },
  { title: "한강 돗자리 체험 클래스", date: "2025-06-15", category: "교육/체험" },
  { title: "청년 문화마켓", date: "2025-06-22", category: "기타" },
];

// 날짜 유틸
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthMatrix(year, monthIndex, weekStartsOn = 0) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);

  const daysInMonth = last.getDate();
  const firstDay = (first.getDay() - weekStartsOn + 7) % 7;

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstDay + 1;
    const d = new Date(year, monthIndex, dayOffset);
    const inCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
    cells.push({ date: d, inCurrentMonth });
  }
  return cells;
}

// Calendar 컴포넌트
function Calendar({ events = [], weekStartsOn = 0, title = "캘린더" }) {
  const [cursor, setCursor] = useState(() => {
    return new Date(2025, 5, 1); // 2025년 6월 (0-indexed)
  });

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  const matrix = useMemo(() => getMonthMatrix(y, m, weekStartsOn), [y, m, weekStartsOn]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      (map[e.date] ||= []).push(e);
    });
    return map;
  }, [events]);

  const weekLabels = weekStartsOn === 1
    ? ["월", "화", "수", "목", "금", "토", "일"]
    : ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCursor(new Date(y, m - 1, 1))
            }
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="이전 달"
          >
            ←
          </button>
          <div className="text-sm font-medium">
            {y}.{String(m + 1).padStart(2, "0")}
          </div>
          <button
            onClick={() =>
              setCursor(new Date(y, m + 1, 1))
            }
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="다음 달"
          >
            →
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
        {weekLabels.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {matrix.map(({ date, inCurrentMonth }, idx) => {
          const key = formatDateKey(date);
          const day = date.getDate();
          const todaysEvents = inCurrentMonth ? (eventsByDay[key] || []) : [];
          return (
            <div
              key={idx}
              className={[
                "aspect-square rounded-md border p-1 flex flex-col",
                inCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400",
              ].join(" ")}
            >
              {/* 날짜 숫자 */}
              <div className="text-right text-xs">
                {day}
              </div>
              {/* 이벤트 점들 (카테고리 색상) */}
              <div className="mt-auto flex flex-wrap gap-1">
                {todaysEvents.slice(0, 4).map((ev, i) => (
                  <span
                    key={i}
                    className={[
                      "inline-block w-2 h-2 rounded-full",
                      CATEGORY_COLORS[ev.category] || "bg-gray-400",
                    ].join(" ")}
                    title={`${ev.title} · ${ev.category}`}
                  />
                ))}
                {todaysEvents.length > 4 && (
                  <span className="text-[10px] text-gray-500">+{todaysEvents.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
            <span className="text-gray-700">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ② Home.jsx + Landing 통합된 메인 페이지 콘텐츠 */
function HomeContent() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. 상단 SEOUL NOW + 아래 큰 사진 (Hero 섹션) */}
      <div className="relative h-96 w-full overflow-hidden">
        <img
          src="/images/hero.jpg"
          alt="hero"
          className="absolute inset-0 h-full w-full object-cover"
        />
    
      </div>

      {/* 2. 카테고리 섹션 */}
      <section className="p-6">
        <h2 className="text-xl font-semibold mb-4">카테고리별 행사 보기</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const IconComponent = cat.icon; // 아이콘 컴포넌트를 변수로 받음
            
            return (
              <div
                key={cat.id}
                className="group cursor-pointer rounded-lg shadow-md hover:shadow-lg transition bg-white p-4 flex flex-col items-center justify-center" 
              >
                {/* 1. 픽토그램 영역 (새로 추가/수정) */}
                <div className="flex items-center justify-center w-full h-24 mb-2">
                    <IconComponent className="w-12 h-12 text-gray-800 group-hover:scale-110 transition-transform" />
                </div>
                {/* 2. 텍스트 영역 (이전 이미지 위에 덮었던 것) */}
                <div className="text-lg font-bold text-gray-800">
                    {cat.name}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 추천 행사 + 캘린더 나란히 배치 */}
      <section className="p-6">
        <div className="grid md:grid-cols-2 gap-4">
          {/* 추천 행사 */}
          <div>
            <h2 className="text-xl font-semibold mb-4">추천 행사</h2>
            <div className="grid md:grid-cols-1 gap-4">
              <div className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition">
                <img
                  src="/images/sample-event.jpg"
                  alt="event"
                  className="rounded-md mb-3"
                />
                <h3 className="font-semibold text-lg">서울재즈페스티벌 2025</h3>
                <p className="text-sm text-gray-600 mt-1">📅 2025.06.02 ~ 06.05</p>
                <p className="text-sm text-gray-600">📍 올림픽공원</p>
                {/* 카테고리 배지 예시 */}
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                    공연
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 캘린더 */}
          <div>
            <h2 className="text-xl font-semibold mb-4">행사 캘린더</h2>
            <Calendar events={demoEvents} weekStartsOn={0} />
          </div>
        </div>
      </section>
    </div>
  );
}

/* --- main_page.jsx 에서 이동된 로직/컴포넌트 시작 --- */

/* 좌측 사이드바 메뉴 */
const MENU = [
  { to: "/", label: "HOME" }, // 홈 페이지를 '/'로 변경
  { to: "/browse", label: "Browse Events" }, 
  { to: "/map", label: "Map" },
  { to: "/calendar", label: "Calendar" },
  { to: "/favorites", label: "Favorites" },
  { to: "/mypage", label: "My Page" },
];

/* 검색창 */
function SearchBar() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  // const navigate = useNavigate(); // 만약 검색 후 페이지 이동이 필요하다면 주석 해제

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
          src="/images/search.png" 
          alt=""
          className="w-4 h-4 pointer-events-none select-none"
        />
      </button>

      {/* 임시 결과 */}
      {result && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow p-2 text-sm text-gray-700 z-50">
          {result}
        </div>
      )}
    </div>
  );
}

/* 공통 레이아웃 */
function Layout({ children }) {
  const [open, setOpen] = useState(false);
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
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => setOpen(false)}
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
        {/* 메인 페이지: HomeContent (Hero + 카테고리 등) */}
        <Route path="/" element={<HomeContent />} /> 

        {/* 나머지 메뉴 페이지들 */}
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