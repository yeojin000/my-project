// src/pages/MyPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ===== LocalStorage ===== */
const LS_FAV = "sn_favorites"; // [{id,title,place,date,category,homepage?,gu?,lat?,lng?}]
const LS_RECENT = "sn_recent";

const loadLS = (k, fb = []) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* 최근 본 항목 저장(타임스탬프 포함, 중복 제거) + 같은 탭 실시간 갱신 이벤트 */
export function addRecent(item) {
  const now = new Date().toISOString();
  const base = {
    id: item.id ?? String(item.id ?? ""),
    title: item.title ?? "",
    date: item.date ?? "",
    place: item.place ?? "",
    category: item.category ?? "",
    thumb: item.thumb ?? "",
    homepage: item.homepage ?? "",
    gu: item.gu ?? "",
    seenAt: now,
  };
  const arr = loadLS(LS_RECENT, []);
  const withoutDup = arr.filter((x) => x.id !== base.id);
  const next = [base, ...withoutDup].slice(0, 10);
  saveLS(LS_RECENT, next);
  try { window.dispatchEvent(new Event("sn:recent-updated")); } catch {}
  return next;
}

/* ===== Kakao Maps loader ===== */
const FALLBACK_APPKEY = "2ee5022c1da6fc178bd51ad4042556fb";
const loadKakao = () =>
  new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) { resolve(window.kakao); return; }
    const key = process.env.REACT_APP_KAKAO_MAP_KEY || FALLBACK_APPKEY;
    const ID = "kakao-maps-sdk";
    const exist = document.getElementById(ID);
    const onLoaded = () => { try { window.kakao.maps.load(() => resolve(window.kakao)); } catch (e) { reject(e); } };
    if (exist) {
      exist.addEventListener("load", onLoaded, { once: true });
      exist.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = ID;
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services,clusterer&autoload=false`;
    s.onload = onLoaded;
    s.onerror = reject;
    document.head.appendChild(s);
  });

/* ===== 좌표 캐시 ===== */
const LS_GEO = "sn_geo_cache_v1";
const loadGeoCache = () => { try { return JSON.parse(localStorage.getItem(LS_GEO) || "{}"); } catch { return {}; } };
const saveGeoCache = (obj) => localStorage.setItem(LS_GEO, JSON.stringify(obj));

/* ===== 구 중심(백업) ===== */
const GU_CENTER = {
  종로구:[37.5730,126.9794], 중구:[37.5636,126.9976], 용산구:[37.5326,126.9905], 성동구:[37.5636,127.0364],
  광진구:[37.5386,127.0822], 동대문구:[37.5744,127.0396], 중랑구:[37.6060,127.0929], 성북구:[37.5894,127.0167],
  강북구:[37.6396,127.0257], 도봉구:[37.6688,127.0471], 노원구:[37.6542,127.0568], 은평구:[37.6176,126.9227],
  서대문구:[37.5791,126.9368], 마포구:[37.5665,126.9018], 양천구:[37.5169,126.8665], 강서구:[37.5510,126.8495],
  구로구:[37.4954,126.8874], 금천구:[37.4599,126.9001], 영등포구:[37.5263,126.8963], 동작구:[37.5124,126.9393],
  관악구:[37.4784,126.9516], 서초구:[37.4836,127.0326], 강남구:[37.5173,127.0473], 송파구:[37.5112,127.0980],
  강동구:[37.5301,127.1238],
};

/* ===== 최근 본 데이터 정리 ===== */
function normalizeRecent(rawArr) {
  const arr = Array.isArray(rawArr) ? rawArr : [];
  const fixed = arr.map((x) => ({
    id: String(x.id ?? ""),
    title: x.title ?? "",
    date: x.date ?? "",
    place: x.place ?? "",
    category: x.category ?? "",
    thumb: x.thumb ?? "",
    homepage: x.homepage ?? "",
    gu: x.gu ?? "",
    seenAt: x.seenAt ?? new Date().toISOString(),
  }));
  const valid = fixed.filter((x) => x.id && x.title);
  const dedup = []; const vis = new Set();
  for (const it of valid) { if (vis.has(it.id)) continue; vis.add(it.id); dedup.push(it); }
  dedup.sort((a, b) => new Date(b.seenAt) - new Date(a.seenAt));
  return dedup.slice(0, 50);
}

export default function MyPage() {
  const navigate = useNavigate();

  const [recent, setRecent] = useState(() => normalizeRecent(loadLS(LS_RECENT, [])));
  const [favs, setFavs]     = useState(() => loadLS(LS_FAV, []));
  const [geoFavs, setGeoFavs] = useState([]);

  // Kakao map refs
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const clusterRef = useRef(null);
  const markersRef = useRef([]);
  const infoRef = useRef([]);

  /* 지도 초기화 */
  useEffect(() => {
    let off = false;
    (async () => {
      const kakao = await loadKakao();
      if (off) return;
      kakaoRef.current = kakao;
      const center = new kakao.maps.LatLng(37.5665, 126.9780);
      mapRef.current = new kakao.maps.Map(mapEl.current, { center, level: 7 });
    })();
    return () => { off = true; };
  }, []);

  /* 즐겨찾기 → 좌표 채우기 */
  useEffect(() => {
    const kakao = kakaoRef.current;
    if (!kakao) return;
    const SEOUL_CENTER = new kakao.maps.LatLng(37.5665,126.9780);
    const ps = new kakao.maps.services.Places();
    const geocoder = new kakao.maps.services.Geocoder();
    const cache = loadGeoCache();

    let cancelled = false;

    const pickSeoul = (data, gu) => {
      const seoul = data.filter(d => (d.address_name || "").startsWith("서울"));
      if (gu) {
        const inGu = seoul.filter(d => d.address_name.includes(gu));
        return inGu[0] || seoul[0] || null;
      }
      return seoul[0] || null;
    };

    const isBad = (t="") => /온라인|비대면|미정|없음/i.test(String(t));

    const kwSearch = (keyword, gu) => new Promise(res => {
      if (!keyword) return res(null);
      ps.keywordSearch(
        keyword,
        (data, status) => {
          if (status === kakao.maps.services.Status.OK && data.length) {
            const best = pickSeoul(data, gu);
            if (best) return res({ lat: Number(best.y), lng: Number(best.x) });
          }
          res(null);
        },
        { location: SEOUL_CENTER, radius: 60000 }
      );
    });

    const addrSearch = (addr) => new Promise(res => {
      if (!addr) return res(null);
      geocoder.addressSearch(addr, (result, status) => {
        if (status === kakao.maps.services.Status.OK && result[0]) {
          const r = result.find(r => r.address_name.startsWith("서울")) || result[0];
          if (r) return res({ lat: Number(r.y), lng: Number(r.x) });
        }
        res(null);
      });
    });

    (async () => {
      const out = [];
      for (const f of favs) {
        if (typeof f.lat === "number" && typeof f.lng === "number") { out.push(f); continue; }

        const cacheKey = `${f.place || ""}|${f.title || ""}`;
        if (cache[cacheKey]) { out.push({ ...f, ...cache[cacheKey] }); continue; }

        let coords = null;
        if (f.place && !isBad(f.place)) {
          coords = await kwSearch(f.place, f.gu);
          if (!coords) coords = await addrSearch(f.place);
        }
        if (!coords && f.title) {
          coords = await kwSearch(f.title, f.gu);
        }
        if (!coords && f.gu && GU_CENTER[f.gu]) {
          const [lat, lng] = GU_CENTER[f.gu]; coords = { lat, lng };
        }
        if (!coords) coords = { lat: 37.5665, lng: 126.9780 };

        cache[cacheKey] = coords;
        out.push({ ...f, ...coords });

        await new Promise(r => setTimeout(r, 20));
        if (cancelled) return;
      }
      saveGeoCache(cache);
      if (!cancelled) setGeoFavs(out);
    })();

    return () => { cancelled = true; };
  }, [favs]);

  /* 마커 + 클러스터 + 툴팁 + 클릭 이동 */
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map) return;

    // cleanup
    markersRef.current.forEach(m => m.setMap(null));
    infoRef.current.forEach(i => i.close());
    markersRef.current = [];
    infoRef.current = [];
    if (clusterRef.current) { clusterRef.current.clear(); clusterRef.current = null; }

    const list = geoFavs.filter(f => f.lat != null && f.lng != null);
    if (list.length === 0) return;

    const markers = [];
    const infos = [];
    const bounds = new kakao.maps.LatLngBounds();

    list.forEach((f) => {
      const pos = new kakao.maps.LatLng(f.lat, f.lng);
      bounds.extend(pos);

      const marker = new kakao.maps.Marker({ position: pos, title: f.title });
      // 클릭 → 상세 페이지 이동(이벤트 상태 함께 전달)
      kakao.maps.event.addListener(marker, "click", () => {
        navigate(`/events/${encodeURIComponent(f.id)}`, { state: { event: f } });
      });

      const iwHtml = `
        <div style="padding:8px 10px; font-size:12px; max-width:220px;">
          <div style="font-weight:600; margin-bottom:4px;">${f.title}</div>
          <div style="color:#666;">${f.place || ""}</div>
          <div style="color:#888; margin-top:2px;">${f.date || ""} · ${f.category || ""}</div>
        </div>`;
      const iw = new kakao.maps.InfoWindow({ content: iwHtml });
      kakao.maps.event.addListener(marker, "mouseover", () => { infos.forEach((i) => i.close()); iw.open(map, marker); });
      kakao.maps.event.addListener(marker, "mouseout", () => iw.close());

      markers.push(marker);
      infos.push(iw);
    });

    markersRef.current = markers;
    infoRef.current = infos;

    const clusterer = new kakao.maps.MarkerClusterer({
      map, averageCenter: true, minLevel: 6, disableClickZoom: false,
    });
    clusterer.addMarkers(markers);
    clusterRef.current = clusterer;

    map.setBounds(bounds, 40, 40, 40, 40);
  }, [geoFavs, navigate]);

  // 스토리지/커스텀 이벤트 반영
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_RECENT) setRecent(normalizeRecent(loadLS(LS_RECENT, [])));
      if (e.key === LS_FAV)    setFavs(loadLS(LS_FAV, []));
    };
    const onRecentEvent = () => setRecent(normalizeRecent(loadLS(LS_RECENT, [])));
    window.addEventListener("storage", onStorage);
    window.addEventListener("sn:recent-updated", onRecentEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sn:recent-updated", onRecentEvent);
    };
  }, []);

  /* 즐겨찾기 토글 */
  const toggleFav = (item) => {
    const list = loadLS(LS_FAV, []);
    const exists = list.some((x) => x.id === item.id);
    const next = exists ? list.filter((x) => x.id !== item.id) : [...list, item];
    saveLS(LS_FAV, next);
    setFavs(next);
  };

  /* 최근 목록 수동 새로고침 */
  const refreshRecent = () => setRecent(normalizeRecent(loadLS(LS_RECENT, [])));

  /* 공통 이동 함수: 상세 페이지로, state에 이벤트 동봉 */
  const goDetailWithState = (ev) => {
    navigate(`/events/${encodeURIComponent(ev.id)}`, { state: { event: ev } });
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 최근 본 항목 */}
        <section className="lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">최근 본 항목</h2>
            <div className="flex items-center gap-3">
              <button className="text-xs underline text-gray-500" onClick={refreshRecent} title="새로고침">새로고침</button>
              {recent.length > 0 && (
                <button className="text-xs underline text-gray-500" onClick={() => { saveLS(LS_RECENT, []); setRecent([]); }}>
                  비우기
                </button>
              )}
            </div>
          </div>
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
                      onClick={() => goDetailWithState(it)} // ✅ 상세 페이지 + state
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 border"
                    >
                      <div className="font-medium truncate">{it.title}</div>
                      <div className="text-xs text-gray-600 truncate">
                        📅 {it.date || "일정 미정"} · 📍 {it.place || "장소 미정"} · {it.category || ""}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* My Favorite (지도) */}
        <section className="lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">My Favorite</h2>
            {favs.length > 0 && (
              <button className="text-xs underline text-gray-500" onClick={() => { saveLS(LS_FAV, []); setFavs([]); }}>
                전체 해제
              </button>
            )}
          </div>

          <div
            ref={mapEl}
            className="relative border rounded-lg bg-gray-100 h-[420px] overflow-hidden"
            aria-label="즐겨찾기 지도"
            role="region"
          >
            {!kakaoRef.current && (
              <div className="absolute inset-0 grid place-items-center text-gray-500 text-sm">
                지도를 불러오는 중…
              </div>
            )}
          </div>

          {/* 즐겨찾기 간단 리스트 (하트 토글 지원) */}
          <ul className="mt-3 text-sm text-gray-700 space-y-1">
            {favs.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <button
                  onClick={() => toggleFav(f)}
                  title="즐겨찾기 해제"
                  aria-label="즐겨찾기 해제"
                  className="leading-none"
                >
                  ❤️
                </button>
                <button
                  className="truncate text-left hover:underline"
                  onClick={() => goDetailWithState(f)} // ✅ 상세 페이지 + state
                >
                  <b>{f.title}</b> · {f.date || "일정 미정"} · {f.place || "장소 미정"} ({f.category || ""})
                </button>
              </li>
            ))}
            {favs.length === 0 && <li className="text-gray-500">즐겨찾기한 행사가 없습니다.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
