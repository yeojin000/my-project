// ===== File: src/main_page.jsx =============================================
import React, { useState } from "react";
import "./App.css"; // styles below
import tailwindcss from '@tailwindcss/vite'


const MENU = [
{ key: "home", label: "HOME" },
{ key: "browse", label: "Browse Events" },
{ key: "map", label: "Map" },
{ key: "calendar", label: "Calendar" },
{ key: "favorites", label: "Favorites" },
{ key: "mypage", label: "My Page" },
];


// 각 메뉴별로 보여줄 배경 이미지 경로를 매핑합니다.
// public/images 에 파일을 넣고 아래 경로를 교체하세요.
const HERO = {
home: "/images/hero_home.jpg",
browse: "/images/hero_browse.jpg",
map: "/images/hero_map.jpg",
calendar: "/images/hero_calendar.jpg",
favorites: "/images/hero_favorites.jpg",
mypage: "/images/hero_mypage.jpg",
};


export default function MainPage() {
const [open, setOpen] = useState(true); // 사이드바 토글
const [active, setActive] = useState("home"); // 현재 메뉴


return (
<div className="layout">
{/* 헤더 */}
<header className="header">
<button className="menuBtn" onClick={() => setOpen((v) => !v)} aria-label="toggle menu">
☰
</button>


{/* 중앙 타이틀 */}
<div className="brandWrap"><h1 className="brand">SEOUL NOW</h1></div>


{/* 우측 검색 */}
<form className="search" onSubmit={(e) => e.preventDefault()}>
<input aria-label="search" placeholder="" />
<button type="submit">🔍</button>
</form>
</header>


{/* 사이드바 */}
<aside className={`sidebar ${open ? "open" : "closed"}`}>
<nav>
{MENU.map((m) => (
<button
key={m.key}
onClick={() => setActive(m.key)}
className={`navItem ${active === m.key ? "active" : ""}`}
>
{m.label}
</button>
))}
</nav>
</aside>


{/* 메인 - 히어로 이미지가 메뉴 클릭에 따라 바뀜 */}
<main className={`main ${open ? "shift" : "compact"}`}>
<section
className="hero"
style={{ backgroundImage: `url(${HERO[active] || HERO.home})` }}
>
{/* 필요하면 히어로 위 텍스트/버튼 추가 */}
</section>
</main>
</div>
);
}