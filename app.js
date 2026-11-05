"use strict";
// LiBird Words — 일본어·영어 단어 학습 (간격 반복 + GitHub 암호화 동기화)
const APP_VERSION = "1.0.0";
const CFG = {owner: "Forlab-future", repo: "LiBirdWords", branch: "progress", dir: "progress"};
const D = window.LBW_DATA || {};
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => isoDate(new Date());
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfToday = () => startOfDay(Date.now()) + DAY;
const newId = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function lsGet(k, fallback = null) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }

// ------------------------------------------------------------ 카드 목록
const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const STAGES = [
  {id: "hira_basic", name: "히라가나 기본", req: null, pool: "kana"},
  {id: "hira_dakuten", name: "히라가나 탁음·반탁음", req: "hira_basic", pool: "kana"},
  {id: "hira_yoon", name: "히라가나 요음", req: "hira_dakuten", pool: "kana"},
  {id: "words_hira", name: "히라가나 단어", req: "hira_yoon", pool: "jw"},
  {id: "kata_basic", name: "가타카나 기본", req: "hira_yoon", pool: "kana"},
  {id: "kata_dakuten", name: "가타카나 탁음·반탁음", req: "kata_basic", pool: "kana"},
  {id: "kata_yoon", name: "가타카나 요음", req: "kata_dakuten", pool: "kana"},
  {id: "words_kata", name: "가타카나 단어", req: "kata_dakuten", pool: "jw"},
  {id: "words_n5", name: "N5 한자 단어", req: "words_hira", pool: "jw"}
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const DECKS = [
  {id: "awl", name: "학술 어휘 (AWL)"},
  {id: "phrase", name: "논문 표현"},
  {id: "sofc", name: "SOFC·재료 전공어휘"}
];
const UNLOCK_AT = 0.8;
const CARDS = {};
const BY_GROUP = {};  // stage id 또는 deck id → 카드 id 목록

function addCard(c) {
  if (CARDS[c.id]) return;
  CARDS[c.id] = c;
  (BY_GROUP[c.group] = BY_GROUP[c.group] || []).push(c.id);
}
(function buildCards() {
  const K = D.kana || {basic: [], dakuten: [], yoon: [], kataTips: {}};
  const kanaSets = [["basic", "hira_basic", "kata_basic"], ["dakuten", "hira_dakuten", "kata_dakuten"], ["yoon", "hira_yoon", "kata_yoon"]];
  for (const [key, hs, ks] of kanaSets) {
    for (const [ch, romaji, ko, tip] of K[key] || []) {
      addCard({id: "k:" + ch, lang: "ja", type: "kana", group: hs, ch, romaji, ko, tip: tip || ""});
    }
  }
  for (const [key, hs, ks] of kanaSets) {
    for (const [ch, romaji, ko] of K[key] || []) {
      const kc = toKata(ch);
      addCard({id: "k:" + kc, lang: "ja", type: "kana", group: ks, ch: kc, romaji, ko, tip: (K.kataTips || {})[kc] || `히라가나 ${ch}와 같은 소리`});
    }
  }
  for (const w of D.ja || []) addCard({...w, lang: "ja", type: "word", group: w.stage});
  for (const w of D.en || []) addCard({...w, lang: "en", type: "en", group: w.deck});
})();

// ------------------------------------------------------------ 상태
const DEFAULT_SETTINGS = {kanaNew: 6, jaNew: 5, enNew: 8, decks: {awl: true, phrase: true, sofc: true}, unlocked: {}, autoSpeak: true, furigana: true, t: 0};
let S = lsGet("lbw.state") || {};
S.v = 1;
S.cards = S.cards || {};
S.daily = S.daily || {};
S.edits = S.edits || {};
S.settings = {...DEFAULT_SETTINGS, ...(S.settings || {})};
S.settings.decks = {...DEFAULT_SETTINGS.decks, ...(S.settings.decks || {})};
let DEVICE = lsGet("lbw.device");
if (!DEVICE) { DEVICE = newId(6); lsSet("lbw.device", DEVICE); }
let DEVNAME = lsGet("lbw.devname") || (/(Android|iPhone|iPad)/i.test(navigator.userAgent) ? "폰" : "PC");
let dirty = lsGet("lbw.dirty", false);
let saveTimer = null;

function save(markDirty = true) {
  lsSet("lbw.state", S);
  if (markDirty) { dirty = true; lsSet("lbw.dirty", true); scheduleSync(); }
}
const card = (id) => {
  const c = CARDS[id];
  const e = S.edits[id];
  return e && e.f ? {...c, ...e.f} : c;
};
const rec = (id) => S.cards[id];
const isNew = (id) => !S.cards[id] || S.cards[id].s === "new";
const enabled = (id) => {
  const c = CARDS[id];
  return c && (c.lang !== "en" || S.settings.decks[c.group] !== false);
};
const poolOf = (c) => c.lang === "en" ? "en" : (STAGE[c.group] ? STAGE[c.group].pool : "jw");

function todayCounts() {
  const day = S.daily[todayStr()] || {};
  const t = {kana: 0, jw: 0, en: 0, rev: 0};
  for (const dev of Object.values(day)) for (const k in t) t[k] += dev[k] || 0;
  return t;
}
function bump(field) {
  const d = todayStr();
  S.daily[d] = S.daily[d] || {};
  const mine = S.daily[d][DEVICE] = S.daily[d][DEVICE] || {kana: 0, jw: 0, en: 0, rev: 0};
  mine[field] = (mine[field] || 0) + 1;
}
function streak() {
  const active = (d) => Object.values(S.daily[d] || {}).some((x) => (x.kana || 0) + (x.jw || 0) + (x.en || 0) + (x.rev || 0) > 0);
  let n = 0;
  const day = new Date();
  if (!active(isoDate(day))) day.setDate(day.getDate() - 1);
  while (active(isoDate(day))) { n++; day.setDate(day.getDate() - 1); }
  return n;
}

// ------------------------------------------------------------ 간격 반복 (Anki 방식을 단순화)
const LEARN_STEPS = [1, 10];  // 분
function dayDue(ivl) { return startOfDay(Date.now()) + ivl * DAY + 4 * HOUR; }
function schedule(r0, g, now = Date.now()) {
  const r = r0 && r0.s !== "new" ? {...r0} : {s: "learn", ease: 2.5, ivl: 0, step: 0, reps: 0, lapses: 0};
  if (r.s === "learn") {
    if (g === 1) { r.step = 0; r.due = now + LEARN_STEPS[0] * MIN; }
    else if (g === 2) { r.due = now + (r.step === 0 ? 6 : LEARN_STEPS[r.step]) * MIN; }
    else if (g === 3 && r.step + 1 < LEARN_STEPS.length) { r.step++; r.due = now + LEARN_STEPS[r.step] * MIN; }
    else {
      r.ivl = g === 4 ? (r.ivl > 0 ? r.ivl + 1 : 4) : (r.ivl > 0 ? r.ivl : 1);
      r.s = "review"; r.step = 0; r.due = dayDue(r.ivl);
    }
  } else {  // review
    if (g === 1) {
      r.lapses++; r.ease = Math.max(1.3, r.ease - 0.2); r.ivl = Math.max(1, Math.round(r.ivl * 0.3));
      r.s = "learn"; r.step = LEARN_STEPS.length - 1; r.due = now + LEARN_STEPS[r.step] * MIN;
    } else {
      if (g === 2) { r.ivl = Math.max(r.ivl + 1, Math.round(r.ivl * 1.2)); r.ease = Math.max(1.3, r.ease - 0.15); }
      if (g === 3) r.ivl = Math.max(r.ivl + 1, Math.round(r.ivl * r.ease));
      if (g === 4) { r.ivl = Math.max(r.ivl + 2, Math.round(r.ivl * r.ease * 1.3)); r.ease += 0.15; }
      r.ivl = Math.min(r.ivl, 3650);
      r.due = dayDue(r.ivl);
    }
  }
  r.reps++;
  r.t = now;
  return r;
}
function fmtGap(ms) {
  if (ms < HOUR) return Math.max(1, Math.round(ms / MIN)) + "분";
  if (ms < DAY) return Math.round(ms / HOUR) + "시간";
  const d = Math.round(ms / DAY);
  if (d < 30) return d + "일";
  if (d < 365) return Math.round(d / 30) + "개월";
  return (d / 365).toFixed(1) + "년";
}

// ------------------------------------------------------------ 단계 · 오늘 할 것
function groupProgress(g) {
  const ids = BY_GROUP[g] || [];
  if (!ids.length) return {done: 0, seen: 0, total: 0, ratio: 0};
  let done = 0, seen = 0;
  for (const id of ids) {
    const r = S.cards[id];
    if (!r || r.s === "new") continue;
    seen++;
    if (r.s === "review" || r.s === "known") done++;
  }
  return {done, seen, total: ids.length, ratio: done / ids.length};
}
function unlocked(stageId) {
  const st = STAGE[stageId];
  if (!st.req || S.settings.unlocked[stageId]) return true;
  return unlocked(st.req) && groupProgress(st.req).ratio >= UNLOCK_AT;
}
function dueIds(lang) {
  const end = endOfToday();
  return Object.keys(S.cards).filter((id) => {
    const c = CARDS[id], r = S.cards[id];
    return c && c.lang === lang && enabled(id) && (r.s === "learn" || r.s === "review") && r.due <= end;
  }).sort((a, b) => S.cards[a].due - S.cards[b].due);
}
function newBudget(lang) {
  const st = S.settings, t = todayCounts();
  const base = lang === "ja" ? st.kanaNew + st.jaNew : st.enNew;
  const dueRev = dueIds(lang).filter((id) => S.cards[id].s === "review").length;
  const factor = dueRev > base * 10 ? 0 : dueRev > base * 5 ? 0.5 : 1;
  if (lang === "ja") return {factor, dueRev, kana: Math.max(0, Math.floor(st.kanaNew * factor) - t.kana), jw: Math.max(0, Math.floor(st.jaNew * factor) - t.jw)};
  return {factor, dueRev, en: Math.max(0, Math.floor(st.enNew * factor) - t.en)};
}
function newIds(lang, extra = 0) {
  const b = newBudget(lang), out = [];
  if (lang === "ja") {
    const left = {kana: b.kana + extra, jw: b.jw + extra};
    for (const st of STAGES) {
      if (!unlocked(st.id)) continue;
      for (const id of BY_GROUP[st.id] || []) {
        if (left[st.pool] <= 0) break;
        if (isNew(id)) { out.push(id); left[st.pool]--; }
      }
    }
  } else {
    let left = b.en + extra;
    const lists = {};
    for (const d of DECKS) lists[d.id] = S.settings.decks[d.id] ? (BY_GROUP[d.id] || []).filter(isNew) : [];
    const pattern = ["awl", "awl", "phrase", "sofc"];
    let i = 0, idle = 0;
    while (left > 0 && idle < pattern.length) {
      const l = lists[pattern[i++ % pattern.length]];
      if (l.length) { out.push(l.shift()); left--; idle = 0; } else idle++;
    }
  }
  return out;
}

// ------------------------------------------------------------ 화면 공통
function toast(text, ms = 3500) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), ms);
}
function openModal(html) { $("#modal-body").innerHTML = html; $("#modal").classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); $("#modal-body").innerHTML = ""; }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

let view = "home";
let ctx = {};  // 현재 화면의 상태
function go(v, c = {}) {
  view = v;
  ctx = c;
  window.scrollTo(0, 0);
  render();
}
function render() {
  const fn = VIEWS[view] || VIEWS.home;
  $("#view").innerHTML = fn();
  if (AFTER[view]) AFTER[view]();
}

// ------------------------------------------------------------ 발음 (Web Speech API)
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
let warnedVoice = {};
function speak(text, lang) {
  if (!("speechSynthesis" in window)) { toast("이 브라우저는 음성 읽기를 지원하지 않아요."); return; }
  const code = lang === "ja" ? "ja-JP" : "en-US";
  const v = voices.find((x) => x.lang.replace("_", "-") === code) || voices.find((x) => x.lang.toLowerCase().startsWith(lang));
  if (!v && voices.length && !warnedVoice[lang]) {
    warnedVoice[lang] = true;
    toast(lang === "ja" ? "이 기기에 일본어 음성이 없어요. 기기 설정 → 음성(TTS)에서 일본어를 추가해 주세요." : "이 기기에 영어 음성이 없어요.", 6000);
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  if (v) u.voice = v;
  u.rate = lang === "ja" ? 0.85 : 0.95;
  speechSynthesis.speak(u);
}
const spk = (text, lang, label = "🔊") => `<button type="button" class="speak" data-act="speak" data-lang="${lang}" data-text="${esc(text)}">${label}</button>`;

// ------------------------------------------------------------ 화면들
const VIEWS = {}, AFTER = {};

VIEWS.home = () => {
  const ja = summary("ja"), en = summary("en"), t = todayCounts();
  const total = t.kana + t.jw + t.en + t.rev;
  const enStarted = (BY_GROUP.awl || []).some((id) => S.cards[id]);
  return `
  <div class="box streak"><div><div class="muted small">연속 학습</div><b>${streak()}일</b></div>
    <div style="text-align:right"><div class="muted small">오늘 본 카드</div><b>${total}장</b></div></div>
  <div class="grid2">
    ${langCard("ja", "일본어", "var(--ja)", ja)}
    ${langCard("en", "영어", "var(--en)", en)}
  </div>
  ${!enStarted && (BY_GROUP.awl || []).length ? `<div class="box small">영어는 처음이시죠? <b>아는 단어 거르기</b>로 이미 아는 단어를 먼저 빼 두면 모르는 단어만 공부할 수 있어요.
    <div style="margin-top:8px"><button class="btn" data-act="sort">아는 단어 거르기</button></div></div>` : ""}
  <h2>일본어 단계</h2>
  <div class="box">${STAGES.map(stageRow).join("")}</div>
  <h3>가나 연습</h3>
  <div class="tools">
    <button class="btn" data-act="quiz">가나 퀴즈</button>
    <button class="btn" data-act="confuse">헷갈리는 글자</button>
    <button class="btn" data-act="chart">가나표</button>
  </div>
  <h2>영어 덱</h2>
  <div class="box">${DECKS.map(deckRow).join("")}</div>
  <div class="tools"><button class="btn" data-act="sort">아는 단어 거르기</button></div>
  <p class="muted small" style="text-align:center;margin-top:28px">LiBird Words ${APP_VERSION}</p>`;
};
function summary(lang) {
  const due = dueIds(lang).length;
  const nw = newIds(lang).length;
  const b = newBudget(lang);
  return {due, nw, b};
}
function langCard(lang, name, color, s) {
  let note = "";
  if (s.b.factor === 0) note = `복습이 ${s.b.dueRev}개 밀려서 오늘은 새 항목을 쉬어요.`;
  else if (s.b.factor < 1) note = `복습이 ${s.b.dueRev}개 밀려서 새 항목을 절반으로 줄였어요.`;
  const nothing = !s.due && !s.nw;
  return `<div class="box lang-card">
    <h2><span class="flag" style="background:${color}"></span>${name}</h2>
    <div class="stats"><div><b>${s.due}</b><span>복습</span></div><div><b>${s.nw}</b><span>새 항목</span></div></div>
    ${note ? `<div class="note">${note}</div>` : ""}
    <button class="btn pri big" data-act="study" data-lang="${lang}" ${nothing ? "" : ""}>${nothing ? "오늘 끝! 더 하기" : "공부 시작"}</button>
  </div>`;
}
function stageRow(st) {
  const p = groupProgress(st.id), open = unlocked(st.id);
  const label = open ? `${p.done}/${p.total}` : `🔒 ${STAGE[st.req].name} ${Math.round(UNLOCK_AT * 100)}% 후`;
  return `<div class="stage ${open ? "" : "locked"}"><div class="row between"><span>${st.name}</span><span class="muted small">${label}</span></div>
    <div class="bar"><i style="width:${Math.round(p.ratio * 100)}%"></i></div></div>`;
}
function deckRow(d) {
  const p = groupProgress(d.id), on = S.settings.decks[d.id];
  return `<div class="stage ${on ? "" : "locked"}"><div class="row between"><span>${d.name}</span><span class="muted small">${on ? "" : "꺼짐 · "}${p.done}/${p.total}</span></div>
    <div class="bar"><i style="width:${Math.round(p.ratio * 100)}%"></i></div></div>`;
}

// ---------- 학습
function startStudy(lang, extra = 0) {
  const due = dueIds(lang);
  const fresh = newIds(lang, extra);
  if (!due.length && !fresh.length && !extra) {
    openModal(`<h2 style="margin-top:0">오늘 ${lang === "ja" ? "일본어" : "영어"} 끝!</h2>
      <p>오늘 할 복습과 새 항목을 다 했어요. 더 하고 싶으면 새 항목을 5개 더 할 수 있어요.</p>
      <div class="row"><button class="btn pri" data-act="study-more" data-lang="${lang}">5개 더 하기</button><button class="btn" data-act="close">닫기</button></div>`);
    return;
  }
  const queue = [];
  const reviews = due.slice(), news = fresh.slice();
  while (reviews.length || news.length) {
    for (let i = 0; i < 3 && reviews.length; i++) queue.push(reviews.shift());
    if (news.length) queue.push(news.shift());
  }
  if (!queue.length) { toast("더 할 새 항목이 없어요."); return; }
  go("study", {lang, queue, later: [], cur: null, shown: false, done: 0, total: queue.length});
  nextCard();
}
function nextCard() {
  const now = Date.now();
  ctx.later.sort((a, b) => S.cards[a].due - S.cards[b].due);
  let id = null;
  if (ctx.later.length && S.cards[ctx.later[0]].due <= now) id = ctx.later.shift();
  else if (ctx.queue.length) id = ctx.queue.shift();
  else if (ctx.later.length) id = ctx.later.shift();
  ctx.cur = id;
  ctx.shown = false;
  render();
}
VIEWS.study = () => {
  if (!ctx.cur) {
    return `<div class="box flash"><div class="word">🎉</div><h2>이번 공부 끝!</h2>
      <p class="muted">${ctx.done}장 봤어요.</p>
      <div class="row"><button class="btn pri" data-act="home">홈으로</button></div></div>`;
  }
  const c = card(ctx.cur), r = rec(ctx.cur);
  const left = ctx.queue.length + ctx.later.length + 1;
  const tag = isNew(ctx.cur) ? `<span class="chip">새 항목</span>` : r && r.s === "learn" ? `<span class="chip">익히는 중</span>` : `<span class="chip">복습</span>`;
  return `<div class="study-top"><button class="btn ghost" data-act="home">← 그만</button><span>${tag} 남은 ${left}장</span></div>
  <div class="box flash">${front(c)}${ctx.shown ? back(c) : ""}</div>
  ${ctx.shown ? gradeButtons(ctx.cur) : `<button class="btn pri big" data-act="show">정답 보기</button>`}
  <div class="kbd-hint">${ctx.shown ? "키보드: 1 다시 · 2 어려움 · 3 좋음(Space) · 4 쉬움" : "키보드: Space로 정답 보기"}</div>
  ${ctx.shown ? `<p style="text-align:center"><button class="btn ghost small" data-act="edit" data-id="${esc(ctx.cur)}">✎ 이 카드 고치기</button></p>` : ""}`;
};
function front(c) {
  if (c.type === "kana") return `<div class="glyph">${esc(c.ch)}</div><div class="muted small">어떻게 읽을까요?</div>`;
  if (c.type === "word") {
    const hasKanji = /[一-鿿]/.test(c.word);
    const w = hasKanji && S.settings.furigana ? `<ruby>${esc(c.word)}<rt>${esc(c.kana)}</rt></ruby>` : esc(c.word);
    return `<div class="word">${w}</div><div class="muted small">무슨 뜻일까요?</div>`;
  }
  return `<div class="word en">${esc(c.word)}</div>${c.pos ? `<div class="pos">${esc(c.pos)}</div>` : ""}`;
}
function dictLinks(c) {
  const q = encodeURIComponent(c.type === "en" ? c.word.replace(/\s*\(.*?\)\s*/g, " ").replace(/~/g, "").trim() : c.word);
  if (c.type === "en") return `<div class="links"><a href="https://en.dict.naver.com/#/search?query=${q}" target="_blank" rel="noopener">네이버 영어사전</a><a href="https://dictionary.cambridge.org/dictionary/english/${q}" target="_blank" rel="noopener">Cambridge</a></div>`;
  return `<div class="links"><a href="https://ja.dict.naver.com/#/search?query=${q}" target="_blank" rel="noopener">네이버 일본어사전</a><a href="https://jisho.org/search/${q}" target="_blank" rel="noopener">Jisho</a></div>`;
}
function back(c) {
  if (c.type === "kana") {
    return `<div class="answer"><div class="main">${esc(c.romaji)} · ${esc(c.ko)} ${spk(c.ch, "ja")}</div>
      ${c.tip ? `<div class="sub">${esc(c.tip)}</div>` : ""}</div>`;
  }
  if (c.type === "word") {
    return `<div class="answer"><div class="main">${esc(c.ko)}</div>
      <div class="sub">${esc(c.kana)} · ${esc(c.romaji)} ${spk(c.kana || c.word, "ja")}</div>
      <dl>${c.ex ? `<dt>예문</dt><dd class="ex-ja">${esc(c.ex)} ${spk(c.exKana || c.ex, "ja")}</dd>
        ${c.exKana ? `<dd class="muted">${esc(c.exKana)}</dd>` : ""}<dd>${esc(c.exKo)}</dd>` : ""}
      ${c.tip ? `<dt>팁</dt><dd>${esc(c.tip)}</dd>` : ""}</dl>${dictLinks(c)}</div>`;
  }
  return `<div class="answer"><div class="main">${esc(c.ko)} ${spk(c.word.replace(/~/g, "…"), "en")}</div>
    ${c.def ? `<div class="sub">${esc(c.def)}</div>` : ""}
    <dl>${c.forms ? `<dt>관련 형태</dt><dd>${esc(c.forms)}</dd>` : ""}
    ${c.ex ? `<dt>예문</dt><dd>${esc(c.ex)} ${spk(c.ex, "en")}</dd><dd class="muted">${esc(c.exKo)}</dd>` : ""}
    ${c.tip ? `<dt>팁</dt><dd>${esc(c.tip)}</dd>` : ""}</dl>${dictLinks(c)}</div>`;
}
function gradeButtons(id) {
  const now = Date.now(), r = rec(id);
  const names = ["다시", "어려움", "좋음", "쉬움"];
  return `<div class="grades">${[1, 2, 3, 4].map((g) => `<button type="button" class="g${g}" data-act="grade" data-g="${g}">${names[g - 1]}<small>${fmtGap(schedule(r, g, now).due - now)}</small></button>`).join("")}</div>`;
}
function showAnswer() {
  if (view !== "study" || !ctx.cur || ctx.shown) return;
  ctx.shown = true;
  render();
  const c = card(ctx.cur);
  if (S.settings.autoSpeak) speak(c.type === "kana" ? c.ch : c.type === "word" ? (c.kana || c.word) : c.word.replace(/~/g, "…"), c.lang);
}
function grade(g) {
  if (view !== "study" || !ctx.cur || !ctx.shown) return;
  const id = ctx.cur, c = CARDS[id];
  const wasNew = isNew(id), wasReview = !wasNew;
  const r = schedule(rec(id), g);
  S.cards[id] = r;
  if (wasNew) bump(poolOf(c));
  else if (wasReview) bump("rev");
  save();
  ctx.done++;
  if (r.s === "learn" && r.due < Date.now() + 30 * MIN) ctx.later.push(id);
  nextCard();
}

// ---------- 아는 단어 거르기 (영어)
function sortList() {
  const out = [];
  for (const d of DECKS) if (S.settings.decks[d.id]) for (const id of BY_GROUP[d.id] || []) if (isNew(id)) out.push(id);
  return out;
}
VIEWS.sort = () => {
  if (!ctx.list) ctx.list = sortList(), ctx.i = 0, ctx.known = 0, ctx.peek = false;
  const id = ctx.list[ctx.i];
  if (!id) return `<div class="box flash"><h2>다 걸렀어요</h2><p class="muted">아는 단어 ${ctx.known}개를 뺐어요.</p><button class="btn pri" data-act="home">홈으로</button></div>`;
  const c = card(id);
  return `<div class="study-top"><button class="btn ghost" data-act="home">← 끝내기</button><span>${ctx.i + 1} / ${ctx.list.length} · 뺀 단어 ${ctx.known}</span></div>
  <div class="box flash"><div class="word en">${esc(c.word)}</div>${c.pos ? `<div class="pos">${esc(c.pos)}</div>` : ""}
    ${ctx.peek ? `<div class="answer"><div class="main">${esc(c.ko)}</div>${c.def ? `<div class="sub">${esc(c.def)}</div>` : ""}</div>`
      : `<p><button class="btn ghost small" data-act="peek">뜻 확인</button></p>`}</div>
  <div class="grid2"><button class="btn big" data-act="sort-no">몰라요 · 배울래요</button><button class="btn pri big" data-act="sort-yes">알아요 · 빼기</button></div>
  <p class="muted small" style="text-align:center">'알아요'를 누른 단어는 학습에서 빠져요. 설정에서 되돌릴 수 있어요.</p>`;
};
function sortAnswer(known) {
  const id = ctx.list[ctx.i];
  if (known) { S.cards[id] = {s: "known", t: Date.now()}; ctx.known++; save(); }
  ctx.i++;
  ctx.peek = false;
  render();
}

// ---------- 가나 퀴즈
function quizPool(script) {
  const groups = script === "kata" ? ["kata_basic", "kata_dakuten", "kata_yoon"] : ["hira_basic", "hira_dakuten", "hira_yoon"];
  let ids = groups.flatMap((g) => BY_GROUP[g] || []).filter((id) => !isNew(id));
  if (ids.length < 8) ids = (BY_GROUP[groups[0]] || []).slice(0, Math.max(10, ids.length + 5));
  return ids;
}
function newQuestion() {
  const pool = quizPool(ctx.script);
  const id = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle(pool.filter((x) => x !== id && CARDS[x].romaji !== CARDS[id].romaji)).slice(0, 3);
  ctx.q = {id, opts: shuffle([id, ...others]), picked: null};
}
VIEWS.quiz = () => {
  if (!ctx.script) { ctx.script = "hira"; ctx.mode = "read"; ctx.n = 0; ctx.right = 0; newQuestion(); }
  const q = ctx.q, c = CARDS[q.id];
  const promptHtml = ctx.mode === "read" ? `<div class="glyph">${esc(c.ch)}</div><div class="muted small">소리를 고르세요</div>`
    : `<div class="word">${esc(c.romaji)} · ${esc(c.ko)}</div><div class="muted small">글자를 고르세요 ${spk(c.ch, "ja")}</div>`;
  const opts = q.opts.map((o) => {
    const oc = CARDS[o];
    let cls = "";
    if (q.picked) { if (o === q.id) cls = "right"; else if (o === q.picked) cls = "wrong"; }
    const label = ctx.mode === "read" ? `${esc(oc.romaji)}<br><small>${esc(oc.ko)}</small>` : esc(oc.ch);
    return `<button type="button" class="${cls}" data-act="quiz-pick" data-id="${esc(o)}" ${q.picked ? "disabled" : ""}>${label}</button>`;
  }).join("");
  return `<div class="study-top"><button class="btn ghost" data-act="home">← 홈</button><span>맞힘 ${ctx.right} / ${ctx.n}</span></div>
  <div class="row between" style="margin-bottom:10px">
    <div class="seg"><button class="${ctx.script === "hira" ? "on" : ""}" data-act="quiz-script" data-v="hira">히라가나</button><button class="${ctx.script === "kata" ? "on" : ""}" data-act="quiz-script" data-v="kata">가타카나</button></div>
    <div class="seg"><button class="${ctx.mode === "read" ? "on" : ""}" data-act="quiz-mode" data-v="read">글자→소리</button><button class="${ctx.mode === "write" ? "on" : ""}" data-act="quiz-mode" data-v="write">소리→글자</button></div>
  </div>
  <div class="box flash">${promptHtml}<div class="options">${opts}</div>
  ${q.picked ? `<p style="margin-top:14px">${q.picked === q.id ? "정답!" : `정답은 <b>${esc(c.ch)}</b> (${esc(c.romaji)})`}</p><button class="btn pri" data-act="quiz-next">다음</button>` : ""}</div>
  <p class="muted small" style="text-align:center">퀴즈는 연습용이라 복습 일정에는 영향을 주지 않아요. 배운 글자가 8개 미만이면 첫 글자들로 연습해요.</p>`;
};

// ---------- 헷갈리는 글자 · 가나표
VIEWS.confuse = () => {
  const groups = (D.kana && D.kana.confusables) || [];
  return `<div class="study-top"><button class="btn ghost" data-act="home">← 홈</button><span>글자를 누르면 소리가 나요</span></div>
  ${groups.map((g) => {
    const chars = g.slice(0, -1), tip = g[g.length - 1];
    return `<div class="box"><div class="pair">${chars.map((ch) => {
      const c = CARDS["k:" + ch];
      return `<button type="button" data-act="speak" data-lang="ja" data-text="${esc(ch)}"><b>${esc(ch)}</b><span class="muted small">${c ? esc(c.romaji) : ""}</span></button>`;
    }).join("")}</div><div class="small" style="text-align:center">${esc(tip)}</div></div>`;
  }).join("")}`;
};
const GOJUON = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "や ゆ よ", "らりるれろ", "わ   を", "ん    "];
VIEWS.chart = () => {
  const kata = ctx.script === "kata";
  const cells = GOJUON.flatMap((row) => row.split("")).map((h) => {
    if (h === " ") return `<button class="empty" disabled></button>`;
    const ch = kata ? toKata(h) : h, c = CARDS["k:" + ch], learned = !isNew("k:" + ch);
    return `<button type="button" class="${learned ? "learned" : ""}" data-act="speak" data-lang="ja" data-text="${esc(ch)}"><b>${esc(ch)}</b><span>${c ? esc(c.romaji) : ""}</span></button>`;
  }).join("");
  return `<div class="study-top"><button class="btn ghost" data-act="home">← 홈</button>
    <div class="seg"><button class="${kata ? "" : "on"}" data-act="chart-script" data-v="hira">히라가나</button><button class="${kata ? "on" : ""}" data-act="chart-script" data-v="kata">가타카나</button></div></div>
  <div class="box"><div class="chart">${cells}</div>
  <p class="muted small">초록 테두리 = 배운 글자. 탁음(゛)·반탁음(゜)과 요음은 학습 단계에서 나와요.</p>
  ${D.kana && D.kana.dakutenTip ? `<p class="small">${esc(D.kana.dakutenTip["゛"])}<br>${esc(D.kana.dakutenTip["゜"])}<br>${esc(D.kana.yoonTip || "")}</p>` : ""}</div>`;
};

// ---------- 카드 고치기
const EDIT_FIELDS = {
  kana: [["tip", "외우는 팁"]],
  word: [["ko", "뜻"], ["kana", "읽기(히라가나)"], ["romaji", "로마자"], ["ex", "예문"], ["exKana", "예문 읽기"], ["exKo", "예문 해석"], ["tip", "팁"]],
  en: [["ko", "뜻"], ["def", "영어 정의"], ["forms", "관련 형태"], ["ex", "예문"], ["exKo", "예문 해석"], ["tip", "팁"]]
};
function openEdit(id) {
  const c = card(id), base = CARDS[id];
  openModal(`<h2 style="margin-top:0">카드 고치기 · ${esc(c.word || c.ch)}</h2>
    <p class="muted small">고친 내용은 이 카드에만 적용되고 다른 기기에도 동기화돼요.</p>
    <form id="edit-form">${EDIT_FIELDS[c.type].map(([k, label]) => `<label class="f"><span>${label}</span>
      <textarea name="${k}" rows="${k.startsWith("ex") || k === "tip" || k === "def" ? 2 : 1}">${esc(c[k] || "")}</textarea></label>`).join("")}
    <div class="row"><button class="btn pri" type="submit">저장</button><button class="btn" type="button" data-act="close">취소</button>
    ${S.edits[id] && S.edits[id].f && Object.keys(S.edits[id].f).length ? `<button class="btn ghost" type="button" data-act="edit-reset" data-id="${esc(id)}">원래대로</button>` : ""}</div></form>`);
  $("#edit-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = {};
    for (const [k] of EDIT_FIELDS[c.type]) {
      const v = e.target.elements[k].value.trim();
      if (v !== (base[k] || "")) f[k] = v;
    }
    S.edits[id] = {f, t: Date.now()};
    save();
    closeModal();
    render();
    toast("고쳤어요.");
  });
}

// ---------- 설정
VIEWS.settings = () => {
  const st = S.settings;
  const editCount = Object.values(S.edits).filter((e) => e.f && Object.keys(e.f).length).length;
  const knownCount = Object.values(S.cards).filter((r) => r.s === "known").length;
  return `<div class="study-top"><button class="btn ghost" data-act="home">← 홈</button><span>설정</span></div>
  <h2>동기화</h2><div class="box" id="sync-box">${syncPanel()}</div>
  <h2>하루 새 항목</h2>
  <div class="box">
    ${numRow("kanaNew", "일본어 가나 (글자)", st.kanaNew)}
    ${numRow("jaNew", "일본어 단어", st.jaNew)}
    ${numRow("enNew", "영어 단어", st.enNew)}
    <p class="muted small">복습이 하루 목표의 5배 넘게 밀리면 새 항목을 절반으로, 10배 넘으면 0으로 자동으로 줄여요.</p>
  </div>
  <h2>영어 덱</h2>
  <div class="box">${DECKS.map((d) => `<label class="check"><input type="checkbox" data-deck="${d.id}" ${st.decks[d.id] ? "checked" : ""}> ${d.name} <span class="muted small">(${(BY_GROUP[d.id] || []).length})</span></label>`).join("")}</div>
  <h2>학습</h2>
  <div class="box">
    <label class="check"><input type="checkbox" data-opt="autoSpeak" ${st.autoSpeak ? "checked" : ""}> 정답 볼 때 자동으로 발음 듣기</label>
    <label class="check"><input type="checkbox" data-opt="furigana" ${st.furigana ? "checked" : ""}> 한자 단어 앞면에 후리가나(읽기) 보이기</label>
    <h3>일본어 단계 미리 열기</h3>
    ${STAGES.filter((s) => s.req).map((s) => `<label class="check"><input type="checkbox" data-unlock="${s.id}" ${st.unlocked[s.id] ? "checked" : ""}> ${s.name}</label>`).join("")}
    <p class="muted small">보통은 이전 단계의 ${Math.round(UNLOCK_AT * 100)}%를 익히면 자동으로 열려요.</p>
  </div>
  <h2>데이터</h2>
  <div class="box">
    <div class="row"><button class="btn" data-act="export">백업 내보내기</button><button class="btn" data-act="import">백업 불러오기</button>
    <input type="file" id="import-file" accept=".json,application/json" hidden></div>
    <p class="muted small">불러오기는 지금 기록과 합쳐요 (더 최근 기록이 남아요).</p>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="copy-edits" ${editCount ? "" : "disabled"}>고친 카드 ${editCount}개 복사</button>
    <button class="btn" data-act="unknown-all" ${knownCount ? "" : "disabled"}>'알아요'로 뺀 ${knownCount}개 되돌리기</button></div>
    <p class="muted small">고친 카드 목록을 복사해서 Claude에게 주면 단어 데이터 원본도 고칠 수 있어요.</p>
  </div>
  <h2>앱</h2>
  <div class="box small">
    <div>버전 ${APP_VERSION} · 이 기기 이름: <b>${esc(DEVNAME)}</b> <button class="btn ghost small" data-act="rename">바꾸기</button></div>
    <p class="muted">폰에서는 브라우저 메뉴의 「홈 화면에 추가」로 앱처럼 쓸 수 있어요.</p>
  </div>`;
};
const numRow = (k, label, v) => `<div class="num"><span>${label}</span><input type="number" min="0" max="50" data-num="${k}" value="${v}"></div>`;

// ------------------------------------------------------------ 암호화 (AES-GCM, PBKDF2)
const enc = new TextEncoder(), dec = new TextDecoder();
function toB64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const toB64url = (u8) => toB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const PBKDF2_ITER = 600000;
const CHECK_TEXT = "libird-words";
const AAD_TOKEN = enc.encode("lbw-token"), AAD_PAIR = enc.encode("lbw-pair");

async function deriveKey(pw, saltB64, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations: iter}, base, 256));
}
async function aesEnc(raw, text, aad) {
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv, ...(aad ? {additionalData: aad} : {})}, key, enc.encode(text)));
  return {iv: toB64(iv), ct: toB64(ct)};
}
async function aesDec(raw, box, aad) {
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({name: "AES-GCM", iv: fromB64(box.iv), ...(aad ? {additionalData: aad} : {})}, key, fromB64(box.ct));
  return dec.decode(pt);
}

// ------------------------------------------------------------ GitHub 동기화
// 저장 위치: progress 브랜치 / meta.json (salt, 비밀번호 확인용 암호문) + progress/<기기>.json (기기마다 자기 파일만 씀)
// lbw.sync = {salt, iter, tok:{iv,ct}, key?:b64}  key가 없으면 시작할 때 비밀번호를 물음
let SYNC = lsGet("lbw.sync");
let memKey = SYNC && SYNC.key ? fromB64(SYNC.key) : null;
let token = null;
let syncState = {busy: false, again: false, err: "", last: lsGet("lbw.lastSync", 0), lastPull: 0};
let remoteCache = lsGet("lbw.remote", {});  // {파일명: {sha, data}}
let ownSha = lsGet("lbw.ownSha", null);
let pendingPair = null;

function gh(method, path, body, accept) {
  const headers = {Accept: accept || "application/vnd.github+json"};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  return fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}${path}`, {method, headers, cache: "no-store", body: body ? JSON.stringify(body) : undefined});
}
const b64utf8 = (s) => toB64(enc.encode(s));
async function fetchMeta() {
  // 토큰 없이도 읽을 수 있게 raw 주소를 먼저 쓴다 (공개 저장소)
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/meta.json?t=${Date.now()}`, {cache: "no-store"});
    if (r.ok) return await r.json();
    if (r.status === 404 && !token) return null;
  } catch (e) { /* 아래에서 다시 */ }
  if (token) {
    const r = await gh("GET", `/contents/meta.json?ref=${CFG.branch}`, null, "application/vnd.github.raw");
    if (r.ok) return await r.json();
    if (r.status === 404) return null;
    throw new Error(r.status === 401 ? "토큰이 맞지 않아요." : `GitHub 응답 오류 (${r.status})`);
  }
  return null;
}
async function ensureBranch() {
  const r = await gh("GET", `/git/ref/heads/${CFG.branch}`);
  if (r.ok) return;
  if (r.status === 401) throw new Error("토큰이 맞지 않아요.");
  const main = await gh("GET", `/git/ref/heads/main`);
  if (!main.ok) throw new Error(`저장소를 찾지 못했어요 (${main.status}). 토큰 권한(저장소 선택)을 확인해 주세요.`);
  const sha = (await main.json()).object.sha;
  const c = await gh("POST", `/git/refs`, {ref: `refs/heads/${CFG.branch}`, sha});
  if (!c.ok) throw new Error(c.status === 403 ? "토큰에 쓰기 권한(Contents: Read and write)이 없어요." : `브랜치를 만들지 못했어요 (${c.status}).`);
}
function syncReady() { return Boolean(SYNC && memKey && token); }
async function unlockSync(pw) {
  // 저장해 둔 설정 + 비밀번호(또는 기억한 키)로 토큰을 푼다
  const raw = pw ? await deriveKey(pw, SYNC.salt, SYNC.iter) : memKey;
  token = await aesDec(raw, SYNC.tok, AAD_TOKEN);
  memKey = raw;
}
async function connect({tok, pw, pw2, remember}) {
  token = tok;
  let meta = await fetchMeta();
  if (!meta) {
    if (!pw2) throw new Error("처음 설정이에요. 비밀번호를 한 번 더 입력해 주세요.");
    if (pw !== pw2) throw new Error("두 비밀번호가 달라요.");
    if (pw.length < 6) throw new Error("비밀번호는 6자 이상으로 해 주세요.");
    await ensureBranch();
    const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
    const raw = await deriveKey(pw, salt, PBKDF2_ITER);
    meta = {v: 1, app: "LiBird Words", kdf: "PBKDF2-SHA256", salt, iter: PBKDF2_ITER, check: await aesEnc(raw, CHECK_TEXT)};
    const r = await gh("PUT", `/contents/meta.json`, {message: "LiBird Words: 동기화 설정", branch: CFG.branch, content: b64utf8(JSON.stringify(meta, null, 1))});
    if (!r.ok) throw new Error(r.status === 403 || r.status === 404 ? "토큰에 쓰기 권한(Contents: Read and write)이 없어요." : `설정 파일을 만들지 못했어요 (${r.status}).`);
    memKey = raw;
  } else {
    const raw = await deriveKey(pw, meta.salt, meta.iter);
    try { if (await aesDec(raw, meta.check) !== CHECK_TEXT) throw 0; }
    catch (e) { throw new Error("비밀번호가 맞지 않아요. 처음 설정할 때 정한 비밀번호를 넣어 주세요."); }
    const t = await gh("GET", `/contents/meta.json?ref=${CFG.branch}`);
    if (t.status === 401) throw new Error("토큰이 맞지 않아요.");
    memKey = raw;
  }
  SYNC = {salt: meta.salt, iter: meta.iter, tok: await aesEnc(memKey, token, AAD_TOKEN), ...(remember ? {key: toB64(memKey)} : {})};
  lsSet("lbw.sync", SYNC);
  dirty = true;
  await syncNow();
}
async function connectWithPair(code, pw, remember) {
  const meta = await fetchMeta();
  if (!meta) throw new Error("저장소에 동기화 설정이 없어요. 먼저 다른 기기에서 처음 설정을 해 주세요.");
  const raw = await deriveKey(pw, meta.salt, meta.iter);
  try { if (await aesDec(raw, meta.check) !== CHECK_TEXT) throw 0; }
  catch (e) { throw new Error("비밀번호가 맞지 않아요."); }
  const bytes = fromB64(code);
  let tok;
  try { tok = await aesDec(raw, {iv: toB64(bytes.slice(0, 12)), ct: toB64(bytes.slice(12))}, AAD_PAIR); }
  catch (e) { throw new Error("연결 코드가 맞지 않아요. 다른 기기에서 QR을 다시 띄워 주세요."); }
  await connect({tok, pw, remember});
}
async function pairLink() {
  const box = await aesEnc(memKey, token, AAD_PAIR);
  const bytes = new Uint8Array([...fromB64(box.iv), ...fromB64(box.ct)]);
  return `${location.origin}${location.pathname}#pair=${toB64url(bytes)}`;
}
function disconnect() {
  SYNC = null; memKey = null; token = null;
  lsSet("lbw.sync", null); lsSet("lbw.remote", null); lsSet("lbw.ownSha", null);
  remoteCache = {}; ownSha = null;
  syncState.err = "";
  showSyncDot();
}

function mergeInto(a, b) {
  let changed = false;
  for (const [id, r] of Object.entries(b.cards || {})) {
    if (!a.cards[id] || (r.t || 0) > (a.cards[id].t || 0)) { a.cards[id] = r; changed = true; }
  }
  for (const [id, e] of Object.entries(b.edits || {})) {
    if (!a.edits[id] || (e.t || 0) > (a.edits[id].t || 0)) { a.edits[id] = e; changed = true; }
  }
  for (const [day, devs] of Object.entries(b.daily || {})) {
    a.daily[day] = a.daily[day] || {};
    for (const [dev, cnt] of Object.entries(devs)) {
      const mine = a.daily[day][dev] = a.daily[day][dev] || {};
      for (const [k, v] of Object.entries(cnt)) if ((mine[k] || 0) < v) { mine[k] = v; changed = true; }
    }
  }
  if (b.settings && (b.settings.t || 0) > (a.settings.t || 0)) {
    a.settings = {...DEFAULT_SETTINGS, ...b.settings, decks: {...DEFAULT_SETTINGS.decks, ...(b.settings.decks || {})}};
    changed = true;
  }
  return changed;
}

async function syncNow() {
  if (!syncReady()) { showSyncDot(); return; }
  if (syncState.busy) { syncState.again = true; return; }
  if (!navigator.onLine) { syncState.err = "offline"; showSyncDot(); return; }
  syncState.busy = true;
  syncState.err = "";
  showSyncDot();
  try {
    // 1. 다른 기기 파일 받기 (바뀐 것만)
    const own = `${DEVICE}.json`;
    const lr = await gh("GET", `/contents/${CFG.dir}?ref=${CFG.branch}`);
    if (lr.status === 401 || lr.status === 403) throw Object.assign(new Error("auth"), {code: "auth"});
    const list = lr.ok ? await lr.json() : lr.status === 404 ? [] : null;
    if (!list) throw new Error(`목록 오류 (${lr.status})`);
    let changed = false;
    const names = new Set();
    for (const f of list) {
      if (!f.name.endsWith(".json")) continue;
      names.add(f.name);
      if (f.name === own) { ownSha = f.sha; continue; }
      if (remoteCache[f.name] && remoteCache[f.name].sha === f.sha) continue;
      const r = await gh("GET", `/contents/${CFG.dir}/${encodeURIComponent(f.name)}?ref=${CFG.branch}`, null, "application/vnd.github.raw");
      if (!r.ok) continue;
      const box = await r.json();
      let data;
      try { data = JSON.parse(await aesDec(memKey, box)); } catch (e) { continue; }  // 다른 비밀번호로 쓴 옛 파일
      remoteCache[f.name] = {sha: f.sha, name: data.name, updated: data.updated, data: {cards: {}, edits: {}, daily: {}, settings: {t: 0}}};
      changed = mergeInto(S, data) || changed;
    }
    for (const k of Object.keys(remoteCache)) if (!names.has(k)) delete remoteCache[k];
    if (!names.has(own)) ownSha = null;
    lsSet("lbw.remote", remoteCache);
    if (changed) { lsSet("lbw.state", S); if (view === "home" || view === "settings") render(); }
    syncState.lastPull = Date.now();
    // 2. 내 파일 올리기
    if (dirty || !ownSha) {
      const content = JSON.stringify({...(await aesEnc(memKey, JSON.stringify({v: 1, device: DEVICE, name: DEVNAME, updated: new Date().toISOString(), cards: S.cards, edits: S.edits, daily: S.daily, settings: S.settings}))), v: 1});
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) {
        const r = await gh("PUT", `/contents/${CFG.dir}/${own}`, {message: `LiBird Words: ${DEVNAME} 기록`, branch: CFG.branch, content: b64utf8(content), ...(ownSha ? {sha: ownSha} : {})});
        if (r.ok) { ownSha = (await r.json()).content.sha; ok = true; }
        else if (r.status === 409 || r.status === 422) {
          const g = await gh("GET", `/contents/${CFG.dir}/${own}?ref=${CFG.branch}`);
          ownSha = g.ok ? (await g.json()).sha : null;
        } else if (r.status === 401 || r.status === 403 || r.status === 404) throw Object.assign(new Error("auth"), {code: "auth"});
        else throw new Error(`올리기 오류 (${r.status})`);
      }
      if (!ok) throw new Error("올리기 충돌");
      lsSet("lbw.ownSha", ownSha);
      dirty = false;
      lsSet("lbw.dirty", false);
    }
    syncState.last = Date.now();
    lsSet("lbw.lastSync", syncState.last);
  } catch (e) {
    syncState.err = e.code === "auth" ? "auth" : (e instanceof TypeError ? "offline" : e.message || "error");
  }
  syncState.busy = false;
  showSyncDot();
  if (view === "settings" && $("#sync-box")) $("#sync-box").innerHTML = syncPanel();
  if (syncState.again) { syncState.again = false; syncNow(); }
}
function scheduleSync(ms = 6000) {
  clearTimeout(saveTimer);
  if (syncReady()) saveTimer = setTimeout(syncNow, ms);
}
function hhmm(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function showSyncDot() {
  const el = $("#sync-dot"), label = $("#sync-label");
  let cls = "off", text = "로컬";
  if (SYNC && !memKey) { cls = "err"; text = "잠김"; }
  else if (syncReady()) {
    if (syncState.busy) { cls = "busy"; text = "동기화 중"; }
    else if (syncState.err === "offline") { cls = "busy"; text = "오프라인"; }
    else if (syncState.err) { cls = "err"; text = "오류"; }
    else if (syncState.last) { cls = "ok"; text = hhmm(syncState.last); }
  }
  el.className = "dot " + cls;
  label.textContent = text;
}
function syncErrorText() {
  const e = syncState.err;
  if (!e) return "";
  if (e === "auth") return "GitHub 토큰이 만료됐거나 권한이 없어요. 새 토큰으로 다시 연결해 주세요.";
  if (e === "offline") return "인터넷에 연결되지 않았어요. 연결되면 자동으로 올려요.";
  return "동기화 오류: " + e;
}
function syncPanel() {
  if (pendingPair) {
    return `<p><b>다른 기기에서 보낸 연결 코드를 받았어요.</b><br>처음 설정할 때 정한 동기화 비밀번호를 넣어 주세요.</p>
      <form id="pair-form"><label class="f"><span>동기화 비밀번호</span><input type="password" name="pw" autocomplete="current-password" required></label>
      <label class="check"><input type="checkbox" name="remember" checked> 이 기기에서 비밀번호 기억</label>
      <div class="row"><button class="btn pri" type="submit">연결</button><button class="btn" type="button" data-act="pair-cancel">취소</button></div>
      <p class="err" id="sync-err"></p></form>`;
  }
  if (SYNC && !memKey) {
    return `<p>동기화가 잠겨 있어요. 비밀번호를 넣으면 이어서 동기화해요.</p>
      <form id="unlock-form"><label class="f"><span>동기화 비밀번호</span><input type="password" name="pw" required></label>
      <label class="check"><input type="checkbox" name="remember"> 이 기기에서 비밀번호 기억</label>
      <div class="row"><button class="btn pri" type="submit">열기</button><button class="btn ghost" type="button" data-act="disconnect">연결 해제</button></div>
      <p class="err" id="sync-err"></p></form>`;
  }
  if (syncReady()) {
    const others = Object.values(remoteCache).map((r) => `${esc(r.name || "기기")} (${r.updated ? new Date(r.updated).toLocaleString("ko-KR") : "-"})`);
    return `<p class="ok">GitHub와 연결됨 · 마지막 동기화 ${syncState.last ? new Date(syncState.last).toLocaleString("ko-KR") : "-"}</p>
      ${syncState.err ? `<p class="err">${esc(syncErrorText())}</p>` : ""}
      <p class="small muted">다른 기기: ${others.length ? others.join(", ") : "아직 없음"}</p>
      <div class="row"><button class="btn pri" data-act="sync-now">지금 동기화</button><button class="btn" data-act="pair-show">다른 기기 연결 (QR)</button>
      <button class="btn ghost" data-act="disconnect">이 기기 연결 해제</button></div>`;
  }
  return `<p>지금은 이 기기에만 저장돼요. GitHub에 연결하면 PC와 폰이 같은 기록으로 공부할 수 있어요.</p>
    <p class="small"><b>이미 다른 기기를 연결했다면</b> 그 기기의 설정 → 「다른 기기 연결 (QR)」을 이 기기 카메라로 찍으면 돼요.</p>
    <details><summary class="small">처음 연결하기 (토큰 만드는 법)</summary>
    <ol class="steps">
      <li>GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → Generate new token</li>
      <li>Repository access: <b>Only select repositories</b> → <b>${CFG.repo}</b> 하나만</li>
      <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
      <li>만든 토큰(github_pat_…)을 아래에 붙여 넣고, 동기화 비밀번호를 새로 정하세요.</li>
    </ol>
    <p class="small muted">토큰은 이 비밀번호로 암호화해서 이 브라우저에만 보관해요. 학습 기록도 같은 비밀번호로 암호화해서 GitHub에 올려요. 공용 컴퓨터에서는 연결하지 마세요.</p>
    </details>
    <form id="connect-form">
      <label class="f"><span>GitHub 토큰</span><input type="password" name="tok" autocomplete="off" required></label>
      <label class="f"><span>동기화 비밀번호</span><input type="password" name="pw" autocomplete="new-password" required></label>
      <label class="f"><span>비밀번호 확인 (처음 설정할 때만)</span><input type="password" name="pw2" autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" name="remember" checked> 이 기기에서 비밀번호 기억</label>
      <button class="btn pri" type="submit">연결</button>
      <p class="err" id="sync-err"></p>
    </form>`;
}
function bindSyncForms() {
  const run = async (form, fn) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#sync-err"), btn = form.querySelector("button[type=submit]");
      err.className = "muted small";
      err.textContent = "확인 중… (비밀번호 계산에 몇 초 걸려요)";
      btn.disabled = true;
      try { await fn(form.elements); render(); toast("동기화를 연결했어요."); }
      catch (ex) { err.className = "err"; err.textContent = ex.message || String(ex); btn.disabled = false; token = SYNC && memKey ? token : null; }
    });
  };
  const cf = $("#connect-form");
  if (cf) run(cf, (el) => connect({tok: el.tok.value.trim(), pw: el.pw.value, pw2: el.pw2.value, remember: el.remember.checked}));
  const pf = $("#pair-form");
  if (pf) run(pf, async (el) => { await connectWithPair(pendingPair, el.pw.value, el.remember.checked); pendingPair = null; });
  const uf = $("#unlock-form");
  if (uf) run(uf, async (el) => {
    try { await unlockSync(el.pw.value); } catch (e) { throw new Error("비밀번호가 맞지 않아요."); }
    if (el.remember.checked) { SYNC.key = toB64(memKey); lsSet("lbw.sync", SYNC); }
    await syncNow();
  });
}
AFTER.settings = bindSyncForms;

async function showPairQR() {
  const link = await pairLink();
  openModal(`<h2 style="margin-top:0">다른 기기 연결</h2>
    <p class="small">연결할 기기(폰) 카메라로 QR을 찍어 열고, 동기화 비밀번호를 넣으면 끝이에요.</p>
    <div class="qr" id="qr">QR 만드는 중…</div>
    <p class="small muted">아이폰은 Safari에서 열어 연결한 뒤 「홈 화면에 추가」를 하면, 홈 화면 앱은 따로 한 번 더 연결해야 할 수 있어요. 그럴 땐 아래 주소를 복사해 홈 화면 앱의 주소창 대신 설정 화면에 붙여 넣어 주세요.</p>
    <code class="link">${esc(link)}</code>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="copy" data-text="${esc(link)}">주소 복사</button><button class="btn pri" data-act="close">닫기</button></div>
    <p class="small muted">이 주소에는 토큰이 비밀번호로 암호화되어 들어 있어요. 비밀번호를 모르면 쓸 수 없지만, 다른 사람에게 보내지는 마세요.</p>`);
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js");
    const qr = window.qrcode(0, "M");
    qr.addData(link);
    qr.make();
    if ($("#qr")) $("#qr").innerHTML = qr.createSvgTag({cellSize: 4, margin: 2, scalable: true});
  } catch (e) {
    if ($("#qr")) $("#qr").textContent = "QR을 만들지 못했어요. 주소를 복사해서 쓰세요.";
  }
}
function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}
function readPairHash(text) {
  const m = String(text || "").match(/#pair=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// ------------------------------------------------------------ 백업
function exportBackup() {
  const blob = new Blob([JSON.stringify({app: "LiBird Words", v: 1, exported: new Date().toISOString(), state: S}, null, 1)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `libird-words-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    const st = j.state || j;
    if (!st.cards) throw new Error();
    mergeInto(S, {cards: st.cards, edits: st.edits || {}, daily: st.daily || {}, settings: st.settings || {t: 0}});
    save();
    render();
    toast("백업을 합쳤어요.");
  } catch (e) { toast("백업 파일을 읽지 못했어요."); }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("복사했어요."); }
  catch (e) { openModal(`<p>아래를 길게 눌러 복사하세요.</p><textarea style="min-height:160px">${esc(text)}</textarea><button class="btn" data-act="close">닫기</button>`); }
}

// ------------------------------------------------------------ 이벤트
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case "home": go("home"); break;
    case "settings": go("settings"); break;
    case "study": startStudy(el.dataset.lang); break;
    case "study-more": closeModal(); startStudy(el.dataset.lang, 5); break;
    case "show": showAnswer(); break;
    case "grade": grade(Number(el.dataset.g)); break;
    case "speak": speak(el.dataset.text, el.dataset.lang); break;
    case "edit": openEdit(el.dataset.id); break;
    case "edit-reset": S.edits[el.dataset.id] = {f: {}, t: Date.now()}; save(); closeModal(); render(); break;
    case "close": closeModal(); break;
    case "sort": go("sort"); break;
    case "peek": ctx.peek = true; render(); break;
    case "sort-yes": sortAnswer(true); break;
    case "sort-no": sortAnswer(false); break;
    case "quiz": go("quiz"); break;
    case "quiz-pick": {
      if (ctx.q.picked) break;
      ctx.q.picked = el.dataset.id; ctx.n++;
      if (ctx.q.picked === ctx.q.id) ctx.right++;
      render();
      speak(CARDS[ctx.q.id].ch, "ja");
      break;
    }
    case "quiz-next": newQuestion(); render(); break;
    case "quiz-script": ctx.script = el.dataset.v; newQuestion(); render(); break;
    case "quiz-mode": ctx.mode = el.dataset.v; newQuestion(); render(); break;
    case "confuse": go("confuse"); break;
    case "chart": go("chart", {script: "hira"}); break;
    case "chart-script": ctx.script = el.dataset.v; render(); break;
    case "sync-info":
      if (syncReady() && syncState.err) toast(syncErrorText(), 6000);
      go("settings");
      break;
    case "sync-now": syncNow(); break;
    case "pair-show": showPairQR(); break;
    case "pair-cancel": pendingPair = null; render(); break;
    case "disconnect":
      if (confirmInline(el, "정말 해제할까요? (기록은 이 기기와 GitHub에 남아요)")) { disconnect(); render(); toast("이 기기의 연결을 해제했어요."); }
      break;
    case "copy": copyText(el.dataset.text); break;
    case "export": exportBackup(); break;
    case "import": $("#import-file").click(); break;
    case "copy-edits": {
      const out = Object.entries(S.edits).filter(([, x]) => x.f && Object.keys(x.f).length).map(([id, x]) => ({id, ...x.f}));
      copyText(JSON.stringify(out, null, 1));
      break;
    }
    case "unknown-all":
      if (confirmInline(el, "뺀 단어를 모두 다시 학습에 넣을까요?")) {
        const now = Date.now();
        for (const [id, r] of Object.entries(S.cards)) if (r.s === "known") S.cards[id] = {s: "new", t: now};
        save(); render();
      }
      break;
    case "rename": {
      const box = el.closest(".box");
      box.innerHTML = `<form id="rename-form" class="row"><input type="text" name="n" value="${esc(DEVNAME)}" maxlength="20" style="flex:1"><button class="btn pri">저장</button></form>`;
      $("#rename-form").addEventListener("submit", (ev) => {
        ev.preventDefault();
        DEVNAME = ev.target.elements.n.value.trim() || DEVNAME;
        lsSet("lbw.devname", DEVNAME);
        dirty = true; lsSet("lbw.dirty", true); scheduleSync(500);
        render();
      });
      break;
    }
  }
});
// 확인 대화상자(confirm) 대신 버튼을 두 번 누르게 한다
function confirmInline(el, msg) {
  if (el.dataset.armed) return true;
  el.dataset.armed = "1";
  const old = el.textContent;
  el.textContent = "한 번 더 누르면 실행";
  toast(msg);
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 4000);
  return false;
}
document.addEventListener("change", (e) => {
  const el = e.target;
  const st = S.settings;
  if (el.dataset.num) st[el.dataset.num] = Math.max(0, Math.min(50, Number(el.value) || 0));
  else if (el.dataset.deck) st.decks[el.dataset.deck] = el.checked;
  else if (el.dataset.opt) st[el.dataset.opt] = el.checked;
  else if (el.dataset.unlock) st.unlocked[el.dataset.unlock] = el.checked;
  else if (el.id === "import-file" && el.files[0]) { importBackup(el.files[0]); return; }
  else return;
  st.t = Date.now();
  save();
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$("#modal").classList.contains("hidden")) { if (e.key === "Escape") closeModal(); return; }
  if (view === "study") {
    if (!ctx.shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); showAnswer(); }
    else if (ctx.shown && "1234".includes(e.key)) grade(Number(e.key));
    else if (ctx.shown && e.key === " ") { e.preventDefault(); grade(3); }
  } else if (view === "sort") {
    if (e.key === "ArrowRight" || e.key === "k") sortAnswer(true);
    else if (e.key === "ArrowLeft" || e.key === "j") sortAnswer(false);
    else if (e.key === " ") { e.preventDefault(); ctx.peek = true; render(); }
  }
});
document.addEventListener("visibilitychange", () => {
  if (!syncReady()) return;
  if (document.visibilityState === "hidden") { if (dirty) syncNow(); }
  else if (Date.now() - syncState.lastPull > 60000) syncNow();
});
window.addEventListener("online", () => { if (syncReady()) syncNow(); });
window.addEventListener("hashchange", () => {
  const code = readPairHash(location.hash);
  if (code) { pendingPair = code; history.replaceState(null, "", location.pathname + location.search); go("settings"); }
});

// ------------------------------------------------------------ 시작
(async function start() {
  const code = readPairHash(location.hash);
  if (code) { pendingPair = code; history.replaceState(null, "", location.pathname + location.search); }
  if (SYNC && memKey) {
    try { await unlockSync(null); } catch (e) { memKey = null; }
  }
  showSyncDot();
  go(pendingPair || (SYNC && !memKey) ? "settings" : "home");
  if (syncReady()) syncNow();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
