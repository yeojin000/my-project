import React, { useMemo, useState } from "react";

const categories = [
  { id: 1, name: "공연", img: "/images/concert.jpg" },
  { id: 2, name: "전시", img: "/images/exhibition.jpg" },
  { id: 3, name: "교육/체험", img: "/images/edu.jpg" },
  { id: 4, name: "기타", img: "/images/etc.jpg" },
];

// 카테고리별 색상 매핑
const CATEGORY_COLORS = {
  공연: "bg-indigo-500",
  전시: "bg-emerald-500",
  "교육/체험": "bg-amber-500",
  기타: "bg-rose-500",
};

// 데모용 이벤트 (실제에선 API 데이터로 교체)
// date는 'YYYY-MM-DD' 형식
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
  // weekStartsOn: 0=Sun, 1=Mon
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

function Calendar({ events = [], weekStartsOn = 0, title = "캘린더" }) {
  const [cursor, setCursor] = useState(() => {
    // 데모 이벤트에 맞춰 2025-06으로 시작 (원하면 new Date()로 바꿔도 됨)
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

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 배너 */}
      {/* NOTE: Tailwind에는 bg-black-600이 없어서 bg-black 또는 bg-gray-800 권장 */}
      <header className="bg-black text-white text-center py-6">
        <h1 className="text-2xl font-bold">서울 문화 행사 웹서비스</h1>
        <p className="text-sm mt-2">실시간 서울 문화행사 통합 안내</p>
      </header>

      {/* 카테고리 섹션 */}
      <section className="p-6">
        <h2 className="text-xl font-semibold mb-4">카테고리별 행사 보기</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-lg transition"
            >
              <img
                src={cat.img}
                alt={cat.name}
                className="object-cover w-full h-32 group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-lg font-bold">
                {cat.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 추천 행사 + 캘린더 나란히 배치 */}
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
