// src/pages/Map.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* === 환경변수 === */
const SEOUL_KEY = (process.env.REACT_APP_SEOUL_KEY || "").trim();
const KAKAO_KEY = (process.env.REACT_APP_KAKAO_MAP_KEY || "").trim();

/* === 서울시 API 주소 설정 === */
const IS_PROD = process.env.NODE_ENV === "production";
const SEOUL_API_BASE = IS_PROD
  ? "/api/seoul/json/culturalEventInfo"
  : SEOUL_KEY
  ? `http://openapi.seoul.go.kr:8088/${encodeURIComponent(SEOUL_KEY)}/json/culturalEventInfo`
  : null;

/* === 필터 옵션 === */
const CATEGORIES = ["전체", "공연", "전시", "교육/체험", "기타"];
const AREAS = [
  "전체", "종로구", "중구", "용산구", "성동구", "광진구",
  "동대문구", "중랑구", "성북구", "강북구", "도봉구",
  "노원구", "은평구", "서대문구", "마포구", "양천구",
  "강서구", "구로구", "금천구", "영등포구", "동작구",
  "관악구", "서초구", "강남구", "송파구", "강동구"
];
const QUICK_RANGES = ["오늘", "이번 주", "이번 달"];

/* === 서울시 행정구 중심 좌표 === */
const GU_CENTER = {
  종로구: [37.5730, 126.9794], 중구: [37.5636, 126.9976], 용산구: [37.5326, 126.9905],
  성동구: [37.5636, 127.0364], 광진구: [37.5386, 127.0822], 동대문구: [37.5744, 127.0396],
  중랑구: [37.6060, 127.0929], 성북구: [37.5894, 127.0167], 강북구: [37.6396, 127.0257],
  도봉구: [37.6688, 127.0471], 노원구: [37.6542, 127.0568], 은평구: [37.6176, 126.9227],
  서대문구: [37.5791, 126.9368], 마포구: [37.5665, 126.9018], 양천구: [37.5169, 126.8665],
  강서구: [37.5510, 126.8495], 구로구: [37.4954, 126.8874], 금천구: [37.4599, 126.9001],
  영등포구: [37.5263, 126.8963], 동작구: [37.5124, 126.9393], 관악구: [37.4784, 126.9516],
  서초구: [37.4836, 127.0326], 강남구: [37.5173, 127.0473], 송파구: [37.5112, 127.0980],
  강동구: [37.5301, 127.1238]
};

/* === 유틸리티 함수들 === */
const LS_FAV = "sn_favorites";
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(LS_FAV) || "[]"); } catch { return []; } };
const saveFavs = (list) => localStorage.setItem(LS_FAV, JSON.stringify(list));
const isFav = (id) => loadFavs().some((x) => x.id === id);
const toggleFav = (item) => {
  const cur = loadFavs();
  const exists = cur.some((x) => x.id === item.id);
  const next = exists ? cur.filter((x) => x.id !== item.id) : [...cur, item];
  saveFavs(next);
  return next;
};

const loadKakao = () =>
  new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) { resolve(window.kakao); return; }
    const key = KAKAO_KEY;
    if (!key) return reject(new Error("REACT_APP_KAKAO_MAP_KEY 확인 필요"));
    const ID = "kakao-maps-sdk";
    const exist = document.getElementById(ID);
    const onLoaded = () => {
      try { window.kakao.maps.load(() => resolve(window.kakao)); } catch (e) { reject(e); }
    };
    if (exist) {
      exist.addEventListener("load", onLoaded, { once: true });
      exist.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = ID; s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services,clusterer,drawing&autoload=false`;
    s.onload = onLoaded; s.onerror = reject;
    document.head.appendChild(s);
  });

const PAGE_SIZE = 200;
function toHighLevelCategory(codename = "", themecode = "") {
  const c = String(codename);
  if (["콘서트", "클래식", "국악", "무용", "연극", "뮤지컬/오페라", "축제-기타"].some(k => c.includes(k))) return "공연";
  if (c.includes("전시/미술")) return "전시";
  if (c.includes("교육/체험") || String(themecode).includes("교육")) return "교육/체험";
  return "기타";
}

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const parseToDate = (s = "") => {
  if (!s) return null;
  const raw = String(s).trim();
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    return isNaN(dt) ? null : dt;
  }
  const normalized = raw.replaceAll(".", "-");
  const dt = new Date(normalized);
  return isNaN(dt) ? null : dt;
};
const normalizeRangeLabel = (s = "", e = "") => {
  const S = (s || "").replaceAll(".", "-");
  const E = (e || "").replaceAll(".", "-");
  if (!S && !E) return "일정 미정";
  if (S && E) return `${S} ~ ${E}`;
  return S || E;
};

function normalizeEvents(json) {
  const rows = json?.culturalEventInfo?.row || [];
  return rows.map((r, idx) => {
    const startStr = r.STRTDATE || r.DATE;
    const endStr = r.END_DATE || r.ENDDATE || r.END;
    const start = parseToDate(startStr);
    const end = parseToDate(endStr) || start;
    const category = toHighLevelCategory(r.CODENAME, r.THEMECODE);
    return {
      id: r.SVCID || `evt_${idx}`,
      title: r.TITLE || r.SVCNM || "무제",
      category,
      place: r.PLACE || "",
      gu: r.GUNAME || "",
      dateStart: start ? ymd(start) : "",
      dateEnd: end ? ymd(end) : "",
      dateLabel: normalizeRangeLabel(startStr, endStr),
      homepage: r.ORG_LINK || r.HMPG_ADDR || "",
      fee: r.USE_FEE || "",
      lat: null, lng: null,
    };
  });
}

const LS_GEO = "sn_geo_cache_v1";
const loadGeoCache = () => { try { return JSON.parse(localStorage.getItem(LS_GEO) || "{}"); } catch { return {}; } };
const saveGeoCache = (obj) => localStorage.setItem(LS_GEO, JSON.stringify(obj));

const inRange = (ev, startISO, endISO) => {
  if (!startISO && !endISO) return true;
  const s = ev.dateStart ? new Date(ev.dateStart + "T00:00:00") : null;
  const e = ev.dateEnd ? new Date(ev.dateEnd + "T23:59:59") : s;
  const S = startISO ? new Date(startISO + "T00:00:00") : null;
  const E = endISO ? new Date(endISO + "T23:59:59") : null;
  if (!s || !e) return false;
  const leftOK = !E || s <= E;
  const rightOK = !S || e >= S;
  return leftOK && rightOK;
};

const isWithinSeoulBoundary = (lat, lng) => {
  return lat >= 37.4 && lat <= 37.7 && lng >= 126.7 && lng <= 127.2;
};

export default function MapPage() {
  const [category, setCategory] = useState("전체");
  const [area, setArea] = useState("전체");
  const [quick, setQuick] = useState("오늘");
  const [startDate, setStartDate] = useState(ymd(new Date())); 
  const [endDate, setEndDate] = useState("");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoRef = useRef([]);
  const clusterRef = useRef(null);
  const kakaoRef = useRef(null);

  /* 데이터 로드 */
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const kakao = await loadKakao();
        if (disposed) return;
        kakaoRef.current = kakao;

        const center = new kakao.maps.LatLng(37.5665, 126.9780);
        if (mapEl.current) {
          const map = new kakao.maps.Map(mapEl.current, { center, level: 7 });
          mapRef.current = map;
        }

        setLoading(true); setErr(null);
        if (!SEOUL_API_BASE) throw new Error("API 키 확인 필요");

        const userStartISO = startDate || ymd(new Date());
        const userStart = new Date(userStartISO + "T00:00:00");
        let pageStart = 1; const allRows = []; let stop = false;

        while (!stop) {
          const pageEnd = pageStart + PAGE_SIZE - 1;
          const url = `${SEOUL_API_BASE}/${pageStart}/${pageEnd}/`;
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const rows = json?.culturalEventInfo?.row || [];

          if (rows.length === 0) break;
          allRows.push(...rows);
          
          if (allRows.length >= 5000) { stop = true; break; }

          const last = rows[rows.length - 1];
          const endStr = last.END_DATE || last.ENDDATE || last.END || last.STRTDATE || last.DATE;
          const lastEnd = parseToDate(endStr);

          if (lastEnd && lastEnd < userStart) stop = true;
          else pageStart += PAGE_SIZE;

          if (disposed) return;
        }
        const items = normalizeEvents({ culturalEventInfo: { row: allRows } });
        if (!disposed) setEvents(items);
      } catch (e) { if (!disposed) setErr(e); } 
      finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; };
  }, [startDate]);

  /* 필터/기간 */
  useEffect(() => {
    if (!quick) return;
    const today = new Date();
    if (quick === "오늘") { setStartDate(ymd(today)); setEndDate(ymd(today)); return; }
    if (quick === "이번 주") {
      const day = today.getDay(); 
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(today); mon.setDate(today.getDate() + diff);
      const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
      setStartDate(ymd(mon)); setEndDate(ymd(sun)); return;
    }
    if (quick === "이번 달") {
      const y = today.getFullYear(), m = today.getMonth();
      setStartDate(ymd(new Date(y, m, 1))); setEndDate(ymd(new Date(y, m + 1, 0))); return;
    }
  }, [quick]);

  /* 지역 변경 시 이동 */
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map) return;
    if (area === "전체") {
      map.setLevel(7);
      map.setCenter(new kakao.maps.LatLng(37.5665, 126.9780));
    } else if (GU_CENTER[area]) {
      const [lat, lng] = GU_CENTER[area];
      map.setLevel(5);
      map.setCenter(new kakao.maps.LatLng(lat, lng));
    } else {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(area, (data, status) => {
        if (status === kakao.maps.services.Status.OK && data[0]) {
          map.setLevel(5);
          map.setCenter(new kakao.maps.LatLng(data[0].y, data[0].x));
        }
      });
    }
  }, [area]);

  /* 필터링 결과 */
  const filtered = useMemo(() => {
    return events.filter((e) => {
      const byCat = category === "전체" ? true : e.category === category;
      const byArea = area === "전체" ? true : (e.gu?.includes(area) || e.place?.includes(area));
      const byDate = inRange(e, startDate, endDate);
      return byCat && byArea && byDate;
    });
  }, [events, category, area, startDate, endDate]);

  /* 좌표 변환 */
  const [geoReadyEvents, setGeoReadyEvents] = useState([]);
  useEffect(() => {
    const kakao = kakaoRef.current;
    if (!kakao) return;
    const cache = loadGeoCache();
    const ps = new kakao.maps.services.Places();
    const geocoder = new kakao.maps.services.Geocoder();
    let cancelled = false;
    const SEOUL_CENTER = new kakao.maps.LatLng(37.5665, 126.9780);

    const isBadPlace = (txt = "") => !String(txt).trim() || /온라인|비대면|무관|미정|없음/i.test(String(txt));
    const pickSeoulHit = (data, gu) => {
      const inSeoul = data.filter(d => (d.address_name || "").startsWith("서울"));
      const inGu = gu ? inSeoul.filter(d => d.address_name.includes(gu)) : inSeoul;
      return (inGu[0] || inSeoul[0] || null);
    };

    const fillCoords = async () => {
      const targets = filtered.slice(0, 100); 
      const out = [];
      for (const ev of targets) {
        const key = `${ev.gu || ""}|${ev.place || ""}|${ev.title}`;
        if (cache[key]) { out.push({ ...ev, ...cache[key] }); continue; }

        let coords = null;
        if (isBadPlace(ev.place) && GU_CENTER[ev.gu]) coords = { lat: GU_CENTER[ev.gu][0], lng: GU_CENTER[ev.gu][1] };

        if (!coords && ev.place) {
          coords = await new Promise(resolve => {
            ps.keywordSearch(`${ev.gu ? ev.gu + " " : ""}${ev.place}`, (data, status) => {
              if (status === kakao.maps.services.Status.OK && data.length) {
                const best = pickSeoulHit(data, ev.gu);
                if (best) return resolve({ lat: Number(best.y), lng: Number(best.x) });
              }
              resolve(null);
            }, { location: SEOUL_CENTER, radius: 60000 });
          });
        }
        if (!coords && ev.place) {
          coords = await new Promise(resolve => {
            geocoder.addressSearch(ev.place, (result, status) => {
              if (status === kakao.maps.services.Status.OK && result[0]) {
                const r = result.find(r => r.address_name.startsWith("서울")) || result[0];
                if (r.address_name.startsWith("서울")) return resolve({ lat: Number(r.y), lng: Number(r.x) });
              }
              resolve(null);
            });
          });
        }
        if (!coords && GU_CENTER[ev.gu]) coords = { lat: GU_CENTER[ev.gu][0], lng: GU_CENTER[ev.gu][1] };

        if (coords) {
          if (!isWithinSeoulBoundary(coords.lat, coords.lng)) {
            if (GU_CENTER[ev.gu]) coords = { lat: GU_CENTER[ev.gu][0], lng: GU_CENTER[ev.gu][1] };
            else coords = null;
          }
        }
        if (coords) {
          cache[key] = coords;
          out.push({ ...ev, ...coords });
        }
        await new Promise(r => setTimeout(r, 150));
        if (cancelled) return;
      }
      saveGeoCache(cache);
      if (!cancelled) setGeoReadyEvents(out);
    };
    fillCoords();
    return () => { cancelled = true; };
  }, [filtered]);

  /* [수정 핵심] 
    이 useEffect는 마커를 '그리는' 역할만 합니다.
    dependencies에서 [selected]를 제거했습니다.
    이제 마우스를 올려서 selected 값이 바뀌어도 지도가 깜빡이거나 이동하지 않습니다.
  */
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    infoRef.current.forEach((i) => i.close());
    markersRef.current = [];
    infoRef.current = [];
    if (clusterRef.current) clusterRef.current.clear();

    if (geoReadyEvents.length === 0) return;

    const markers = [];
    const infos = [];
    const bounds = new kakao.maps.LatLngBounds();

    geoReadyEvents.forEach((ev) => {
      if (ev.lat == null || ev.lng == null) return;
      const pos = new kakao.maps.LatLng(ev.lat, ev.lng);
      bounds.extend(pos);

      const marker = new kakao.maps.Marker({ position: pos, title: ev.title });

      const iwHtml = `
        <div style="padding:8px 10px; font-size:12px; max-width:240px;">
          <div style="font-weight:600; margin-bottom:4px; cursor:pointer;">
             ${ev.homepage 
               ? `<a href="${ev.homepage}" target="_blank" style="color:#333; text-decoration:none;">${ev.title}</a>` 
               : ev.title}
          </div>
          <div style="color:#666;">${ev.place || ev.gu || ""}</div>
          <div style="color:#888; margin-top:2px;">${ev.dateLabel}</div>
          ${ev.homepage 
            ? `<div style="margin-top:4px; text-align:right;">
                 <a href="${ev.homepage}" target="_blank" style="color:#2563eb; text-decoration:underline;">상세보기</a>
               </div>` 
            : ""}
        </div>
      `;

      const iw = new kakao.maps.InfoWindow({ content: iwHtml, removable: true });

      const openInfo = () => {
        infos.forEach((i) => i.close());
        iw.open(map, marker);
        setSelected(ev);
      };

      kakao.maps.event.addListener(marker, "mouseover", openInfo);
      kakao.maps.event.addListener(marker, "click", openInfo);

      markers.push(marker);
      infos.push(iw);
    });

    markersRef.current = markers;
    infoRef.current = infos;

    const clusterer = new kakao.maps.MarkerClusterer({
      map, markers, averageCenter: true, minLevel: 6, disableClickZoom: false,
    });
    clusterRef.current = clusterer;

    const handleMapClick = () => {
      infos.forEach((i) => i.close());
    };
    kakao.maps.event.addListener(map, "click", handleMapClick);

    // '전체' 지역일 때만 bound 재설정 (필터 변경 시에만 동작)
    if (area === "전체" && markers.length > 0) {
      map.setBounds(bounds, 40, 40, 40, 40);
    }

    return () => {
      kakao.maps.event.removeListener(map, "click", handleMapClick);
    };
  }, [geoReadyEvents, area]); // ★ 여기서 selected를 제거함!

  /* 필터 변경 등으로 목록이 바뀌었을 때, 선택된 항목이 목록에 없으면 선택 해제 */
  useEffect(() => {
    if (selected && !geoReadyEvents.some((e) => e.id === selected.id)) {
      setSelected(null);
    }
  }, [geoReadyEvents]);

  const [, forceFav] = useState(0);
  const onToggleFav = (ev) => {
    toggleFav({
      id: ev.id, title: ev.title, category: ev.category,
      date: ev.dateLabel, place: ev.place || ev.gu || "", homepage: ev.homepage || "",
    });
    forceFav((v) => v + 1);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 왼쪽 */}
        <aside className="lg:col-span-3">
          <h2 className="font-semibold mb-2">카테고리</h2>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded px-2 py-2 w-full mb-4">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <h2 className="font-semibold mb-2">지역(행정구)</h2>
          <select value={area} onChange={(e) => setArea(e.target.value)} className="border rounded px-2 py-2 w-full mb-4">
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <h2 className="font-semibold mb-2">날짜</h2>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {QUICK_RANGES.map((r) => (
              <button key={r} onClick={() => setQuick(r)}
                className={"text-xs border rounded px-2 py-1 " + (quick === r ? "bg-black text-white" : "bg-white hover:bg-gray-50")}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setQuick(""); }} className="border rounded px-2 py-1 text-sm w-full" />
            <span className="text-sm text-gray-500">~</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setQuick(""); }} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div className="mt-4 text-xs text-gray-600">
            {loading ? "🔄 서울시 행사 불러오는 중…" : `표시 후보: ${filtered.length}건`}
            {err && <div className="text-red-600 mt-1">데이터 로드 실패: {String(err.message || err)}</div>}
          </div>
        </aside>

        {/* 지도 */}
        <section className="lg:col-span-6">
          <div ref={mapEl} className="border rounded-lg w-full" style={{ height: 600 }} aria-label="카카오 지도" role="region" />
        </section>

        {/* 상세 패널 */}
        <aside className="lg:col-span-3 border rounded-lg p-4 bg-gray-50">
          {!selected ? (
            <div className="text-gray-500 text-sm text-center mt-20">지도의 마커를 클릭하면 상세 정보가 표시됩니다.</div>
          ) : (
            <div>
              <div className="text-xs inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 mb-2">
                {selected.category} {selected.gu ? `· ${selected.gu}` : ""}
              </div>
              <h3 className="font-bold text-lg mb-1">{selected.title}</h3>
              <p className="text-sm text-gray-700">{selected.place || selected.gu || ""}</p>
              <p className="text-sm text-gray-700 mt-1">📅 {selected.dateLabel}</p>
              {selected.fee && <p className="text-xs text-gray-500 mt-1">요금: {selected.fee}</p>}
              <div className="mt-3 flex items-center gap-3">
                <button onClick={() => onToggleFav(selected)} className="text-xl" title="즐겨찾기 토글">
                  {isFav(selected.id) ? "❤️" : "🤍"}
                </button>
                {selected.homepage && (
                  <a href={selected.homepage} target="_blank" rel="noreferrer" className="text-sm underline" title="상세보기">
                    상세보기
                  </a>
                )}
              </div>
              <button className="mt-4 text-xs underline text-gray-600" onClick={() => setSelected(null)}>선택 해제</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}