"use strict";
// LiBird Words — 공부 화면: 질문 만들기 · 채점 · 오늘의 학습 · 자유 복습

// ------------------------------------------------------------ 질문
const shortKo = (ko) => String(ko || "").split(/\s*;\s*/).slice(0, 2).join("; ");
const LABEL = {
  romaji: (x) => x.romaji, kana: (x) => x.ch, meaning: (x) => shortKo(x.ko), reading: (x) => x.word,
  spell: (x) => x.word, translate: (x) => x.ko, cloze: (x) => x.key
};
function dirFor(c) {
  const d = S.settings.dir[c.lang];
  return d === "mix" ? (Math.random() < 0.5 ? "fwd" : "rev") : d;
}
function distractors(c, kind, n = 3) {
  const labelOf = LABEL[kind], own = labelOf(c);
  const same = shuffle([...(BY_GROUP[c.group] || [])]).map(card);
  const more = shuffle(Object.keys(CARDS).filter((id) => CARDS[id].lang === c.lang && CARDS[id].type === c.type && CARDS[id].group !== c.group)).slice(0, 60).map(card);
  const out = [], seen = new Set([own]);
  for (const x of [...same, ...more]) {
    if (!x || x.id === c.id) continue;
    const l = labelOf(x);
    if (!l || seen.has(l)) continue;
    seen.add(l);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}
function makeQ(id) {
  const c = card(id);
  let dir = dirFor(c);
  if (c.type === "sent" && dir === "rev" && !(c.key && c.word.includes(c.key))) dir = "fwd";
  const kind = c.type === "kana" ? (dir === "fwd" ? "romaji" : "kana")
    : c.type === "word" ? (dir === "fwd" ? "meaning" : "reading")
    : c.type === "sent" ? (dir === "fwd" ? "translate" : "cloze")
    : (dir === "fwd" ? "meaning" : "spell");
  let mode = S.settings.mode[c.lang];
  if (kind === "kana" && mode === "type") mode = "choice";
  if (kind === "translate" && mode === "type" && !hasAI()) mode = "self";
  const q = {id, c, dir, kind, mode, hints: 0};
  if (mode === "choice") {
    const opts = [c, ...distractors(c, kind)];
    if (opts.length < 2) q.mode = "self";
    else q.choices = shuffle(opts).map((x) => ({id: x.id, label: LABEL[kind](x), sub: kind === "romaji" ? x.ko : ""}));
  }
  return q;
}
function jpWordHTML(c, big = true) {
  const w = hasKanji(c.word) && S.settings.furigana && c.kana && c.kana !== c.word ? `<ruby>${esc(c.word)}<rt>${esc(c.kana)}</rt></ruby>` : esc(c.word);
  return `<div class="word jp${big && c.word.length > 8 ? " long" : ""}">${w}</div>`;
}
function spellHint(word, shown = 1) {
  let i = 0;
  return String(word).replace(/\(.*?\)/g, "").trim().split("").map((ch) => {
    if (!/[a-z]/i.test(ch)) return ch === " " ? "  " : ch;
    return i++ < shown ? ch : "_";
  }).join(" ");
}
function clozeHTML(c, reveal = false) {
  const i = c.word.indexOf(c.key);
  if (i < 0) return esc(c.word);
  return esc(c.word.slice(0, i)) + (reveal ? `<mark>${esc(c.key)}</mark>` : `<span class="blank">${"_".repeat(Math.min(14, c.key.length))}</span>`) + esc(c.word.slice(i + c.key.length));
}
const ASK_TEXT = {romaji: "어떻게 읽을까요?", kana: "어떤 글자일까요?", meaning: "무슨 뜻일까요?", reading: "일본어로 뭘까요?", spell: "영어로 쓰면?", translate: "해석해 보세요", cloze: "빈칸에 들어갈 표현은?"};
const PLACEHOLDER = {romaji: "로마자로 (예: ka) 또는 한글로", meaning: "뜻을 한국어로", reading: "가나 또는 로마자로 (예: neko)", spell: "영어 단어", translate: "한국어로 해석", cloze: "빈칸 표현"};
function promptHTML(q) {
  const c = q.c;
  switch (q.kind) {
    case "romaji": return `<div class="glyph">${esc(c.ch)}</div>`;
    case "kana": return `<div class="word">${esc(c.romaji)}</div><div class="hint">${esc(c.ko)}</div>`;
    case "meaning": return c.type === "word" ? jpWordHTML(c) : `<div class="word en${c.word.length > 18 ? " long" : ""}">${esc(c.word)}</div>${c.pos ? `<div class="pos">${esc(c.pos)}</div>` : ""}`;
    case "reading": return `<div class="word">${esc(shortKo(c.ko))}</div>`;
    case "spell": return `<div class="word">${esc(shortKo(c.ko))}</div>${c.pos ? `<div class="pos">${esc(c.pos)}</div>` : ""}<div class="hint mono">${esc(spellHint(c.word, 1 + q.hints))}</div>`;
    case "translate": return `<div class="sentence">${esc(c.word)}</div>`;
    case "cloze": return `<div class="sentence">${clozeHTML(c)}</div><div class="hint">${esc(c.ko)}</div>`;
  }
  return "";
}
function dictLinks(c) {
  const raw = c.type === "kana" ? c.ch : c.type === "sent" ? (c.key || "") : String(c.word).replace(/\(.*?\)/g, " ").replace(/~/g, "").trim();
  const q = encodeURIComponent(raw);
  if (c.lang === "en") return `<div class="links"><a href="https://en.dict.naver.com/#/search?query=${q}" target="_blank" rel="noopener">네이버 영어사전</a><a href="https://dictionary.cambridge.org/dictionary/english/${q}" target="_blank" rel="noopener">Cambridge</a><a href="https://www.google.com/search?q=%22${q}%22+site%3Asciencedirect.com" target="_blank" rel="noopener">논문 용례</a></div>`;
  return `<div class="links"><a href="https://ja.dict.naver.com/#/search?query=${q}" target="_blank" rel="noopener">네이버 일본어사전</a><a href="https://jisho.org/search/${q}" target="_blank" rel="noopener">Jisho</a></div>`;
}
function speakText(c) {
  if (c.type === "kana") return c.ch;
  if (c.type === "word") return c.kana || c.word;
  return c.word;
}
const spkBtn = (text, lang) => `<button type="button" class="speak" data-act="speak" data-lang="${lang}" data-text="${esc(text)}" aria-label="발음 듣기">${ICON.sound}</button>`;
function answerHTML(c, q) {
  const acc = accepted(c.id);
  const accHTML = acc.length ? `<dt>인정한 답</dt><dd class="muted">${acc.map(esc).join(", ")}</dd>` : "";
  if (c.type === "kana") {
    return `<div class="answer"><div class="main">${q && q.kind === "kana" ? `<span class="jp" style="font-size:44px">${esc(c.ch)}</span> ` : ""}${esc(c.romaji)} · ${esc(c.ko)} ${spkBtn(c.ch, "ja")}</div>
      ${c.tip ? `<div class="def">${esc(c.tip)}</div>` : ""}</div>`;
  }
  if (c.type === "word") {
    return `<div class="answer">${q && q.kind === "reading" ? jpWordHTML(c) : ""}<div class="main">${esc(c.ko)}</div>
      <div class="reading"><span class="jp">${esc(c.kana || c.word)}</span> · ${esc(c.romaji || "")} ${spkBtn(c.kana || c.word, "ja")}</div>
      <dl>${c.ex ? `<div><dt>예문</dt><dd class="ex"><div class="jp">${esc(c.ex)} ${spkBtn(c.exKana || c.ex, "ja")}</div>${c.exKana ? `<div class="muted small jp">${esc(c.exKana)}</div>` : ""}<div class="small">${esc(c.exKo || "")}</div></dd></div>` : ""}
      ${c.tip ? `<div><dt>팁</dt><dd>${esc(c.tip)}</dd></div>` : ""}${accHTML}</dl>${dictLinks(c)}</div>`;
  }
  if (c.type === "sent") {
    return `<div class="answer">${q && q.kind === "cloze" ? `<div class="sentence small-s">${clozeHTML(c, true)} ${spkBtn(c.word, "en")}</div>` : ""}
      <div class="main ko-s">${esc(c.ko)}</div>
      <dl>${c.key ? `<div><dt>핵심 표현</dt><dd><b>${esc(c.key)}</b> — ${esc(c.keyKo || "")}</dd></div>` : ""}
      ${c.tip ? `<div><dt>팁</dt><dd>${esc(c.tip)}</dd></div>` : ""}</dl>${dictLinks(c)}</div>`;
  }
  return `<div class="answer">${q && q.kind === "spell" ? `<div class="word en">${esc(c.word)}</div>` : ""}<div class="main">${esc(c.ko)} ${spkBtn(c.word, "en")}</div>
    ${c.def ? `<div class="def">${esc(c.def)}</div>` : ""}
    <dl>${c.forms ? `<div><dt>관련 형태</dt><dd>${esc(c.forms)}</dd></div>` : ""}
    ${c.ex ? `<div><dt>예문</dt><dd class="ex">${esc(c.ex)} ${spkBtn(c.ex, "en")}<div class="muted small">${esc(c.exKo || "")}</div></dd></div>` : ""}
    ${c.tip ? `<div><dt>팁</dt><dd>${esc(c.tip)}</dd></div>` : ""}${accHTML}</dl>${dictLinks(c)}</div>`;
}

// ------------------------------------------------------------ 채점
async function evaluate(q, input) {
  const c = q.c, t = String(input || "").trim();
  if (!t) return {ok: false, by: "skip"};
  let v;
  switch (q.kind) {
    case "romaji": v = romajiNorm(t) === romajiNorm(c.romaji) || t.replace(/\s/g, "") === c.ko ? {ok: true, by: "exact"} : {ok: false, by: "local"}; break;
    case "meaning": v = checkMeaning(c, t); break;
    case "reading": v = checkReading(c, t); break;
    case "spell": v = checkSpell(c.word, t); break;
    case "cloze": v = checkSpell(c.key, t); break;
    case "translate": v = {ok: false, by: "local"}; break;
    default: v = {ok: false, by: "local"};
  }
  if (!v.ok && (q.kind === "meaning" || q.kind === "translate") && hasAI()) {
    try {
      const j = await aiJudge(q.kind, c, t);
      v = {ok: j.correct, by: "ai", reason: j.reason};
      if (j.correct && q.kind === "meaning") addAccepted(c.id, t);
    } catch (e) { v.aiErr = e.message; }
  }
  if (q.hints && v.ok) v.near = true;
  return v;
}
const recGrade = (v) => !v || v.ok == null ? 0 : !v.ok ? 1 : v.near ? 2 : 3;

// ------------------------------------------------------------ 세션 (오늘의 학습 · 자유 복습)
let ctx = {};
function startStudy(lang, {extra = 0, group = null} = {}) {
  const due = shuffle(dueIds(lang, group));
  const fresh = shuffle(newIds(lang, extra, group));
  const queue = [];
  while (due.length || fresh.length) {
    for (let i = 0; i < 3 && due.length; i++) queue.push(due.shift());
    if (fresh.length) queue.push(fresh.shift());
  }
  if (!queue.length) {
    if (group) { toast("이 단어장에 지금 공부할 카드가 없어요. 자유 복습을 해 보세요."); return; }
    openDoneModal(lang);
    return;
  }
  beginSession({kind: "srs", lang, ids: queue, title: group ? GROUPS[group].name : "오늘의 학습"});
}
function beginSession({kind, lang, ids, title}) {
  stopSpeak();
  go("study", {kind, lang, title, queue: ids.slice(), later: [], cur: null, q: null, phase: "ask", input: "", verdict: null, picked: null,
    done: 0, ok: 0, total: ids.length, start: Date.now(), shownAt: 0, newCount: 0});
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
  ctx.q = id ? makeQ(id) : null;
  ctx.phase = "ask";
  ctx.input = "";
  ctx.verdict = null;
  ctx.picked = null;
  ctx.shownAt = Date.now();
  render();
  if (id) focusAnswer();
  else finishSession();
}
function focusAnswer() {
  const el = $("#ans");
  if (el && matchMedia("(hover: hover)").matches) el.focus();
}
async function submitAnswer(input) {
  if (ctx.phase !== "ask" || !ctx.q) return;
  const q = ctx.q;
  ctx.input = String(input || "").trim();
  if (!ctx.input) { giveUp(); return; }
  const mayAI = (q.kind === "meaning" || q.kind === "translate") && hasAI();
  if (mayAI) { ctx.phase = "checking"; render(); }
  const v = await evaluate(q, ctx.input);
  if (ctx.q !== q) return;
  reveal(v);
}
function choose(id) {
  if (ctx.phase !== "ask" || !ctx.q || !ctx.q.choices) return;
  const q = ctx.q, pick = q.choices.find((x) => x.id === id);
  ctx.picked = id;
  ctx.input = pick ? pick.label : "";
  reveal({ok: id === q.id || (pick && pick.label === LABEL[q.kind](q.c)), by: "choice"});
}
function giveUp() { reveal({ok: false, by: "skip"}); }
function selfReveal() { reveal(null); }
function reveal(v) {
  ctx.verdict = v;
  ctx.phase = "shown";
  render();
  if (v && v.ok === false && v.by !== "skip") {
    const f = $(".flash");
    if (f) { f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); }
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* 진동 없음 */ }
  }
  const c = ctx.q.c;
  if (S.settings.autoSpeak && c.type !== "sent") speak(speakText(c), c.lang, {quiet: true});
}
function acceptMine() {
  if (!ctx.q || !ctx.input) return;
  addAccepted(ctx.q.c.id, ctx.input);
  ctx.verdict = {ok: true, by: "mine"};
  render();
  toast("내 답을 정답으로 인정했어요. 다음부터 자동으로 맞게 채점해요.");
}
function hint() {
  if (ctx.phase !== "ask" || !ctx.q) return;
  const q = ctx.q, c = q.c;
  q.hints++;
  if (q.kind === "spell" || q.kind === "cloze") { render(); focusAnswer(); return; }
  const ans = q.kind === "romaji" ? c.romaji : q.kind === "reading" ? (c.kana || c.word) : shortKo(c.ko);
  toast(`힌트: ${ans.slice(0, q.hints)}${"○".repeat(Math.max(0, Math.min(6, ans.length - q.hints)))}`);
}
function lapse() {
  const sec = Math.min(60, (Date.now() - ctx.shownAt) / 1000);
  bump(ctx.lang === "ja" ? "sja" : "sen", Math.round(sec));
}
function grade(g) {
  if (ctx.phase !== "shown" || ctx.kind !== "srs") return;
  const id = ctx.cur, c = CARDS[id];
  const wasNew = isNew(id);
  const r = schedule(rec(id), g);
  S.cards[id] = r;
  if (wasNew) { bump(poolOf(c)); ctx.newCount++; }
  else bump(c.lang === "ja" ? "rja" : "ren");
  bump((g >= 2 ? "o" : "b") + c.lang);
  lapse();
  save();
  ctx.done++;
  if (g >= 2) ctx.ok++;
  if (r.s === "learn" && r.due < Date.now() + 30 * MIN) ctx.later.push(id);
  nextCard();
}
function freeAnswer(knew) {
  if (ctx.phase !== "shown" || ctx.kind !== "free") return;
  bump(ctx.lang === "ja" ? "fja" : "fen");
  lapse();
  save(false);
  ctx.done++;
  if (knew) ctx.ok++;
  else ctx.queue.splice(Math.min(3, ctx.queue.length), 0, ctx.cur);
  nextCard();
}
function finishSession() {
  if (ctx.kind === "srs" || ctx.kind === "free") { save(); if (syncReady()) syncNow(); }
}

VIEWS.study = () => {
  if (!ctx.cur) return finishHTML();
  const q = ctx.q, c = q.c, r = rec(c.id);
  const left = ctx.queue.length + ctx.later.length + 1;
  const pct = Math.round((ctx.done / (ctx.done + left)) * 100);
  const chip = ctx.kind === "free" ? `<span class="chip">자유 복습</span>` : isNew(c.id) ? `<span class="chip new">새 항목</span>`
    : r && r.s === "learn" ? `<span class="chip learn">익히는 중</span>` : `<span class="chip review">복습</span>`;
  const shown = ctx.phase === "shown";
  const canSpeak = shown || ["romaji", "meaning", "translate"].includes(q.kind);
  let body = "";
  if (ctx.phase === "ask") body = askHTML(q);
  else if (ctx.phase === "checking") body = `<div class="checking"><span class="spinner"></span>AI가 채점하고 있어요…</div>`;
  else body = (q.mode === "choice" ? optionsHTML(q, true) : "") + verdictHTML(ctx.verdict) + answerHTML(c, q);
  return `<div class="s-top"><button class="icon-btn" data-act="quit" aria-label="그만하기">${ICON.close}</button>
      <div class="prog"><i style="width:${pct}%"></i></div><span class="cnt">${ctx.done}/${ctx.done + left}</span></div>
    <div class="flash"><div class="meta"><div class="row">${chip}<span class="muted small">${esc((GROUPS[c.group] || {}).name || "")}</span></div>
      ${canSpeak ? `<button class="icon-btn" data-act="speak" data-lang="${c.lang}" data-text="${esc(speakText(c))}" aria-label="발음 듣기">${ICON.sound}</button>` : ""}</div>
      <div class="face">${promptHTML(q)}${ctx.phase === "ask" ? `<div class="hint">${ASK_TEXT[q.kind]}</div>` : ""}</div>${body}</div>
    ${shown ? (ctx.kind === "srs" ? gradeHTML(c.id) : freeHTML()) : ""}
    ${shown ? `<div class="tools-row"><button class="btn ghost sm" data-act="chat-card" data-id="${esc(c.id)}">${ICON.spark} AI에게 묻기</button>
      <button class="btn ghost sm" data-act="edit" data-id="${esc(c.id)}">${ICON.edit} 고치기</button></div>` : ""}
    <div class="kbd">${kbdText(q)}</div>`;
};
function kbdText(q) {
  if (ctx.phase === "shown") return ctx.kind === "srs" ? "키보드: Enter 추천 버튼 · 1 다시 · 2 어려움 · 3 좋음 · 4 쉬움" : "키보드: Enter 추천 · 1 몰랐어요 · 2 알았어요";
  if (q.mode === "choice") return "키보드: 1~4로 고르기";
  if (q.mode === "self") return "키보드: Space로 정답 보기";
  return "키보드: Enter 확인 · Esc 모르겠어요";
}
function askHTML(q) {
  if (q.mode === "choice") return optionsHTML(q, false);
  if (q.mode === "self") return `<button class="btn pri big" data-act="show">정답 보기</button>`;
  const jpInput = q.kind === "reading";
  return `<form class="ans-form" id="ans-form" autocomplete="off"><input id="ans" type="text" placeholder="${PLACEHOLDER[q.kind] || "답"}" autocapitalize="off" spellcheck="false" ${jpInput ? 'lang="ja"' : ""} enterkeyhint="done">
      <button class="btn pri" type="submit">확인</button></form>
    <div class="under"><button class="btn ghost sm" type="button" data-act="hint">${ICON.bulb} 힌트</button><button class="btn ghost sm" type="button" data-act="giveup">모르겠어요</button></div>`;
}
function optionsHTML(q, shown) {
  const jp = q.kind === "kana" || (q.kind === "reading");
  return `<div class="options${q.kind === "translate" || q.kind === "meaning" && q.c.type === "sent" ? " wide" : ""}">${q.choices.map((o, i) => {
    let cls = jp ? "jp" : "";
    if (shown) { if (o.id === q.id) cls += " right"; else if (o.id === ctx.picked) cls += " wrong"; }
    return `<button type="button" class="${cls}" data-act="choose" data-id="${esc(o.id)}" ${shown ? "disabled" : ""}><span class="num">${i + 1}</span>${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</button>`;
  }).join("")}</div>`;
}
function verdictHTML(v) {
  if (!v) return "";
  const mine = ctx.input && ctx.q.mode !== "choice" ? `<small>내 답: ${esc(ctx.input)}</small>` : "";
  if (v.ok == null) return "";
  if (v.ok) {
    const how = v.by === "ai" ? "AI 채점: 맞아요" : v.by === "mine" ? "정답으로 인정했어요" : v.by === "typo" ? "정답! (오타는 봐줬어요)" : v.by === "part" ? "정답! (핵심이 맞아요)" : "정답!";
    return `<div class="verdict ok${v.by === "ai" ? " ai" : ""}"><span class="vi">${v.by === "ai" ? ICON.spark : "✓"}</span><div><b>${how}</b>${mine}${v.reason ? `<small>${esc(v.reason)}</small>` : ""}</div></div>`;
  }
  if (v.by === "skip") return `<div class="verdict bad"><span class="vi">?</span><div><b>정답을 확인해 보세요</b></div></div>`;
  const canAccept = ctx.q.mode === "type" && ["meaning", "translate", "reading", "spell", "romaji"].includes(ctx.q.kind);
  return `<div class="verdict bad${v.by === "ai" ? " ai" : ""}"><span class="vi">✕</span><div><b>${v.by === "ai" ? "AI 채점: 아쉬워요" : "아쉬워요"}</b>${mine}${v.reason ? `<small>${esc(v.reason)}</small>` : ""}${v.aiErr ? `<small class="err">AI 채점 실패: ${esc(v.aiErr)}</small>` : ""}</div>
    ${canAccept ? `<button class="btn sm act" data-act="accept-mine">내 답도 맞아요</button>` : ""}</div>`;
}
function gradeHTML(id) {
  const now = Date.now(), r = rec(id), best = recGrade(ctx.verdict);
  const names = ["다시", "어려움", "좋음", "쉬움"];
  return `<div class="grades${best ? " dim" : ""}">${[1, 2, 3, 4].map((g) => `<button type="button" class="g${g}${g === best ? " rec" : ""}" data-act="grade" data-g="${g}"><span>${names[g - 1]}</span><small>${fmtGap(schedule(r, g, now).due - now)}</small></button>`).join("")}</div>`;
}
function freeHTML() {
  const v = ctx.verdict, best = !v || v.ok == null ? 0 : v.ok ? 2 : 1;
  return `<div class="free-btns"><button class="btn big bad${best === 1 ? " rec" : ""}" data-act="free-no">몰랐어요</button><button class="btn big good${best === 2 ? " rec" : ""}" data-act="free-yes">알았어요</button></div>`;
}
function finishHTML() {
  const sec = Math.round((Date.now() - ctx.start) / 1000);
  const acc = ctx.done ? Math.round((ctx.ok / ctx.done) * 100) : 0;
  const tomorrow = Object.keys(S.cards).filter((id) => CARDS[id] && CARDS[id].lang === ctx.lang && S.cards[id].s === "review" && startOfDay(S.cards[id].due) === startOfDay(Date.now() + DAY)).length;
  const emoji = acc >= 90 ? "🏆" : acc >= 70 ? "🎉" : "💪";
  return `<div class="box finish anim"><div class="big">${emoji}</div><h2>${ctx.kind === "free" ? "자유 복습 끝!" : "이번 공부 끝!"}</h2>
    <div class="sumgrid"><div><b>${ctx.done}</b><span>본 카드</span></div><div><b>${acc}%</b><span>${ctx.kind === "free" ? "알았어요" : "맞힌 비율"}</span></div>
    <div><b>${Math.floor(sec / 60)}분 ${sec % 60}초</b><span>걸린 시간</span></div><div><b>${ctx.kind === "srs" ? ctx.newCount : tomorrow}</b><span>${ctx.kind === "srs" ? "새로 배운 카드" : "내일 복습 예정"}</span></div></div>
    <div class="btn-row"><button class="btn" data-act="free" data-lang="${ctx.lang}">자유 복습</button><button class="btn pri" data-act="home">홈으로</button></div></div>`;
}

// ------------------------------------------------------------ 자유 복습 고르기 · 오늘 끝
function learnedIds(lang) { return Object.keys(S.cards).filter((id) => CARDS[id] && CARDS[id].lang === lang && ["learn", "review"].includes(S.cards[id].s)); }
function freeScopes(lang) {
  const learned = learnedIds(lang), today = startOfDay(Date.now());
  return {
    today: learned.filter((id) => (S.cards[id].t || 0) >= today),
    week: learned.filter((id) => (S.cards[id].t || 0) >= today - 6 * DAY),
    wrong: learned.filter((id) => (S.cards[id].wrong || 0) + (S.cards[id].lapses || 0) > 0).sort((a, b) => ((S.cards[b].wrong || 0) - (S.cards[a].wrong || 0))),
    all: learned
  };
}
function openFreeModal(lang) {
  const s = freeScopes(lang);
  const row = (k, title, sub) => `<button class="choice" data-act="free-go" data-scope="${k}" data-lang="${lang}" ${s[k].length ? "" : "disabled"}><span><b>${title}</b><small>${sub}</small></span><span class="chip">${s[k].length}</span></button>`;
  const groups = Object.values(GROUPS).filter((g) => g.lang === lang && (BY_GROUP[g.id] || []).some((id) => S.cards[id] && ["learn", "review"].includes(S.cards[id].s)));
  openModal(`<h2>자유 복습 <span class="chip">일정에 영향 없음</span></h2>
    <p class="sub">복습 날짜와 상관없이 다시 볼 수 있어요. 결과는 복습 일정을 바꾸지 않아요.</p>
    ${row("today", "오늘 본 카드", "방금 공부한 것 한 번 더")}${row("week", "최근 7일", "이번 주에 본 카드")}
    ${row("wrong", "자주 틀린 카드", "'다시'를 누른 적 있는 카드")}${row("all", "배운 카드 전체", "무작위로 30장")}
    ${groups.length ? `<h3>단어장 골라서</h3><div class="row">${groups.map((g) => `<button class="btn sm" data-act="free-go" data-scope="group" data-group="${g.id}" data-lang="${lang}">${esc(g.name)}</button>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="close">닫기</button></div>`);
}
function startFree(lang, scope, group) {
  let ids = scope === "group" ? (BY_GROUP[group] || []).filter((id) => S.cards[id] && ["learn", "review"].includes(S.cards[id].s)) : freeScopes(lang)[scope] || [];
  ids = scope === "wrong" ? ids.slice(0, 30) : shuffle(ids.slice()).slice(0, 30);
  if (!ids.length) { toast("복습할 카드가 없어요."); return; }
  closeModal();
  beginSession({kind: "free", lang, ids: scope === "wrong" ? shuffle(ids) : ids, title: "자유 복습"});
}
function openDoneModal(lang) {
  openModal(`<div class="center"><div style="font-size:52px">🎉</div><h2 style="justify-content:center">오늘 ${LANGS[lang].name} 끝!</h2>
    <p class="sub">오늘 할 복습과 새 항목을 다 했어요. 더 하고 싶다면:</p></div>
    <button class="choice" data-act="study-more" data-lang="${lang}"><span><b>새 항목 5개 더</b><small>오늘 목표를 넘어서 더 배우기</small></span>${ICON.chev}</button>
    <button class="choice" data-act="free" data-lang="${lang}"><span><b>자유 복습</b><small>일정과 상관없이 다시 보기</small></span>${ICON.chev}</button>
    <button class="choice" data-act="tab" data-tab="games"><span><b>게임으로 복습</b><small>짝 맞추기 · 스피드 퀴즈</small></span>${ICON.chev}</button>
    <div class="row" style="margin-top:8px"><button class="btn ghost" data-act="close">닫기</button></div>`);
}

// ------------------------------------------------------------ 아는 단어 거르기
function startSort(group = null) {
  const list = (group ? [group] : Object.values(GROUPS).filter((g) => g.lang === LANG && groupOn(g.id)).map((g) => g.id))
    .flatMap((g) => (BY_GROUP[g] || []).filter(isNew));
  if (!list.length) { toast("거를 새 항목이 없어요."); return; }
  go("sort", {list, i: 0, known: 0, peek: false});
}
VIEWS.sort = () => {
  const id = ctx.list[ctx.i];
  if (!id) return `<div class="box finish anim"><div class="big">✅</div><h2>다 걸렀어요</h2><p class="sub">아는 항목 ${ctx.known}개를 학습에서 뺐어요.</p><button class="btn pri" data-act="home">홈으로</button></div>`;
  const c = card(id);
  const front = c.type === "kana" ? `<div class="glyph">${esc(c.ch)}</div>` : c.type === "word" ? jpWordHTML(c) : c.type === "sent" ? `<div class="sentence">${esc(c.word)}</div>` : `<div class="word en">${esc(c.word)}</div>${c.pos ? `<div class="pos">${esc(c.pos)}</div>` : ""}`;
  return `<div class="s-top"><button class="icon-btn" data-act="home" aria-label="끝내기">${ICON.close}</button>
      <div class="prog"><i style="width:${Math.round((ctx.i / ctx.list.length) * 100)}%"></i></div><span class="cnt">${ctx.i + 1}/${ctx.list.length}</span></div>
    <div class="flash"><div class="meta"><span class="chip">아는 단어 거르기 · 뺀 ${ctx.known}개</span>${spkBtn(speakText(c), c.lang)}</div>
      <div class="face">${front}${ctx.peek ? `<div class="answer"><div class="main">${esc(c.ko)}</div>${c.def ? `<div class="def">${esc(c.def)}</div>` : ""}</div>` : `<button class="btn ghost sm" data-act="peek" style="margin-top:14px">뜻 확인</button>`}</div></div>
    <div class="free-btns"><button class="btn big" data-act="sort-no">몰라요 · 배울래요</button><button class="btn big pri" data-act="sort-yes">알아요 · 빼기</button></div>
    <div class="kbd">키보드: ← 몰라요 · → 알아요 · Space 뜻 확인</div>`;
};
function sortAnswer(known) {
  const id = ctx.list[ctx.i];
  if (!id) return;
  if (known) { S.cards[id] = {s: "known", t: Date.now()}; ctx.known++; save(); }
  ctx.i++;
  ctx.peek = false;
  render();
}
