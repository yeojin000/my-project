// src/pages/Calendar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchSeoulAllEventsJSON } from "../lib/seoulApi.js";


/* === 환경변수 === */
const SEOUL_KEY = (process.env.REACT_APP_SEOUL_KEY || "").trim();

/* === 카테고리(브라우즈와 동일 라벨) === */
const CATEGORIES = ["전체", "공연", "전시", "교육/체험", "기타"];

/* === 카테고리 색(점 표시용) === */
const CAT_COLOR = {
  공연: "bg-indigo-500",
  전시: "bg-emerald-500",
  "교육/체험": "bg-amber-500",
  기타: "bg-rose-500",
};

/* === 상위 카테고리 매핑 === */
function toHighLevelCategory(codename = "", themecode = "") {
  const c = String(codename);
  if (["콘서트", "클래식", "국악", "무용", "연극", "뮤지컬/오페라", "축제-기타"].some(k => c.includes(k))) {
    return "공연";
  }
  if (c.includes("전시/미술")) return "전시";
  if (c.includes("교육/체험") || String(themecode).includes("교육")) return "교육/체험";
  return "기타";
}

/* === 날짜 유틸 === */
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseToDate(s = "") {
  if (!s) return null;
  const raw = String(s).trim();
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    return isNaN(dt) ? null : dt;
  }
  const normalized = raw.replaceAll(".", "-").split(" ")[0];
  const dt = new Date(`${normalized}T00:00:00`);
  return isNaN(dt) ? null : dt;
}
function normalizeRangeLabel(startStr = "", endStr = "") {
  const s = (startStr || "").replaceAll(".", "-");
  const e = (endStr || "").replaceAll(".", "-");
  if (!s && !e) return "일정 미정";
  if (s && e) return `${s} ~ ${e}`;
  return s || e;
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

/* API → 프론트용 이벤트로 정규화 (날짜구간을 일 단위로 확장) */
function normalizeFromAPI(jsonOrRows) {
  const rows = Array.isArray(jsonOrRows)
    ? jsonOrRows
    : (jsonOrRows?.culturalEventInfo?.row || []);
  return rows.map((r, i) => {
    const startStr = r.STRTDATE || r.DATE;
    const endStr = r.END_DATE || r.ENDDATE || r.END;

    const start = parseToDate(startStr);
    const end = parseToDate(endStr) || start; // 종료일 없으면 시작일 1일 행사로
    const cat = toHighLevelCategory(r.CODENAME, r.THEMECODE);

    // 일자 목록(최대 31일 안전 제한)
    const allDates = [];
    if (start) {
      const until = end && !isNaN(end) ? end : start;
      const cursor = new Date(start);
      let steps = 0;
      while (cursor <= until && steps < 31) {
        allDates.push(ymd(cursor));
        cursor.setDate(cursor.getDate() + 1);
        steps++;
      }
    }

    return {
      id: r.SVCID || `evt_${i}`,
      title: r.TITLE || r.SVCNM || "무제",
      category: cat,
      place: r.PLACE || r.GUNAME || "장소 미정",
      dateLabel: normalizeRangeLabel(startStr, endStr),
      allDates, // 'YYYY-MM-DD' 배열
      homepage: r.ORG_LINK || r.HMPG_ADDR,
      fee: r.USE_FEE,
    };
  });
}

/* 데이터 로딩 훅 */
function useSeoulCalendarEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let abort = false;
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await fetchSeoulAllEventsJSON({
          seoulKey: SEOUL_KEY,
          useProxy: false,       // 프록시 쓰면 true
          pageSize: 200,         // 200씩 페이징
          hardLimit: 5000,       // 안전 상한(원하면 상향)
          signal: ctrl.signal,
        });
        const items = normalizeFromAPI(rows);
        if (!abort) setEvents(items);
      } catch (e) {
        if (!abort) setErr(e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
      ctrl.abort();
    };
  }, []);

  return { events, loading, error: err };
}

export default function CalendarPage() {
  // ① 기본은 현재 년/월
  const today = new Date();
  const todayKey = ymd(today);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [category, setCategory] = useState("전체");
  const [activeDay, setActiveDay] = useState(null); // 'YYYY-MM-DD'

  // 캘린더 박스의 실제 렌더 높이를 상세 패널에 복제
  const calBoxRef = useRef(null);
  const [panelH, setPanelH] = useState(0);

  useEffect(() => {
    if (!calBoxRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setPanelH(Math.round(box.height));
    });
    ro.observe(calBoxRef.current);
    return () => ro.disconnect();
  }, []);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  // API 데이터 로드
  const { events, loading, error } = useSeoulCalendarEvents();

  // ③ 달력 매트릭스
  const matrix = useMemo(() => monthMatrix(y, m, 0), [y, m]);

  // 이번 달에 해당하는 날짜들만 골라 날짜→이벤트 매핑
  const byDay = useMemo(() => {
    const map = {};
    const ymPrefix = `${y}-${String(m + 1).padStart(2, "0")}-`;
    const pool = category === "전체" ? events : events.filter(e => e.category === category);

    for (const e of pool) {
      for (const d of e.allDates || []) {
        if (d.startsWith(ymPrefix)) {
          (map[d] ||= []).push(e);
        }
      }
    }
    return map;
  }, [events, category, y, m]);

  const selectedEventsAll = activeDay ? (byDay[activeDay] || []) : [];
  const ymLabel = `${y}.${String(m + 1).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Calendar</h2>

      {/* 컨트롤: 년월/카테고리 */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
        {/* 년월 선택 */}
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

        {/* 카테고리 선택 */}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setActiveDay(null);
          }}
          className="border rounded px-3 py-2 w-56"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* 로딩/에러 */}
      {loading && <div className="mb-4 text-sm text-gray-500">실시간 데이터를 불러오는 중…</div>}
      {error && (
        <div className="mb-4 text-sm text-red-600">
          데이터를 불러오지 못했어요. {String(error?.message || error)}
        </div>
      )}

      {/* 본문: 달력 / 상세 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 캘린더 */}
        <div className="lg:col-span-6">
          <div ref={calBoxRef} className="border rounded-lg p-4">
            {/* 요일 헤더 */}
            <div className="text-sm text-gray-600 mb-2">
              {new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {matrix.map(({ date, inMonth }, idx) => {
                const key = ymd(date);
                const day = date.getDate();
                const dayEvents = inMonth ? (byDay[key] || []) : [];
                const isToday = key === todayKey;
                const isPast = inMonth && key < todayKey; // 지난 날짜 회색/비활성
                const isActive = activeDay === key;

                return (
                  <button
                    key={idx}
                    disabled={!inMonth || isPast}
                    onClick={() => setActiveDay(key)}
                    className={[
                      "aspect-square rounded-md border p-1 text-left",
                      !inMonth
                        ? "bg-gray-50 text-gray-400 cursor-default"
                        : isPast
                        ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                        : "bg-white hover:bg-gray-50",
                      isActive ? "ring-2 ring-black" : "",
                    ].join(" ")}
                    title={inMonth && dayEvents.length ? `${dayEvents.length}개 행사` : undefined}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={isToday ? "font-bold underline" : ""}>{day}</span>
                      <span className="flex gap-0.5">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <i
                            key={i}
                            className={[
                              "inline-block w-1.5 h-1.5 rounded-full",
                              CAT_COLOR[e.category] || "bg-gray-400",
                              isPast ? "opacity-50" : "",
                            ].join(" ")}
                          />
                        ))}
                      </span>
                    </div>
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

        {/* 상세: 캘린더와 같은 높이 + 스크롤 */}
        <div className="lg:col-span-6">
          <div
            className="border rounded-lg bg-gray-50 overflow-auto"
            style={{
              height: panelH ? `${panelH}px` : undefined,
              minHeight: panelH ? undefined : "280px",
            }}
          >
            <div className="p-4">
              {!activeDay ? (
                <div className="text-sm text-gray-500 h-40 grid place-items-center">
                  날짜를 선택하면 해당 날짜의 행사가 표시됩니다.
                </div>
              ) : selectedEventsAll.length === 0 ? (
                <div className="text-sm text-gray-500 h-40 grid place-items-center">
                  {activeDay} 일정이 없습니다.
                </div>
              ) : (
                <ul className="space-y-3">
                  {selectedEventsAll.map((e) => (
                    <li key={e.id} className="bg-white border rounded p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{e.title}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{e.category}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">📅 {e.dateLabel}</p>
                      <p className="text-sm text-gray-600">📍 {e.place}</p>
                      {e.fee && <p className="text-xs text-gray-500 mt-1">요금: {e.fee}</p>}
                      {e.homepage && (
                        <div className="mt-2 text-right">
                          <a
                            className="text-xs underline underline-offset-4"
                            href={e.homepage}
                            target="_blank"
                            rel="noreferrer"
                          >
                            상세보기
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
