// src/App.js
// - HOME에서 전체 데이터 로딩 대신,
//   ① 추천 행사는 별도 API(START_INDEX=0, END_INDEX=4)
//   ② 행사 캘린더는 현재 달력에 보이는 날짜(최대 42일)에 대해서만 일별 API 호출
// - seoulApi.js 에 fetchSeoulRecommendedEvents, fetchSeoulDailyEvents 사용

import React, { useEffect, useMemo, useState } from "react";
import BrowseEvents from "./pages/BrowseEvents.jsx";
import MapPage from "./pages/Map.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import Favorites from "./pages/Favorites.jsx";
import MyPage from "./pages/MyPage.jsx";
import EventDetail from "./pages/EventDetail";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
} from "react-router-dom";
import {
  FaTheaterMasks,
  FaPalette,
  FaGraduationCap,
  FaQuestion,
} from "react-icons/fa";

// 🔗 유틸
import {
  fetchSeoulRecommendedEvents, // 추천 행사용 (START_INDEX=0, END_INDEX=4)
  fetchSeoulDailyEvents, // 특정 날짜 행사용 (DATE + START_INDEX, END_INDEX)
} from "./lib/seoulApi";

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

function formatDateLabel(dateKey) {
  try {
    const d = new Date(`${dateKey}T00:00:00`);
    if (isNaN(d)) return dateKey;
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return dateKey;
  }
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
  const c = String(codename || "");
  const t = String(themecode || "");

  // 1) 공연 관련 키워드
  if (
    [
      "공연",
      "콘서트",
      "클래식",
      "국악",
      "무용",
      "연극",
      "뮤지컬",
      "오페라",
      "음악회",
      "페스티벌",
      "축제",
    ].some((k) => c.includes(k))
  ) {
    return "공연";
  }

  // 2) 전시
  if (["전시", "미술", "갤러리", "아트", "사진전"].some((k) => c.includes(k))) {
    return "전시";
  }

  // 3) 교육/체험
  if (
    ["교육", "체험", "워크숍", "워크샵", "강좌", "강의", "세미나", "강연"].some(
      (k) => c.includes(k)
    ) ||
    t.includes("교육")
  ) {
    return "교육/체험";
  }

  // 4) 나머지는 기타
  return "기타";
}

/** OpenAPI row 배열을 프론트에서 쓰기 편한 객체배열로 변환 */
function normalizeEvents(jsonOrRows) {
  const rows = Array.isArray(jsonOrRows)
    ? jsonOrRows
    : jsonOrRows?.culturalEventInfo?.row || [];

  return rows.map((r, idx) => {
    const start = toISODate(r.STRTDATE || r.DATE);
    const end = toISODate(r.END_DATE || r.ENDDATE || r.END);
    const cat = toHighLevelCategory(r.CODENAME, r.THEMECODE);

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
    };
  });
}

/* --- 1) 추천 행사만 별도 API로 로딩하는 훅 --- */
function useRecommendedEvents(limit = 4) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;

    (async () => {
      try {
        if (!SEOUL_KEY) {
          throw new Error(
            "REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인)."
          );
        }
        setLoading(true);
        setErr(null);

        const json = await fetchSeoulRecommendedEvents({
          seoulKey: SEOUL_KEY,
          startIndex: 0,
          endIndex: limit,
          signal: ctrl.signal,
        });

        if (!mounted) return;

        const rows = json?.culturalEventInfo?.row || [];
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
  }, [limit]);

  return { events, loading, error: err };
}

/* --- 2) 현재 달력에 보이는 날짜(최대 42일)에 대해서만 일별 API 42개 호출하는 훅 --- */
function useCalendarMonth(year, month, weekStartsOn = 0, perDayLimit = 4) {
  const [dataByDay, setDataByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;

    (async () => {
      try {
        if (!SEOUL_KEY) {
          throw new Error(
            "REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인)."
          );
        }
        setLoading(true);
        setErr(null);
        setDataByDay({});

        const matrix = getMonthMatrix(year, month, weekStartsOn);
        const dates = matrix.map((cell) => formatDateKey(cell.date)); // 최대 42개

        const results = await Promise.all(
          dates.map(async (dateKey) => {
            try {
              const json = await fetchSeoulDailyEvents({
                seoulKey: SEOUL_KEY,
                date: dateKey,
                startIndex: 0,
                endIndex: perDayLimit,
                signal: ctrl.signal,
              });

              const info = json?.culturalEventInfo;
              const rows = info?.row || [];
              const totalCount = info?.list_total_count ?? rows.length;
              const events = normalizeEvents(rows);

              return { dateKey, events, totalCount };
            } catch (e) {
              console.error("Calendar daily fetch error:", dateKey, e);
              return { dateKey, events: [], totalCount: 0 };
            }
          })
        );

        if (!mounted) return;

        const map = {};
        results.forEach(({ dateKey, events, totalCount }) => {
          map[dateKey] = { events, totalCount };
        });
        setDataByDay(map);
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
  }, [year, month, weekStartsOn, perDayLimit]);

  return { dataByDay, loading, error: err };
}

/* --- 3) HOME 달력 팝업용: 선택 날짜 전체 행사 무한 로딩 훅 --- */
const HOME_POPUP_PAGE_SIZE = 20;

function useDailyEventsInfinite(dateKey, pageSize = HOME_POPUP_PAGE_SIZE) {
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // 날짜가 바뀔 때마다 초기화 후 첫 페이지 로딩
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      if (!dateKey) {
        setEvents([]);
        setTotalCount(0);
        setErr(null);
        setLoading(false);
        return;
      }

      try {
        if (!SEOUL_KEY) {
          throw new Error(
            "REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인)."
          );
        }
        setLoading(true);
        setErr(null);

        const start1 = 1;
        const end1 = start1 + pageSize - 1;

        const json = await fetchSeoulDailyEvents({
          seoulKey: SEOUL_KEY,
          date: dateKey,
          startIndex: start1,
          endIndex: end1,
          signal: ctrl.signal,
        });

        if (cancelled) return;

        const info = json?.culturalEventInfo;
        const rows = info?.row || [];
        const total = info?.list_total_count ?? rows.length;
        const mapped = normalizeEvents(rows);

        setEvents(mapped);
        setTotalCount(total);
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [dateKey, pageSize]);

  const hasMore =
    !!dateKey && totalCount > 0 && events.length < totalCount;

  const loadMore = async () => {
    if (!dateKey) return;
    if (!hasMore) return;
    // 추가 로딩 중인데 또 누르면 중복 방지
    if (loading) return;

    const ctrl = new AbortController();
    let cancelled = false;
    try {
      if (!SEOUL_KEY) {
        throw new Error(
          "REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인)."
        );
      }
      setLoading(true);
      setErr(null);

      const start1 = events.length + 1;
      const end1 = start1 + pageSize - 1;

      const json = await fetchSeoulDailyEvents({
        seoulKey: SEOUL_KEY,
        date: dateKey,
        startIndex: start1,
        endIndex: end1,
        signal: ctrl.signal,
      });

      if (cancelled) return;

      const info = json?.culturalEventInfo;
      const rows = info?.row || [];
      const total = info?.list_total_count ?? totalCount;
      const mapped = normalizeEvents(rows);

      setEvents((prev) => [...prev, ...mapped]);
      setTotalCount(total);
    } catch (e) {
      if (!cancelled) setErr(e);
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  };

  return { events, totalCount, loading, error: err, hasMore, loadMore };
}

/* --- Calendar 컴포넌트 (카드 클릭 이동 X, 날짜 클릭 → 팝업용 콜백) --- */
function Calendar({
  year,
  month,
  dataByDay = {},
  weekStartsOn = 0,
  title = "캘린더",
  onPrevMonth,
  onNextMonth,
  onDayClick,
  selectedDateKey,
}) {
  const todayKey = formatDateKey(new Date());
  const matrix = useMemo(
    () => getMonthMatrix(year, month, weekStartsOn),
    [year, month, weekStartsOn]
  );

  const weekLabels =
    weekStartsOn === 1
      ? ["월", "화", "수", "목", "금", "토", "일"]
      : ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevMonth?.();
            }}
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="이전 달"
          >
            ←
          </button>
          <div className="text-sm font-medium">
            {year}.{String(month + 1).padStart(2, "0")}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNextMonth?.();
            }}
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="다음 달"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
        {weekLabels.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {matrix.map(({ date, inCurrentMonth }, idx) => {
          const key = formatDateKey(date);
          const day = date.getDate();
          const dayData = dataByDay[key] || { events: [], totalCount: 0 };
          const todaysEvents = dayData.events || [];
          const totalCount = dayData.totalCount ?? todaysEvents.length;

          const maxDots = 4;
          const dotEvents = todaysEvents.slice(0, maxDots);
          const extra = totalCount - dotEvents.length;

          const isToday = key === todayKey;
          const isSelected = selectedDateKey && selectedDateKey === key;

          const baseClasses = [
            "aspect-square rounded-md border p-1 flex flex-col",
            // 변경안 1 적용:
            // - 현재 달이 아닌 날짜(전달/다음달)만 음영
            // - 이번 달 날짜는 지난 날짜여도 음영 처리 X
            !inCurrentMonth ? "bg-gray-50 text-gray-300" : "bg-white",
          ];

          if (inCurrentMonth) {
            baseClasses.push(
              "cursor-pointer hover:ring-1 hover:ring-indigo-300 hover:border-indigo-300"
            );
          }

          if (isSelected) {
            baseClasses.push("ring-2 ring-indigo-500 border-indigo-500");
          }

          return (
            <div
              key={idx}
              className={baseClasses.join(" ")}
              title={todaysEvents
                .map((e) => `${e.category} - ${e.title}`)
                .join(", ")}
              onClick={() => {
                if (!inCurrentMonth) return;
                onDayClick?.(key);
              }}
            >
              <div
                className={[
                  "text-right text-xs",
                  isToday ? "font-bold underline" : "",
                ].join(" ")}
              >
                {day}
              </div>
              <div className="mt-auto flex flex-wrap gap-1 items-end">
                {dotEvents.map((ev, i) => (
                  <span
                    key={i}
                    className={[
                      "inline-block w-2 h-2 rounded-full",
                      CATEGORY_COLORS[ev.category] || "bg-gray-400",
                      !inCurrentMonth ? "opacity-50" : "",
                    ].join(" ")}
                  />
                ))}
                {extra > 0 && (
                  <span className="text-[10px] text-gray-500 ml-auto">
                    +{extra}
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

/* --- HOME 콘텐츠 (추천 API + 달력용 일별 API 분리) --- */
function HomeContent() {
  const navigate = useNavigate();

  // 1) 추천 행사
  const {
    events: recommended,
    loading: loadingRec,
    error: errorRec,
  } = useRecommendedEvents(4);

  // 2) 행사 캘린더
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const {
    dataByDay,
    loading: loadingCal,
    error: errorCal,
  } = useCalendarMonth(year, month, 0, 4);

  // 3) 날짜 클릭 시 레이어 팝업 (전체 행사 무한 로딩)
  const [popupDateKey, setPopupDateKey] = useState(null);

  const handleDayClick = (dateKey) => {
    setPopupDateKey(dateKey);
  };

  const closePopup = () => setPopupDateKey(null);

  const {
    events: popupEvents,
    totalCount: popupTotalCount,
    loading: popupLoading,
    error: popupError,
    hasMore: popupHasMore,
    loadMore: popupLoadMore,
  } = useDailyEventsInfinite(popupDateKey, HOME_POPUP_PAGE_SIZE);

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
                onClick={() =>
                  navigate(`/browse?category=${encodeURIComponent(cat.name)}`)
                }
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
          {/* 추천 행사 */}
          <div>
            <h2 className="text-xl font-semibold mb-2">추천 행사</h2>
            <p className="text-xs text-gray-500 mb-4">
              서울시 문화 행사 중 일부를 추천으로 보여줍니다.
            </p>

            {loadingRec && (
              <div className="text-sm text-gray-500">
                추천 행사 불러오는 중…
              </div>
            )}
            {errorRec && (
              <div className="text-sm text-red-600">
                추천 행사를 불러오지 못했어요.{" "}
                {String(errorRec.message || errorRec)}
              </div>
            )}

            {!loadingRec && !errorRec && recommended.length === 0 && (
              <div className="text-sm text-gray-500">
                표시할 추천 행사가 없어요.
              </div>
            )}

            <div className="grid md:grid-cols-1 gap-4">
              {recommended.map((ev) => {
                const handleOpenDetail = () => {
                  if (!ev.homepage) return;
                  window.open(ev.homepage, "_blank", "noopener,noreferrer");
                };

                return (
                  <div
                    key={ev.id}
                    className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition"
                  >
                    {ev.img && (
                      <button
                        type="button"
                        onClick={handleOpenDetail}
                        className="block w-full text-left"
                      >
                        <img
                          src={ev.img}
                          alt={ev.title}
                          className="rounded-md mb-3 w-full object-cover max-h-60 hover:opacity-90 transition"
                        />
                      </button>
                    )}
                    <h3 className="font-semibold text-lg">
                      {ev.homepage ? (
                        <button
                          type="button"
                          onClick={handleOpenDetail}
                          className="text-left w-full hover:underline"
                        >
                          {ev.title}
                        </button>
                      ) : (
                        ev.title
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      📅 {ev.startDate}
                      {ev.endDate ? ` ~ ${ev.endDate}` : ""}
                    </p>
                    <p className="text-sm text-gray-600">
                      📍 {ev.place || ev.gu || "장소 미정"}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          CATEGORY_COLORS[ev.category] || "bg-gray-200"
                        } text-white`}
                      >
                        {ev.category}
                      </span>
                      {ev.fee && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                          {ev.fee}
                        </span>
                      )}
                    </div>
                    {ev.homepage && (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleOpenDetail}
                          className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
                        >
                          상세 보기
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 행사 캘린더 */}
          <div>
            <h2 className="text-xl font-semibold mb-2">행사 캘린더</h2>
            <p className="text-xs text-gray-500 mb-2">
              날짜를 클릭하면 해당 날짜의 행사 목록을 바로 확인할 수 있어요.
            </p>

            {loadingCal && (
              <div className="text-sm text-gray-500 mb-2">
                캘린더 데이터 불러오는 중…
              </div>
            )}
            {errorCal && (
              <div className="text-sm text-red-600 mb-2">
                캘린더 데이터를 불러오지 못했어요.{" "}
                {String(errorCal.message || errorCal)}
              </div>
            )}

            <Calendar
              year={year}
              month={month}
              dataByDay={dataByDay}
              weekStartsOn={0}
              onPrevMonth={() => {
                setCursor(new Date(year, month - 1, 1));
                setPopupDateKey(null);
              }}
              onNextMonth={() => {
                setCursor(new Date(year, month + 1, 1));
                setPopupDateKey(null);
              }}
              onDayClick={handleDayClick}
              selectedDateKey={popupDateKey}
            />
          </div>
        </div>
      </section>

      {/* 날짜 클릭 시 레이어 팝업 (전체 행사 + 더 보기) */}
      {popupDateKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">선택한 날짜</div>
                <div className="text-base font-semibold">
                  {formatDateLabel(popupDateKey)}
                </div>
              </div>
              <button
                type="button"
                onClick={closePopup}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 서브 헤더 */}
            <div className="px-5 py-2 text-xs text-gray-500 border-b">
              {popupError
                ? `데이터를 불러오지 못했습니다: ${
                    popupError.message || String(popupError)
                  }`
                : popupLoading && popupEvents.length === 0
                ? "행사 목록을 불러오는 중입니다…"
                : popupTotalCount > 0
                ? `총 ${popupTotalCount}건의 행사가 있습니다.`
                : "등록된 행사가 없습니다."}
            </div>

            {/* 목록 */}
            <div className="px-5 pb-4 pt-2 overflow-y-auto flex-1">
              {popupEvents.length === 0 && !popupLoading && !popupError ? (
                <div className="text-sm text-gray-500 py-4">
                  해당 날짜에 등록된 행사가 없습니다.
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {popupEvents.map((ev) => (
                      <li
                        key={ev.id}
                        className="border rounded-md p-3 flex flex-col gap-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">
                              {ev.title}
                            </div>
                            <div className="text-xs text-gray-600">
                              📍 {ev.place || ev.gu || "장소 미정"}
                            </div>
                            <div className="text-xs text-gray-600">
                              ⏰ {ev.time || "시간 정보 없음"}
                            </div>
                            <div className="text-xs text-gray-600">
                              📅{" "}
                              {ev.startDate
                                ? ev.endDate && ev.endDate !== ev.startDate
                                  ? `${ev.startDate} ~ ${ev.endDate}`
                                  : ev.startDate
                                : "일정 정보 없음"}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-full ${
                              CATEGORY_COLORS[ev.category] || "bg-gray-300"
                            } text-white whitespace-nowrap`}
                          >
                            {ev.category}
                          </span>
                        </div>
                        {ev.homepage && (
                          <div className="mt-1">
                            <a
                              href={ev.homepage}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-indigo-700 hover:underline"
                            >
                              상세 보기
                            </a>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* 더 보기 버튼 (무한 스크롤 스타일) */}
                  {popupHasMore && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={popupLoadMore}
                        disabled={popupLoading}
                        className="px-4 py-2 text-xs rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        {popupLoading ? "불러오는 중…" : "더 보기"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
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

/* ✅ 헤더 검색바: 검색 → BrowseEvents로 이동 */
function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const goSearch = () => {
    const q = query.trim();
    if (!q) return;
    navigate(`/browse?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") goSearch();
  };

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
      <button
        type="button"
        onClick={goSearch}
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
                (isActive
                  ? "bg-white/10 font-semibold"
                  : "opacity-90 hover:bg-white/10")
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
          <Route
            path="*"
            element={<div className="p-6">페이지를 찾을 수 없습니다.</div>}
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
