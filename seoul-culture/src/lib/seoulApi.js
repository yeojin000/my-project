// src/lib/seoulApi.js

const DEFAULT_PAGE = 200;

/**
 * 내부 공통 URL 빌더
 * * [프록시 모드 동작 원리]
 * 1. 클라이언트 호출: /api/seoul/json/culturalEventInfo/...
 * 2. vercel.json 설정에 의해: http://openapi.seoul.go.kr:8088/API_KEY/json/culturalEventInfo/... 로 변환됨
 */
function buildRequestUrl(path, { useProxy, seoulKey }) {
  // 1. 프록시 모드 (기본 권장)
  if (useProxy) {
    // API 키 없이 경로만 붙여서 호출 -> setupProxy.js 또는 vercel.json이 처리
    return `/api/seoul/${path}`;
  }

  // 2. 직접 호출 모드 (로컬 테스트용, 키 필요)
  const key = seoulKey || (process.env.REACT_APP_SEOUL_KEY || "").trim();
  if (!key) {
    throw new Error(
      "REACT_APP_SEOUL_KEY 가 설정되지 않았습니다 (.env 확인 필요)"
    );
  }
  // 직접 호출 시: 도메인 + 키 + 경로 조합
  return `http://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/${path}`;
}

/** 내부 공통 START/END 보정 (0~4 입력을 1 기반으로 변환) */
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
 * - JSON 포맷 기준
 * - 페이징 돌면서 row만 모아서 배열로 리턴
 */
export async function fetchSeoulAllEventsJSON({
  // 프록시 모드 기본값 true (API 키 노출 방지 및 Mixed Content 해결)
  useProxy = true,
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  pageSize = DEFAULT_PAGE,
  hardLimit = 5000,
  onPage = null,
  signal = undefined,
}) {
  const allRows = [];
  const seen = new Set(); // SVCID 중복 제거용
  
  let start = 1;
  let round = 0;

  while (allRows.length < hardLimit) {
    const end = start + pageSize - 1;

    // 요청 경로 생성: json/culturalEventInfo/START/END/
    const path = `json/culturalEventInfo/${start}/${end}/`;
    const url = buildRequestUrl(path, { useProxy, seoulKey });

    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) throw new Error(`${res.status} @ ${url}`);
    
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

/**
 * 2) HOME "추천 행사"용
 * - START_INDEX=0, END_INDEX=4 (보정 후 1~5)
 */
export async function fetchSeoulRecommendedEvents({
  useProxy = true,
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  startIndex = 0,
  endIndex = 4,
  signal = undefined,
} = {}) {
  const { start, end } = normalizeRange(startIndex, endIndex);

  // 요청 경로 생성
  const path = `json/culturalEventInfo/${start}/${end}/`;
  const url = buildRequestUrl(path, { useProxy, seoulKey });

  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  
  return res.json();
}

/**
 * 3) HOME "행사 캘린더"용: 특정 날짜 하루 단위 조회
 * - 경로 파라미터 방식: .../date/
 */
export async function fetchSeoulDailyEvents({
  useProxy = true,
  seoulKey = (process.env.REACT_APP_SEOUL_KEY || "").trim(),
  date,
  startIndex = 0,
  endIndex = 4,
  codename = " ", // 필터 없음 → 공백
  guname = " ",   // 필터 없음 → 공백
  signal = undefined,
} = {}) {
  if (!date) {
    throw new Error("fetchSeoulDailyEvents 호출 시 date(YYYY-MM-DD)가 필요합니다.");
  }

  const { start, end } = normalizeRange(startIndex, endIndex);

  // 공백이나 특수문자 처리를 위해 encodeURIComponent 사용 (공백 -> %20)
  const codeSegment = encodeURIComponent(codename || " ");
  const guSegment = encodeURIComponent(guname || " ");
  const dateSegment = encodeURIComponent(date);

  // 요청 경로 생성: json/culturalEventInfo/START/END/CODE/GU/DATE/
  const path = `json/culturalEventInfo/${start}/${end}/${codeSegment}/${guSegment}/${dateSegment}/`;
  const url = buildRequestUrl(path, { useProxy, seoulKey });

  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  
  return res.json();
}