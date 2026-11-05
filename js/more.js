"use strict";
// LiBird Words — 읽기 · 게임 · 통계 · 설정 · AI 대화

// ============================================================ 읽기
const passageList = (lang) => [
  ...Object.values(S.custom.passages).filter((p) => !p.del && p.lang === lang).sort((a, b) => (b.created || 0) - (a.created || 0)),
  ...(D.passages || []).filter((p) => p.lang === lang)
];
const passageById = (id) => (D.passages || []).find((p) => p.id === id) || (S.custom.passages[id] && !S.custom.passages[id].del ? S.custom.passages[id] : null);
const fullText = (p) => p.paras.map((x) => x.text).join(" ");
function passageSize(p) {
  const t = fullText(p);
  if (p.lang === "en") { const n = (t.match(/[A-Za-z]+/g) || []).length; return `${n}단어 · 약 ${Math.max(1, Math.round(n / 130))}분`; }
  return `${t.replace(/\s/g, "").length}자 · 약 ${Math.max(1, Math.round(t.length / 150))}분`;
}
VIEWS.read = () => {
  const list = passageList(LANG);
  return `<div class="hello"><div><div class="date">${LANGS[LANG].name}</div><h1>읽기</h1></div></div>
    <p class="sub">한 문단 글을 읽고, 듣고, 해석을 보고, 문제를 풀어요. ${LANG === "en" ? "모르는 단어는 눌러서 바로 단어장에 넣을 수 있어요." : "문장을 누르면 읽어줘요. 표시된 단어는 눌러서 뜻을 볼 수 있어요."}</p>
    <div class="btn-row"><button class="btn pri" data-act="p-new-ai">${ICON.spark} AI로 글 만들기</button><button class="btn" data-act="p-paste">${ICON.plus} 직접 붙여넣기</button></div>
    <div class="plist">${list.map((p) => {
      const read = S.read[p.id];
      return `<button class="pcard" data-act="passage" data-id="${esc(p.id)}"><div class="pc-top"><span class="chip">${esc(p.level || "")}</span>${p.ai ? `<span class="chip new">AI</span>` : ""}${p.mine ? `<span class="chip">내 글</span>` : ""}${read ? `<span class="chip review">✓ 읽음</span>` : ""}</div>
        <b class="${p.lang === "ja" ? "jp" : ""}">${esc(p.title)}</b>${p.titleKo ? `<span class="muted small">${esc(p.titleKo)}</span>` : ""}
        <span class="muted small">${esc(p.topic || "")}${p.topic ? " · " : ""}${passageSize(p)}</span></button>`;
    }).join("") || `<div class="empty-state">아직 글이 없어요.</div>`}</div>`;
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function splitSentences(text, lang) {
  const re = lang === "ja" ? /[^。！？!?]+[。！？!?」]*\s*/g : /[^.!?]+(?:[.!?]+["')\]]*)\s*|[^.!?]+$/g;
  return (String(text).match(re) || [text]).filter((s) => s.trim());
}
function markSentence(s, p) {
  const terms = (p.glossary || []).map((g) => g.w).filter(Boolean).sort((a, b) => b.length - a.length);
  const ranges = [];
  for (const t of terms) {
    const re = new RegExp(p.lang === "en" ? `\\b${escapeRe(t)}\\b` : escapeRe(t), p.lang === "en" ? "gi" : "g");
    let m;
    while ((m = re.exec(s))) {
      const a = m.index, b = a + m[0].length;
      if (!ranges.some(([x, y]) => a < y && b > x)) ranges.push([a, b, t]);
      if (!m[0].length) break;
    }
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const plain = (txt) => p.lang === "en" ? txt.split(/([A-Za-z][A-Za-z'’-]*)/).map((part, i) => i % 2 ? `<span class="tw" data-act="w" data-w="${esc(part)}">${esc(part)}</span>` : esc(part)).join("") : esc(txt);
  let out = "", pos = 0;
  for (const [a, b, t] of ranges) {
    out += plain(s.slice(pos, a)) + `<mark class="gl" data-act="gl" data-w="${esc(t)}">${esc(s.slice(a, b))}</mark>`;
    pos = b;
  }
  return out + plain(s.slice(pos));
}
VIEWS.reader = () => {
  const p = passageById(ctx.pid);
  if (!p) return `<div class="empty-state">글을 찾지 못했어요.</div>`;
  const size = S.settings.readSize || 18;
  let k = 0;
  const paras = p.paras.map((x, i) => {
    const sents = splitSentences(x.text, p.lang).map((s) => `<span class="sent" data-k="${k++}" data-text="${esc(s.trim())}" ${p.lang === "ja" ? 'data-act="say"' : ""}>${markSentence(s, p)}</span>`).join("");
    return `<div class="para"><p class="${p.lang === "ja" ? "jp" : ""}" style="font-size:${size}px">${sents}</p>
      ${p.lang === "ja" && ctx.kana && x.kana ? `<p class="kana-line jp">${esc(x.kana)}</p>` : ""}
      ${ctx.ko ? (x.ko ? `<p class="ko-line">${esc(x.ko)}</p>` : `<button class="btn soft sm" data-act="ai-study" data-id="${esc(p.id)}">${ICON.spark} AI로 해석·문제 만들기</button>`) : ""}</div>`;
  }).join("");
  return `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="read" aria-label="뒤로">${ICON.back}</button><b class="grow ellipsis">${esc(p.title)}</b>
      ${S.custom.passages[p.id] ? `<button class="icon-btn" data-act="p-del" data-id="${esc(p.id)}" aria-label="삭제">${ICON.trash}</button>` : ""}</div>
    <div class="reader-head"><h1 class="${p.lang === "ja" ? "jp" : ""}">${esc(p.title)}</h1>${p.titleKo ? `<p class="sub">${esc(p.titleKo)}</p>` : ""}
      <div class="row"><span class="chip">${esc(p.level || "")}</span>${p.topic ? `<span class="chip">${esc(p.topic)}</span>` : ""}<span class="muted small">${passageSize(p)}</span></div></div>
    <div class="rbar"><button class="btn sm ${ctx.playing ? "pri" : "soft"}" data-act="r-play">${ctx.playing ? ICON.stop + " 멈춤" : ICON.play + " 듣기"}</button>
      <button class="btn sm ${ctx.ko ? "pri" : ""}" data-act="r-ko">해석</button>
      ${p.lang === "ja" ? `<button class="btn sm ${ctx.kana ? "pri" : ""}" data-act="r-kana">읽는 법</button>` : ""}
      <span class="grow"></span><button class="btn sm" data-act="r-size" data-d="-1" aria-label="글자 작게">가−</button><button class="btn sm" data-act="r-size" data-d="1" aria-label="글자 크게">가+</button></div>
    <article class="box reader">${paras}</article>
    ${p.glossary && p.glossary.length ? `<h2>핵심 단어</h2><div class="gl-chips">${p.glossary.map((g) => `<button class="gchip" data-act="gl" data-w="${esc(g.w)}"><b class="${p.lang === "ja" ? "jp" : ""}">${esc(g.w)}</b><span>${esc(g.ko)}</span></button>`).join("")}</div>` : ""}
    ${questionsHTML(p)}
    <button class="btn ${S.read[p.id] ? "" : "pri"} big" data-act="r-done" data-id="${esc(p.id)}" style="margin-top:14px">${S.read[p.id] ? "✓ 읽은 글이에요" : "다 읽었어요"}</button>`;
};
AFTER.reader = () => { if (ctx.ko == null) { ctx.ko = false; ctx.kana = false; } };
function questionsHTML(p) {
  if (!p.questions || !p.questions.length) return "";
  ctx.ans = ctx.ans || {};
  return `<h2>이해 확인</h2>${p.questions.map((q, qi) => {
    const a = ctx.ans[qi];
    return `<div class="box qbox"><b>${qi + 1}. ${esc(q.q)}</b><div class="qchoices">${q.choices.map((c, ci) => {
      let cls = "";
      if (a != null) { if (ci === q.answer) cls = "right"; else if (ci === a) cls = "wrong"; }
      return `<button class="${cls}" data-act="pq" data-q="${qi}" data-c="${ci}" ${a != null ? "disabled" : ""}>${esc(c)}</button>`;
    }).join("")}</div>${a != null && q.why ? `<p class="muted small">${a === q.answer ? "✓ " : "✕ "}${esc(q.why)}</p>` : ""}</div>`;
  }).join("")}`;
}
function readAloud() {
  const p = passageById(ctx.pid);
  if (ctx.playing) { ctx.playing = false; stopSpeak(); render(); return; }
  ctx.playing = true;
  render();
  const sents = $$(".reader .sent");
  let i = 0;
  const step = () => {
    $$(".sent.speaking").forEach((e) => e.classList.remove("speaking"));
    if (!ctx.playing || view !== "reader" || i >= sents.length) { if (ctx.playing) { ctx.playing = false; render(); } return; }
    const el = sents[i++];
    el.classList.add("speaking");
    el.scrollIntoView({block: "center", behavior: "smooth"});
    speak(el.dataset.text, p.lang, {onend: step, quiet: true});
  };
  stopSpeak();
  setTimeout(step, 50);
}
function inboxDeck(lang) {
  let d = customDecks(lang).find((x) => x.inbox);
  if (!d) {
    const now = Date.now(), id = "d:" + newId(5);
    d = S.custom.decks[id] = {id, lang, name: "읽기에서 모은 단어", desc: "읽기 화면에서 추가한 단어", inbox: true, created: now, t: now};
    rebuildCustom();
  }
  return d.id;
}
function lookupWord(w, lang) {
  const lw = w.toLowerCase();
  const stems = [lw, lw.replace(/(ies)$/, "y"), lw.replace(/(es|s)$/, ""), lw.replace(/(ed|ing)$/, ""), lw.replace(/(ed|ing)$/, "e"), lw.replace(/(ly)$/, "")];
  return Object.values(CARDS).find((c) => c.lang === lang && c.word && stems.includes(String(c.word).toLowerCase()));
}
function wordPopup(w, gloss) {
  const p = passageById(ctx.pid), lang = p.lang;
  const g = (p.glossary || []).find((x) => x.w.toLowerCase() === w.toLowerCase());
  const c = !g ? lookupWord(w, lang) : null;
  const ko = g ? g.ko : c ? shortKo(c.ko) : "";
  const reading = g && g.kana && g.kana !== g.w ? g.kana : "";
  const sentEl = $$(".reader .sent").find((el) => el.dataset.text.toLowerCase().includes(w.toLowerCase()));
  const inDeck = Object.values(CARDS).some((x) => x.lang === lang && x.custom && String(x.word).toLowerCase() === w.toLowerCase());
  ctx.wp = {w, ko, kana: reading, sentence: sentEl ? sentEl.dataset.text : ""};
  openModal(`<div class="center"><div class="word ${lang === "ja" ? "jp" : "en"}">${esc(w)}</div>${reading ? `<div class="reading jp">${esc(reading)}</div>` : ""}
      <div style="margin:8px 0">${spkBtn(reading || w, lang)}</div>
      <div class="main-ko">${ko ? esc(ko) : `<span class="muted">아직 뜻이 없어요</span>`}</div>
      ${ctx.wp.sentence ? `<p class="muted small ctx-sent">“${esc(ctx.wp.sentence)}”</p>` : ""}</div>
    <div class="btn-row wrap" style="margin-top:12px">${inDeck ? `<button class="btn" disabled>${ICON.check} 단어장에 있어요</button>` : `<button class="btn pri" data-act="w-add">${ICON.plus} 단어장에 추가</button>`}
      <button class="btn soft" data-act="w-ai">${ICON.spark} AI에게 묻기</button></div>
    ${dictLinks({lang, type: lang === "en" ? "en" : "word", word: w})}`);
}
async function addWordFromReader() {
  const {w, ko, kana, sentence} = ctx.wp, p = passageById(ctx.pid), lang = p.lang;
  const gid = inboxDeck(lang);
  if (ko) {
    addCustomCards(gid, [{word: w, kana, ko, ex: sentence}]);
    closeModal(); toast(`'${w}'를 「읽기에서 모은 단어」에 넣었어요.`);
    return;
  }
  if (!hasAI()) { closeModal(); openAddCard(gid); setTimeout(() => { const f = $("#ac-form"); if (f) { f.elements.word.value = w; f.elements.ex.value = sentence; f.elements.ko.focus(); } }, 50); return; }
  openModal(`<div class="checking" style="padding:30px 0"><span class="spinner"></span>AI가 '${esc(w)}' 카드를 만들고 있어요…</div>`);
  try {
    const prompt = `${lang === "en" ? "영어" : "일본어"} 표현 「${w}」의 학습 카드 1개를 만들어줘. 이 글의 문맥에서 쓰인 뜻을 우선해. 문맥: "${sentence}"
규칙: word=${lang === "en" ? "기본형(원형)" : "사전형"}, reading=${lang === "ja" ? "히라가나 읽기" : "\"\""}, pos=${lang === "en" ? "품사 약어" : "\"\""}, ko=한국어 뜻(여러 뜻은 '; '로, 문맥의 뜻을 앞에), def=${lang === "en" ? "쉬운 영어 정의" : "\"\""}, ex=문맥 문장 그대로, exKo=그 문장 해석, tip=한국어 한 문장 팁.`;
    const {json} = await claude({system: TUTOR, messages: [{role: "user", content: prompt}], schema: CARDS_SCHEMA, maxTokens: 3000, effort: "low"});
    const x = json.cards[0];
    addCustomCards(gid, [{...x, kana: x.reading}]);
    closeModal(); toast(`'${x.word}' — ${shortKo(x.ko)} 를 단어장에 넣었어요.`);
  } catch (e) { openModal(`<p class="err">${esc(e.message)}</p><button class="btn" data-act="close">닫기</button>`); }
}
const PASSAGE_SCHEMA = obj({title: STR, titleKo: STR, text: STR, kana: STR, ko: STR,
  glossary: {type: "array", items: obj({w: STR, kana: STR, ko: STR})},
  questions: {type: "array", items: obj({q: STR, choices: {type: "array", items: STR}, answer: {type: "integer"}, why: STR})}});
function openPassageAI() {
  if (!hasAI()) { aiNeeded(); return; }
  const ja = LANG === "ja";
  const learned = Object.keys(S.cards).filter((id) => CARDS[id] && CARDS[id].lang === LANG && CARDS[id].type !== "kana" && CARDS[id].type !== "sent" && ["learn", "review"].includes(S.cards[id].s));
  openModal(`<h2>${ICON.spark} AI로 글 만들기</h2><p class="sub">원하는 주제로 한 문단 글과 해석·핵심 단어·문제를 만들어요.</p>
    <form id="pa-form"><label class="f"><span>주제</span><input type="text" name="topic" required placeholder="${ja ? "예: 편의점에서, 내 취미, 일본 여행 첫날" : "예: SOFC 음극의 니켈 응집, 학회 질의응답, 수면과 기억력"}"></label>
    <div class="grid2 tight"><label class="f"><span>수준</span><select name="lv">${(ja ? [["입문", "입문 (가나 위주)"], ["N5", "초급 N5"]] : [["B2", "중급 B2"], ["C1", "고급 C1"]]).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
    <label class="f"><span>길이</span><select name="len"><option value="s">짧게</option><option value="m" selected>보통</option><option value="l">길게</option></select></label></div>
    <label class="set-row" style="border:0;padding:6px 0"><span class="lbl">내가 배운 단어 넣기<small>${learned.length ? `배운 단어 ${learned.length}개 중 일부를 글에 섞어요` : "아직 배운 단어가 없어요"}</small></span><input type="checkbox" class="switch" name="mine" ${learned.length ? "checked" : "disabled"}></label>
    <div class="row" style="margin-top:8px"><button class="btn pri" type="submit">만들기</button><button class="btn ghost" type="button" data-act="close">취소</button></div></form>`);
  $("#pa-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = e.target.elements, topic = el.topic.value.trim(), lv = el.lv.value, len = el.len.value;
    const words = el.mine.checked ? shuffle(learned.slice()).slice(0, 10).map((id) => CARDS[id].word) : [];
    openModal(`<div class="checking" style="padding:40px 0"><span class="spinner"></span>AI가 「${esc(topic)}」 글을 쓰고 있어요… (30초 정도)</div>`);
    const L = ja ? {s: "3~4문장", m: "5~6문장", l: "7~9문장"}[len] : {s: "80~110단어", m: "120~160단어", l: "170~220단어"}[len];
    const prompt = ja
      ? `주제 「${topic}」로 일본어 읽기 글을 한 문단(${L})으로 써줘. 학습자는 한국인 ${lv === "입문" ? "입문자(히라가나·가타카나만 읽음): 한자 없이 가나로만, 단어 사이 띄어쓰기" : "JLPT N5 초급자: 아주 기초 한자만, 단어 사이 띄어쓰기"}.${words.length ? ` 가능하면 이 단어들을 자연스럽게 넣어: ${words.join(", ")}.` : ""}
title=일본어 제목, titleKo=한국어 제목, text=본문(한 문단), kana=본문에 한자가 있으면 전체를 히라가나로 쓴 읽기(띄어쓰기 동일), 한자가 없으면 "", ko=자연스러운 한국어 해석, glossary=본문에 그대로 나오는 핵심 단어 6~8개(w=본문 표기, kana=읽기, ko=뜻), questions=한국어 이해 문제 2개(choices 4개, answer는 0부터 시작하는 정답 번호, why=한국어 해설). 읽기는 반드시 정확하게.`
      : `주제 「${topic}」로 영어 읽기 글을 한 문단(${L})으로 써줘. 학습자는 한국인 SOFC 재료공학 대학원생, 글 수준은 CEFR ${lv}. 자연스럽고 정확한 영어로.${words.length ? ` 가능하면 이 단어들을 자연스럽게 넣어: ${words.join(", ")}.` : ""}
title=영어 제목, titleKo=한국어 제목, text=본문(한 문단), kana="", ko=자연스러운 한국어 해석, glossary=본문에 그대로 나오는 어려운 단어·표현 6~8개(w=본문 표기 그대로, kana="", ko=문맥상 뜻), questions=영어 이해 문제 3개(choices 4개, answer는 0부터 시작하는 정답 번호, why=한국어 해설).`;
    try {
      const {json} = await claude({system: TUTOR, messages: [{role: "user", content: prompt}], schema: PASSAGE_SCHEMA, maxTokens: 8000, effort: "low"});
      const now = Date.now(), id = "p:c:" + newId(5);
      S.custom.passages[id] = {id, lang: LANG, title: json.title, titleKo: json.titleKo, level: lv, topic, ai: true, created: now, t: now,
        paras: [{text: json.text, kana: json.kana || "", ko: json.ko}], glossary: json.glossary.filter((g) => json.text.toLowerCase().includes(g.w.toLowerCase())),
        questions: json.questions.filter((q) => q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length)};
      save(); closeModal(); go("reader", {pid: id});
    } catch (err) {
      openModal(`<h2>만들지 못했어요</h2><p class="err">${esc(err.message)}</p><div class="row"><button class="btn" data-act="p-new-ai">다시 하기</button><button class="btn ghost" data-act="close">닫기</button></div>`);
    }
  });
}
function openPassagePaste() {
  openModal(`<h2>직접 붙여넣기</h2><p class="sub">논문 초록, 기사, 메일 등 읽고 싶은 ${LANGS[LANG].name} 글을 넣으세요. ${hasAI() ? "AI로 해석과 문제도 만들 수 있어요." : ""}</p>
    <form id="pp-form"><label class="f"><span>제목</span><input type="text" name="title" required></label>
    <label class="f"><span>본문</span><textarea name="text" rows="9" required ${LANG === "ja" ? 'lang="ja"' : ""}></textarea></label>
    <div class="row"><button class="btn pri" type="submit">저장</button><button class="btn ghost" type="button" data-act="close">취소</button></div></form>`);
  $("#pp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const el = e.target.elements, now = Date.now(), id = "p:c:" + newId(5);
    const paras = el.text.value.split(/\n\s*\n/).map((t) => t.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).map((text) => ({text, kana: "", ko: ""}));
    S.custom.passages[id] = {id, lang: LANG, title: el.title.value.trim(), titleKo: "", level: "내 글", topic: "", mine: true, created: now, t: now, paras, glossary: [], questions: []};
    save(); closeModal(); go("reader", {pid: id, ko: false, kana: false});
  });
}
async function aiStudyPassage(pid) {
  if (!hasAI()) { aiNeeded(); return; }
  const p = S.custom.passages[pid];
  if (!p) return;
  openModal(`<div class="checking" style="padding:40px 0"><span class="spinner"></span>AI가 해석과 문제를 만들고 있어요…</div>`);
  const schema = obj({ko: {type: "array", items: STR}, kana: {type: "array", items: STR}, glossary: PASSAGE_SCHEMA.properties.glossary, questions: PASSAGE_SCHEMA.properties.questions});
  const prompt = `아래 ${p.lang === "en" ? "영어" : "일본어"} 글(문단 ${p.paras.length}개)을 공부 자료로 만들어줘.
ko=문단마다 자연스러운 한국어 해석(문단 수와 같은 개수), kana=${p.lang === "ja" ? "문단마다 전체 히라가나 읽기(한자가 없으면 \"\")" : "문단마다 \"\""}, glossary=본문에 그대로 나오는 어려운 단어·표현 6~10개(w=본문 표기, kana=${p.lang === "ja" ? "읽기" : "\"\""}, ko=문맥상 뜻), questions=이해 문제 3개(${p.lang === "en" ? "영어" : "한국어"}, choices 4개, answer는 0부터, why=한국어 해설).
${p.paras.map((x, i) => `[문단 ${i + 1}]\n${x.text}`).join("\n\n")}`;
  try {
    const {json} = await claude({system: TUTOR, messages: [{role: "user", content: prompt}], schema, maxTokens: 12000, effort: "low"});
    p.paras = p.paras.map((x, i) => ({...x, ko: json.ko[i] || "", kana: json.kana[i] || ""}));
    const t = fullText(p).toLowerCase();
    p.glossary = json.glossary.filter((g) => t.includes(g.w.toLowerCase()));
    p.questions = json.questions.filter((q) => q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length);
    p.t = Date.now();
    save(); closeModal(); ctx.ko = true; render();
  } catch (e) { openModal(`<p class="err">${esc(e.message)}</p><button class="btn" data-act="close">닫기</button>`); }
}

// ============================================================ 게임
let gameTimer = null;
function stopGame() { clearInterval(gameTimer); gameTimer = null; }
const GAMES = {
  match: {name: "짝 맞추기", icon: "🧩", desc: "단어와 뜻을 짝지어요. 빠를수록 좋아요", low: true},
  speed: {name: "스피드 퀴즈", icon: "⚡", desc: "60초 동안 최대한 많이! 연속 정답은 보너스"},
  listen: {name: "듣고 고르기", icon: "🎧", desc: "소리만 듣고 맞는 단어를 골라요"},
  cloze: {name: "빈칸 채우기", icon: "✍️", desc: "예문 속 빈칸에 들어갈 단어는?"}
};
const bestOf = (g) => S.best[`${g}_${LANG}`];
function saveBest(g, score) {
  const k = `${g}_${LANG}`, low = Boolean(GAMES[g] && GAMES[g].low), cur = S.best[k];
  const better = !cur || (low ? score < cur.score : score > cur.score);
  if (better) { S.best[k] = {score, t: Date.now(), ...(low ? {low: true} : {})}; save(); }
  return better;
}
function fmtBest(g) {
  const b = bestOf(g);
  if (!b) return "기록 없음";
  return GAMES[g].low ? `최고 ${(b.score / 1000).toFixed(1)}초` : `최고 ${b.score}점`;
}
VIEWS.games = () => `<div class="hello"><div><div class="date">${LANGS[LANG].name}</div><h1>게임</h1></div></div>
  <p class="sub">배운 카드로 가볍게 복습해요. 게임은 복습 일정에 영향을 주지 않아요. 배운 카드가 적으면 첫 단계 카드로 해요.</p>
  <div class="tiles">${Object.entries(GAMES).map(([k, g]) => `<button class="tile" data-act="g-start" data-g="${k}"><span class="ic emoji">${g.icon}</span><b>${g.name}</b><span>${g.desc}</span><span class="best">${fmtBest(k)}</span></button>`).join("")}</div>
  ${LANG === "ja" ? `<h2>가나 연습</h2><div class="tiles">
    <button class="tile" data-act="quiz"><span class="ic jp">あ</span><b>가나 퀴즈</b><span>글자↔소리 4지선다</span></button>
    <button class="tile" data-act="confuse"><span class="ic jp">さち</span><b>헷갈리는 글자</b><span>비슷한 글자 나란히 비교</span></button>
    <button class="tile" data-act="kana-chart"><span class="ic jp">表</span><b>가나표</b><span>오십음도 · 누르면 발음</span></button></div>`
  : `<h2>정리</h2><div class="tiles"><button class="tile" data-act="sort"><span class="ic">✂️</span><b>아는 단어 거르기</b><span>이미 아는 단어를 학습에서 빼요</span></button></div>`}`;
function gamePool(lang, filter, min = 8) {
  let ids = Object.keys(S.cards).filter((id) => CARDS[id] && CARDS[id].lang === lang && S.cards[id].s !== "new" && filter(card(id)));
  if (ids.length < min) {
    const have = new Set(ids);
    const extra = Object.values(GROUPS).filter((g) => g.lang === lang && unlocked(g.id) && groupOn(g.id)).flatMap((g) => BY_GROUP[g.id] || []).filter((id) => !have.has(id) && filter(card(id)));
    ids = ids.concat(extra.slice(0, Math.max(min * 2, 20) - ids.length));
  }
  return ids;
}
const gFront = (c) => c.type === "kana" ? c.ch : c.word;
const gBack = (c) => { const s = c.type === "kana" ? c.romaji : shortKo(c.ko).split(/\s*;\s*/)[0]; return s.length > 22 ? s.slice(0, 21) + "…" : s; };
function startGame(g) {
  stopGame();
  const notSent = (c) => c.type !== "sent";
  if (g === "match") {
    const pool = shuffle(gamePool(LANG, notSent)).slice(0, 6);
    if (pool.length < 3) { toast("카드가 부족해요."); return; }
    const tiles = shuffle(pool.flatMap((id) => { const c = card(id); return [{k: id + "|a", pid: id, side: "a", label: gFront(c), jp: c.lang === "ja"}, {k: id + "|b", pid: id, side: "b", label: gBack(c)}]; }));
    go("game", {game: "match", tiles, sel: null, done: [], miss: 0, start: Date.now(), bad: []});
    gameTimer = setInterval(() => { const el = $("#g-time"); if (el) el.textContent = ((Date.now() - ctx.start) / 1000).toFixed(1) + "초"; }, 100);
  } else if (g === "speed") {
    const pool = gamePool(LANG, notSent);
    if (pool.length < 4) { toast("카드가 부족해요."); return; }
    go("game", {game: "speed", pool, score: 0, combo: 0, maxCombo: 0, n: 0, right: 0, end: Date.now() + 60000, q: null, last: null, flash: null});
    nextSpeed();
    gameTimer = setInterval(() => {
      const left = ctx.end - Date.now();
      if (left <= 0) { finishGame(ctx.score); return; }
      const bar = $("#g-bar"); if (bar) bar.style.width = (left / 600) + "%";
      const t = $("#g-time"); if (t) t.textContent = Math.ceil(left / 1000) + "초";
    }, 100);
  } else if (g === "listen") {
    const pool = gamePool(LANG, notSent);
    if (pool.length < 4) { toast("카드가 부족해요."); return; }
    go("game", {game: "listen", pool: shuffle(pool.slice()), round: 0, rounds: 10, right: 0, q: null, picked: null});
    nextListen();
  } else if (g === "cloze") {
    const items = clozeItems(LANG);
    if (items.length < 4) { toast("예문이 있는 카드가 아직 부족해요. 조금 더 공부한 뒤 해 보세요."); return; }
    go("game", {game: "cloze", items: shuffle(items), round: 0, rounds: Math.min(10, items.length), right: 0, q: null, picked: null});
    nextCloze();
  }
}
function tapMatch(k) {
  if (ctx.done.includes(k)) return;
  if (!ctx.sel || ctx.sel === k) { ctx.sel = ctx.sel === k ? null : k; render(); return; }
  const a = ctx.tiles.find((t) => t.k === ctx.sel), b = ctx.tiles.find((t) => t.k === k);
  if (a.side === b.side) { ctx.sel = k; render(); return; }
  if (a.pid === b.pid) {
    ctx.done.push(a.k, b.k); ctx.sel = null;
    const c = card(a.pid); speak(speakText(c), c.lang, {quiet: true});
    if (ctx.done.length === ctx.tiles.length) { finishGame(Date.now() - ctx.start); return; }
  } else {
    ctx.miss++; ctx.bad = [a.k, b.k]; ctx.sel = null;
    setTimeout(() => { if (view === "game" && ctx.game === "match") { ctx.bad = []; render(); } }, 450);
  }
  render();
}
function speedQ(pool, last) {
  let id;
  do { id = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && id === last);
  const c = card(id), kind = c.type === "kana" ? "romaji" : "meaning";
  return {id, c, kind, choices: shuffle([c, ...distractors(c, kind)]).map((x) => ({id: x.id, label: LABEL[kind](x)}))};
}
function nextSpeed() { ctx.q = speedQ(ctx.pool, ctx.last); ctx.last = ctx.q.id; ctx.flash = null; render(); }
function answerSpeed(id) {
  if (ctx.flash) return;
  const q = ctx.q, ok = id === q.id || q.choices.find((x) => x.id === id).label === LABEL[q.kind](q.c);
  ctx.n++;
  if (ok) { ctx.right++; ctx.score += 10 * (1 + Math.floor(ctx.combo / 3)); ctx.combo++; ctx.maxCombo = Math.max(ctx.maxCombo, ctx.combo); }
  else { ctx.combo = 0; ctx.end -= 3000; }
  ctx.flash = {id, ok};
  render();
  setTimeout(() => { if (view === "game" && ctx.game === "speed") nextSpeed(); }, ok ? 220 : 700);
}
function nextListen() {
  if (ctx.round >= ctx.rounds) { finishGame(ctx.right); return; }
  const id = ctx.pool[ctx.round % ctx.pool.length], c = card(id);
  const kind = c.type === "kana" ? "kana" : c.type === "word" ? "reading" : "spell";
  ctx.q = {id, c, kind, choices: shuffle([c, ...distractors(c, kind)]).map((x) => ({id: x.id, label: LABEL[kind](x)}))};
  ctx.picked = null;
  render();
  setTimeout(() => speak(speakText(c), c.lang, {quiet: true}), 250);
}
function answerListen(id) {
  if (ctx.picked) return;
  ctx.picked = id;
  const ok = id === ctx.q.id || ctx.q.choices.find((x) => x.id === id).label === LABEL[ctx.q.kind](ctx.q.c);
  if (ok) ctx.right++;
  ctx.round++;
  render();
  if (ok) setTimeout(() => { if (view === "game" && ctx.game === "listen" && ctx.picked) nextListen(); }, 900);
}
function clozeItems(lang) {
  const out = [];
  for (const id of gamePool(lang, () => true, 30)) {
    const c = card(id);
    if (c.type === "sent" && c.key && c.word.includes(c.key)) { out.push({id, text: c.word, ans: c.key, ko: c.ko}); continue; }
    if (!c.ex || c.type === "kana") continue;
    if (lang === "en") {
      const base = String(c.word).replace(/\(.*?\)/g, "").replace(/~/g, "").trim();
      if (!base || base.split(" ").length > 3) continue;
      const m = c.ex.match(new RegExp(`\\b${escapeRe(base.length > 4 ? base.replace(/e$/, "") : base)}[a-z]*`, "i"));
      if (m) out.push({id, text: c.ex, ans: m[0], ko: c.exKo || c.ko});
    } else {
      const w = c.ex.includes(c.word) ? c.word : c.kana && c.ex.includes(c.kana) ? c.kana : null;
      if (w) out.push({id, text: c.ex, ans: w, ko: c.exKo || c.ko});
    }
  }
  return out;
}
function nextCloze() {
  if (ctx.round >= ctx.rounds) { finishGame(ctx.right); return; }
  const it = ctx.items[ctx.round];
  const others = shuffle(ctx.items.filter((x) => x.ans.toLowerCase() !== it.ans.toLowerCase()).map((x) => x.ans)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
  ctx.q = {it, choices: shuffle([it.ans, ...others])};
  ctx.picked = null;
  render();
}
function answerCloze(i) {
  if (ctx.picked != null) return;
  ctx.picked = i;
  const ok = ctx.q.choices[i] === ctx.q.it.ans;
  if (ok) ctx.right++;
  ctx.round++;
  render();
  const c = card(ctx.q.it.id);
  speak(ctx.q.it.text, c.lang, {quiet: true});
}
function finishGame(score) {
  stopGame();
  const g = ctx.game, newBest = saveBest(g, score);
  bump(LANG === "ja" ? "fja" : "fen", 1);
  save(false);
  ctx.result = {score, newBest};
  render();
}
VIEWS.game = () => {
  const g = GAMES[ctx.game];
  const top = `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="games" aria-label="나가기">${ICON.close}</button><b class="grow">${g.icon} ${g.name}</b>${fmtBest(ctx.game) !== "기록 없음" ? `<span class="muted small">${fmtBest(ctx.game)}</span>` : ""}</div>`;
  if (ctx.result) {
    const {score, newBest} = ctx.result;
    const main = ctx.game === "match" ? `${(score / 1000).toFixed(1)}초` : ctx.game === "speed" ? `${score}점` : `${score} / ${ctx.rounds}`;
    const sub = ctx.game === "match" ? `틀린 횟수 ${ctx.miss}` : ctx.game === "speed" ? `${ctx.right}/${ctx.n} 정답 · 최대 연속 ${ctx.maxCombo}` : "맞힌 문제";
    return top + `<div class="box finish anim"><div class="big">${newBest ? "🏆" : "🎮"}</div><h2>${newBest ? "새 최고 기록!" : "끝!"}</h2>
      <div class="score-big">${main}</div><p class="sub">${sub}</p>
      <div class="btn-row"><button class="btn" data-act="tab" data-tab="games">게임 목록</button><button class="btn pri" data-act="g-start" data-g="${ctx.game}">한 번 더</button></div></div>`;
  }
  if (ctx.game !== "match" && !ctx.q) return top;
  if (ctx.game === "match") {
    return top + `<div class="row between" style="margin-bottom:10px"><span class="muted small">짝을 이루는 두 칸을 차례로 누르세요</span><b id="g-time">0.0초</b></div>
      <div class="mgrid">${ctx.tiles.map((t) => {
        const cls = ctx.done.includes(t.k) ? "done" : ctx.bad.includes(t.k) ? "bad" : ctx.sel === t.k ? "sel" : "";
        return `<button class="mtile ${t.side} ${cls}${t.jp ? " jp" : ""}" data-act="mt" data-k="${esc(t.k)}" ${ctx.done.includes(t.k) ? "disabled" : ""}>${esc(t.label)}</button>`;
      }).join("")}</div>`;
  }
  if (ctx.game === "speed") {
    const q = ctx.q, left = Math.max(0, ctx.end - Date.now());
    return top + `<div class="speed-hud"><div class="tbar"><i id="g-bar" style="width:${left / 600}%"></i></div><div class="row between"><b id="g-time">${Math.ceil(left / 1000)}초</b>
        <span>${ctx.combo >= 3 ? `<span class="combo">🔥 ${ctx.combo}연속 ×${1 + Math.floor(ctx.combo / 3)}</span> ` : ""}<b class="score">${ctx.score}점</b></span></div></div>
      <div class="flash game-card"><div class="face">${q.c.type === "kana" ? `<div class="glyph">${esc(q.c.ch)}</div>` : q.c.type === "word" ? jpWordHTML(q.c) : `<div class="word en">${esc(q.c.word)}</div>`}</div>
      <div class="options">${q.choices.map((o, i) => {
        let cls = "";
        if (ctx.flash) { if (o.id === q.id) cls = "right"; else if (o.id === ctx.flash.id) cls = "wrong"; }
        return `<button class="${cls}" data-act="sp" data-id="${esc(o.id)}"><span class="num">${i + 1}</span>${esc(o.label)}</button>`;
      }).join("")}</div></div>`;
  }
  if (ctx.game === "listen") {
    const q = ctx.q, ok = ctx.picked && (ctx.picked === q.id || q.choices.find((x) => x.id === ctx.picked).label === LABEL[q.kind](q.c));
    return top + `<div class="row between" style="margin-bottom:10px"><span class="muted small">${Math.min(ctx.round + (ctx.picked ? 0 : 1), ctx.rounds)} / ${ctx.rounds}</span><b>맞힘 ${ctx.right}</b></div>
      <div class="flash game-card"><div class="face"><button class="listen-btn" data-act="ls-replay" aria-label="다시 듣기">${ICON.sound}</button><div class="hint">눌러서 다시 듣기</div>
        ${ctx.picked ? `<div class="answer"><div class="main">${esc(gFront(q.c))} — ${esc(gBack(q.c))}</div></div>` : ""}</div>
      <div class="options">${q.choices.map((o, i) => {
        let cls = q.kind === "spell" ? "" : "jp";
        if (ctx.picked) { if (o.id === q.id) cls += " right"; else if (o.id === ctx.picked) cls += " wrong"; }
        return `<button class="${cls}" data-act="ls" data-id="${esc(o.id)}" ${ctx.picked ? "disabled" : ""}><span class="num">${i + 1}</span>${esc(o.label)}</button>`;
      }).join("")}</div>${ctx.picked && !ok ? `<button class="btn pri big" data-act="g-next" style="margin-top:12px">다음</button>` : ""}</div>`;
  }
  if (ctx.game === "cloze") {
    const q = ctx.q, it = q.it, i = it.text.indexOf(it.ans);
    const sent = ctx.picked != null ? esc(it.text.slice(0, i)) + `<mark>${esc(it.ans)}</mark>` + esc(it.text.slice(i + it.ans.length))
      : esc(it.text.slice(0, i)) + `<span class="blank">${"_".repeat(Math.min(12, it.ans.length + 2))}</span>` + esc(it.text.slice(i + it.ans.length));
    const jp = LANG === "ja";
    return top + `<div class="row between" style="margin-bottom:10px"><span class="muted small">${Math.min(ctx.round + (ctx.picked != null ? 0 : 1), ctx.rounds)} / ${ctx.rounds}</span><b>맞힘 ${ctx.right}</b></div>
      <div class="flash game-card"><div class="face"><div class="sentence${jp ? " jp" : ""}">${sent}</div><div class="hint">${esc(it.ko)}</div></div>
      <div class="options">${q.choices.map((c, k) => {
        let cls = jp ? "jp" : "";
        if (ctx.picked != null) { if (c === it.ans) cls += " right"; else if (k === ctx.picked) cls += " wrong"; }
        return `<button class="${cls}" data-act="cz" data-i="${k}" ${ctx.picked != null ? "disabled" : ""}><span class="num">${k + 1}</span>${esc(c)}</button>`;
      }).join("")}</div>${ctx.picked != null ? `<button class="btn pri big" data-act="g-next" style="margin-top:12px">${ctx.round >= ctx.rounds ? "결과 보기" : "다음"}</button>` : ""}</div>`;
  }
  return top;
};

// ---------- 가나 퀴즈 · 헷갈리는 글자 · 가나표
function quizPool(script) {
  const groups = script === "kata" ? ["kata_basic", "kata_dakuten", "kata_yoon"] : ["hira_basic", "hira_dakuten", "hira_yoon"];
  let ids = groups.flatMap((g) => BY_GROUP[g] || []).filter((id) => !isNew(id));
  if (ids.length < 8) ids = (BY_GROUP[groups[0]] || []).slice(0, Math.max(10, ids.length + 5));
  return ids;
}
function newQuizQ() {
  const pool = quizPool(ctx.script), id = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle(pool.filter((x) => x !== id && CARDS[x].romaji !== CARDS[id].romaji)).slice(0, 3);
  ctx.q = {id, opts: shuffle([id, ...others]), picked: null};
}
VIEWS.quiz = () => {
  if (!ctx.script) { ctx.script = "hira"; ctx.mode = "read"; ctx.n = 0; ctx.right = 0; ctx.combo = 0; newQuizQ(); }
  const q = ctx.q, c = CARDS[q.id];
  const prompt = ctx.mode === "read" ? `<div class="glyph">${esc(c.ch)}</div>` : `<div class="word">${esc(c.romaji)}</div><div class="hint">${esc(c.ko)} ${spkBtn(c.ch, "ja")}</div>`;
  return `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="games">${ICON.close}</button><b class="grow">가나 퀴즈</b><span>${ctx.combo >= 3 ? `<span class="combo">🔥${ctx.combo}</span> ` : ""}<b>${ctx.right}/${ctx.n}</b></span></div>
    <div class="row between" style="margin-bottom:12px">${seg("quiz-script", ctx.script, [["hira", "히라가나"], ["kata", "가타카나"]])}${seg("quiz-mode", ctx.mode, [["read", "글자→소리"], ["write", "소리→글자"]])}</div>
    <div class="flash game-card"><div class="face">${prompt}</div><div class="options">${q.opts.map((o, i) => {
      const oc = CARDS[o];
      let cls = ctx.mode === "write" ? "jp" : "";
      if (q.picked) { if (o === q.id) cls += " right"; else if (o === q.picked) cls += " wrong"; }
      return `<button class="${cls}" data-act="quiz-pick" data-id="${esc(o)}" ${q.picked ? "disabled" : ""}><span class="num">${i + 1}</span>${ctx.mode === "read" ? `${esc(oc.romaji)}<small>${esc(oc.ko)}</small>` : esc(oc.ch)}</button>`;
    }).join("")}</div>
    ${q.picked ? `<p class="center">${q.picked === q.id ? "정답! 🎉" : `정답은 <b class="jp">${esc(c.ch)}</b> (${esc(c.romaji)})`}</p><button class="btn pri big" data-act="quiz-next">다음</button>` : ""}</div>
    <p class="muted small center">배운 글자로 출제해요. 배운 글자가 8개 미만이면 첫 글자들로 연습해요.</p>`;
};
VIEWS.confuse = () => `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="games">${ICON.close}</button><b class="grow">헷갈리는 글자</b><span class="muted small">누르면 소리가 나요</span></div>
  ${((D.kana && D.kana.confusables) || []).map((g) => {
    const chars = g.slice(0, -1), tip = g[g.length - 1];
    return `<div class="box"><div class="pair">${chars.map((ch) => { const c = CARDS["k:" + ch]; return `<button type="button" data-act="speak" data-lang="ja" data-text="${esc(ch)}"><b>${esc(ch)}</b><span>${c ? esc(c.romaji) : ""}</span></button>`; }).join("")}</div><div class="small center">${esc(tip)}</div></div>`;
  }).join("")}`;
const GOJUON = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "や ゆ よ", "らりるれろ", "わ   を", "ん    "];
VIEWS.chart = () => {
  const kata = ctx.script === "kata";
  const cells = GOJUON.flatMap((row) => row.split("")).map((h) => {
    if (h === " ") return `<button class="empty" disabled></button>`;
    const ch = kata ? toKata(h) : h, c = CARDS["k:" + ch];
    return `<button type="button" class="${isNew("k:" + ch) ? "" : "learned"}" data-act="speak" data-lang="ja" data-text="${esc(ch)}"><b>${esc(ch)}</b><span>${c ? esc(c.romaji) : ""}</span></button>`;
  }).join("");
  const K = D.kana || {};
  return `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="games">${ICON.close}</button><b class="grow">가나표</b>${seg("chart-script", kata ? "kata" : "hira", [["hira", "히라가나"], ["kata", "가타카나"]])}</div>
    <div class="box"><div class="chart">${cells}</div>
    <p class="muted small">초록색 = 배운 글자. 누르면 발음을 들어요.</p>
    ${K.dakutenTip ? `<p class="small">${esc(K.dakutenTip["゛"])}<br>${esc(K.dakutenTip["゜"])}<br>${esc(K.yoonTip || "")}</p>` : ""}</div>`;
};

// ============================================================ 통계
function heatLevel(n) { return n <= 0 ? "" : n < 10 ? "l1" : n < 30 ? "l2" : n < 60 ? "l3" : "l4"; }
VIEWS.stats = () => {
  const lang = LANG, ids = Object.keys(CARDS).filter((id) => CARDS[id].lang === lang);
  const cnt = {new: 0, learn: 0, review: 0, mature: 0, known: 0};
  for (const id of ids) cnt[status(id)]++;
  let ok = 0, bad = 0, days = 0, sec7 = 0;
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const t = dayTotals(isoDate(d));
    ok += t["o" + lang] || 0; bad += t["b" + lang] || 0; sec7 += t["s" + lang] || 0;
  }
  for (const day of Object.keys(S.daily)) if (dayCount(day, lang) > 0) days++;
  const acc = ok + bad ? Math.round((ok / (ok + bad)) * 100) + "%" : "–";
  const todaySec = todayCounts()["s" + lang] || 0;
  // 히트맵: 18주, 월요일 시작
  const start = new Date(today); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 17 * 7);
  const cells = [];
  for (let i = 0; i < 18 * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = isoDate(d), n = Math.round(dayCount(iso, lang));
    const fut = d > today;
    cells.push(`<i class="${fut ? "fut" : heatLevel(n)}" ${fut ? "" : `data-tip="${d.getMonth() + 1}월 ${d.getDate()}일 · ${n}장"`}></i>`);
  }
  // 앞으로 7일 복습 예정
  const t0 = startOfDay(Date.now());
  const fc = Array.from({length: 7}, (_, i) => ids.filter((id) => { const r = S.cards[id]; if (!r || !["learn", "review"].includes(r.s) || !enabled(id)) return false; return i === 0 ? r.due < t0 + DAY : r.due >= t0 + i * DAY && r.due < t0 + (i + 1) * DAY; }).length);
  const max = Math.max(1, ...fc);
  const dayName = (i) => i === 0 ? "오늘" : i === 1 ? "내일" : "일월화수목금토"[new Date(t0 + i * DAY).getDay()];
  const hard = ids.filter((id) => S.cards[id] && (S.cards[id].wrong || 0) + (S.cards[id].lapses || 0) > 0).sort((a, b) => ((S.cards[b].wrong || 0) + (S.cards[b].lapses || 0)) - ((S.cards[a].wrong || 0) + (S.cards[a].lapses || 0))).slice(0, 8);
  const learned = cnt.review + cnt.mature + cnt.known;
  return `<div class="hello"><div><div class="date">${LANGS[lang].name}</div><h1>통계</h1></div></div>
    <div class="stat-tiles">
      <div class="stat"><b>🔥 ${streak()}일</b><span>연속 학습</span></div>
      <div class="stat"><b>${learned}</b><span>익힌 카드 / ${ids.length}</span></div>
      <div class="stat"><b>${acc}</b><span>최근 7일 정답률</span></div>
      <div class="stat"><b>${Math.round(todaySec / 60)}분</b><span>오늘 공부 · 7일 ${Math.round(sec7 / 60)}분</span></div>
    </div>
    <h2>학습 달력 <span class="muted small">총 ${days}일</span></h2>
    <div class="box"><div class="heat-wrap"><div class="heat">${cells.join("")}</div></div>
      <div class="heat-legend">적음 <i style="background:var(--heat-0)"></i><i class="l1" style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> 많음</div></div>
    <h2>앞으로 7일 복습 예정</h2>
    <div class="box"><div class="fc">${fc.map((n, i) => `<div class="col" data-tip="${dayName(i)} · 복습 ${n}장"><span class="tot">${n || ""}</span><i class="bar-v" style="height:${n ? Math.max(4, (n / max) * 120) : 0}px"></i></div>`).join("")}</div>
      <div class="fc-x">${fc.map((_, i) => `<span>${dayName(i)}</span>`).join("")}</div></div>
    <h2>카드 상태</h2>
    <div class="box"><div class="stack tall">${stackBars([["known", cnt.known], ["mature", cnt.mature], ["review", cnt.review], ["learn", cnt.learn], ["new", cnt.new]], ids.length)}</div>
      <div class="legend"><span><i class="st-known"></i>알아요 ${cnt.known}</span><span><i class="st-mature"></i>오래 기억 ${cnt.mature}</span><span><i class="st-review"></i>복습 중 ${cnt.review}</span><span><i class="st-learn"></i>익히는 중 ${cnt.learn}</span><span><i class="st-new"></i>새 항목 ${cnt.new}</span></div>
      <p class="muted small" style="margin:10px 0 0">오래 기억 = 복습 간격이 21일 이상인 카드</p></div>
    <h2>자주 틀리는 카드</h2>
    ${hard.length ? `<div class="lib-list">${hard.map(cardRow).join("")}</div><button class="btn soft big" data-act="free-go" data-scope="wrong" data-lang="${lang}" style="margin-top:10px">이 카드들로 자유 복습</button>` : `<div class="empty-state">아직 틀린 카드가 없어요 👍</div>`}`;
};

// ============================================================ 설정
const stepper = (k, v) => `<div class="stepper"><button type="button" data-act="step" data-k="${k}" data-d="-1" aria-label="줄이기">−</button><b>${v}</b><button type="button" data-act="step" data-k="${k}" data-d="1" aria-label="늘리기">+</button></div>`;
const swRow = (k, label, sub) => `<label class="set-row"><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ""}</span><input type="checkbox" class="switch" data-opt="${k}" ${S.settings[k] ? "checked" : ""}></label>`;
VIEWS.settings = () => {
  const st = S.settings;
  const editCount = Object.values(S.edits).filter((e) => e.f && Object.keys(e.f).length).length;
  const knownCount = Object.values(S.cards).filter((r) => r.s === "known").length;
  return `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="home" aria-label="뒤로">${ICON.back}</button><b class="grow">설정</b></div>
    <h2>공부 방식</h2><div class="set-list">
      <div class="set-row"><span class="lbl">일본어 답하는 법</span>${seg("mode-ja", st.mode.ja, MODE_OPTS)}</div>
      <div class="set-row"><span class="lbl">일본어 방향</span>${seg("dir-ja", st.dir.ja, DIR_OPTS.ja)}</div>
      <div class="set-row"><span class="lbl">영어 답하는 법</span>${seg("mode-en", st.mode.en, MODE_OPTS)}</div>
      <div class="set-row"><span class="lbl">영어 방향</span>${seg("dir-en", st.dir.en, DIR_OPTS.en)}</div></div>
    <p class="muted small pad">타이핑: 직접 입력하면 자동 채점 (비슷한 뜻·오타 허용, AI 채점 가능) · 객관식: 4개 중 고르기 · 스스로: 정답을 보고 직접 평가</p>
    <h2>하루 새 항목</h2><div class="set-list">
      <div class="set-row"><span class="lbl">일본어 가나 (글자)</span>${stepper("kanaNew", st.kanaNew)}</div>
      <div class="set-row"><span class="lbl">일본어 단어·표현</span>${stepper("jaNew", st.jaNew)}</div>
      <div class="set-row"><span class="lbl">영어</span>${stepper("enNew", st.enNew)}</div></div>
    <p class="muted small pad">복습이 하루 목표의 5배 넘게 밀리면 새 항목을 절반으로, 10배 넘으면 0으로 자동으로 줄여요.</p>
    <h2>학습 옵션</h2><div class="set-list">
      ${swRow("shuffleNew", "새 항목 무작위로 들이기", "끄면 순서대로 (가나는 행 단위로)")}
      ${swRow("autoSpeak", "정답 볼 때 자동 발음")}
      ${swRow("furigana", "한자 위에 후리가나 보이기")}</div>
    <h2>${ICON.spark} AI</h2><div class="box" id="ai-box">${aiPanel()}</div>
    <h2>동기화</h2><div class="box" id="sync-box">${syncPanel()}</div>
    <h2>데이터</h2><div class="box">
      <div class="btn-row wrap"><button class="btn" data-act="export">백업 내보내기</button><button class="btn" data-act="import">백업 불러오기</button></div>
      <input type="file" id="import-file" accept=".json,application/json" hidden>
      <p class="muted small">불러오기는 지금 기록과 합쳐요 (더 최근 기록이 남아요).</p>
      <div class="btn-row wrap"><button class="btn sm" data-act="copy-edits" ${editCount ? "" : "disabled"}>고친 카드 ${editCount}개 복사</button>
      <button class="btn sm" data-act="unknown-all" ${knownCount ? "" : "disabled"}>'알아요' ${knownCount}개 되돌리기</button></div></div>
    <h2>앱</h2><div class="box small">
      <div class="row between"><span>이 기기 이름: <b>${esc(DEVNAME)}</b></span><button class="btn ghost sm" data-act="rename">바꾸기</button></div>
      <p class="muted">LiBird Words ${APP_VERSION} · 폰에서는 브라우저 메뉴의 「홈 화면에 추가」로 앱처럼 쓸 수 있어요.</p></div>`;
};
function aiPanel() {
  const st = S.settings;
  const status = hasAI() ? `<p class="okt">${ICON.check} AI 사용 가능 · ${memKey ? "키는 동기화 비밀번호로 암호화해 이 기기에 보관" : "키는 이 기기에만 보관 (동기화를 연결하면 암호화돼요)"}</p>`
    : aiLocked() ? `<p class="err">키가 잠겨 있어요. 위의 동기화 비밀번호를 먼저 넣어 주세요.</p>` : `<p class="muted small">AI 채점, 단어장 자동 생성, 글 만들기, AI 질문에 쓰여요.</p>`;
  return `${status}
    <div class="set-row" style="border:0;padding:4px 0 10px"><span class="lbl">모델</span>${seg("aiModel", st.aiModel, AI_MODELS.map(([v, n]) => [v, n.replace("Claude ", "")]))}</div>
    <p class="muted small" style="margin-top:0">${AI_MODELS.find((m) => m[0] === st.aiModel)[2]} · 채점 1번에 Opus 약 5~7원, Haiku 약 0.1원</p>
    <form id="ai-form" class="row" autocomplete="off"><input type="password" name="key" placeholder="${hasAI() ? "새 키로 바꾸기 (sk-ant-…)" : "Claude API 키 (sk-ant-…)"}" style="flex:1;min-width:180px"><button class="btn pri" type="submit">저장</button></form>
    <div class="btn-row wrap" style="margin-top:8px">${hasAI() ? `<button class="btn sm" data-act="ai-test">연결 테스트</button><button class="btn ghost sm danger" data-act="ai-del">키 지우기</button>` : ""}</div>
    <p class="err small" id="ai-msg"></p>
    <details><summary>API 키 만드는 법</summary><ol class="steps">
      <li>console.anthropic.com 에 로그인 (Claude 구독과 별개로 API 크레딧 충전 필요)</li>
      <li>Settings → Limits에서 월 사용 한도를 정해 두면 안심이에요</li>
      <li>API Keys → Create Key → 만든 키(sk-ant-…)를 위에 붙여 넣기</li></ol>
      <p class="muted small">키는 이 브라우저에만 저장되고, 다른 기기는 「다른 기기 연결 (QR)」로 함께 옮겨져요. 공용 컴퓨터에서는 넣지 마세요.</p></details>`;
}
function syncPanel() {
  if (pendingPair) {
    return `<p><b>다른 기기에서 보낸 연결 코드를 받았어요.</b><br>동기화 비밀번호를 넣어 주세요.</p>
      <form id="pair-form"><label class="f"><span>동기화 비밀번호</span><input type="password" name="pw" autocomplete="current-password" required></label>
      <label class="set-row" style="border:0;padding:4px 0"><span class="lbl">이 기기에서 비밀번호 기억</span><input type="checkbox" class="switch" name="remember" checked></label>
      <div class="row"><button class="btn pri" type="submit">연결</button><button class="btn" type="button" data-act="pair-cancel">취소</button></div>
      <p class="err" id="sync-err"></p></form>`;
  }
  if (SYNC && !memKey) {
    return `<p>동기화가 잠겨 있어요. 비밀번호를 넣으면 이어서 동기화해요.</p>
      <form id="unlock-form"><label class="f"><span>동기화 비밀번호</span><input type="password" name="pw" required></label>
      <label class="set-row" style="border:0;padding:4px 0"><span class="lbl">이 기기에서 비밀번호 기억</span><input type="checkbox" class="switch" name="remember"></label>
      <div class="row"><button class="btn pri" type="submit">열기</button><button class="btn ghost" type="button" data-act="disconnect">연결 해제</button></div>
      <p class="err" id="sync-err"></p></form>`;
  }
  if (syncReady()) {
    const others = Object.values(remoteCache).map((r) => `${esc(r.name || "기기")} (${r.updated ? new Date(r.updated).toLocaleString("ko-KR") : "-"})`);
    return `<p class="okt">${ICON.check} GitHub와 연결됨 · 마지막 동기화 ${syncState.last ? new Date(syncState.last).toLocaleString("ko-KR") : "-"}</p>
      ${syncState.err ? `<p class="err">${esc(syncErrorText())}</p>` : ""}
      <p class="small muted">다른 기기: ${others.length ? others.join(", ") : "아직 없음"}</p>
      <div class="btn-row wrap"><button class="btn pri" data-act="sync-now">지금 동기화</button><button class="btn" data-act="pair-show">다른 기기 연결 (QR)</button>
      <button class="btn ghost" data-act="disconnect">이 기기 연결 해제</button></div>`;
  }
  return `<p>지금은 이 기기에만 저장돼요. GitHub에 연결하면 PC와 폰이 같은 기록으로 공부할 수 있어요.</p>
    <p class="small"><b>이미 다른 기기를 연결했다면</b> 그 기기의 설정 → 「다른 기기 연결 (QR)」을 이 기기 카메라로 찍으면 돼요.</p>
    <details><summary>처음 연결하기 (토큰 만드는 법)</summary><ol class="steps">
      <li>GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → Generate new token</li>
      <li>Repository access: <b>Only select repositories</b> → <b>${CFG.repo}</b></li>
      <li>Permissions: <b>Contents → Read and write</b></li>
      <li>토큰(github_pat_…)을 아래에 넣고 동기화 비밀번호를 정하세요</li></ol></details>
    <form id="connect-form">
      <label class="f"><span>GitHub 토큰</span><input type="password" name="tok" autocomplete="off" required></label>
      <label class="f"><span>동기화 비밀번호</span><input type="password" name="pw" autocomplete="new-password" required></label>
      <label class="f"><span>비밀번호 확인 (처음 설정할 때만)</span><input type="password" name="pw2" autocomplete="new-password"></label>
      <label class="set-row" style="border:0;padding:4px 0"><span class="lbl">이 기기에서 비밀번호 기억</span><input type="checkbox" class="switch" name="remember" checked></label>
      <button class="btn pri" type="submit">연결</button><p class="err" id="sync-err"></p></form>`;
}
function bindSyncForms() {
  const run = (form, fn) => form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#sync-err"), btn = form.querySelector("button[type=submit]");
    err.className = "muted small";
    err.textContent = "확인 중… (비밀번호 계산에 몇 초 걸려요)";
    btn.disabled = true;
    try { await fn(form.elements); render(); toast("동기화를 연결했어요."); }
    catch (ex) { err.className = "err"; err.textContent = ex.message || String(ex); btn.disabled = false; if (!(SYNC && memKey)) token = null; }
  });
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
function bindAiForm() {
  const f = $("#ai-form");
  if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = f.elements.key.value.trim();
    if (!/^sk-ant-/.test(k)) { $("#ai-msg").textContent = "Claude API 키는 sk-ant- 로 시작해요."; return; }
    await saveAiKey(k);
    $("#ai-box").innerHTML = aiPanel(); bindAiForm();
    toast("AI 키를 저장했어요. 「연결 테스트」로 확인해 보세요.");
  });
}
AFTER.settings = () => { bindSyncForms(); bindAiForm(); if (ctx.focus === "ai" && $("#ai-box")) $("#ai-box").scrollIntoView({block: "center"}); };
async function aiTest() {
  const m = $("#ai-msg");
  m.className = "muted small"; m.textContent = "테스트 중…";
  try {
    const {json} = await claude({messages: [{role: "user", content: "영어 단어 'cash'의 뜻으로 학습자가 '현찰'이라고 답했어. 맞아?"}], schema: JUDGE_SCHEMA, maxTokens: 1000});
    m.className = "okt small"; m.textContent = `연결 성공! 예시 채점: ${json.correct ? "정답" : "오답"} — ${json.reason}`;
  } catch (e) { m.className = "err small"; m.textContent = e.message; }
}
async function showPairQR() {
  const link = await pairLink();
  openModal(`<h2>다른 기기 연결</h2>
    <p class="small">연결할 기기(폰) 카메라로 QR을 찍어 열고, 동기화 비밀번호를 넣으면 끝이에요.${AI.key ? " AI 키도 함께 옮겨져요." : ""}</p>
    <div class="qr" id="qr"><span class="spinner"></span></div>
    <p class="small muted">아이폰은 Safari에서 연결한 뒤 「홈 화면에 추가」를 하면 홈 화면 앱은 한 번 더 연결해야 할 수 있어요. 그럴 땐 아래 주소를 복사해 쓰세요.</p>
    <code class="link">${esc(link)}</code>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="copy" data-text="${esc(link)}">주소 복사</button><button class="btn pri" data-act="close">닫기</button></div>
    <p class="small muted">이 주소에는 토큰이 비밀번호로 암호화되어 들어 있어요. 다른 사람에게 보내지는 마세요.</p>`);
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js");
    const qr = window.qrcode(0, "M");
    qr.addData(link); qr.make();
    if ($("#qr")) $("#qr").innerHTML = qr.createSvgTag({cellSize: 4, margin: 2, scalable: true});
  } catch (e) { if ($("#qr")) $("#qr").textContent = "QR을 만들지 못했어요. 주소를 복사해서 쓰세요."; }
}
function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}
function exportBackup() {
  const blob = new Blob([JSON.stringify({app: "LiBird Words", v: 2, exported: new Date().toISOString(), state: S}, null, 1)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `libird-words-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    const st = normState(j.state || j);
    mergeInto(S, st);
    save(); render(); toast("백업을 합쳤어요.");
  } catch (e) { toast("백업 파일을 읽지 못했어요."); }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("복사했어요."); }
  catch (e) { openModal(`<p>아래를 길게 눌러 복사하세요.</p><textarea style="min-height:160px">${esc(text)}</textarea><button class="btn" data-act="close">닫기</button>`); }
}

// ============================================================ AI 대화
const CHAT = {open: false, msgs: lsGet("lbw.chat", []), busy: false, cardId: null, err: ""};
const CHAT_SYSTEM = TUTOR + " 답은 짧은 문단과 목록 위주로 써. 마크다운은 **굵게**, - 목록, 번호 목록 정도만 써. 예문에는 한국어 해석을 붙여.";
function mdLite(text) {
  const lines = esc(text).split("\n");
  let html = "", list = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const raw of lines) {
    const l = raw.trimEnd();
    const ul = l.match(/^\s*[-•*]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/), hd = l.match(/^#{1,4}\s+(.*)/);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      if (list !== tag) { if (list) html += `</${list}>`; html += `<${tag}>`; list = tag; }
      html += `<li>${inline((ul || ol)[1])}</li>`;
      continue;
    }
    if (list) { html += `</${list}>`; list = null; }
    if (hd) html += `<p><b>${inline(hd[1])}</b></p>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (list) html += `</${list}>`;
  return html;
}
const msgText = (m) => typeof m.content === "string" ? m.content : (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
function chatSuggestions() {
  const c = CHAT.cardId ? card(CHAT.cardId) : null;
  if (c) return c.lang === "en" ? ["예문 3개 더 보여줘", "비슷한 말과 차이는?", "논문에서는 어떻게 써?", "외우는 요령 알려줘"] : ["예문 더 보여줘", "비슷한 말과 차이는?", "한자 뜻 풀어줘", "외우는 요령 알려줘"];
  return LANG === "en" ? ["affect와 effect 차이", "논문에서 however 대신 쓸 표현", "오늘 배운 단어로 예문 만들어줘", "이메일 첫 문장 자연스럽게"] : ["は와 が 차이가 뭐야?", "です와 ます는 언제 써?", "오늘 배운 단어로 쉬운 문장 만들어줘", "가타카나는 언제 써?"];
}
function chatHTML() {
  const c = CHAT.cardId ? card(CHAT.cardId) : null;
  const msgs = CHAT.msgs.map((m) => `<div class="msg ${m.role}">${m.role === "user" ? esc(msgText(m)).replace(/\n/g, "<br>") : mdLite(msgText(m))}</div>`).join("");
  return `<div class="chat-head"><b>${ICON.spark} AI에게 묻기</b><span class="chip">${esc(AI_MODELS.find((m) => m[0] === S.settings.aiModel)[1])}</span><span class="grow"></span>
      <button class="btn ghost sm" data-act="chat-new">새 대화</button><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    ${c ? `<div class="chat-ctx">📌 <b class="${c.lang === "ja" ? "jp" : ""}">${esc(c.word || c.ch)}</b> — ${esc(shortKo(c.ko))}</div>` : ""}
    <div class="chat-log" id="chat-log">${msgs || `<div class="chat-empty">단어 뜻, 쓰임새, 뉘앙스, 문법… 무엇이든 물어보세요.<br><span class="muted small">답은 ${esc(AI_MODELS.find((m) => m[0] === S.settings.aiModel)[1])}가 해요.</span></div>`}
      ${CHAT.busy ? `<div class="msg assistant typing"><span></span><span></span><span></span></div>` : ""}${CHAT.err ? `<div class="msg err">${esc(CHAT.err)}</div>` : ""}</div>
    ${!CHAT.busy ? `<div class="chat-sug">${chatSuggestions().map((s) => `<button data-act="chat-sug" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
    <form class="chat-form" id="chat-form"><textarea id="chat-in" rows="1" placeholder="질문을 입력하세요"></textarea><button class="btn pri" type="submit" ${CHAT.busy ? "disabled" : ""} aria-label="보내기">${ICON.send}</button></form>`;
}
function openChat(cardId = null) {
  if (!hasAI()) { aiNeeded(); return; }
  if (cardId && cardId !== CHAT.cardId) { CHAT.msgs = []; }
  CHAT.cardId = cardId;
  CHAT.open = true;
  CHAT.err = "";
  openModal(chatHTML(), "chat");
  bindChat();
}
function renderChat() {
  if (!CHAT.open) return;
  const keep = $("#chat-in") ? $("#chat-in").value : "";
  $("#modal-body").innerHTML = chatHTML();
  bindChat();
  $("#chat-in").value = keep;
}
function bindChat() {
  const log = $("#chat-log");
  if (log) log.scrollTop = log.scrollHeight;
  const f = $("#chat-form"), inp = $("#chat-in");
  f.addEventListener("submit", (e) => { e.preventDefault(); sendChat(inp.value); });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(inp.value); } });
  inp.addEventListener("input", () => { inp.style.height = "auto"; inp.style.height = Math.min(140, inp.scrollHeight) + "px"; });
  if (matchMedia("(hover: hover)").matches) inp.focus();
}
async function sendChat(text) {
  text = String(text || "").trim();
  if (!text || CHAT.busy) return;
  let content = text;
  const c = CHAT.cardId ? card(CHAT.cardId) : null;
  if (c && !CHAT.msgs.length) {
    const info = c.type === "kana" ? `가나 ${c.ch} (${c.romaji})` : c.type === "word" ? `일본어 ${c.word} (읽기 ${c.kana}, ${c.romaji}) — 뜻: ${c.ko}` : `영어 ${c.word}${c.pos ? ` (${c.pos})` : ""} — 뜻: ${c.ko}${c.ex ? ` / 예문: ${c.ex}` : ""}`;
    content = `[지금 공부 중인 카드] ${info}\n\n${text}`;
  }
  if (/오늘 배운 단어/.test(text)) {
    const today = startOfDay(Date.now());
    const words = Object.keys(S.cards).filter((id) => CARDS[id] && CARDS[id].lang === LANG && CARDS[id].type !== "kana" && (S.cards[id].t || 0) >= today).map((id) => CARDS[id].word).slice(0, 20);
    content += words.length ? `\n(오늘 배운 단어: ${words.join(", ")})` : "\n(오늘 배운 단어가 아직 없어. 지금 수준에 맞는 기초 단어로 해 줘.)";
  }
  CHAT.msgs.push({role: "user", content});
  CHAT.busy = true; CHAT.err = "";
  renderChat();
  $("#chat-in").value = "";
  try {
    const {message} = await claude({system: CHAT_SYSTEM, messages: CHAT.msgs, maxTokens: 4000, effort: "low"});
    CHAT.msgs.push({role: "assistant", content: message.content});
  } catch (e) {
    CHAT.msgs.pop();
    CHAT.err = e.message;
    if ($("#chat-in")) $("#chat-in").value = text;
  }
  CHAT.busy = false;
  lsSet("lbw.chat", CHAT.msgs);
  renderChat();
  if (!CHAT.err && $("#chat-in")) $("#chat-in").value = "";
}
