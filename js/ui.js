"use strict";
// LiBird Words — 화면 공통: 아이콘 · 화면 전환 · 탭 · 모달 · 토스트 · 툴팁

const svg = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
const ICON = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>'),
  book: svg('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/><path d="M8 7h8M8 11h6"/>'),
  read: svg('<path d="M2 5.5C4.5 4 8 4 12 6c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5z"/><path d="M12 6v13.5"/>'),
  game: svg('<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/>'),
  chart: svg('<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  sound: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chev: svg('<path d="M9 5l7 7-7 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  play: svg('<path d="M7 5v14l11-7z" fill="currentColor"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  send: svg('<path d="M4 12l16-8-6 16-2-6.5z"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
};

const VIEWS = {}, AFTER = {};
let view = "home";
const TAB_OF = {home: "home", library: "library", deck: "library", read: "read", reader: "read", games: "games", game: "games", quiz: "games", confuse: "games", chart: "games", stats: "stats", settings: "", study: null, sort: null};
const TABS = [["home", "학습", ICON.home], ["library", "단어장", ICON.book], ["read", "읽기", ICON.read], ["games", "게임", ICON.game], ["stats", "통계", ICON.chart]];

function go(v, c = {}) {
  if (view === "reader" && v !== "reader") stopSpeak();
  if (view === "game" && v !== "game" && typeof stopGame === "function") stopGame();
  view = v;
  ctx = c;
  window.scrollTo(0, 0);
  render();
}
function render() {
  const fn = VIEWS[view] || VIEWS.home;
  const tab = TAB_OF[view];
  document.body.classList.toggle("focus", tab === null);
  $("#view").innerHTML = fn();
  renderTabs(tab);
  if (AFTER[view]) AFTER[view]();
}
function renderTabs(tab) {
  $("#tabs .inner").innerHTML = TABS.map(([id, name, icon]) => `<button type="button" class="${tab === id ? "on" : ""}" data-act="tab" data-tab="${id}" aria-label="${name}">${icon}<span>${name}</span></button>`).join("");
}
function setLang(l) {
  LANG = l;
  lsSet("lbw.lang", l);
  document.body.classList.toggle("lang-ja", l === "ja");
  document.body.classList.toggle("lang-en", l === "en");
  $$("#lang-seg button").forEach((b) => b.classList.toggle("on", b.dataset.lang === l));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = l === "ja" ? "#eb6834" : "#2a78d6";
}

function toast(text, ms = 3500) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.remove("hidden");
  t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), ms);
}
function openModal(html, cls = "") {
  $("#modal-body").className = "sheet " + cls;
  $("#modal-body").innerHTML = html;
  $("#modal").classList.remove("hidden");
}
function closeModal() {
  $("#modal").classList.add("hidden");
  $("#modal-body").innerHTML = "";
  if (typeof CHAT !== "undefined") CHAT.open = false;
}
const modalOpen = () => !$("#modal").classList.contains("hidden");

// 툴팁: data-tip 속성이 있는 요소에 마우스를 올리거나 누르면 보인다
function showTip(el) {
  const tip = $("#tip");
  tip.textContent = el.dataset.tip;
  tip.classList.remove("hidden");
  const r = el.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + "px";
}
const hideTip = () => $("#tip").classList.add("hidden");
document.addEventListener("pointerover", (e) => { const el = e.target.closest("[data-tip]"); if (el && e.pointerType === "mouse") showTip(el); });
document.addEventListener("pointerout", (e) => { if (e.target.closest("[data-tip]")) hideTip(); });
document.addEventListener("pointerdown", (e) => { const el = e.target.closest("[data-tip]"); if (el && e.pointerType !== "mouse") { showTip(el); setTimeout(hideTip, 1800); } });
window.addEventListener("scroll", hideTip, {passive: true});

function hhmm(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function onSyncChange() {
  const dot = $("#sync-dot");
  let cls = "", title = "이 기기에만 저장 중";
  if (SYNC && !memKey) { cls = "err"; title = "동기화 잠김"; }
  else if (syncReady()) {
    if (syncState.busy) { cls = "busy"; title = "동기화 중"; }
    else if (syncState.err === "offline") { cls = "busy"; title = "오프라인"; }
    else if (syncState.err) { cls = "err"; title = "동기화 오류"; }
    else { cls = "ok"; title = syncState.last ? `동기화됨 ${hhmm(syncState.last)}` : "동기화 연결됨"; }
  }
  if (dot) { dot.className = "sdot " + cls; dot.parentElement.title = "설정 · " + title; }
  if (view === "settings" && $("#sync-box")) { $("#sync-box").innerHTML = syncPanel(); bindSyncForms(); }
}
function onRemoteChange() {
  if (["home", "library", "deck", "read", "stats", "settings"].includes(view)) render();
}
