// src/pages/BrowseEvents.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
} from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSeoulRecommendedEvents } from "../lib/seoulApi";
import { addRecent } from "./MyPage";

/* === .env 키 === */
const SEOUL_KEY = (process.env.NEXT_PUBLIC_REACT_APP_SEOUL_KEY || "").trim();

/* === 카테고리 === */
const CATEGORIES = ["전체", "공연", "전시", "교육/체험", "기타"];

/* === 상위 카테고리 매핑 (App.js 와 동일 규칙) === */
function toHighLevelCategory(codename = "", themecode = "") {
  const c = String(codename || "");
  const t = String(themecode || "");

  // 공연
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

  // 전시
  if (["전시", "미술", "갤러리", "아트", "사진전"].some((k) => c.includes(k))) {
    return "전시";
  }

  // 교육/체험
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

/* === 날짜 표기 유틸 === */
function normalizeDateRange(startStr = "", endStr = "") {
  const s = (startStr || "").replaceAll(".", "-");
  const e = (endStr || "").replaceAll(".", "-");
  if (!s && !e) return "일정 미정";
  if (s && e) return `${s} ~ ${e}`;
  return s || e;
}

/* === 즐겨찾기 로컬스토리지 === */
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

/* =========================
   페이지 단위 API 로딩 (무한 "더 보기" 방식)
========================= */
const PER_PAGE = 64;

function mapRowToEvent(r, globalIndex) {
  const id = r.SVCID || `evt_${globalIndex}`;
  const title = r.TITLE || r.SVCNM || "무제";
  const codename = r.CODENAME;
  const themecode = r.THEMECODE;
  const gu = r.GUNAME;
  const place = r.PLACE;
  const start = r.STRTDATE || r.DATE;
  const end = r.END_DATE || r.ENDDATE || r.END;
  const homepage = r.ORG_LINK || r.HMPG_ADDR;
  const img = r.MAIN_IMG;
  const fee = r.USE_FEE;
  const category = toHighLevelCategory(codename, themecode);

  return {
    id,
    title,
    category,
    date: normalizeDateRange(start, end),
    place: place || gu || "장소 미상",
    thumb: img || "/images/sample-event.jpg",
    homepage,
    gu,
    fee,
  };
}

/**
 * 전체 데이터를 "페이지 단위로 점점 더 많이" 불러와서
 * 누적(allEvents) + 검색/필터에 사용.
 */
function useSeoulEventsInfinite() {
  const [pages, setPages] = useState(() => ({})); // { [page]: Event[] }
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const page = currentPage;
    const ctrl = new AbortController();
    let cancelled = false;

    async function run() {
      if (!SEOUL_KEY) {
        setErr(
          new Error(
            "환경변수 REACT_APP_SEOUL_KEY 가 설정되지 않았습니다 (.env 확인)."
          )
        );
        return;
      }

      // 이미 가져온 페이지면 다시 호출 안 함
      if (pages[page]) return;

      setLoading(true);
      setErr(null);
      try {
        const start1 = (page - 1) * PER_PAGE + 1;
        const end1 = start1 + PER_PAGE - 1;

        const json = await fetchSeoulRecommendedEvents({
          seoulKey: SEOUL_KEY,
          startIndex: start1,
          endIndex: end1,
          signal: ctrl.signal,
        });

        if (cancelled) return;

        const info = json?.culturalEventInfo;
        const rows = info?.row || [];
        const total = info?.list_total_count ?? 0;

        const mapped = rows.map((r, idx) =>
          mapRowToEvent(r, start1 - 1 + idx)
        );

        setPages((prev) => ({ ...prev, [page]: mapped }));
        setTotalCount(total);
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [currentPage, pages]);

  // 지금까지 로딩된 모든 페이지를 합친 배열
  const allEvents = useMemo(() => {
    const arr = [];
    for (let p = 1; p <= currentPage; p++) {
      if (pages[p]) arr.push(...pages[p]);
    }
    return arr;
  }, [pages, currentPage]);

  const totalPages = totalCount
    ? Math.max(1, Math.ceil(totalCount / PER_PAGE))
    : null;

  const hasMore =
    totalPages == null // 아직 totalCount 모르면 더 있는 걸로 가정
      ? true
      : currentPage < totalPages;

  const loadMore = () => {
    if (loading) return;
    if (!hasMore) return;
    setCurrentPage((p) => p + 1);
  };

  return {
    events: allEvents,
    loading,
    error: err,
    totalCount,
    totalPages,
    currentPage,
    hasMore,
    loadMore,
  };
}

/* =========================
   페이지 컴포넌트
========================= */
export default function BrowseEvents() {
  const [sp, setSp] = useSearchParams();

  // --- URL 쿼리에서 초기값 추출 ---
  const categoryParam = sp.get("category");
  const qParam = sp.get("q") || "";

  const [category, setCategory] = useState(
    categoryParam && CATEGORIES.includes(categoryParam)
      ? categoryParam
      : "전체"
  );
  const [input, setInput] = useState(qParam); // 입력창 값
  const [query, setQuery] = useState(qParam); // 실제 검색에 쓰는 값

  // ✅ URL(searchParams)이 바뀔 때마다 상태 재동기화
  // (HOME/헤더 검색에서 /browse?q=... 로 들어오는 경우 포함)
  useEffect(() => {
    const urlCategory = sp.get("category");
    const urlQ = sp.get("q") || "";

    const nextCategory =
      urlCategory && CATEGORIES.includes(urlCategory)
        ? urlCategory
        : "전체";

    setCategory(nextCategory);
    setInput(urlQ);
    setQuery(urlQ);
  }, [sp]);

  // 검색 입력 디바운스 → query로 반영
  useEffect(() => {
    const t = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  // URL 유지 (카테고리 / 검색어 -> 쿼리스트링 반영)
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (category && category !== "전체") next.set("category", category);
    else next.delete("category");

    if (query) next.set("q", query);
    else next.delete("q");

    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query]);

  // 전체 데이터 무한 로딩 훅
  const {
    events: allEvents,
    loading,
    error,
    totalCount,
    hasMore,
    loadMore,
  } = useSeoulEventsInfinite();

  const deferredQuery = useDeferredValue(query);

  // 카테고리 + 검색 필터 (현재까지 로딩된 전체 데이터에서 수행)
  const filtered = useMemo(() => {
    const pool =
      category === "전체"
        ? allEvents
        : allEvents.filter((e) => e.category === category);

    const q = (deferredQuery || "").trim().toLowerCase();
    if (!q) return pool;

    return pool.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.place || "").toLowerCase().includes(q)
    );
  }, [allEvents, category, deferredQuery]);

  const initialLoading = loading && allEvents.length === 0;

  const onSubmit = (e) => {
    e.preventDefault();
    setQuery(input);
  };

  // 즐겨찾기
  const [favSet, setFavSet] = useState(
    () => new Set(loadFavs().map((x) => x.id))
  );

  const onHeartToggle = (ev) => {
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
          date: ev.date,
          place: ev.place,
          thumb: ev.thumb,
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

  const isFiltering =
    category !== "전체" || (deferredQuery || "").trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* ===== 상단 컨트롤 바 (sticky) ===== */}
        <div
          className="
            sticky 
            top-[48px]   /* 헤더 높이에 맞게 조정 */
            z-20
            bg-white
            pt-4 pb-3
          "
        >
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 border-b pb-3">
            <div className="w-full md:w-56">
              <label htmlFor="category" className="sr-only">
                카테고리
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded-md px-3 py-2 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={onSubmit} className="flex-1">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="행사명, 장소로 검색"
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
        </div>

        {/* ===== 본문 리스트 ===== */}
        <div className="mt-4">
          <div className="border rounded-lg p-4">
            {initialLoading && (
              <div className="h-56 grid place-items-center text-gray-500">
                불러오는 중…
              </div>
            )}

            {error && !initialLoading && (
              <div className="h-56 grid place-items-center text-red-600">
                데이터를 불러오지 못했어요. {String(error.message || error)}
              </div>
            )}

            {!initialLoading && !error && filtered.length === 0 && (
              <div className="h-56 grid place-items-center text-gray-500">
                조건에 맞는 행사가 없습니다.
              </div>
            )}

            {!initialLoading && !error && filtered.length > 0 && (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      isFav={favSet.has(ev.id)}
                      onHeartToggle={onHeartToggle}
                    />
                  ))}
                </div>

                <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
                  <div className="text-gray-600">
                    {isFiltering ? (
                      <>
                        검색 결과{" "}
                        <strong className="font-semibold">
                          {filtered.length}
                        </strong>
                        건
                        <span className="text-xs text-gray-500 ml-1">
                          (현재 로딩된 데이터 {allEvents.length}건 기준)
                        </span>
                      </>
                    ) : totalCount ? (
                      <>
                        총{" "}
                        <strong className="font-semibold">
                          {totalCount}
                        </strong>
                        건 중{" "}
                        <span className="font-semibold">
                          {allEvents.length}
                        </span>
                        건을 불러왔습니다.
                      </>
                    ) : (
                      <>
                        현재{" "}
                        <span className="font-semibold">
                          {allEvents.length}
                        </span>
                        건을 불러왔습니다.
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    {hasMore ? (
                      <button
                        onClick={loadMore}
                        disabled={loading}
                        className="px-4 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        {loading ? "더 불러오는 중…" : "더 보기"}
                      </button>
                    ) : (
                      <span className="text-gray-400">
                        마지막까지 모두 불러왔습니다.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 메모ized 카드 아이템 */
const EventCard = React.memo(function EventCard({
  ev,
  isFav,
  onHeartToggle,
}) {
  return (
    <div className="relative text-left bg-white border rounded-lg overflow-hidden hover:shadow transition">
      <button
        onClick={(e) => {
          e.preventDefault();
          onHeartToggle(ev);
        }}
        className="absolute right-2 top-2 z-10 text-2xl leading-none select-none"
        title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      >
        {isFav ? "❤️" : "🤍"}
      </button>

      <a
        href={ev.homepage || "#"}
        target={ev.homepage ? "_blank" : "_self"}
        rel="noreferrer"
        className="block"
        title={ev.homepage ? "상세보기(새창)" : undefined}
        onClick={() => addRecent(ev)}
      >
        <img
          src={ev.thumb}
          alt={ev.title}
          className="w-full h-40 object-cover"
          loading="lazy"
        />
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold line-clamp-2">{ev.title}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 whitespace-nowrap">
              {ev.category}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">📅 {ev.date}</p>
          <p className="text-sm text-gray-600">📍 {ev.place}</p>
          {ev.fee && (
            <p className="text-xs text-gray-500 mt-1">요금: {ev.fee}</p>
          )}
        </div>
      </a>
    </div>
  );
});
