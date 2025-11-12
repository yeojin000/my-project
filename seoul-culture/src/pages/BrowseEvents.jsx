// src/pages/BrowseEvents.jsx
import React, { useEffect, useMemo, useState, useDeferredValue, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSeoulAllEventsJSON } from "../lib/seoulApi";

/* === .env 키 === */
const SEOUL_KEY = (process.env.REACT_APP_SEOUL_KEY || "").trim();

/* === 카테고리 === */
const CATEGORIES = ["전체", "공연", "전시", "교육/체험", "기타"];

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

/* === 리뷰 로컬스토리지 === */
const RV_LS_KEY = (eventId) => `reviews:${eventId}`;
const ensureUserId = () => {
  let id = localStorage.getItem("currentUserId");
  if (!id) {
    id = `user_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("currentUserId", id);
  }
  return id;
};
const loadReviews = (eventId) => {
  try {
    const raw = localStorage.getItem(RV_LS_KEY(eventId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveReviews = (eventId, reviews) => {
  localStorage.setItem(RV_LS_KEY(eventId), JSON.stringify(reviews));
};

function Stars({ value = 0 }) {
  const full = Math.round(value);
  return (
    <div className="flex items-center" aria-label={`평점 ${full}점`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={"text-xl " + (i < full ? "opacity-100" : "opacity-30")}>★</span>
      ))}
    </div>
  );
}

function ReviewEditor({ mode = "create", initialValue, onSubmit, onCancel }) {
  const [rating, setRating] = useState(initialValue?.rating ?? 0);
  const [body, setBody] = useState(initialValue?.body ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = mode === "edit";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) return alert("별점을 선택해 주세요 (1~5)");
    if (body.trim().length < 5) return alert("리뷰를 5자 이상 입력해 주세요");
    try {
      setSaving(true);
      await onSubmit({ rating, body: body.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-4 space-y-3 bg-white">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">평점</label>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setRating(i + 1)}
              className="text-2xl leading-none"
              aria-label={`${i + 1}점`}
            >
              <span className={i + 1 <= rating ? "" : "opacity-30"}>★</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[96px] rounded-xl border px-3 py-2 focus:outline-none focus:ring"
          placeholder={isEdit ? "리뷰를 수정하세요" : "이 행사가 어땠는지 남겨보세요"}
        />
        <p className="mt-1 text-xs text-gray-500">최소 5자 / 욕설·개인정보 금지</p>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-xl border">
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 rounded-xl bg-black text-white disabled:opacity-60"
        >
          {saving ? "저장 중…" : isEdit ? "수정 저장" : "리뷰 등록"}
        </button>
      </div>
    </form>
  );
}

function ReviewItem({ review, isMine, onEdit, onDelete }) {
  const edited = review.updatedAt && review.updatedAt !== review.createdAt;
  const when = new Date(review.updatedAt || review.createdAt).toLocaleString();

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stars value={review.rating} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{when}</span>
            {edited && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                aria-label="수정됨"
                title="작성자가 내용을 수정했습니다"
              >
                수정됨
              </span>
            )}
          </div>
        </div>
        {isMine && (
          <div className="flex gap-2">
            <button onClick={onEdit} className="px-3 py-1 rounded-lg border">✏️ 수정</button>
            <button onClick={onDelete} className="px-3 py-1 rounded-lg border">🗑 삭제</button>
          </div>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed">{review.body}</p>
      <div className="mt-3 text-xs text-gray-500">by {review.userId}</div>
    </div>
  );
}

function ReviewList({ reviews, currentUserId, onRequestEdit, onRequestDelete }) {
  if (!reviews.length) {
    return <div className="text-sm text-gray-500">아직 작성된 리뷰가 없습니다.</div>;
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewItem
          key={r.id}
          review={r}
          isMine={r.userId === currentUserId}
          onEdit={() => onRequestEdit(r)}
          onDelete={() => onRequestDelete(r)}
        />
      ))}
    </div>
  );
}

function ReviewSection({ eventId }) {
  const currentUserId = ensureUserId();
  const [reviews, setReviews] = useState(() => loadReviews(eventId));
  const [editing, setEditing] = useState(null);

  const { avg, count } = useMemo(() => {
    const c = reviews.length;
    const a = c ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / c : 0;
    return { avg: Math.round(a * 10) / 10, count: c };
  }, [reviews]);

  const myReview = useMemo(() => reviews.find((r) => r.userId === currentUserId) || null, [reviews, currentUserId]);

  const sorted = useMemo(() => {
    const arr = [...reviews];
    arr.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    if (myReview) {
      const i = arr.findIndex((x) => x.id === myReview.id);
      if (i > 0) {
        arr.splice(i, 1);
        arr.unshift(myReview);
      }
    }
    return arr;
  }, [reviews, myReview]);

  const listForRender = useMemo(
    () => (myReview ? sorted.filter(r => r.id !== myReview.id) : sorted),
    [sorted, myReview]
  );

  const persist = (next) => {
    setReviews(next);
    saveReviews(eventId, next);
  };

  const handleCreate = async ({ rating, body }) => {
    const now = new Date().toISOString();
    if (myReview) return alert("이미 작성한 리뷰가 있어요. 수정 기능을 이용해 주세요.");
    const newReview = {
      id: `rv_${Math.random().toString(36).slice(2, 10)}`,
      eventId,
      userId: currentUserId,
      rating,
      body,
      createdAt: now,
      updatedAt: now,
    };
    persist([newReview, ...reviews]);
  };

  const handleUpdate = async ({ rating, body }) => {
    const now = new Date().toISOString();
    const next = reviews.map((r) => (r.id === editing.id ? { ...r, rating, body, updatedAt: now } : r));
    persist(next);
    setEditing(null);
  };

  const handleDelete = async (target) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const next = reviews.filter((r) => r.id !== target.id);
    persist(next);
    if (editing?.id === target.id) setEditing(null);
  };

  return (
    <section className="mt-2">
      <div className="flex items-end justify-between">
        <h3 className="text-lg font-semibold">리뷰</h3>
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <Stars value={avg} />
          <span>평균 {avg || 0} / 5 · 총 {count}개</span>
        </div>
      </div>

      <div className="mt-3 grid gap-4">
        {editing ? (
          <ReviewEditor
            mode="edit"
            initialValue={{ rating: editing.rating, body: editing.body }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        ) : myReview ? (
          <ReviewItem
            review={myReview}
            isMine
            onEdit={() => setEditing(myReview)}
            onDelete={() => handleDelete(myReview)}
          />
        ) : (
          <ReviewEditor mode="create" onSubmit={handleCreate} />
        )}

        <ReviewList
          reviews={listForRender}
          currentUserId={currentUserId}
          onRequestEdit={(r) => setEditing(r.userId === currentUserId ? r : null)}
          onRequestDelete={(r) => r.userId === currentUserId && handleDelete(r)}
        />
      </div>
    </section>
  );
}

function ReviewModal({ open, onClose, event }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,92vw)] max-h-[82vh] overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <div className="text-xs text-gray-500">리뷰 · {event?.category} · {event?.place}</div>
            <h2 className="text-lg font-semibold">{event?.title}</h2>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-xl border">닫기</button>
        </div>
        <div className="p-5">
          <ReviewSection eventId={event?.id} />
        </div>
      </div>
    </div>
  );
}

/* =========================
   API 로딩 훅 (빠른 UX용 최적화)
   - 초기 상한: INITIAL_LIMIT 개만 먼저 렌더
   - 필요 시 버튼으로 더 불러오기
========================= */
const INITIAL_LIMIT = 800;      // 초기 렌더 품질/속도 균형점
const PAGE_SIZE = 200;          // API 페이징 단위(서울 API 최대 1000/200 등)
const MAX_LIMIT = 5000;         // 전체 상한

function useSeoulEventsJSON(initialOnly = true) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!SEOUL_KEY) throw new Error("환경변수 REACT_APP_SEOUL_KEY 가 설정되지 않았습니다 (.env 확인).");

        // 초기 로딩: 상한을 줄여서 먼저 렌더링
        const first = await fetchSeoulAllEventsJSON({
          seoulKey: SEOUL_KEY,
          pageSize: PAGE_SIZE,
          hardLimit: initialOnly ? INITIAL_LIMIT : MAX_LIMIT,
          useProxy: false,
          signal: ctrl.signal,
        });

        if (!mounted) return;
        setAll(first);
        setHasMore(initialOnly && first.length >= INITIAL_LIMIT); // 더 불러오기 표시 기준

      } catch (e) {
        if (mounted) setErr(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [initialOnly]);

  const loadMore = useCallback(async () => {
    // 남은 전량을 추가로 가져와 합치기
    const ctrl = new AbortController();
    try {
      const rest = await fetchSeoulAllEventsJSON({
        seoulKey: SEOUL_KEY,
        pageSize: PAGE_SIZE,
        hardLimit: MAX_LIMIT,
        useProxy: false,
        signal: ctrl.signal,
      });
      setAll(rest);        // 전량으로 교체(중복 제거는 lib에서 처리되어 있을 가능성 높음)
      setHasMore(false);
    } catch (e) {
      setErr(e);
    }
  }, []);

  // 카드 필드로 정규화(메모)
  const events = useMemo(() => {
    return all.map((r, i) => {
      const id = r.SVCID || `evt_${i}`;
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
    });
  }, [all]);

  return { events, loading, error: err, hasMore, loadMore };
}

/* =========================
   메모ized 카드 아이템
========================= */
const EventCard = React.memo(function EventCard({ ev, isFav, onHeartToggle, onOpenReviews }) {
  return (
    <div className="relative text-left bg-white border rounded-lg overflow-hidden hover:shadow transition">
      <button
        onClick={(e) => { e.preventDefault(); onHeartToggle(ev); }}
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

      <div className="px-3 pb-3">
        <button
          onClick={() => onOpenReviews(ev)}
          className="mt-2 w-full text-sm rounded-xl border px-3 py-2 hover:bg-gray-50"
        >
          리뷰보기
        </button>
      </div>
    </div>
  );
});

/* =========================
   페이지 컴포넌트
========================= */
export default function BrowseEvents() {
  const [sp, setSp] = useSearchParams();

  // URL 쿼리 동기화
  const initialCategory = decodeURIComponent(sp.get("category") || "전체");
  const initialQuery = sp.get("q") || "";

  const [category, setCategory] = useState(
    CATEGORIES.includes(initialCategory) ? initialCategory : "전체"
  );
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);

  // 디바운스(300ms)로 query 반영
  useEffect(() => {
    const t = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  // 데이터 가져오기 (초기 빠르게 -> 필요 시 더 불러오기)
  const { events, loading, error, hasMore, loadMore } = useSeoulEventsJSON(true);

  // 즐겨찾기
  const [favSet, setFavSet] = useState(() => new Set(loadFavs().map((x) => x.id)));

  // 리뷰 모달
  const [openReview, setOpenReview] = useState(false);
  const [reviewEvent, setReviewEvent] = useState(null);

  // URL 유지
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (category && category !== "전체") next.set("category", encodeURIComponent(category));
    else next.delete("category");
    if (query) next.set("q", query);
    else next.delete("q");
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query]);

  // 필터 + 검색 (deferred로 대량 리스트 렌더 지연 완화)
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const pool = category === "전체" ? events : events.filter((e) => e.category === category);
    const q = (deferredQuery || "").trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.place || "").toLowerCase().includes(q)
    );
  }, [events, category, deferredQuery]);

  // 페이지네이션(페이지당 24개)
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [category, deferredQuery]); // 검색/카테고리 바뀌면 1페이지로
  const PER_PAGE = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const onSubmit = (e) => {
    e.preventDefault();
    // 즉시 검색 버튼 제출 시에도 반영되도록
    setQuery(input);
  };

  const onHeartToggle = (ev) => {
    const list = loadFavs();
    const exists = list.some((x) => x.id === ev.id);
    let next;
    if (exists) {
      next = list.filter((x) => x.id !== ev.id);
    } else {
      next = [...list, {
        id: ev.id, title: ev.title, category: ev.category,
        date: ev.date, place: ev.place, thumb: ev.thumb, homepage: ev.homepage,
      }];
    }
    saveFavs(next);
    setFavSet(new Set(next.map((x) => x.id)));
  };

  const onOpenReviews = (ev) => {
    setReviewEvent(ev);
    setOpenReview(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* 컨트롤 바 */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="w-full md:w-56">
            <label htmlFor="category" className="sr-only">카테고리</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-white"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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

        {/* 본문 */}
        <div className="mt-6">
          <div className="border rounded-lg p-4">
            {loading && (
              <div className="h-56 grid place-items-center text-gray-500">불러오는 중…</div>
            )}
            {error && (
              <div className="h-56 grid place-items-center text-red-600">
                데이터를 불러오지 못했어요. {String(error.message || error)}
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="h-56 grid place-items-center text-gray-500">
                조건에 맞는 행사가 없습니다.
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <>
                {/* 결과 그리드 */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pageItems.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      isFav={favSet.has(ev.id)}
                      onHeartToggle={onHeartToggle}
                      onOpenReviews={onOpenReviews}
                    />
                  ))}
                </div>

                {/* 페이지네이션 */}
                <div className="mt-6 flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    총 {filtered.length}건 · {page}/{totalPages}페이지
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded border disabled:opacity-50"
                    >
                      이전
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded border disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </div>

                {/* 더 불러오기 (전량 로딩) */}
                {hasMore && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={loadMore}
                      className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                    >
                      더 많은 행사 불러오기
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ReviewModal
        open={openReview}
        onClose={() => setOpenReview(false)}
        event={reviewEvent}
      />
    </div>
  );
}
