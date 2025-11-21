// src/lib/seoulApi.js
// 서울시 문화행사 오픈 API 헬퍼 모음
// - 전체 데이터 페이징 수집: fetchSeoulAllEventsJSON
// - HOME "추천 행사": fetchSeoulRecommendedEvents
// - HOME "행사 캘린더"(일별 조회): fetchSeoulDailyEvents
//
// 공통 규칙
// - .env 의 REACT_APP_SEOUL_KEY 사용(직접 호출) 또는 프록시(/api/seoul) 둘 다 지원
// - 멘토님 피드백에 맞게 START_INDEX=0, END_INDEX=4 로 넘기면 내부에서 1 기반으로 보정

const DEFAULT_PAGE = 200;

/** 내부 공통 URL 빌더 */
function buildBaseUrl({ seoulKey, useProxy }) {
  const key = seoulKey || (process.env.REACT_APP_SEOUL_KEY || "").trim();

  if (!useProxy && !key) {
    // 직접 호출 모드인데 키가 없으면 에러
    throw new Error(
      "REACT_APP_SEOUL_KEY 가 설정되지 않았습니다 (.env/Vercel 환경변수 확인)."
    );
  }

  return useProxy
    // 프록시 모드(키는 서버에서 주입): /api/seoul/ 뒤에 culturalEventInfo/... 만 붙임
    // vercel.json:
    //  source:      /api/seoul/:path*
    //  destination: https://openapi.seoul.go.kr:8088/KEY/json/:path*
    ? "/api/seoul"
    // 직접 호출 모드: KEY/json 까지 base에 포함
    // 실제 호출: https://openapi.seoul.go.kr:8088/KEY/json/culturalEventInfo/...
    : `https://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json`;
}

/** 내부 공통 START/END 보정 (멘토님이 말씀하신 0~4 를 1 기반으로 변환) */
function normalizeRange(startIndex = 0, endIndex = 4) {
  let s = Number(startIndex);
  let e = Number(endIndex);

  if (!Number.isFinite(s)) s = 0;
  if (!Number.isFinite(e)) e = s + 4;

  // 오픈API는 1 기반이라 0 → 1 로 보정
  s = Math.max(1, s);
  e = Math.max(s, e);
  return { start: s, end: e };
}

/**
 * 1) 전체 데이터를 페이지 단위로 모두 불러오는 헬퍼
 *  - JSON 포맷 기준
 *  - 페이징 돌면서 row만 모아서 배열로 리턴
 */
export async function fetchSeoulAllEventsJSON({
  // direct 모드: openapi 직접 호출
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  // proxy 모드: 개발 프록시(setupProxy.js) 또는 Vercel 프록시(/api/seoul)로 키를 숨겨서 호출
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
  const base = buildBaseUrl({ seoulKey, useProxy });

  let start = 1;
  let round = 0;

  while (allRows.length < hardLimit) {
    const end = start + pageSize - 1;

    // ✅ /json 은 base 에 이미 포함(직접 호출) 또는 vercel에서 붙여줌(프록시 모드)
    //    그래서 여기서는 culturalEventInfo 부터만 붙인다.
    const url = `${base}/culturalEventInfo/${start}/${end}/`;

    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) throw new Error(`${res.status} @ ${url}`);
    const json = await res.json();

    const rows = json?.culturalEventInfo?.row || [];
    if (!rows.length) break;

    for (const r of rows) {
      const id =
        r.SVCID || `${start}-${Math.random().toString(36).slice(2, 8)}`;
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

/**
 * 2) HOME "추천 행사"용
 *  - 멘토님 피드백: 추천 행사는 전체 데이터랑 분리해서 별도 API 호출
 *  - START_INDEX=0, END_INDEX=4 (또는 보여주고 싶은 만큼) 로 조회
 *  - 반환값: 오픈API 원본 JSON (App.jsx에서 culturalEventInfo.row 로 꺼내씀)
 */
export async function fetchSeoulRecommendedEvents({
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  useProxy = false,
  startIndex = 0,
  endIndex = 4,
  signal = undefined,
} = {}) {
  const base = buildBaseUrl({ seoulKey, useProxy });
  const { start, end } = normalizeRange(startIndex, endIndex);

  // 여기서도 culturalEventInfo 부터만 붙인다.
  const url = `${base}/culturalEventInfo/${start}/${end}/`;

  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  // App.jsx 에서 culturalEventInfo.row, list_total_count 등을 쓰기 위해 JSON 그대로 반환
  return res.json();
}

/**
 * 3) HOME "행사 캘린더"용: 특정 날짜 하루 단위 조회
 *  - 이 API는 DATE를 쿼리스트링(?DATE=...)이 아니라
 *    경로 파라미터로 넘겨야 함:
 *
 *    /culturalEventInfo/{start}/{end}/{CODENAME}/{GUNAME}/{DATE}/
 *
 *  - CODENAME, GUNAME 필터를 안 쓰는 경우 " " (공백)을 넣으라고 되어 있어
 *    실제 호출은 예를 들어:
 *
 *    .../culturalEventInfo/1/4/%20/%20/2025-11-13/
 */
export async function fetchSeoulDailyEvents({
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  useProxy = false,
  date,
  startIndex = 0,
  endIndex = 4,
  codename = " ", // 필터 없음 → 공백
  guname = " ", // 필터 없음 → 공백
  signal = undefined,
} = {}) {
  if (!date) {
    throw new Error(
      "fetchSeoulDailyEvents 호출 시 date(YYYY-MM-DD)가 필요합니다."
    );
  }

  const base = buildBaseUrl({ seoulKey, useProxy });
  const { start, end } = normalizeRange(startIndex, endIndex);

  const codeSegment = encodeURIComponent(codename || " ");
  const guSegment = encodeURIComponent(guname || " ");
  const dateSegment = encodeURIComponent(date);

  // 마찬가지로 /json 은 base 쪽에서 처리되고,
  // 여기서는 culturalEventInfo 이하만 붙임
  const url = `${base}/culturalEventInfo/${start}/${end}/${codeSegment}/${guSegment}/${dateSegment}/`;

  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.json();
}
