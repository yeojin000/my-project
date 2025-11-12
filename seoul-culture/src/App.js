// src/App.jsx (이전 main_page.jsx + Home.jsx 통합 + 서울시 문화행사 API 연동)
// - 데이터를 lib/seoulApi.js의 fetchSeoulAllEventsJSON로 페이징 수집
import React, { useEffect, useMemo, useState } from "react";
import BrowseEvents from "./pages/BrowseEvents.jsx";
import MapPage from "./pages/Map.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import Favorites from "./pages/Favorites.jsx";
import MyPage from "./pages/MyPage.jsx";
import EventDetail from "./pages/EventDetail";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { FaTheaterMasks, FaPalette, FaGraduationCap, FaQuestion } from "react-icons/fa";

// 🔗 전체 수집 유틸 (src/lib/seoulApi.js)
import { fetchSeoulAllEventsJSON } from "./lib/seoulApi";

/* === .env 키 === */
const SEOUL_KEY = (process.env.REACT_APP_SEOUL_KEY || "").trim();

/* --- 카테고리/색상 --- */
const categories = [
  { id: 1, name: "공연", icon: FaTheaterMasks },
  { id: 2, name: "전시", icon: FaPalette },
  { id: 3, name: "교육/체험", icon: FaGraduationCap },
  { id: 4, name: "기타", icon: FaQuestion },
];

const CATEGORY_COLORS = {
  공연: "bg-indigo-500",
  전시: "bg-emerald-500",
  "교육/체험": "bg-amber-500",
  기타: "bg-rose-500",
};

/* --- 달력 유틸 --- */
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

/** API의 날짜 문자열(YYYY-MM-DD, YYYY.MM.DD, YYYYMMDD…)을 Date로 안전 변환 */
function toISODate(dateStr = "") {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  const s = raw.replaceAll(".", "-").split(" ")[0];
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d) ? null : d;
}

/** 카테고리 상위매핑 */
function toHighLevelCategory(codename = "", themecode = "") {
  const c = String(codename);
  if (["콘서트", "클래식", "국악", "무용", "연극", "뮤지컬/오페라", "축제-기타"].some(k => c.includes(k))) {
    return "공연";
  }
  if (c.includes("전시/미술")) return "전시";
  if (c.includes("교육/체험") || String(themecode).includes("교육")) return "교육/체험";
  return "기타";
}

/** OpenAPI 결과(배열/JSON 둘 다 허용)를 프론트에서 쓰기 편한 객체배열로 변환 (캘린더용 allDates 포함) */
function normalizeEvents(jsonOrRows) {
  const rows = Array.isArray(jsonOrRows)
    ? jsonOrRows
    : (jsonOrRows?.culturalEventInfo?.row || []);
  return rows.map((r, idx) => {
    const start = toISODate(r.STRTDATE || r.DATE);
    const end = toISODate(r.END_DATE || r.ENDDATE || r.END);
    const cat = toHighLevelCategory(r.CODENAME, r.THEMECODE);

    // 달력 표시를 위해 시작~종료까지 날짜 확장 (최대 31일로 안전 제한)
    const dates = [];
    if (start) {
      const until = end && !isNaN(end) ? end : start;
      const maxSpan = 31;
      const cursor = new Date(start);
      let steps = 0;
      while (cursor <= until && steps < maxSpan) {
        dates.push(formatDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
        steps++;
      }
    }

    return {
      id: r.SVCID || `${Date.now()}_${idx}`,
      title: r.TITLE || r.SVCNM || "무제",
      category: cat,
      codename: r.CODENAME,
      gu: r.GUNAME,
      place: r.PLACE,
      org: r.ORG_NAME,
      fee: r.USE_FEE,
      target: r.USE_TRGT,
      time: r.TIME,
      homepage: r.ORG_LINK || r.HMPG_ADDR,
      img: r.MAIN_IMG,
      startDate: start ? formatDateKey(start) : null,
      endDate: end && !isNaN(end) ? formatDateKey(end) : null,
      allDates: dates, // 캘린더 찍을 날짜 배열
    };
  });
}

/** 데이터 로딩 훅: 전체 페이지를 합쳐 로드 (lib 사용) */
function useSeoulEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!SEOUL_KEY) {
          throw new Error("REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인).");
        }
        // 👉 한 번에 전량 수집 (200개 페이지 단위), 안전상한은 필요 시 조정
        const rows = await fetchSeoulAllEventsJSON({
          seoulKey: SEOUL_KEY,
          pageSize: 200,
          hardLimit: 5000,   // 필요하면 상향 가능
          useProxy: false,   // setupProxy 사용 시 true
          signal: ctrl.signal,
        });
        if (!mounted) return;
        const items = normalizeEvents(rows);
        setEvents(items);
      } catch (e) {
        if (!mounted) return;
        setErr(e);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  return { events, loading, error: err };
}

/* --- Calendar 컴포넌트 (Calendar.jsx 스타일로 동기화) --- */
function Calendar({ events = [], weekStartsOn = 0, title = "캘린더", onCardClick }) {
  const [cursor, setCursor] = useState(() => new Date()); // 현재 달
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const todayKey = formatDateKey(new Date());

  const matrix = useMemo(() => getMonthMatrix(y, m, weekStartsOn), [y, m, weekStartsOn]);

  // 날짜별 매핑: 현재 달에 해당하는 날짜만 셀에 점으로 표시
  const eventsByDay = useMemo(() => {
    const map = {};
    const ymPrefix = `${y}-${String(m + 1).padStart(2, "0")}-`;
    for (const ev of events) {
      const days = ev.allDates?.length ? ev.allDates : (ev.startDate ? [ev.startDate] : []);
      for (const d of days) {
        if (d.startsWith(ymPrefix)) {
          (map[d] ||= []).push(ev);
        }
      }
    }
    return map;
  }, [events, y, m]);

  const weekLabels = weekStartsOn === 1
    ? ["월", "화", "수", "목", "금", "토", "일"]
    : ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div
      className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
      onClick={onCardClick}
      title="전체 캘린더 보기"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setCursor(new Date(y, m - 1, 1)); }}
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="이전 달"
          >
            ←
          </button>
          <div className="text-sm font-medium">
            {y}.{String(m + 1).padStart(2, "0")}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setCursor(new Date(y, m + 1, 1)); }}
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="다음 달"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
        {weekLabels.map((w) => (<div key={w} className="py-1">{w}</div>))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {matrix.map(({ date, inCurrentMonth }, idx) => {
          const key = formatDateKey(date);
          const day = date.getDate();
          const todaysEvents = inCurrentMonth ? (eventsByDay[key] || []) : [];

          // 지난 날짜 회색/비활성 스타일
          const isPast = inCurrentMonth && key < todayKey;

          return (
            <div
              key={idx}
              className={[
                "aspect-square rounded-md border p-1 flex flex-col",
                !inCurrentMonth
                  ? "bg-gray-50 text-gray-300"
                  : isPast
                  ? "bg-gray-50 text-gray-400"
                  : "bg-white"
              ].join(" ")}
              title={todaysEvents.map(e => e.title).join(", ")}
            >
              <div className="text-right text-xs">{day}</div>
              <div className="mt-auto flex flex-wrap gap-1">
                {todaysEvents.slice(0, 4).map((ev, i) => (
                  <span
                    key={i}
                    className={[
                      "inline-block w-2 h-2 rounded-full",
                      CATEGORY_COLORS[ev.category] || "bg-gray-400",
                      isPast ? "opacity-50" : ""
                    ].join(" ")}
                  />
                ))}
                {todaysEvents.length > 4 && (
                  <span className="text-[10px] text-gray-500">
                    +{todaysEvents.length - 4}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

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

/* --- HOME 콘텐츠 (API 연동) --- */
function HomeContent() {
  const { events, loading, error } = useSeoulEvents();
  const navigate = useNavigate();

  // 추천행사: 이미지가 있는 상위 몇 개
  const featured = useMemo(() => {
    const withImg = events.filter(e => e.img);
    return (withImg.length ? withImg : events).slice(0, 4);
  }, [events]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative h-96 w-full overflow-hidden">
        <img
          src="/images/hero.jpg"
          alt="hero"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* 카테고리 */}
      <section className="p-6">
        <h2 className="text-xl font-semibold mb-4">카테고리별 행사 보기</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/browse?category=${encodeURIComponent(cat.name)}`)}
                className="group cursor-pointer rounded-lg shadow-md hover:shadow-lg transition bg-white p-4 flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-gray-200"
                aria-label={`${cat.name} 카테고리로 이동`}
                title={`${cat.name}만 보기`}
              >
                <div className="flex items-center justify-center w-full h-24 mb-2">
                  <IconComponent className="w-12 h-12 text-gray-800 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-lg font-bold text-gray-800">
                  {cat.name}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 추천 + 캘린더 */}
      <section className="p-6">
        <div className="grid md:grid-cols-2 gap-4">
          {/* 추천 행사 (실데이터) */}
          <div>
            <h2 className="text-xl font-semibold mb-4">추천 행사</h2>

            {loading && (
              <div className="text-sm text-gray-500">불러오는 중…</div>
            )}
            {error && (
              <div className="text-sm text-red-600">
                데이터를 불러오지 못했어요. {String(error.message || error)}
              </div>
            )}

            {!loading && !error && featured.length === 0 && (
              <div className="text-sm text-gray-500">표시할 행사가 없어요.</div>
            )}

            <div className="grid md:grid-cols-1 gap-4">
              {featured.map(ev => (
                <div key={ev.id} className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition">
                  {ev.img && (
                    <img src={ev.img} alt={ev.title} className="rounded-md mb-3 w-full object-cover max-h-60" />
                  )}
                  <h3 className="font-semibold text-lg">{ev.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    📅 {ev.startDate}{ev.endDate ? ` ~ ${ev.endDate}` : ""}
                  </p>
                  <p className="text-sm text-gray-600">📍 {ev.place || ev.gu || "장소 미정"}</p>
                  <div className="mt-2 inline-flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${CATEGORY_COLORS[ev.category] || "bg-gray-200"} text-white`}>
                      {ev.category}
                    </span>
                    {ev.fee && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {ev.fee}
                      </span>
                    )}
                  </div>
                  {ev.homepage && (
                    <div className="mt-2">
                      <a href={ev.homepage} target="_blank" rel="noreferrer" className="text-sm underline">
                        상세보기
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 캘린더 (실데이터) */}
          <div>
            <h2 className="text-xl font-semibold mb-4">행사 캘린더</h2>
            <Calendar
              events={events}
              weekStartsOn={0}
              onCardClick={() => navigate("/calendar")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* --- 공통 레이아웃 --- */
const MENU = [
  { to: "/", label: "HOME" },
  { to: "/browse", label: "Browse Events" },
  { to: "/map", label: "Map" },
  { to: "/calendar", label: "Calendar" },
  { to: "/favorites", label: "Favorites" },
  { to: "/mypage", label: "My Page" },
];

function SearchBar() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    setResult(`"${q}" 검색 결과를 표시합니다.`);
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") handleSearch(); };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="검색"
        className="h-7 w-44 md:w-56 border rounded pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        aria-label="검색어 입력"
      />
      <button type="button" onClick={handleSearch} className="absolute right-2 top-1.5" aria-label="검색" title="검색">
        <img src="/images/search.png" alt="" className="w-4 h-4 pointer-events-none select-none" />
      </button>
      {result && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow p-2 text-sm text-gray-700 z-50">
          {result}
        </div>
      )}
    </div>
  );
}

function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 h-12 border-b bg-white z-50">
        <div className="h-full flex items-center justify-between px-3">
          <button className="p-1 rounded hover:bg-gray-100" onClick={() => setOpen(v => !v)} aria-label="toggle menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div
            className="absolute left-1/2 -translate-x-1/2 font-extrabold tracking-wider cursor-pointer"
            onClick={() => navigate("/")}
            title="SEOUL NOW 페이지로 이동"
          >
            SEOUL NOW
          </div>

          <SearchBar />
        </div>
      </header>

      <aside className={`fixed top-12 left-0 bottom-0 w-56 bg-black text-white overflow-y-auto transition-transform duration-200 z-40 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <nav className="flex flex-col py-4">
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                "px-4 py-3 text-sm " + (isActive ? "bg-white/10 font-semibold" : "opacity-90 hover:bg-white/10")
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="pt-12">{children}</main>

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

/* --- 앱 루트 --- */
export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeContent />} />
          <Route path="/browse" element={<BrowseEvents />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="*" element={<div className="p-6">페이지를 찾을 수 없습니다.</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
