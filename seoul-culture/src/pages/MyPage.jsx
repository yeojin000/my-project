import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// 로컬스토리지 키 (Favorites.jsx와 동일 키 사용)
const LS_FAV = "sn_favorites";
const LS_RECENT = "sn_recent"; // 최근 본 항목 최대 10개

function loadLS(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 다른 페이지(상세 등)에서 호출해서 최근 본 항목을 기록할 때 쓰면 됨
 *  사용 예:
 *    addRecent({ id, title, place, date, category })
 */
export function addRecent(item) {
  const arr = loadLS(LS_RECENT, []);
  const withoutDup = arr.filter((x) => x.id !== item.id);
  const next = [item, ...withoutDup].slice(0, 10); // 최대 10개
  saveLS(LS_RECENT, next);
  return next;
}

export default function MyPage() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState(() => loadLS(LS_RECENT, []));
  const [favs, setFavs] = useState(() => loadLS(LS_FAV, []));

  // 데모 편의: 둘 다 비어 있으면 샘플 2개씩 채우기 (최초 1회)
  useEffect(() => {
    if (recent.length === 0) {
      const seed = [
        { id: "ev001", title: "서울재즈페스티벌 2025", place: "올림픽공원", date: "2025-06-02 ~ 06-05", category: "공연" },
        { id: "ev002", title: "시립미술관 여름 기획전", place: "서울시립미술관", date: "2025-06-10 ~ 08-31", category: "전시" },
      ];
      setRecent(seed);
      saveLS(LS_RECENT, seed);
    }
    if (favs.length === 0) {
      const seedFav = [
        { id: "ev003", title: "한강 돗자리 체험 클래스", place: "여의도 한강공원", date: "2025-06-15", category: "교육/체험" },
        { id: "ev004", title: "청년 문화마켓", place: "성수동", date: "2025-06-22", category: "기타" },
      ];
      setFavs(seedFav);
      saveLS(LS_FAV, seedFav);
    }
  }, []); // eslint-disable-line

  // 가짜 지도 마커 좌표(컨테이너의 width/height를 0~1로 정규화)
  const markerSlots = useMemo(
    () => [
      { x: 0.32, y: 0.35 },
      { x: 0.58, y: 0.42 },
      { x: 0.45, y: 0.55 },
      { x: 0.70, y: 0.30 },
      { x: 0.25, y: 0.60 },
      { x: 0.60, y: 0.70 },
      { x: 0.40, y: 0.28 },
      { x: 0.15, y: 0.45 },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-7xl mx-auto">
      

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ① 최근 본 항목 */}
        <section className="lg:col-span-6">
          <h2 className="text-lg font-semibold mb-3">최근 본 항목</h2>

          {recent.length === 0 ? (
            <div className="h-[420px] grid place-items-center bg-gray-100 border rounded text-gray-500">
              최근 본 항목이 없습니다.
            </div>
          ) : (
            <div className="border rounded p-3 h-[420px] overflow-auto">
              <ul className="space-y-2">
                {recent.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => navigate(`/detail/${it.id}`)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 border"
                      title="상세 페이지로 이동"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.title}</div>
                          <div className="text-xs text-gray-600 truncate">
                            📅 {it.date} · 📍 {it.place} · {it.category}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">자세히 →</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ② My Favorite (가짜 지도 + 마커) */}
        <section className="lg:col-span-6">
          <h2 className="text-lg font-semibold mb-3">My Favorite</h2>

          <div className="relative border rounded-lg bg-gray-200 h-[420px] overflow-hidden">
            {/* 지도 플레이스홀더 레이블 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
              지도 영역 (즐겨찾기 마커 표시 · API 미연결)
            </div>

            {/* 마커 */}
            {favs.map((f, i) => {
              const pos = markerSlots[i % markerSlots.length];
              return (
                <div
                  key={f.id}
                  title={`${f.title} · ${f.place}`}
                  className="absolute -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                  }}
                >
                  {/* 빨간 마커 */}
                  <div className="relative group">
                    <div className="w-3 h-3 bg-red-500 rounded-full shadow" />
                    {/* 툴팁 */}
                    <div className="absolute left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block whitespace-nowrap bg-black text-white text-xs rounded px-2 py-1">
                      {f.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 즐겨찾기 간단 리스트 (지도의 아래) */}
          <ul className="mt-3 text-sm text-gray-700 space-y-1">
            {favs.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <span>❤️</span>
                <span className="truncate">
                  <b>{f.title}</b> · {f.date} · {f.place} ({f.category})
                </span>
              </li>
            ))}
            {favs.length === 0 && (
              <li className="text-gray-500">즐겨찾기한 행사가 없습니다.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
