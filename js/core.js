"use strict";
// LiBird Words — 공통: 데이터 · 상태 · 간격 반복 · 채점 · 암호화 · 동기화 · AI
const APP_VERSION = "2.0.0";
const CFG = {owner: "Forlab-future", repo: "LiBirdWords", branch: "progress", dir: "progress"};
const D = window.LBW_DATA || {};
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => isoDate(new Date());
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfToday = () => startOfDay(Date.now()) + DAY;
const newId = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hasKanji = (s) => /[一-鿿]/.test(s || "");

function lsGet(k, fallback = null) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }

const LANGS = {ja: {name: "일본어", badge: "あ", voice: "ja-JP"}, en: {name: "영어", badge: "Aa", voice: "en-US"}};
let LANG = lsGet("lbw.lang") === "en" ? "en" : "ja";

// ------------------------------------------------------------ 카드 목록
const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const STAGES = [
  {id: "hira_basic", name: "히라가나 기본", desc: "あ부터 ん까지 46자", req: null, pool: "kana"},
  {id: "hira_dakuten", name: "히라가나 탁음", desc: "が·ざ·だ·ば·ぱ", req: "hira_basic", pool: "kana"},
  {id: "hira_yoon", name: "히라가나 요음", desc: "きゃ·しゅ·ちょ…", req: "hira_dakuten", pool: "kana"},
  {id: "words_hira", name: "히라가나 단어", desc: "가나로만 쓰는 쉬운 단어", req: "hira_yoon", pool: "jw"},
  {id: "phrases", name: "기본 회화 표현", desc: "인사·쇼핑·길 묻기", req: "words_hira", pool: "jw"},
  {id: "kata_basic", name: "가타카나 기본", desc: "외래어 표기 글자", req: "hira_yoon", pool: "kana"},
  {id: "kata_dakuten", name: "가타카나 탁음", desc: "ガ·ザ·ダ·バ·パ", req: "kata_basic", pool: "kana"},
  {id: "kata_yoon", name: "가타카나 요음", desc: "キャ·シュ·チョ…", req: "kata_dakuten", pool: "kana"},
  {id: "words_kata", name: "가타카나 단어", desc: "コーヒー·テレビ…", req: "kata_dakuten", pool: "jw"},
  {id: "words_n5", name: "N5 한자 단어", desc: "기초 한자 단어 (후리가나)", req: "words_hira", pool: "jw"}
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const EN_DECKS = [
  {id: "awl", name: "학술 어휘 (AWL)", desc: "논문에 가장 자주 나오는 핵심 어휘", w: 2},
  {id: "idiom", name: "숙어·구동사", desc: "논문·발표·일상의 고급 표현", w: 1},
  {id: "phrase", name: "논문 표현", desc: "글을 쓸 때 쓰는 문장 틀", w: 1},
  {id: "sent", name: "논문 문장", desc: "통째로 익히는 모범 문장 · 빈칸 연습", w: 1},
  {id: "sofc", name: "SOFC·재료 전공어휘", desc: "내 분야 핵심 용어", w: 1}
];
const UNLOCK_AT = 0.8;
const CARDS = {}, BY_GROUP = {}, GROUPS = {};
function addGroup(g) { GROUPS[g.id] = g; BY_GROUP[g.id] = BY_GROUP[g.id] || []; }
function addCard(c) {
  if (CARDS[c.id]) return;
  CARDS[c.id] = c;
  (BY_GROUP[c.group] = BY_GROUP[c.group] || []).push(c.id);
}
const KANA_ROMA = {};
(function buildBuiltin() {
  const K = D.kana || {basic: [], dakuten: [], yoon: [], kataTips: {}};
  for (const st of STAGES) addGroup({id: st.id, lang: "ja", name: st.name, desc: st.desc, kind: "stage", pool: st.pool});
  for (const d of EN_DECKS) addGroup({id: d.id, lang: "en", name: d.name, desc: d.desc, kind: "deck", pool: "en", w: d.w});
  const sets = [["basic", "hira_basic", "kata_basic"], ["dakuten", "hira_dakuten", "kata_dakuten"], ["yoon", "hira_yoon", "kata_yoon"]];
  for (const [key, hs] of sets) for (const [ch, romaji, ko, tip] of K[key] || []) {
    KANA_ROMA[ch] = romaji;
    addCard({id: "k:" + ch, lang: "ja", type: "kana", group: hs, ch, romaji, ko, tip: tip || ""});
  }
  for (const [key, , ks] of sets) for (const [ch, romaji, ko] of K[key] || []) {
    const kc = toKata(ch);
    addCard({id: "k:" + kc, lang: "ja", type: "kana", group: ks, ch: kc, romaji, ko, tip: (K.kataTips || {})[kc] || `히라가나 ${ch}와 같은 소리`});
  }
  for (const w of D.ja || []) if (STAGE[w.stage]) addCard({...w, lang: "ja", type: "word", group: w.stage});
  for (const w of D.en || []) if (GROUPS[w.deck]) addCard({...w, lang: "en", type: w.deck === "sent" ? "sent" : "en", group: w.deck});
})();

function kanaToRomaji(s) {
  const h = toHira(String(s || ""));
  let out = "", i = 0;
  const small = {"ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o"};
  while (i < h.length) {
    const one = h[i], two = h.slice(i, i + 2);
    if (one === "っ") {
      const nx = KANA_ROMA[h.slice(i + 1, i + 3)] || KANA_ROMA[h[i + 1]] || "";
      out += nx ? (nx.startsWith("ch") ? "t" : nx[0]) : "";
      i++; continue;
    }
    if (one === "ー") { const m = out.match(/[aeiou]$/); out += m ? m[0] : ""; i++; continue; }
    if (two.length === 2 && KANA_ROMA[two]) { out += KANA_ROMA[two]; i += 2; continue; }
    if (KANA_ROMA[one]) {
      // 조사 は·へ·を는 단어 사이에 홀로 있을 때 wa·e·o
      // 띄어쓴 단어 끝의 は·へ는 조사로 본다 (これは → kore wa, こんにちは → konnichiwa)
      const tokenEnd = h[i + 1] === " " || i === h.length - 1;
      const tokenLen = i - Math.max(h.lastIndexOf(" ", i - 1), -1);
      const particle = tokenEnd && tokenLen >= 3 && (one === "は" || one === "へ");
      out += particle ? (one === "は" ? "wa" : "e") : one === "を" ? "o" : KANA_ROMA[one];
      i++; continue;
    }
    if (small[one]) { out = out.replace(/[aeiou]$/, "") + small[one]; i++; continue; }
    out += one === "　" ? " " : one;
    i++;
  }
  return out;
}

// ------------------------------------------------------------ 상태
const DEFAULT_SETTINGS = {
  kanaNew: 6, jaNew: 5, enNew: 8, decks: {}, unlocked: {}, autoSpeak: true, furigana: true, shuffleNew: false,
  mode: {ja: "choice", en: "type"}, dir: {ja: "fwd", en: "fwd"}, aiModel: "claude-opus-5-5", readSize: 18, t: 0
};
const AI_MODELS = [["claude-opus-5-5", "Claude Opus 5.5", "가장 정확 · 기본"], ["claude-haiku-5-5", "Claude Haiku 5.5", "아주 저렴 · 빠름"]];
function normSettings(s) {
  s = s || {};
  return {...DEFAULT_SETTINGS, ...s, decks: {...(s.decks || {})}, unlocked: {...(s.unlocked || {})},
    mode: {...DEFAULT_SETTINGS.mode, ...(s.mode || {})}, dir: {...DEFAULT_SETTINGS.dir, ...(s.dir || {})}};
}
function normState(x) {
  x = x || {};
  x.v = 2;
  for (const k of ["cards", "daily", "edits", "accept", "read", "best"]) x[k] = x[k] || {};
  x.custom = x.custom || {};
  for (const k of ["decks", "cards", "passages"]) x.custom[k] = x.custom[k] || {};
  x.settings = normSettings(x.settings);
  return x;
}
let S = normState(lsGet("lbw.state"));
let DEVICE = lsGet("lbw.device");
if (!DEVICE) { DEVICE = newId(6); lsSet("lbw.device", DEVICE); }
let DEVNAME = lsGet("lbw.devname") || (/(Android|iPhone|iPad)/i.test(navigator.userAgent) ? "폰" : "PC");
let dirty = lsGet("lbw.dirty", false);
let syncTimer = null;

function save(markDirty = true) {
  lsSet("lbw.state", S);
  if (markDirty) { dirty = true; lsSet("lbw.dirty", true); scheduleSync(); }
}

const customDecks = (lang) => Object.values(S.custom.decks).filter((d) => !d.del && (!lang || d.lang === lang)).sort((a, b) => (a.created || 0) - (b.created || 0));
function rebuildCustom() {
  for (const g of Object.values(GROUPS)) {
    if (g.kind !== "custom") continue;
    for (const cid of BY_GROUP[g.id] || []) delete CARDS[cid];
    delete BY_GROUP[g.id];
    delete GROUPS[g.id];
  }
  for (const d of customDecks()) addGroup({id: d.id, lang: d.lang, name: d.name, desc: d.desc || "내 단어장", kind: "custom", pool: d.lang === "en" ? "en" : "jw", w: 1});
  const list = Object.values(S.custom.cards).filter((c) => !c.del && GROUPS[c.deck] && GROUPS[c.deck].kind === "custom").sort((a, b) => (a.created || 0) - (b.created || 0));
  for (const c of list) {
    const lang = GROUPS[c.deck].lang;
    const base = {...c, lang, group: c.deck, custom: true};
    if (lang === "ja") addCard({...base, type: "word", kana: c.kana || c.word, romaji: c.romaji || kanaToRomaji(c.kana || c.word)});
    else addCard({...base, type: "en"});
  }
}
rebuildCustom();

const card = (id) => {
  const c = CARDS[id];
  if (!c) return null;
  const e = S.edits[id];
  return e && e.f && Object.keys(e.f).length ? {...c, ...e.f} : c;
};
const rec = (id) => S.cards[id];
const isNew = (id) => !S.cards[id] || S.cards[id].s === "new";
const groupOn = (g) => S.settings.decks[g] !== false;
const enabled = (id) => CARDS[id] && groupOn(CARDS[id].group);
function status(id) {
  const r = S.cards[id];
  if (!r || r.s === "new") return "new";
  if (r.s === "known") return "known";
  if (r.s === "learn") return "learn";
  return r.ivl >= 21 ? "mature" : "review";
}
const STATUS_LABEL = {new: "새 항목", learn: "익히는 중", review: "복습 중", mature: "오래 기억", known: "알아요"};
const poolOf = (c) => c.lang === "en" ? "en" : (GROUPS[c.group] ? GROUPS[c.group].pool : "jw");
const accepted = (id) => (S.accept[id] && S.accept[id].a) || [];
function addAccepted(id, text) {
  const t = String(text || "").trim();
  if (!t) return;
  const cur = S.accept[id] || {a: [], t: 0};
  if (!cur.a.includes(t)) { S.accept[id] = {a: [...cur.a, t], t: Date.now()}; save(); }
}

// ------------------------------------------------------------ 하루 기록 (기기별)
// kana·jw·en = 새로 배운 수, rja·ren = 복습, oja·bja·oen·ben = 맞음/틀림, fja·fen = 자유 복습, sja·sen = 공부 시간(초)
function bump(field, n = 1) {
  if (!n) return;
  const d = todayStr();
  S.daily[d] = S.daily[d] || {};
  const mine = S.daily[d][DEVICE] = S.daily[d][DEVICE] || {};
  mine[field] = Math.round(((mine[field] || 0) + n) * 10) / 10;
}
function dayTotals(day) {
  const t = {};
  for (const dev of Object.values(S.daily[day] || {})) for (const [k, v] of Object.entries(dev)) t[k] = (t[k] || 0) + v;
  return t;
}
const todayCounts = () => dayTotals(todayStr());
function dayCount(day, lang) {
  const t = dayTotals(day);
  if (lang === "ja") return (t.kana || 0) + (t.jw || 0) + (t.rja || 0) + (t.fja || 0);
  if (lang === "en") return (t.en || 0) + (t.ren || 0) + (t.fen || 0);
  return Object.entries(t).filter(([k]) => !/^s(ja|en)$/.test(k)).reduce((a, [, v]) => a + v, 0);
}
function streak() {
  let n = 0;
  const day = new Date();
  if (!dayCount(isoDate(day))) day.setDate(day.getDate() - 1);
  while (dayCount(isoDate(day))) { n++; day.setDate(day.getDate() - 1); }
  return n;
}

// ------------------------------------------------------------ 간격 반복
const LEARN_STEPS = [1, 10];  // 분
const dayDue = (ivl) => startOfDay(Date.now()) + ivl * DAY + 4 * HOUR;
function schedule(r0, g, now = Date.now()) {
  const r = r0 && r0.s !== "new" && r0.s !== "known" ? {...r0} : {s: "learn", ease: 2.5, ivl: 0, step: 0, reps: 0, lapses: 0, wrong: (r0 && r0.wrong) || 0};
  if (g === 1) r.wrong = (r.wrong || 0) + 1;
  if (r.s === "learn") {
    if (g === 1) { r.step = 0; r.due = now + LEARN_STEPS[0] * MIN; }
    else if (g === 2) { r.due = now + (r.step === 0 ? 6 : LEARN_STEPS[r.step]) * MIN; }
    else if (g === 3 && r.step + 1 < LEARN_STEPS.length) { r.step++; r.due = now + LEARN_STEPS[r.step] * MIN; }
    else {
      r.ivl = g === 4 ? (r.ivl > 0 ? r.ivl + 1 : 4) : (r.ivl > 0 ? r.ivl : 1);
      r.s = "review"; r.step = 0; r.due = dayDue(r.ivl);
    }
  } else {
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
function relDue(due) {
  if (!due) return "";
  const days = Math.round((startOfDay(due) - startOfDay(Date.now())) / DAY);
  if (due <= Date.now()) return "지금";
  if (days <= 0) return "오늘";
  if (days === 1) return "내일";
  return days + "일 후";
}

// ------------------------------------------------------------ 단계 · 오늘 할 것
function groupProgress(g) {
  const ids = BY_GROUP[g] || [];
  let done = 0, seen = 0;
  for (const id of ids) {
    const r = S.cards[id];
    if (!r || r.s === "new") continue;
    seen++;
    if (r.s === "review" || r.s === "known") done++;
  }
  return {done, seen, total: ids.length, ratio: ids.length ? done / ids.length : 0};
}
function unlocked(gid) {
  const st = STAGE[gid];
  if (!st || !st.req || S.settings.unlocked[gid]) return true;
  return unlocked(st.req) && groupProgress(st.req).ratio >= UNLOCK_AT;
}
function dueIds(lang, group = null) {
  const end = endOfToday();
  return Object.keys(S.cards).filter((id) => {
    const c = CARDS[id], r = S.cards[id];
    return c && c.lang === lang && (!group || c.group === group) && enabled(id) && (r.s === "learn" || r.s === "review") && r.due <= end;
  }).sort((a, b) => S.cards[a].due - S.cards[b].due);
}
function newBudget(lang) {
  const st = S.settings, t = todayCounts();
  const base = lang === "ja" ? st.kanaNew + st.jaNew : st.enNew;
  const dueRev = dueIds(lang).filter((id) => S.cards[id].s === "review").length;
  const factor = dueRev > base * 10 ? 0 : dueRev > base * 5 ? 0.5 : 1;
  if (lang === "ja") return {factor, dueRev, kana: Math.max(0, Math.floor(st.kanaNew * factor) - (t.kana || 0)), jw: Math.max(0, Math.floor(st.jaNew * factor) - (t.jw || 0))};
  return {factor, dueRev, en: Math.max(0, Math.floor(st.enNew * factor) - (t.en || 0))};
}
function weave(streams, n) {
  const out = [];
  let moved = true;
  while (out.length < n && moved) {
    moved = false;
    for (const s of streams) for (let k = 0; k < (s.w || 1) && out.length < n; k++) if (s.ids.length) { out.push(s.ids.shift()); moved = true; }
  }
  return out;
}
function newIds(lang, extra = 0, only = null) {
  const order = (ids) => S.settings.shuffleNew ? shuffle(ids.slice()) : ids.slice();
  if (only) return order((BY_GROUP[only] || []).filter(isNew)).slice(0, extra || 10);
  const b = newBudget(lang), out = [];
  if (lang === "ja") {
    const kana = order(STAGES.filter((s) => s.pool === "kana" && unlocked(s.id)).flatMap((s) => (BY_GROUP[s.id] || []).filter(isNew)));
    out.push(...kana.slice(0, b.kana + extra));
    const builtin = order(STAGES.filter((s) => s.pool === "jw" && unlocked(s.id)).flatMap((s) => (BY_GROUP[s.id] || []).filter(isNew)));
    const streams = [{ids: builtin, w: 2}, ...customDecks("ja").filter((d) => groupOn(d.id)).map((d) => ({ids: order((BY_GROUP[d.id] || []).filter(isNew)), w: 1}))];
    out.push(...weave(streams, b.jw + extra));
  } else {
    const streams = Object.values(GROUPS).filter((g) => g.lang === "en" && groupOn(g.id)).map((g) => ({ids: order((BY_GROUP[g.id] || []).filter(isNew)), w: g.w || 1}));
    out.push(...weave(streams, b.en + extra));
  }
  return out;
}

// ------------------------------------------------------------ 채점 (AI 없이)
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ", JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
function jamo(s) {
  let o = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c >= 0 && c < 11172) o += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + (c % 28 ? JONG[c % 28] : "");
    else o += ch;
  }
  return o;
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const ENDINGS = ["합니다", "했다", "하는", "하다", "하게", "하기", "되다", "되는", "시키다", "스럽다", "스러운", "적으로", "적인", "이다", "입니다", "이에요", "예요", "에요", "해요", "한", "된", "적", "것", "의", "을", "를", "은", "는", "이", "가", "요", "다"];
function normKo(s) {
  let t = String(s).toLowerCase().replace(/[^0-9a-z぀-ヿ一-鿿가-힣]/g, "");
  for (let k = 0; k < 2; k++) {
    const e = ENDINGS.find((x) => t.endsWith(x) && t.length - x.length >= 2);
    if (!e) break;
    t = t.slice(0, -e.length);
  }
  return t;
}
function answerVariants(text) {
  const out = new Set();
  for (const part of String(text || "").split(/[,;\/·、，]|\s또는\s|\s혹은\s/)) {
    const p = part.trim();
    if (!p) continue;
    out.add(p.replace(/\(.*?\)|\[.*?\]/g, ""));
    out.add(p.replace(/[()[\]]/g, ""));
    for (const m of p.matchAll(/\((.*?)\)/g)) out.add(m[1]);
  }
  return [...out].map(normKo).filter(Boolean);
}
function checkMeaning(c, typed) {
  const t = normKo(typed);
  if (!t) return {ok: false, by: "local"};
  const cands = [...answerVariants(c.ko), ...accepted(c.id).flatMap(answerVariants)];
  for (const x of cands) if (t === x) return {ok: true, by: "exact"};
  for (const x of cands) {
    if (x.length >= 2 && t.includes(x) && t.length <= x.length + 4) return {ok: true, by: "part"};
    if (t.length >= 2 && x.includes(t) && t.length / x.length >= 0.6) return {ok: true, by: "part"};
  }
  for (const x of cands) {
    const a = jamo(t), b = jamo(x);
    if (b.length >= 3 && lev(a, b) <= (b.length <= 6 ? 1 : 2)) return {ok: true, by: "typo"};
  }
  return {ok: false, by: "local"};
}
function romajiNorm(s) {
  let t = String(s).toLowerCase().replace(/[^a-z]/g, "");
  if (t === "nn") t = "n";
  if (t === "wo") t = "o";
  return t.replace(/tsu/g, "tu").replace(/shi/g, "si").replace(/chi/g, "ti").replace(/sh/g, "sy").replace(/ch/g, "ty").replace(/cy/g, "ty")
    .replace(/jy/g, "zy").replace(/j/g, "zy").replace(/zyi/g, "zi").replace(/zyy/g, "zy").replace(/fu/g, "hu").replace(/di/g, "zi").replace(/du/g, "zu")
    .replace(/ou/g, "oo").replace(/(.)\1+/g, "$1$1");
}
function normEn(s) {
  return String(s).toLowerCase().replace(/[’`]/g, "'").replace(/\(.*?\)/g, " ").replace(/~/g, " ").replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ").trim().replace(/^to /, "")
    .replace(/isation/g, "ization").replace(/ise\b/g, "ize").replace(/yse\b/g, "yze").replace(/our\b/g, "or").replace(/tre\b/g, "ter").replace(/per cent/g, "percent");
}
function checkSpell(expected, typed) {
  const t = normEn(typed), tn = t.replace(/[ '-]/g, "");
  if (!tn) return {ok: false, by: "local"};
  const cands = new Set([expected]);
  for (const m of String(expected).matchAll(/\((.*?)\)/g)) cands.add(m[1]);
  for (const p of String(expected).split(/\s*[\/;]\s*/)) cands.add(p);
  for (const x of cands) {
    const e = normEn(x), en = e.replace(/[ '-]/g, "");
    if (!en) continue;
    if (t === e || tn === en) return {ok: true, by: "exact"};
    if (en.length >= 6 && lev(tn, en) <= 1) return {ok: true, by: "typo", near: true};
  }
  return {ok: false, by: "local"};
}
function checkReading(c, typed) {
  const t = toHira(String(typed).replace(/\s/g, ""));
  if (!t) return {ok: false, by: "local"};
  const kana = toHira(String(c.kana || "").replace(/\s/g, "")), word = String(c.word || "").replace(/\s/g, "");
  if (t === kana || t === toHira(word) || t === word) return {ok: true, by: "exact"};
  if (/^[a-z\s'-]+$/i.test(typed)) {
    const a = romajiNorm(typed), b = romajiNorm(c.romaji || kanaToRomaji(c.kana));
    if (a === b) return {ok: true, by: "exact"};
    if (b.length >= 4 && lev(a, b) <= 1) return {ok: true, by: "typo", near: true};
  }
  if (kana.length >= 4 && lev(t, kana) <= 1) return {ok: true, by: "typo", near: true};
  return {ok: false, by: "local"};
}

// ------------------------------------------------------------ 발음 (Web Speech API)
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const warnedVoice = {};
function voiceFor(lang) {
  const code = LANGS[lang].voice;
  return voices.find((x) => x.lang.replace("_", "-") === code && /Google|Microsoft|Siri|Kyoko|Samantha|Natural/i.test(x.name))
    || voices.find((x) => x.lang.replace("_", "-") === code) || voices.find((x) => x.lang.toLowerCase().startsWith(lang));
}
function speak(text, lang, opts = {}) {
  if (!("speechSynthesis" in window) || !text) { if (!opts.quiet) toast("이 브라우저는 음성 읽기를 지원하지 않아요."); return null; }
  const v = voiceFor(lang);
  if (!v && voices.length && !warnedVoice[lang]) {
    warnedVoice[lang] = true;
    toast(lang === "ja" ? "이 기기에 일본어 음성이 없어요. 기기 설정 → 음성(TTS)에서 일본어를 추가해 주세요." : "이 기기에 영어 음성이 없어요.", 6000);
  }
  if (!opts.queue) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/~/g, "…"));
  u.lang = LANGS[lang].voice;
  if (v) u.voice = v;
  u.rate = opts.rate || (lang === "ja" ? 0.85 : 0.95);
  if (opts.onend) u.onend = opts.onend;
  if (opts.onstart) u.onstart = opts.onstart;
  speechSynthesis.speak(u);
  return u;
}
function stopSpeak() { try { speechSynthesis.cancel(); } catch (e) { /* 없음 */ } }

// ------------------------------------------------------------ 암호화 (AES-GCM, PBKDF2)
const enc = new TextEncoder(), dec = new TextDecoder();
function toB64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const toB64url = (u8) => toB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const PBKDF2_ITER = 600000;
const CHECK_TEXT = "libird-words";
const AAD_TOKEN = enc.encode("lbw-token"), AAD_PAIR = enc.encode("lbw-pair"), AAD_AI = enc.encode("lbw-ai");
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
// progress 브랜치: meta.json (salt, 비밀번호 확인용 암호문) + progress/<기기>.json (기기마다 자기 파일만 씀, 전부 암호화)
let SYNC = lsGet("lbw.sync");
let memKey = SYNC && SYNC.key ? fromB64(SYNC.key) : null;
let token = null;
const syncState = {busy: false, again: false, err: "", last: lsGet("lbw.lastSync", 0), lastPull: 0};
let remoteCache = lsGet("lbw.remote", {});
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
const syncReady = () => Boolean(SYNC && memKey && token);
async function unlockSync(pw) {
  const raw = pw ? await deriveKey(pw, SYNC.salt, SYNC.iter) : memKey;
  token = await aesDec(raw, SYNC.tok, AAD_TOKEN);
  memKey = raw;
  await loadAiKey();
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
  if (AI.key) await saveAiKey(AI.key);  // 평문으로 있던 AI 키를 암호화해서 다시 보관
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
  let text;
  try { text = await aesDec(raw, {iv: toB64(bytes.slice(0, 12)), ct: toB64(bytes.slice(12))}, AAD_PAIR); }
  catch (e) { throw new Error("연결 코드가 맞지 않아요. 다른 기기에서 QR을 다시 띄워 주세요."); }
  let tok = text, aiKey = null;
  if (text.startsWith("{")) { const o = JSON.parse(text); tok = o.t; aiKey = o.a || null; }
  await connect({tok, pw, remember});
  if (aiKey) await saveAiKey(aiKey);
}
async function pairLink() {
  const box = await aesEnc(memKey, JSON.stringify({t: token, ...(AI.key ? {a: AI.key} : {})}), AAD_PAIR);
  const bytes = new Uint8Array([...fromB64(box.iv), ...fromB64(box.ct)]);
  return `${location.origin}${location.pathname}#pair=${toB64url(bytes)}`;
}
function disconnect() {
  if (AI.key) lsSet("lbw.ai", {plain: AI.key});
  SYNC = null; memKey = null; token = null;
  lsSet("lbw.sync", null); lsSet("lbw.remote", null); lsSet("lbw.ownSha", null);
  remoteCache = {}; ownSha = null;
  syncState.err = "";
}

function mergeInto(a, b) {
  let changed = false, customChanged = false;
  const byT = (dst, src, onChange) => {
    for (const [id, x] of Object.entries(src || {})) {
      if (!dst[id] || (x.t || 0) > (dst[id].t || 0)) { dst[id] = x; changed = true; if (onChange) onChange(); }
    }
  };
  byT(a.cards, b.cards);
  byT(a.edits, b.edits);
  byT(a.custom.decks, b.custom && b.custom.decks, () => { customChanged = true; });
  byT(a.custom.cards, b.custom && b.custom.cards, () => { customChanged = true; });
  byT(a.custom.passages, b.custom && b.custom.passages);
  for (const [id, x] of Object.entries(b.accept || {})) {
    const m = a.accept[id];
    if (!m) { a.accept[id] = x; changed = true; continue; }
    const u = [...new Set([...m.a, ...(x.a || [])])];
    if (u.length !== m.a.length) { a.accept[id] = {a: u, t: Math.max(m.t || 0, x.t || 0)}; changed = true; }
  }
  for (const [id, t] of Object.entries(b.read || {})) if ((a.read[id] || 0) < t) { a.read[id] = t; changed = true; }
  for (const [k, x] of Object.entries(b.best || {})) {
    const m = a.best[k];
    const better = !m || (x.low ? x.score < m.score : x.score > m.score);
    if (better) { a.best[k] = x; changed = true; }
  }
  for (const [day, devs] of Object.entries(b.daily || {})) {
    a.daily[day] = a.daily[day] || {};
    for (const [dev, cnt] of Object.entries(devs)) {
      const mine = a.daily[day][dev] = a.daily[day][dev] || {};
      for (const [k, v] of Object.entries(cnt)) if ((mine[k] || 0) < v) { mine[k] = v; changed = true; }
    }
  }
  if (b.settings && (b.settings.t || 0) > (a.settings.t || 0)) { a.settings = normSettings(b.settings); changed = true; }
  if (customChanged) rebuildCustom();
  return changed;
}
function payload() {
  return {v: 2, device: DEVICE, name: DEVNAME, updated: new Date().toISOString(),
    cards: S.cards, edits: S.edits, accept: S.accept, custom: S.custom, read: S.read, best: S.best, daily: S.daily, settings: S.settings};
}
async function syncNow() {
  if (!syncReady()) { onSyncChange(); return; }
  if (syncState.busy) { syncState.again = true; return; }
  if (!navigator.onLine) { syncState.err = "offline"; onSyncChange(); return; }
  syncState.busy = true;
  syncState.err = "";
  onSyncChange();
  try {
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
      let data;
      try { data = JSON.parse(await aesDec(memKey, await r.json())); } catch (e) { continue; }
      remoteCache[f.name] = {sha: f.sha, name: data.name, updated: data.updated};
      changed = mergeInto(S, normState(data)) || changed;
    }
    for (const k of Object.keys(remoteCache)) if (!names.has(k)) delete remoteCache[k];
    if (!names.has(own)) ownSha = null;
    lsSet("lbw.remote", remoteCache);
    if (changed) { lsSet("lbw.state", S); onRemoteChange(); }
    syncState.lastPull = Date.now();
    if (dirty || !ownSha) {
      const content = JSON.stringify({...(await aesEnc(memKey, JSON.stringify(payload()))), v: 2});
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
  onSyncChange();
  if (syncState.again) { syncState.again = false; syncNow(); }
}
function scheduleSync(ms = 6000) {
  clearTimeout(syncTimer);
  if (syncReady()) syncTimer = setTimeout(syncNow, ms);
}
function syncErrorText() {
  const e = syncState.err;
  if (!e) return "";
  if (e === "auth") return "GitHub 토큰이 만료됐거나 권한이 없어요. 새 토큰으로 다시 연결해 주세요.";
  if (e === "offline") return "인터넷에 연결되지 않았어요. 연결되면 자동으로 올려요.";
  return "동기화 오류: " + e;
}

// ------------------------------------------------------------ AI (Claude API, 브라우저에서 직접 호출)
const AI = {key: null};
async function loadAiKey() {
  const s = lsGet("lbw.ai");
  if (!s) { AI.key = null; return; }
  if (s.plain) AI.key = s.plain;
  else if (s.box && memKey) { try { AI.key = await aesDec(memKey, s.box, AAD_AI); } catch (e) { AI.key = null; } }
}
async function saveAiKey(k) {
  k = (k || "").trim();
  if (!k) { AI.key = null; lsSet("lbw.ai", null); return; }
  AI.key = k;
  lsSet("lbw.ai", memKey ? {box: await aesEnc(memKey, k, AAD_AI)} : {plain: k});
}
const hasAI = () => Boolean(AI.key);
const aiLocked = () => Boolean(!AI.key && lsGet("lbw.ai") && lsGet("lbw.ai").box);
const TUTOR = "너는 한국인 학습자의 일본어·영어 개인 튜터야. 학습자: SOFC(고체산화물 연료전지) 재료공학 대학원생, 영어는 CEFR B2(TOEIC 830) 수준으로 논문을 많이 읽음, 일본어는 완전 초보(히라가나부터 배우는 중). 항상 한국어로 답하고, 짧고 정확하게. 일본어를 쓸 때는 읽는 법(히라가나)과 로마자를 함께 적어. 확실하지 않은 건 확실하지 않다고 말해.";

async function claude({system, messages, schema, maxTokens = 2000, effort = "low"}) {
  if (!AI.key) throw new Error("AI 키가 없어요. 설정 → AI에서 Claude API 키를 넣어 주세요.");
  const model = S.settings.aiModel;
  const body = {model, max_tokens: maxTokens, messages, output_config: {effort}};
  if (system) body.system = system;
  if (schema) body.output_config.format = {type: "json_schema", schema};
  const headers = {"content-type": "application/json", "x-api-key": AI.key, "anthropic-version": "2026-10-21", "anthropic-dangerous-direct-browser-access": "true"};
  if (model === "claude-opus-5-5") { headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; body.fallbacks = "default"; }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  let r;
  try { r = await fetch("https://api.anthropic.com/v1/messages", {method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal}); }
  catch (e) { throw new Error(e.name === "AbortError" ? "AI 응답이 너무 오래 걸려요." : "AI 서버에 연결하지 못했어요. 인터넷을 확인해 주세요."); }
  finally { clearTimeout(timer); }
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const m = (j && j.error && j.error.message) || "";
    if (r.status === 401) throw new Error("API 키가 맞지 않아요.");
    if (r.status === 429) throw new Error("요청이 많아 잠시 막혔어요. 조금 뒤 다시 해 주세요.");
    if (/credit|balance|billing/i.test(m)) throw new Error("API 크레딧이 부족해요. console.anthropic.com에서 충전해 주세요.");
    throw new Error(`AI 오류 (${r.status}) ${m}`);
  }
  if (j.stop_reason === "refusal") throw new Error("AI가 이 요청에는 답하지 않았어요.");
  if (j.stop_reason === "max_tokens") throw new Error("AI 답이 너무 길어서 잘렸어요. 개수나 길이를 줄여 주세요.");
  const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let json = null;
  if (schema) { try { json = JSON.parse(text); } catch (e) { throw new Error("AI 답을 읽지 못했어요. 다시 해 주세요."); } }
  return {message: j, text, json};
}
const obj = (props) => ({type: "object", properties: props, required: Object.keys(props), additionalProperties: false});
const STR = {type: "string"};
const JUDGE_SCHEMA = obj({correct: {type: "boolean"}, reason: STR});
let aiCache = lsGet("lbw.aicache", {});
async function aiJudge(kind, c, typed) {
  const key = `${kind}|${c.id}|${typed}`;
  if (aiCache[key]) return aiCache[key];
  let prompt;
  if (kind === "translate") {
    prompt = `학습자가 아래 영어 문장을 한국어로 해석했어. 핵심 의미가 맞으면 정답이야 (표현이 달라도, 조금 어색해도 괜찮아). 중요한 내용이 빠지거나 틀리면 오답.\n문장: ${c.word}\n모범 해석: ${c.ko}\n학습자 해석: ${typed}\nreason에는 한국어 한 문장으로 판단 이유(틀렸으면 무엇이 틀렸는지)를 써.`;
  } else {
    const what = c.lang === "ja" ? `일본어 단어: ${c.word} (읽기: ${c.kana || ""})` : `영어: ${c.word}${c.pos ? ` (${c.pos})` : ""}${c.def ? ` — ${c.def}` : ""}`;
    prompt = `단어 학습 앱의 뜻 채점이야. 학습자가 적은 한국어 뜻이 이 단어의 뜻으로 맞는지 판단해. 동의어·비슷한 표현·품사가 조금 다른 것(예: '분석'과 '분석하다')은 정답. 다른 단어의 뜻이거나 핵심이 틀리면 오답.\n${what}\n앱에 저장된 뜻: ${c.ko}\n학습자 답: ${typed}\nreason에는 한국어 한 문장으로 이유를 써.`;
  }
  const {json} = await claude({messages: [{role: "user", content: prompt}], schema: JUDGE_SCHEMA, maxTokens: 1500, effort: "low"});
  aiCache[key] = json;
  const keys = Object.keys(aiCache);
  if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete aiCache[k];
  lsSet("lbw.aicache", aiCache);
  return json;
}
