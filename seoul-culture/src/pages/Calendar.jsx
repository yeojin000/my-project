// src/pages/Calendar.jsx
// - HOME의 캘린더와 동일한 방식으로 서울시 API를 사용
//   ① 현재 달력에 보이는 날짜(최대 42일)에 대해서만, 날짜별로 API 호출(fetchSeoulDailyEvents)
//      각 날짜는 START_INDEX=0, END_INDEX=4 로 일부만 가져오고 list_total_count 로 전체 개수 확인
//   ② 상세 행사 목록은 선택한 날짜에 대해 페이지네이션 적용
//      각 페이지마다 START_INDEX / END_INDEX 를 계산해서 그 페이지만 조회

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
} from "react";
import { fetchSeoulDailyEvents } from "../lib/seoulApi.js";

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

/* === 즐겨찾기 로컬스토리지 (Browse/MyPage와 동일 키) === */
const LS_KEY_FAV = "sn_favorites";
function loadFavs() {
  try {
    const raw = localStorage.getItem(LS_KEY_FAV);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveFavs(list) {
  localStorage.setItem(LS_KEY_FAV, JSON.stringify(list));
}

/* === 상위 카테고리 매핑 (App/Browse 와 동일 규칙) === */
function toHighLevelCategory(codename = "", themecode = "") {
  const c = String(codename || "");
  const t = String(themecode || "");

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

  if (["전시", "미술", "갤러리", "아트", "사진전"].some((k) => c.includes(k))) {
    return "전시";
  }

  if (
    ["교육", "체험", "워크숍", "워크샵", "강좌", "강의", "세미나", "강연"].some(
      (k) => c.includes(k)
    ) ||
    t.includes("교육")
  ) {
    return "교육/체험";
  }

  return "기타";
}

/* === 날짜 유틸 === */
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

/* === API row -> 캘린더용 이벤트 정규화 === */
function mapRowToEvent(r, idx = 0) {
  const startStr = r.STRTDATE || r.DATE;
  const endStr = r.END_DATE || r.ENDDATE || r.END;

  const category = toHighLevelCategory(r.CODENAME, r.THEMECODE);

  return {
    id: r.SVCID || `evt_${idx}`,
    title: r.TITLE || r.SVCNM || "무제",
    category,
    place: r.PLACE || r.GUNAME || "장소 미정",
    dateLabel: normalizeRangeLabel(startStr, endStr),
    homepage: r.ORG_LINK || r.HMPG_ADDR,
    fee: r.USE_FEE,
    gu: r.GUNAME,
    thumb: r.MAIN_IMG || "/images/sample-event.jpg",
    lat: r.LAT || null,
    lng: r.LNG || null,
  };
}

/* === 1) 월 전체에 대한 "일별 요약" 조회 (HOME 과 동일 구조) === */
/**
 * dataByDay[dateKey] = {
 *   events: Event[],      // 그 날짜 상위 N개 (N = perDayLimit)
 *   totalCount: number,   // list_total_count
 * }
 */
function useCalendarMonthDots(year, month, weekStartsOn = 0, perDayLimit = 4) {
  const [dataByDay, setDataByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        if (!SEOUL_KEY) {
          throw new Error("REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인).");
        }
        setLoading(true);
        setErr(null);
        setDataByDay({});

        const matrix = monthMatrix(year, month, weekStartsOn);
        const dates = matrix.map((cell) => ymd(cell.date)); // 현재 달력에 보이는 날짜들(최대 42일)

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
              const events = rows.map((r, idx) => mapRowToEvent(r, idx));
              return { dateKey, events, totalCount };
            } catch (e) {
              console.error("Calendar month daily fetch error:", dateKey, e);
              return { dateKey, events: [], totalCount: 0 };
            }
          })
        );

        if (cancelled) return;

        const map = {};
        results.forEach(({ dateKey, events, totalCount }) => {
          map[dateKey] = { events, totalCount };
        });
        setDataByDay(map);
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
  }, [year, month, weekStartsOn, perDayLimit]);

  return { dataByDay, loading, error: err };
}

/* === 2) 선택한 날짜에 대한 페이지 단위 상세 조회 === */
/**
 * - dateKey: 'YYYY-MM-DD'
 * - page: 1-based
 * - pageSize: 상세 리스트 한 페이지당 개수
 * - 각 page 마다 START_INDEX / END_INDEX 를 계산해서 그 범위만 조회
 */
const DETAIL_PAGE_SIZE = 20;

function useDailyPagedEvents(dateKey, page, pageSize = DETAIL_PAGE_SIZE) {
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

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
          throw new Error("REACT_APP_SEOUL_KEY가 설정되지 않았습니다 (.env 확인).");
        }
        setLoading(true);
        setErr(null);

        // page 1 → 1~20, page 2 → 21~40 ... (오픈API는 1-based)
        const start1 = (page - 1) * pageSize + 1;
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

        const mapped = rows.map((r, idx) => mapRowToEvent(r, start1 - 1 + idx));

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
  }, [dateKey, page, pageSize]);

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || events.length || 1) / pageSize)
  );

  return { events, totalCount, totalPages, loading, error: err };
}

/* === 페이지 컴포넌트 === */
export default function CalendarPage() {
  const today = new Date();
  const todayKey = ymd(today);

  // ① 기본은 현재 년/월
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [category, setCategory] = useState("전체");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [activeDay, setActiveDay] = useState(null); // 'YYYY-MM-DD'
  const [detailPage, setDetailPage] = useState(1);

  const deferredKeyword = useDeferredValue(keyword);

  // 캘린더 박스 높이를 상세 패널에 복제
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

  // 월 전체 일별 요약 로딩
  const {
    dataByDay,
    loading: loadingMonth,
    error: errorMonth,
  } = useCalendarMonthDots(y, m, 0, 4);

  // 달력 매트릭스
  const matrix = useMemo(() => monthMatrix(y, m, 0), [y, m]);

  // 날짜/필터 변경 시 상세 페이지 초기화
  useEffect(() => {
    setDetailPage(1);
  }, [activeDay, category, keyword]);

  // 선택한 날짜의 상세
  const {
    events: dailyEventsRaw,
    totalCount: dailyTotalCount,
    totalPages: dailyTotalPages,
    loading: loadingDaily,
    error: errorDaily,
  } = useDailyPagedEvents(activeDay, detailPage, DETAIL_PAGE_SIZE);

  // 카테고리/검색 필터 상세 적용
  const filteredDailyEvents = useMemo(() => {
    let arr = dailyEventsRaw;
    if (category !== "전체") {
      arr = arr.filter((e) => e.category === category);
    }
    const q = (deferredKeyword || "").trim().toLowerCase();
    if (!q) return arr;
    return arr.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.place || "").toLowerCase().includes(q)
    );
  }, [dailyEventsRaw, category, deferredKeyword]);

  const ymLabel = `${y}.${String(m + 1).padStart(2, "0")}`;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setKeyword(keywordInput);
  };

  // 즐겨찾기 (Calendar 메뉴에서도 추가 가능)
  const [favSet, setFavSet] = useState(
    () => new Set(loadFavs().map((x) => x.id))
  );

  const handleToggleFavorite = (ev) => {
    const list = loadFavs();
    const exists = list.some((x) => x.id === ev.id);
    let next;
    if (exists) {
      next = list.filter((x) => x.id !== ev.id);
    } else {
      next = [
        ...list,
        {
          id: ev.id,
          title: ev.title,
          category: ev.category,
          date: ev.dateLabel,
          place: ev.place,
          thumb: ev.thumb || "/images/sample-event.jpg",
          homepage: ev.homepage,
          gu: ev.gu,
          lat: ev.lat ?? null,
          lng: ev.lng ?? null,
        },
      ];
    }
    saveFavs(next);
    setFavSet(new Set(next.map((x) => x.id)));
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">캘린더</h2>

      {/* 컨트롤: 년월/카테고리/검색 */}
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
            // activeDay는 유지 (선택한 날짜 내에서만 카테고리 필터)
          }}
          className="border rounded px-3 py-2 w-40"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* 검색(상세 목록용) */}
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="행사명, 장소로 검색 (선택한 날짜의 목록 내에서)"
              className="w-full border rounded-md pl-3 pr-10 py-2"
            />
            <button
              type="submit"
              aria-label="검색"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-50"
            >
              <img src="/images/search.png" alt="" className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* 로딩/에러 (월 단위) */}
      {loadingMonth && (
        <div className="mb-4 text-sm text-gray-500">
          달력 데이터를 불러오는 중…
        </div>
      )}
      {errorMonth && (
        <div className="mb-4 text-sm text-red-600">
          달력 데이터를 불러오지 못했어요.{" "}
          {String(errorMonth?.message || errorMonth)}
        </div>
      )}

      {/* 본문: 달력 / 상세 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 캘린더 */}
        <div className="lg:col-span-6">
          <div ref={calBoxRef} className="border rounded-lg p-4">
            {/* 요일 헤더 */}
            <div className="text-sm text-gray-600 mb-2">
              {new Date(y, m, 1).toLocaleString("ko-KR", {
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
              {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {matrix.map(({ date, inMonth }, idx) => {
                const key = ymd(date);
                const day = date.getDate();
                const dayData = dataByDay[key] || { events: [], totalCount: 0 };
                const allDayEvents = dayData.events || [];

                const dayEvents =
                  category === "전체"
                    ? allDayEvents
                    : allDayEvents.filter((e) => e.category === category);

                const isToday = key === todayKey;
                const isPast = key < todayKey; // 과거 날짜도 조회 가능하지만 스타일만 다르게
                const isActive = activeDay === key;

                return (
                  <button
                    key={idx}
                    onClick={() => setActiveDay(key)}
                    className={[
                      "aspect-square rounded-md border p-1 text-left cursor-pointer",
                      !inMonth
                        ? "bg-gray-50 text-gray-300"
                        : isPast
                        ? "bg-gray-50 text-gray-400"
                        : "bg-white hover:bg-gray-50",
                      isActive ? "ring-2 ring-black" : "",
                    ].join(" ")}
                    title={
                      dayData.totalCount
                        ? `${dayData.totalCount}개 행사`
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={isToday ? "font-bold underline" : ""}>
                        {day}
                      </span>
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
                        {dayData.totalCount > dayEvents.length &&
                          dayEvents.length > 0 && (
                            <span className="text-[9px] text-gray-400 ml-0.5">
                              +{dayData.totalCount - dayEvents.length}
                            </span>
                          )}
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

        {/* 상세: 캘린더와 같은 높이 + 스크롤 + 페이지네이션 + 즐겨찾기 */}
        <div className="lg:col-span-6">
          <div
            className="border rounded-lg bg-gray-50 overflow-auto"
            style={{
              height: panelH ? `${panelH}px` : undefined,
              minHeight: panelH ? undefined : "280px",
            }}
          >
            <div className="p-4 flex flex-col h-full">
              {!activeDay ? (
                <div className="text-sm text-gray-500 flex-1 grid place-items-center">
                  날짜를 선택하면 해당 날짜의 행사가 표시됩니다.
                </div>
              ) : loadingDaily ? (
                <div className="text-sm text-gray-500 flex-1 grid place-items-center">
                  {activeDay}의 행사를 불러오는 중…
                </div>
              ) : errorDaily ? (
                <div className="text-sm text-red-600 flex-1 grid place-items-center">
                  데이터를 불러오지 못했어요.{" "}
                  {String(errorDaily?.message || errorDaily)}
                </div>
              ) : filteredDailyEvents.length === 0 ? (
                <div className="text-sm text-gray-500 flex-1 grid place-items-center">
                  {activeDay}에 조건에 맞는 행사가 없습니다.
                </div>
              ) : (
                <>
                  <div className="mb-3 text-sm text-gray-700">
                    <span className="font-semibold">{activeDay}</span>{" "}
                    기준 행사 목록
                  </div>
                  <ul className="space-y-3 flex-1 overflow-auto pr-1">
                    {filteredDailyEvents.map((e) => {
                      const isFav = favSet.has(e.id);
                      return (
                        <li
                          key={e.id}
                          className="bg-white border rounded p-3 relative"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 pr-2">
                              <h4 className="font-semibold">{e.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                📅 {e.dateLabel}
                              </p>
                              <p className="text-sm text-gray-600">
                                📍 {e.place}
                              </p>
                              {e.fee && (
                                <p className="text-xs text-gray-500 mt-1">
                                  요금: {e.fee}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 whitespace-nowrap">
                                {e.category}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(e)}
                                className="text-xl leading-none select-none"
                                title={
                                  isFav
                                    ? "즐겨찾기 해제"
                                    : "즐겨찾기에 추가"
                                }
                                aria-label={
                                  isFav
                                    ? "즐겨찾기 해제"
                                    : "즐겨찾기에 추가"
                                }
                              >
                                {isFav ? "❤️" : "🤍"}
                              </button>
                            </div>
                          </div>
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
                      );
                    })}
                  </ul>

                  {/* 페이지네이션 */}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                    <div>
                      총 {dailyTotalCount}건 · {detailPage}/{dailyTotalPages}
                      페이지
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setDetailPage((p) => Math.max(1, p - 1))
                        }
                        disabled={detailPage === 1}
                        className="px-3 py-1.5 rounded border bg-white disabled:opacity-40"
                      >
                        이전
                      </button>
                      <button
                        onClick={() =>
                          setDetailPage((p) =>
                            Math.min(dailyTotalPages, p + 1)
                          )
                        }
                        disabled={detailPage === dailyTotalPages}
                        className="px-3 py-1.5 rounded border bg-white disabled:opacity-40"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
