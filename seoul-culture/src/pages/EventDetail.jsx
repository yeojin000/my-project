// src/pages/EventDetail.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * 리뷰 기능 제거 버전의 상세 페이지
 * - MyPage / Map 등에서 navigate 할 때 state로 넘긴 event만 사용
 * - 리뷰, 별점, 로컬스토리지 리뷰 전부 없음
 */

export default function EventDetail() {
  const navigate = useNavigate();
  const location = useLocation();

  // navigate(..., { state: { event } }) 로 넘긴 데이터 사용
  const ev = location.state?.event;

  if (!ev) {
    // state 없이 /events/:id 로 직접 들어온 경우
    return (
      <div className="min-h-screen bg-white px-6 py-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-sm underline text-gray-600"
        >
          ← 뒤로가기
        </button>
        <div className="border rounded-lg p-6 text-sm text-gray-600">
          이 행사의 상세 정보가 전달되지 않았습니다.
          <br />
          이전 화면에서 다시 접근해 주세요.
        </div>
      </div>
    );
  }

  const {
    title,
    category,
    date,
    dateLabel,
    place,
    homepage,
    fee,
    thumb,
    gu,
  } = ev;

  const displayDate = dateLabel || date || "일정 미정";
  const displayPlace = place || gu || "장소 미정";

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-4xl mx-auto">
      {/* 상단 헤더 */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm underline text-gray-600"
      >
        ← 뒤로가기
      </button>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        {/* 이미지 영역 */}
        {thumb && (
          <div className="w-full h-56 bg-gray-100 overflow-hidden">
            <img
              src={thumb}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* 텍스트 정보 */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs inline-flex items-center rounded-full bg-gray-100 px-3 py-1">
              {category || "행사"}
              {gu ? <span className="ml-1 text-gray-500">· {gu}</span> : null}
            </div>
          </div>

          <h1 className="text-2xl font-bold leading-snug">{title}</h1>

          <div className="space-y-1 text-sm text-gray-700">
            <p>📅 {displayDate}</p>
            <p>📍 {displayPlace}</p>
            {fee && <p>💳 요금: {fee}</p>}
          </div>

          {homepage && (
            <div className="pt-3">
              <a
                href={homepage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm px-4 py-2 rounded-full border hover:bg-gray-50"
              >
                상세 페이지 바로가기
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
