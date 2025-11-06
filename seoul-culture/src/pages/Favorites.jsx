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

// 임시 데이터(다른 페이지에서 즐겨찾기 추가하기 전 시연용)
// 실제에선 각 카드에 하트 버튼을 넣어 toggleFav(item) 호출하면 됨
const SEED = [
  { id: "ev001", title: "서울재즈페스티벌 2025", category: "공연", date: "2025-06-02 ~ 06-05", place: "올림픽공원" },
  { id: "ev002", title: "시립미술관 여름 기획전", category: "전시", date: "2025-06-10 ~ 08-31", place: "서울시립미술관" },
  { id: "ev003", title: "한강 돗자리 체험 클래스", category: "교육/체험", date: "2025-06-15", place: "여의도 한강공원" },
  { id: "ev004", title: "청년 문화마켓", category: "기타", date: "2025-06-22", place: "성수동" },
];

export default function Favorites() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category"); // 없으면 카테고리 그리드, 있으면 목록 화면

  // 검색어
  const [q, setQ] = useState("");
  // 로컬스토리지 즐겨찾기 목록
  const [favs, setFavs] = useState(() => loadFavs());

  // 데모 편의: 즐겨찾기 비어 있으면 SEED 2개 넣어줌(최초 1회)
  useEffect(() => {
    if (favs.length === 0) {
      const seeded = [SEED[0], SEED[1]];
      saveFavs(seeded);
      setFavs(seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 카테고리별 목록
  const list = useMemo(() => {
    const base = category ? favs.filter((x) => x.category === category) : favs;
    if (!q.trim()) return base;
    const k = q.trim().toLowerCase();
    return base.filter(
      (x) =>
        x.title.toLowerCase().includes(k) ||
        x.place.toLowerCase().includes(k)
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

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-6xl mx-auto">
      

      {/* 화면 1: 카테고리 그리드 */}
      {!category && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <div className="mb-2 text-gray-800">{cat}</div>
                <button
                  onClick={() => goList(cat)}
                  className="w-full aspect-[16/9] bg-gray-200 border rounded-lg hover:bg-gray-300 transition"
                  title={`${cat} 즐겨찾기 보기`}
                />
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            * 회색 박스는 카테고리 대표 이미지 자리(추후 교체). 클릭하면 해당 카테고리 즐겨찾기 목록으로 이동합니다.
          </p>
        </>
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
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 select-none">🔍</span>
            </div>
          </div>

          {/* 목록 */}
          {list.length === 0 ? (
            <div className="text-gray-500 text-sm h-40 grid place-items-center border rounded">
              {q ? "검색 결과가 없습니다." : "이 카테고리에 즐겨찾기한 행사가 없습니다."}
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((it) => {
                const fav = isFav(it.id);
                return (
                  <li
                    key={it.id}
                    className="flex items-center justify-between bg-gray-200 rounded px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{it.title}</div>
                      <div className="text-xs text-gray-700 mt-0.5">
                        📅 {it.date} · 📍 {it.place}
                      </div>
                    </div>
                    <button
                      onClick={() => onToggle(it)}
                      className="ml-3 text-xl"
                      title={fav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      aria-label="toggle favorite"
                    >
                      {fav ? "❤️" : "🤍"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-xs text-gray-500">
            * 하트(❤️/🤍) 버튼으로 즐겨찾기 토글. 데이터는 브라우저 <b>localStorage</b>에 저장됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
