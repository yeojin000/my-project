// src/pages/BrowseEvents.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// 데모 데이터 (추후 API로 교체)
const ALL_EVENTS = [
  {
    id: "ev001",
    title: "서울재즈페스티벌 2025",
    category: "공연",
    date: "2025-06-02 ~ 06-05",
    place: "올림픽공원",
    thumb: "/images/sample-event.jpg",
  },
  {
    id: "ev002",
    title: "시립미술관 여름 기획전",
    category: "전시",
    date: "2025-06-10 ~ 08-31",
    place: "서울시립미술관",
    thumb: "/images/exhibition.jpg",
  },
  {
    id: "ev003",
    title: "한강 돗자리 체험 클래스",
    category: "교육/체험",
    date: "2025-06-15",
    place: "여의도 한강공원",
    thumb: "/images/edu.jpg",
  },
  {
    id: "ev004",
    title: "청년 문화마켓",
    category: "기타",
    date: "2025-06-22",
    place: "성수동",
    thumb: "/images/etc.jpg",
  },
];

const CATEGORIES = ["전체", "공연", "전시", "교육/체험", "기타"];

export default function BrowseEvents() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // URL 쿼리 동기화
  const initialCategory = decodeURIComponent(sp.get("category") || "전체");
  const initialQuery = sp.get("q") || "";

  const [category, setCategory] = useState(
    CATEGORIES.includes(initialCategory) ? initialCategory : "전체"
  );
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (category && category !== "전체") next.set("category", encodeURIComponent(category));
    else next.delete("category");
    if (query) next.set("q", query);
    else next.delete("q");
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query]);

  const results = useMemo(() => {
    const byCategory =
      category === "전체" ? ALL_EVENTS : ALL_EVENTS.filter((e) => e.category === category);
    if (!query.trim()) return byCategory;
    const q = query.trim().toLowerCase();
    return byCategory.filter(
      (e) => e.title.toLowerCase().includes(q) || e.place.toLowerCase().includes(q)
    );
  }, [category, query]);

  const onSubmit = (e) => {
    e.preventDefault();
    setQuery(input);
  };

  return (
    <div className="min-h-screen bg-white">
      

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* 컨트롤 바: 카테고리 + 검색 */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          {/* 카테고리 */}
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

          {/* 검색 */}
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
                {/* 네가 쓰는 이미지 아이콘에 맞춤 */}
                <img src="/images/search.png" alt="" className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* 본문: 결과 + 참고 이미지 */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 결과 리스트 */}
          <div className="lg:col-span-8">
            <div className="border rounded-lg p-4 min-h-[360px]">
              {results.length === 0 ? (
                <div className="h-56 grid place-items-center text-gray-500">
                  조건에 맞는 행사가 없습니다.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {results.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => navigate(`/detail/${ev.id}`)}
                      className="text-left bg-white border rounded-lg overflow-hidden hover:shadow transition"
                    >
                      <img
                        src={ev.thumb}
                        alt={ev.title}
                        className="w-full h-36 object-cover"
                      />
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{ev.title}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                            {ev.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">📅 {ev.date}</p>
                        <p className="text-sm text-gray-600">📍 {ev.place}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 참고 이미지 (스크린샷 넣을 자리) */}
          <aside className="lg:col-span-4">
            <div className="border rounded-lg overflow-hidden">
              {/* 프로젝트의 public/images/wireframes/browse_guide.png 위치에 이미지 두기 */}
              <img
                src="/images/wireframes/browse_guide.png"
                alt="Browse 페이지 기능 설명 이미지"
                className="w-full h-auto"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">* 참고 이미지는 필요 없으면 제거해도 됩니다.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
