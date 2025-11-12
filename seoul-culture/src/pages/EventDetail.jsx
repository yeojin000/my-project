import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { addRecent } from "./MyPage";
/**
 * EventDetail.jsx
 * - 단일 파일 버전: ReviewSection / ReviewList / ReviewItem / ReviewEditor 를 내부에 포함
 * - 다음 주 백엔드 붙이기 전까지 localStorage 기반 mock CRUD 동작
 * - 준비물: react-router-dom 라우팅에서 /events/:id 로 진입하도록 설정
 */

/* =========================
   유틸 & Mock 스토리지
========================= */
const LS_KEY = (eventId) => `reviews:${eventId}`;
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
    const raw = localStorage.getItem(LS_KEY(eventId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to parse reviews from LS", e);
    return [];
  }
};

const saveReviews = (eventId, reviews) => {
  localStorage.setItem(LS_KEY(eventId), JSON.stringify(reviews));
};

/* =========================
   별점 컴포넌트 (간단)
========================= */
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

/* =========================
   ReviewEditor (Create/Update 공용)
========================= */
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
    <form onSubmit={handleSubmit} className="rounded-2xl border p-4 space-y-3 bg-white shadow-sm">
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

/* =========================
   ReviewItem (단일 카드)
========================= */
function ReviewItem({ review, isMine, onEdit, onDelete }) {
  return (
    <div className="rounded-2xl border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stars value={review.rating} />
          <span className="text-sm text-gray-500">{new Date(review.updatedAt || review.createdAt).toLocaleString()}</span>
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

/* =========================
   ReviewList (목록)
========================= */
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

/* =========================
   ReviewSection (상세 페이지용 섹션)
========================= */
function ReviewSection({ eventId }) {
  const currentUserId = ensureUserId();
  const [reviews, setReviews] = useState(() => loadReviews(eventId));
  const [editing, setEditing] = useState(null); // 내 리뷰 편집 중인 리뷰 객체

  // 평균 별점/개수
  const { avg, count } = useMemo(() => {
    const c = reviews.length;
    const a = c ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / c : 0;
    return { avg: Math.round(a * 10) / 10, count: c };
  }, [reviews]);

  // 내 리뷰 (1인 1리뷰 정책)
  const myReview = useMemo(() => reviews.find((r) => r.userId === currentUserId) || null, [reviews, currentUserId]);

  // 정렬: 내 리뷰 우선 → 최신순
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

  const persist = (next) => {
    setReviews(next);
    saveReviews(eventId, next);
  };

  // Create
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

  // Update (인라인)
  const handleUpdate = async ({ rating, body }) => {
    const now = new Date().toISOString();
    const next = reviews.map((r) => (r.id === editing.id ? { ...r, rating, body, updatedAt: now } : r));
    persist(next);
    setEditing(null);
  };

  // Delete (내 리뷰만)
  const handleDelete = async (target) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const next = reviews.filter((r) => r.id !== target.id);
    persist(next);
    if (editing?.id === target.id) setEditing(null);
  };

  return (
    <section id="reviews" className="mt-8">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-semibold">리뷰</h2>
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <Stars value={avg} />
          <span>
            평균 {avg || 0} / 5 · 총 {count}개
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {/* 내 리뷰 작성/수정 */}
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

        {/* 리뷰 목록 */}
        <ReviewList
          reviews={sorted}
          currentUserId={currentUserId}
          onRequestEdit={(r) => setEditing(r.userId === currentUserId ? r : null)}
          onRequestDelete={(r) => r.userId === currentUserId && handleDelete(r)}
        />
      </div>
    </section>
  );
}

/* =========================
   EventDetail (페이지 루트)
========================= */
export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // location.state 로 전달된 event 객체(목록/지도에서 넘겨줄 수 있음)
  const eventFromState = location.state?.event || null;
  const [event, setEvent] = useState(eventFromState);

  useEffect(() => {
  if (!eventFromState) {
    setEvent({ id, title: `행사 #${id}`, place: "장소 미상", category: "기타" });
  }
}, [id, eventFromState]);

useEffect(() => {
  if (event) addRecent(event);
}, [event]);

  if (!event) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {event.category} · {event.place}
          </p>
        </div>
        <button onClick={() => navigate(-1)} className="rounded-xl border px-3 py-1.5">
          ← 뒤로
        </button>
      </div>

      {/* (선택) 상세 메타/이미지 등 */}
      <div className="mt-4 grid gap-2">
        {/* 여기에 일정/요금/링크/주소 등 상세 정보를 채워 넣으세요 */}
      </div>

      {/* 리뷰 섹션 */}
      <ReviewSection eventId={id} />

      {/* (선택) 관련 행사, 위치 지도 등 아래에 이어붙이기 */}
      <div className="mt-10 text-center text-sm text-gray-500">
        Tip: 목록/지도에서 이 페이지로 이동 시 <code>navigate('/events/123', {`{ state: { event } }`})</code> 형태로
        최소 정보를 같이 넘기면 초기 렌더링이 깔끔해요.
      </div>
    </div>
  );
}
