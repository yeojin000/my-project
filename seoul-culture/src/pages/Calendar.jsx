import React, { useMemo, useState } from "react";

// 카테고리(브라우즈와 동일 라벨)
const CATEGORIES = ["전체", "공연", "전시", "교육/체험", "기타"];

// 카테고리 색(점 표시용)
const CAT_COLOR = {
  공연: "bg-indigo-500",
  전시: "bg-emerald-500",
  "교육/체험": "bg-amber-500",
  기타: "bg-rose-500",
};

// 데모 이벤트 (실제 API 연동 시 교체)
// date: 'YYYY-MM-DD'
const DEMO = [
  { id: "e1", title: "서울재즈페스티벌", date: "2025-10-08", place: "올림픽공원", category: "공연" },
  { id: "e2", title: "시립미술관 가을 기획전", date: "2025-10-12", place: "서울시립미술관", category: "전시" },
  { id: "e3", title: "한강 야외 체험 클래스", date: "2025-10-18", place: "여의도 한강공원", category: "교육/체험" },
  { id: "e4", title: "청년 문화마켓", date: "2025-10-25", place: "성수동", category: "기타" },
  { id: "e5", title: "실내 콘서트", date: "2025-11-03", place: "장충체육관", category: "공연" },
];

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthMatrix(year, monthIdx, weekStartsOn = 0) {
  // weekStartsOn: 0=Sun, 1=Mon
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);
  const days = last.getDate();
  const firstDay = (first.getDay() - weekStartsOn + 7) % 7;
  const total = Math.ceil((firstDay + days) / 7) * 7;

  const cells = [];
  for (let i = 0; i < total; i++) {
    const dayOffset = i - firstDay + 1;
    const d = new Date(year, monthIdx, dayOffset);
    const inMonth = dayOffset >= 1 && dayOffset <= days;
    cells.push({ date: d, inMonth });
  }
  return cells;
}

export default function CalendarPage() {
  // ① 기본은 현재 년/월
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [category, setCategory] = useState("전체");
  const [activeDay, setActiveDay] = useState(null); // 'YYYY-MM-DD'

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  // ③ 달력 매트릭스
  const matrix = useMemo(() => monthMatrix(y, m, 0), [y, m]);

  // 이번 달 이벤트(카테고리 필터 적용)
  const eventsThisMonth = useMemo(() => {
    const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
    return DEMO.filter((e) => e.date.startsWith(ym) && (category === "전체" || e.category === category));
  }, [y, m, category]);

  // 날짜별 그룹
  const byDay = useMemo(() => {
    const map = {};
    eventsThisMonth.forEach((e) => {
      (map[e.date] ||= []).push(e);
    });
    return map;
  }, [eventsThisMonth]);

  // ④ 오른쪽 상세: 선택된 날짜의 이벤트
  const selectedEvents = activeDay ? (byDay[activeDay] || []) : [];

  // ① 년/월 셀렉터 표시용 (YYYY.MM)
  const ymLabel = `${y}.${String(m + 1).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-6xl mx-auto">
      

      {/* 페이지 제목 */}
      <h2 className="text-2xl font-semibold mb-4">Calendar</h2>

      {/* ① 년/월 선택 + ② 카테고리 선택 */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
        {/* 년월 선택 (좌우 화살표) */}
        <div className="flex items-stretch">
          <div className="border rounded-l px-3 py-2 min-w-[110px] grid place-items-center">
            {ymLabel}
          </div>
          <button
            className="border-y border-r px-3 py-2"
            onClick={() => {
              const d = new Date(y, m - 1, 1);
              setCursor(d);
              setActiveDay(null);
            }}
            aria-label="이전 달"
            title="이전 달"
          >
            ◀
          </button>
          <button
            className="border rounded-r border-l-0 px-3 py-2"
            onClick={() => {
              const d = new Date(y, m + 1, 1);
              setCursor(d);
              setActiveDay(null);
            }}
            aria-label="다음 달"
            title="다음 달"
          >
            ▶
          </button>
        </div>

        {/* ② 카테고리 선택 */}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            // 카테고리 바꾸면 선택일 초기화
            setActiveDay(null);
          }}
          className="border rounded px-3 py-2 w-56"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 본문: ③ 달력 / ④ 상세 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ③ 캘린더 */}
        <div className="lg:col-span-6">
          <div className="border rounded-lg p-4">
            {/* 요일 헤더 */}
            <div className="text-sm text-gray-600 mb-2">
              {new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
                <div key={w} className="py-1">{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {matrix.map(({ date, inMonth }, idx) => {
                const key = ymd(date);
                const day = date.getDate();
                const events = inMonth ? (byDay[key] || []) : [];
                const isToday = ymd(date) === ymd(new Date());
                const isActive = activeDay === key;

                return (
                  <button
                    key={idx}
                    disabled={!inMonth}
                    onClick={() => setActiveDay(key)}
                    className={[
                      "aspect-square rounded-md border p-1 text-left",
                      inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50 text-gray-400 cursor-default",
                      isActive ? "ring-2 ring-black" : "",
                    ].join(" ")}
                    title={inMonth && events.length ? `${events.length}개 행사` : undefined}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={isToday ? "font-bold underline" : ""}>{day}</span>
                      {/* 점(이벤트 존재 표시) 최대 3개 */}
                      <span className="flex gap-0.5">
                        {events.slice(0, 3).map((e, i) => (
                          <i
                            key={i}
                            className={`inline-block w-1.5 h-1.5 rounded-full ${CAT_COLOR[e.category] || "bg-gray-400"}`}
                          />
                        ))}
                      </span>
                    </div>
                    {/* 여백 */}
                    <div className="mt-3" />
                  </button>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {Object.entries(CAT_COLOR).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <i className={`inline-block w-2 h-2 rounded-full ${v}`} />
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ④ 상세 영역 */}
        <div className="lg:col-span-6">
          <div className="border rounded-lg p-4 min-h-[280px] bg-gray-50">
            {!activeDay ? (
              <div className="text-sm text-gray-500 h-40 grid place-items-center">
                날짜를 선택하면 해당 날짜의 행사가 표시됩니다.
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="text-sm text-gray-500 h-40 grid place-items-center">
                {activeDay} 일정이 없습니다.
              </div>
            ) : (
              <ul className="space-y-3">
                {selectedEvents.map((e) => (
                  <li key={e.id} className="bg-white border rounded p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{e.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{e.category}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">📅 {e.date}</p>
                    <p className="text-sm text-gray-600">📍 {e.place}</p>
                    <div className="mt-2 text-right">
                      <button
                        className="text-xs underline underline-offset-4"
                        onClick={() => alert(`상세 페이지로 이동 (id: ${e.id})`)}
                      >
                        상세보기
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
