// src/lib/seoulApi.js
// 전체 데이터를 페이지 단위로 모두 불러오는 헬퍼
// - JSON 포맷 기준
// - .env의 REACT_APP_SEOUL_KEY 사용(직접 호출) 또는 프록시(/api/seoul) 둘 다 지원

const DEFAULT_PAGE = 200;

export async function fetchSeoulAllEventsJSON({
  // direct 모드: openapi 직접 호출
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  // proxy 모드: 개발 프록시(setupProxy.js)로 키를 숨겨서 호출(ex. /api/seoul/…)
  useProxy = false,
  // 한 번에 가져올 개수 (200 추천)
  pageSize = DEFAULT_PAGE,
  // 안전 상한(너무 크면 브라우저 부담) — 필요시 늘려도 됨
  hardLimit = 5000,
  // 중간 진행상황 콜백 (선택)
  onPage = null,
  // fetch 옵션 -> abortSignal 등
  signal = undefined,
}) {
  const allRows = [];
  const seen = new Set(); // SVCID 중복 제거용

  let start = 1;
  let round = 0;

  while (allRows.length < hardLimit) {
    const end = start + pageSize - 1;

    const url = useProxy
      // 프록시 모드(키는 서버에서 주입): /api/seoul/culturalEventInfo/{start}/{end}/
      ? `/api/seoul/culturalEventInfo/${start}/${end}/`
      // 직접 호출 모드: http://openapi.seoul.go.kr:8088/{key}/json/culturalEventInfo/{start}/{end}/
      : `http://openapi.seoul.go.kr:8088/${encodeURIComponent(
          seoulKey
        )}/json/culturalEventInfo/${start}/${end}/`;

    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
    const json = await res.json();

    const rows = json?.culturalEventInfo?.row || [];
    if (!rows.length) break;

    for (const r of rows) {
      const id = r.SVCID || `${start}-${Math.random().toString(36).slice(2, 8)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      allRows.push(r);
      if (allRows.length >= hardLimit) break;
    }

    round += 1;
    if (typeof onPage === "function") {
      onPage({ round, fetched: rows.length, total: allRows.length, start, end });
    }

    if (rows.length < pageSize) break; // 마지막 페이지
    start += pageSize;
  }

  return allRows;
}
