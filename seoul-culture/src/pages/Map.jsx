// src/pages/Map.jsx
import React, { useState } from "react";

const CATEGORIES = ["공연", "전시", "교육/체험", "기타"];
const AREAS = ["전체", "종로구", "마포구", "서초구", "성동구", "용산구"];
const DATES = ["전체", "오늘", "이번 주", "이번 달"];

export default function MapPage() {
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("전체");
  const [date, setDate] = useState("전체");
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <div className="min-h-screen bg-white px-6 py-8 max-w-7xl mx-auto">
    

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 왼쪽 필터 영역 */}
        <div className="lg:col-span-3">
          {/* 1. 카테고리 필터 */}
          <h2 className="font-semibold mb-2">카테고리 필터</h2>
          <div className="flex flex-col gap-1 mb-6">
            {CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                />
                {c}
              </label>
            ))}
          </div>

          {/* 2. 지역 */}
          <h2 className="font-semibold mb-2">지역</h2>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="border rounded px-2 py-1 w-full mb-6"
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* 3. 날짜 */}
          <h2 className="font-semibold mb-2">날짜</h2>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          >
            {DATES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* 4. 지도 (임시 박스) */}
        <div className="lg:col-span-6">
          <div className="border rounded-lg w-full aspect-square bg-gray-200 grid place-items-center text-gray-500">
            지도 영역 (추후 카카오/네이버 API 적용)
          </div>
        </div>

        {/* 5. 상세 정보 (임시) */}
        <div className="lg:col-span-3 border rounded-lg p-4 bg-gray-50">
          {selectedEvent ? (
            <div>
              <h3 className="font-bold text-lg mb-1">{selectedEvent.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{selectedEvent.place}</p>
              <p className="text-sm text-gray-600">{selectedEvent.date}</p>
            </div>
          ) : (
            <div className="text-gray-500 text-sm text-center mt-20">
              지도의 표시된 행사 중 하나를 클릭하면 상세정보가 여기에 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
