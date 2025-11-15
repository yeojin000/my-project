// src/pages/Favorites.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// 카테고리 고정 라벨
const CATEGORIES = ["공연", "전시", "교육/체험", "기타"];

// 로컬스토리지 키
const LS_KEY = "sn_favorites";

// 저장/불러오기 유틸
function loadFavs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveFavs(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
function toggleFav(item) {
  const list = loadFavs();
  const exists = list.some((x) => x.id === item.id);
  const next = exists ? list.filter((x) => x.id !== item.id) : [...list, item];
  saveFavs(next);
  return next;
}
function isFav(id) {
  return loadFavs().some((x) => x.id === id);
}

// 임시 데이터(최초 완전 비었을 때 데모용)
const SEED = [
  {
    id: "ev001",
    title: "서울재즈페스티벌 2025",
    category: "공연",
    date: "2025-06-02 ~ 06-05",
    place: "올림픽공원",
  },
  {
    id: "ev002",
    title: "시립미술관 여름 기획전",
    category: "전시",
    date: "2025-06-10 ~ 08-31",
    place: "서울시립미술관",
  },
  {
    id: "ev003",
    title: "한강 돗자리 체험 클래스",
    category: "교육/체험",
    date: "2025-06-15",
    place: "여의도 한강공원",
  },
  {
    id: "ev004",
    title: "청년 문화마켓",
    category: "기타",
    date: "2025-06-22",
    place: "성수동",
  },
];

export default function Favorites() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category"); // 없으면 카테고리 그리드, 있으면 목록 화면

  // 검색어
  const [q, setQ] = useState("");
  // 로컬스토리지 즐겨찾기 목록
  const [favs, setFavs] = useState(() => loadFavs());

  // 최초 완전 비었으면 SEED 주입(데모용)
  useEffect(() => {
    if (favs.length === 0) {
      const seeded = [SEED[0], SEED[1]];
      saveFavs(seeded);
      setFavs(seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 카테고리별 묶음
  const favsByCategory = useMemo(() => {
    const map = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
    for (const f of favs) {
      if (map[f.category]) map[f.category].push(f);
    }
    return map;
  }, [favs]);

  // (목록 화면) 카테고리별 + 검색
  const list = useMemo(() => {
    const base = category ? favs.filter((x) => x.category === category) : favs;
    if (!q.trim()) return base;
    const k = q.trim().toLowerCase();
    return base.filter(
      (x) =>
        x.title.toLowerCase().includes(k) ||
        (x.place || "").toLowerCase().includes(k)
    );
  }, [favs, category, q]);

  const goGrid = () => {
    sp.delete("category");
    setSp(sp, { replace: true });
    setQ("");
  };
  const goList = (cat) => {
    sp.set("category", cat);
    setSp(sp, { replace: true });
    setQ("");
  };

  const onToggle = (item) => {
    const next = toggleFav(item);
    setFavs(next);
  };

  // ✅ 상세보기 동작
  const handleOpenDetail = (item) => {
    if (item.homepage) {
      window.open(item.homepage, "_blank", "noopener,noreferrer");
    } else {
      // homepage 없으면 BrowseEvents에서 제목으로 검색
      navigate(`/browse?q=${encodeURIComponent(item.title)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-6xl mx-auto">
      {/* 화면 1: 카테고리 그리드 (이미지 대신 텍스트 3~4개 미리보기) */}
      {!category && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CATEGORIES.map((cat) => {
            const items = favsByCategory[cat] || [];
            const preview = items.slice(0, 4);
            const count = items.length;

            return (
              <div
                key={cat}
                role="button"
                tabIndex={0}
                onClick={() => goList(cat)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goList(cat);
                }}
                className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                title={`${cat} 즐겨찾기 보기`}
                aria-label={`${cat} 즐겨찾기 목록으로 이동`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{cat}</h3>
                  <span className="text-xs text-gray-600">{count}개</span>
                </div>

                {preview.length === 0 ? (
                  <div className="text-sm text-gray-500 h-20 grid place-items-center">
                    이 카테고리에 즐겨찾기가 비어 있어요.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {preview.map((it) => (
                      <li key={it.id} className="text-sm">
                        <div className="font-medium truncate">{it.title}</div>
                        <div className="text-xs text-gray-600 truncate">
                          📅 {it.date} · 📍 {it.place}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 더보기 영역 */}
                <div className="mt-3 text-xs text-blue-700 underline underline-offset-4">
                  {count > 4 ? `+ ${count - 4}개 더 보기` : "전체 보기"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 화면 2: 선택 카테고리 목록 */}
      {category && (
        <div className="mt-1">
          {/* 상단 바: 카테고리명 + 검색 + 뒤로가기 */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={goGrid}
              className="px-2 py-1 border rounded text-sm hover:bg-gray-50"
              title="카테고리로 돌아가기"
              aria-label="카테고리 그리드로 돌아가기"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold">{category}</h2>

            <div className="ml-auto relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="검색"
                className="border rounded pl-3 pr-8 py-1 text-sm"
                aria-label="즐겨찾기 검색"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 select-none">
                🔍
              </span>
            </div>
          </div>

          {/* 목록 */}
          {list.length === 0 ? (
            <div className="text-gray-500 text-sm h-40 grid place-items-center border rounded">
              {q
                ? "검색 결과가 없습니다."
                : "이 카테고리에 즐겨찾기한 행사가 없습니다."}
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((it) => {
                const fav = isFav(it.id);
                return (
                  <li
                    key={it.id}
                    className="flex items-center justify-between bg-gray-100 rounded px-4 py-3"
                  >
                    <div className="min-w-0">
                      {/* ✅ 제목 클릭 시 상세보기 */}
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(it)}
                        className="font-medium truncate text-left hover:underline"
                        title="상세보기"
                      >
                        {it.title}
                      </button>
                      <div className="text-xs text-gray-700 mt-0.5">
                        📅 {it.date} · 📍 {it.place}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-3">
                      {/* ✅ 상세보기 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(it)}
                        className="px-3 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      >
                        상세보기
                      </button>

                      {/* 즐겨찾기 토글 */}
                      <button
                        onClick={() => onToggle(it)}
                        className="text-xl"
                        title={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      >
                        {fav ? "❤️" : "🤍"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
