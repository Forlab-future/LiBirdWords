"use strict";
// LiBird Words — 홈(학습) · 단어장 · 카드 상세 · 내 단어장 만들기

function confirmInline(el, msg) {
  if (el.dataset.armed) return true;
  el.dataset.armed = "1";
  const old = el.innerHTML;
  el.textContent = "한 번 더 누르면 실행";
  toast(msg);
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.innerHTML = old; } }, 4000);
  return false;
}
const seg = (name, cur, opts) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" class="${v === cur ? "on" : ""}" data-act="seg" data-seg="${name}" data-v="${v}">${l}</button>`).join("")}</div>`;
const MODE_OPTS = [["type", "타이핑"], ["choice", "객관식"], ["self", "스스로"]];
const DIR_OPTS = {ja: [["fwd", "글자→뜻"], ["rev", "뜻→글자"], ["mix", "섞기"]], en: [["fwd", "단어→뜻"], ["rev", "뜻→단어"], ["mix", "섞기"]]};

// ------------------------------------------------------------ 홈 (학습)
VIEWS.home = () => {
  const lang = LANG, L = LANGS[lang];
  const due = dueIds(lang).length, fresh = newIds(lang).length, b = newBudget(lang);
  const doneToday = Math.round(dayCount(todayStr(), lang));
  const total = doneToday + due + fresh, ratio = total ? doneToday / total : 0;
  const started = Object.keys(S.cards).some((id) => CARDS[id] && CARDS[id].lang === lang);
  const d = new Date(), dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 ${"일월화수목금토"[d.getDay()]}요일`;
  const C = 2 * Math.PI * 42;
  let note = "";
  if (b.factor === 0) note = `복습이 ${b.dueRev}개 밀려서 오늘은 새 항목을 쉬어요. 복습부터 끝내요!`;
  else if (b.factor < 1) note = `복습이 ${b.dueRev}개 밀려서 새 항목을 절반으로 줄였어요.`;
  const welcome = started ? "" : lang === "ja"
    ? `<div class="welcome anim"><h3>히라가나부터 시작해요 🌸</h3><p>오늘은 あ행부터 ${S.settings.kanaNew}글자. 객관식으로 가볍게 시작하고, 익숙해지면 타이핑으로 바꿔 보세요.</p>
       <div class="row" style="margin-top:12px"><button class="btn" data-act="study" data-lang="ja">첫 공부 시작</button><button class="btn ghost light" data-act="kana-chart">가나표 구경하기</button></div></div>`
    : `<div class="welcome anim"><h3>아는 단어부터 걸러요 ✂️</h3><p>AWL 앞쪽 단어는 대부분 아실 거예요. 먼저 빼 두면 모르는 단어만 남아요.</p>
       <div class="row" style="margin-top:12px"><button class="btn" data-act="sort">아는 단어 거르기</button><button class="btn ghost light" data-act="study" data-lang="en">바로 공부 시작</button></div></div>`;
  return `<div class="hello anim"><div><div class="date">${dateStr}</div><h1>${L.name} 공부</h1></div>
      <div class="streak-badge" data-tip="연속으로 공부한 날"><span class="fire">🔥</span>${streak()}일</div></div>
    ${welcome}
    <div class="box anim">
      <div class="today">
        <div class="ring"><svg width="96" height="96"><circle class="bg" cx="48" cy="48" r="42" stroke-width="9" fill="none"/>
          <circle class="fg" cx="48" cy="48" r="42" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - ratio)).toFixed(1)}"/></svg>
          <div class="label"><div><b>${Math.round(ratio * 100)}%</b><span>오늘</span></div></div></div>
        <div class="today-txt"><b>${due + fresh ? `${due + fresh}장 남았어요` : doneToday ? "오늘 목표 완료!" : "오늘 할 카드가 없어요"}</b>
          <p>복습 ${due} · 새 항목 ${fresh} · 오늘 ${doneToday}장 공부</p></div>
      </div>
      ${note ? `<div class="note" style="margin-top:12px">${note}</div>` : ""}
      <div style="margin-top:14px">${due + fresh ? `<button class="btn pri big" data-act="study" data-lang="${lang}">${ICON.play} 공부 시작</button>`
        : `<div class="done-msg">${ICON.check} 오늘 할 건 다 했어요</div><button class="btn pri big" data-act="study-more" data-lang="${lang}">새 항목 5개 더</button>`}</div>
      <div class="btn-row" style="margin-top:8px"><button class="btn soft" data-act="free" data-lang="${lang}">자유 복습</button><button class="btn soft" data-act="tab" data-tab="library">단어장 골라 공부</button></div>
    </div>
    <div class="box anim"><div class="row between"><b>공부 방식</b><span class="muted small">${lang === "ja" ? "초보는 객관식 추천" : "타이핑이 기억에 오래 남아요"}</span></div>
      <div class="mode-rows"><div><span class="muted small">답하는 법</span>${seg("mode", S.settings.mode[lang], MODE_OPTS)}</div>
      <div><span class="muted small">방향</span>${seg("dir", S.settings.dir[lang], DIR_OPTS[lang])}</div></div>
      ${S.settings.mode[lang] === "type" ? `<p class="muted small" style="margin:10px 0 0">${hasAI() ? "✨ 뜻이 조금 달라도 AI가 맞는지 판단해요." : "비슷한 뜻·오타는 자동으로 봐줘요. 설정에서 AI 채점을 켜면 더 똑똑해져요."}</p>` : ""}
    </div>
    ${lang === "ja" ? roadHTML() : deckProgressHTML("en")}
    ${customSummaryHTML(lang)}
    <h2>바로가기</h2>
    <div class="tiles">
      <button class="tile" data-act="tab" data-tab="games"><span class="ic">${ICON.game}</span><b>게임</b><span>짝 맞추기 · 스피드 퀴즈 · 듣기</span></button>
      <button class="tile" data-act="tab" data-tab="read"><span class="ic">${ICON.read}</span><b>읽기</b><span>한 문단 글 읽고 해석·문제 풀기</span></button>
      <button class="tile" data-act="chat"><span class="ic">${ICON.spark}</span><b>AI에게 묻기</b><span>뜻·쓰임새·뉘앙스 질문</span></button>
    </div>`;
};
function roadHTML() {
  let curFound = false;
  const items = STAGES.map((st) => {
    const p = groupProgress(st.id), open = unlocked(st.id);
    let cls = "lock", mark = ICON.lock;
    if (open && p.ratio >= UNLOCK_AT) { cls = "done"; mark = "✓"; }
    else if (open && !curFound) { cls = "cur"; mark = "▶"; curFound = true; }
    else if (open) { cls = "open"; mark = "·"; }
    const sub = open ? st.desc : `${STAGE[st.req].name} ${Math.round(UNLOCK_AT * 100)}% 익히면 열려요`;
    return `<li class="${cls}" data-act="deck" data-id="${st.id}"><span class="st">${mark}</span><span class="nm">${st.name}<small>${sub}</small>
      <span class="bar"><i style="width:${Math.round(p.ratio * 100)}%"></i></span></span><span class="ct">${p.done}/${p.total}</span></li>`;
  }).join("");
  return `<h2>로드맵 <span class="muted small">단계를 누르면 단어장이 열려요</span></h2><div class="box"><ul class="road">${items}</ul></div>`;
}
function deckProgressHTML(lang) {
  const gs = Object.values(GROUPS).filter((g) => g.lang === lang && g.kind !== "custom");
  return `<h2>덱 진행</h2><div class="box"><ul class="road">${gs.map((g) => {
    const p = groupProgress(g.id), on = groupOn(g.id);
    return `<li class="${on ? (p.ratio >= UNLOCK_AT ? "done" : "open") : "lock"}" data-act="deck" data-id="${g.id}"><span class="st">${on ? (p.ratio >= UNLOCK_AT ? "✓" : Math.round(p.ratio * 100)) : "–"}</span>
      <span class="nm">${esc(g.name)}<small>${on ? esc(g.desc) : "학습에서 꺼짐"}</small><span class="bar"><i style="width:${Math.round(p.ratio * 100)}%"></i></span></span><span class="ct">${p.done}/${p.total}</span></li>`;
  }).join("")}</ul></div>`;
}
function customSummaryHTML(lang) {
  const ds = customDecks(lang);
  if (!ds.length) return `<div class="box flat cta"><div><b>내 분야 단어장 만들기</b><p class="muted small">원하는 분야의 단어를 직접 넣거나, 주제만 말하면 AI가 만들어줘요.</p></div>
    <button class="btn soft" data-act="new-deck">${ICON.plus} 만들기</button></div>`;
  return `<h2>내 단어장 <button class="btn ghost sm" data-act="new-deck">${ICON.plus} 새로</button></h2><div class="box"><ul class="road">${ds.map((d) => {
    const p = groupProgress(d.id);
    return `<li class="${groupOn(d.id) ? "open" : "lock"}" data-act="deck" data-id="${d.id}"><span class="st">${p.total ? Math.round(p.ratio * 100) : "0"}</span>
      <span class="nm">${esc(d.name)}<small>${p.total}개 카드${groupOn(d.id) ? "" : " · 학습에서 꺼짐"}</small><span class="bar"><i style="width:${Math.round(p.ratio * 100)}%"></i></span></span><span class="ct">${p.done}/${p.total}</span></li>`;
  }).join("")}</ul></div>`;
}

// ------------------------------------------------------------ 단어장
const FILTERS = [["all", "전체"], ["new", "새 항목"], ["learn", "익히는 중"], ["review", "복습 중"], ["known", "알아요"], ["wrong", "자주 틀림"]];
function cardMatches(id, f, q) {
  const c = card(id), st = status(id), r = S.cards[id];
  if (f === "new" && st !== "new") return false;
  if (f === "learn" && st !== "learn") return false;
  if (f === "review" && st !== "review" && st !== "mature") return false;
  if (f === "known" && st !== "known") return false;
  if (f === "wrong" && !(r && (r.wrong || 0) + (r.lapses || 0) >= 2)) return false;
  if (!q) return true;
  const hay = [c.word, c.ch, c.kana, c.romaji, c.ko, c.key].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q) || (c.kana && toHira(q) && hay.includes(toHira(q)));
}
function cardRow(id) {
  const c = card(id), st = status(id), r = S.cards[id];
  const jp = c.lang === "ja";
  let w, m;
  if (c.type === "kana") { w = c.ch; m = `${esc(c.romaji)} · ${esc(c.ko)}`; }
  else if (c.type === "word") { w = c.word; m = `${esc(shortKo(c.ko))} <small class="jp">${c.kana && c.kana !== c.word ? esc(c.kana) : ""}</small>`; }
  else if (c.type === "sent") { w = c.word.length > 34 ? c.word.slice(0, 32) + "…" : c.word; m = esc(c.ko); }
  else { w = c.word; m = esc(shortKo(c.ko)); }
  return `<button class="lib-row" data-act="card" data-id="${esc(id)}"><span class="w${jp ? " jp" : ""}${c.type === "sent" ? " s" : ""}">${esc(w)}</span><span class="m">${m}</span>
    <span class="r"><span class="chip ${st}">${STATUS_LABEL[st]}</span>${r && r.due && (st === "review" || st === "mature" || st === "learn") ? `<small>${relDue(r.due)}</small>` : ""}</span></button>`;
}
VIEWS.library = () => {
  if (ctx.f == null) { ctx.f = "all"; ctx.q = ""; }
  return `<div class="hello"><div><div class="date">${LANGS[LANG].name}</div><h1>단어장</h1></div><button class="btn soft" data-act="new-deck">${ICON.plus} 새 단어장</button></div>
    <label class="search">${ICON.search}<input id="lib-q" type="search" placeholder="단어·뜻·읽기로 찾기" value="${esc(ctx.q)}" autocomplete="off"></label>
    <div class="filters">${FILTERS.map(([k, l]) => `<button class="${ctx.f === k ? "on" : ""}" data-act="lib-filter" data-f="${k}">${l}</button>`).join("")}</div>
    <div id="lib-body">${libBody()}</div>`;
};
function libBody() {
  const q = (ctx.q || "").trim().toLowerCase();
  if (q || ctx.f !== "all") {
    const ids = Object.keys(CARDS).filter((id) => CARDS[id].lang === LANG && cardMatches(id, ctx.f, q));
    if (!ids.length) return `<div class="empty-state">찾는 카드가 없어요.</div>`;
    return `<p class="muted small">${ids.length}개${ids.length > 150 ? " (앞의 150개만 보여요)" : ""}</p><div class="lib-list">${ids.slice(0, 150).map(cardRow).join("")}</div>`;
  }
  const builtin = Object.values(GROUPS).filter((g) => g.lang === LANG && g.kind !== "custom");
  const mine = customDecks(LANG);
  return `<h2>기본 단어장</h2><div class="deck-list">${builtin.map(deckRowHTML).join("")}</div>
    <h2>내 단어장</h2>${mine.length ? `<div class="deck-list">${mine.map((d) => deckRowHTML(GROUPS[d.id])).join("")}</div>`
      : `<div class="box flat center"><p class="sub" style="margin:4px 0 12px">전공·취미·시험 등 원하는 분야의 단어장을 만들 수 있어요.<br>직접 입력, 엑셀에서 붙여넣기, AI로 자동 생성이 돼요.</p>
         <div class="row" style="justify-content:center"><button class="btn pri" data-act="new-deck">${ICON.plus} 새 단어장</button></div></div>`}`;
}
function deckRowHTML(g) {
  if (!g) return "";
  const p = groupProgress(g.id), open = unlocked(g.id), on = groupOn(g.id);
  const sub = !open ? "🔒 잠김 · 미리 열 수 있어요" : !on ? "학습에서 꺼짐" : `${p.total}개 · 익힘 ${p.done}`;
  const due = dueIds(g.lang, g.id).length;
  return `<button class="deck-row" data-act="deck" data-id="${g.id}"><span class="dk-ic">${g.kind === "custom" ? "★" : g.lang === "ja" ? (g.pool === "kana" ? "あ" : "語") : "Aa"}</span>
    <span class="dk-tx"><b>${esc(g.name)}</b><small>${esc(sub)}</small><span class="bar"><i style="width:${Math.round(p.ratio * 100)}%"></i></span></span>
    <span class="dk-r">${due ? `<span class="chip learn">복습 ${due}</span>` : ""}${ICON.chev}</span></button>`;
}
AFTER.library = () => {
  const inp = $("#lib-q");
  if (!inp) return;
  inp.addEventListener("input", () => { ctx.q = inp.value; $("#lib-body").innerHTML = libBody(); });
};

// ------------------------------------------------------------ 단어장 상세
VIEWS.deck = () => {
  const g = GROUPS[ctx.gid];
  if (!g) return `<div class="empty-state">단어장을 찾지 못했어요.</div>`;
  const ids = BY_GROUP[g.id] || [];
  const p = groupProgress(g.id), open = unlocked(g.id), on = groupOn(g.id);
  const cnt = {new: 0, learn: 0, review: 0, known: 0};
  for (const id of ids) { const s = status(id); cnt[s === "mature" ? "review" : s]++; }
  const learned = ids.some((id) => S.cards[id] && ["learn", "review"].includes(S.cards[id].s));
  const custom = g.kind === "custom";
  return `<div class="s-top"><button class="icon-btn" data-act="tab" data-tab="library" aria-label="뒤로">${ICON.back}</button><b class="grow">${esc(g.name)}</b>
      ${custom ? `<button class="icon-btn" data-act="deck-menu" data-id="${g.id}" aria-label="메뉴">${ICON.more}</button>` : ""}</div>
    <div class="box">
      <p class="sub" style="margin-bottom:10px">${esc(g.desc || "")}</p>
      <div class="stack" data-tip="새 ${cnt.new} · 익히는 중 ${cnt.learn} · 복습 중 ${cnt.review} · 알아요 ${cnt.known}">${stackBars([["known", cnt.known], ["review", cnt.review], ["learn", cnt.learn], ["new", cnt.new]], ids.length)}</div>
      <div class="legend"><span><i class="st-known"></i>알아요 ${cnt.known}</span><span><i class="st-review"></i>복습 중 ${cnt.review}</span><span><i class="st-learn"></i>익히는 중 ${cnt.learn}</span><span><i class="st-new"></i>새 항목 ${cnt.new}</span></div>
      ${!open ? `<div class="note" style="margin:12px 0 0">🔒 아직 잠긴 단계예요. ${esc(STAGE[g.id].name)}을(를) 지금 열고 싶으면 아래 스위치를 켜세요.</div>` : ""}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn pri" data-act="deck-study" data-id="${g.id}" ${ids.length && open ? "" : "disabled"}>${ICON.play} 이 단어장 공부</button>
        <button class="btn soft" data-act="free-go" data-scope="group" data-group="${g.id}" data-lang="${g.lang}" ${learned ? "" : "disabled"}>자유 복습</button></div>
      ${cnt.new ? `<button class="btn ghost sm" data-act="sort-group" data-id="${g.id}" style="margin-top:8px">✂️ 아는 항목 거르기</button>` : ""}
    </div>
    <div class="set-list">
      ${STAGE[g.id] && STAGE[g.id].req ? `<label class="set-row"><span class="lbl">이 단계 미리 열기<small>보통은 이전 단계를 ${Math.round(UNLOCK_AT * 100)}% 익히면 자동으로 열려요</small></span><input type="checkbox" class="switch" data-unlock="${g.id}" ${S.settings.unlocked[g.id] ? "checked" : ""}></label>` : ""}
      ${g.kind !== "stage" ? `<label class="set-row"><span class="lbl">오늘의 학습에 포함<small>끄면 새 항목·복습이 이 단어장에서 나오지 않아요</small></span><input type="checkbox" class="switch" data-deck="${g.id}" ${on ? "checked" : ""}></label>` : ""}
    </div>
    ${custom ? `<div class="btn-row wrap" style="margin:14px 0"><button class="btn" data-act="add-card" data-id="${g.id}">${ICON.plus} 단어 추가</button>
      <button class="btn" data-act="paste-cards" data-id="${g.id}">여러 개 붙여넣기</button><button class="btn" data-act="ai-fill" data-id="${g.id}">${ICON.spark} AI로 채우기</button></div>` : ""}
    <h2>카드 ${ids.length}개</h2>
    ${ids.length ? `<div class="lib-list">${ids.map(cardRow).join("")}</div>` : `<div class="empty-state">아직 카드가 없어요. 위에서 단어를 추가해 보세요.</div>`}`;
};
function stackBars(parts, total) {
  return parts.filter(([, n]) => n > 0).map(([k, n]) => `<i class="st-${k}" style="flex:${n}"></i>`).join("") || `<i class="st-new" style="flex:1"></i>`;
}

// ------------------------------------------------------------ 카드 상세
function openCard(id) {
  const c = card(id);
  if (!c) return;
  const r = S.cards[id], st = status(id);
  const front = c.type === "kana" ? `<div class="glyph">${esc(c.ch)}</div>` : c.type === "word" ? jpWordHTML(c) : c.type === "sent" ? `<div class="sentence">${esc(c.word)}</div>` : `<div class="word en">${esc(c.word)}</div>${c.pos ? `<div class="pos">${esc(c.pos)}</div>` : ""}`;
  openModal(`<div class="row between"><span class="chip ${st}">${STATUS_LABEL[st]}</span><span class="muted small">${esc((GROUPS[c.group] || {}).name || "")}</span></div>
    <div class="face center" style="padding:14px 0 4px">${front}</div>
    ${answerHTML(c)}
    <div class="sumgrid mini"><div><b>${r && r.due && st !== "known" ? relDue(r.due) : "–"}</b><span>다음 복습</span></div><div><b>${r && r.reps || 0}</b><span>본 횟수</span></div>
      <div><b>${r && (r.wrong || 0) + (r.lapses || 0) || 0}</b><span>틀린 횟수</span></div><div><b>${r && r.ivl ? r.ivl + "일" : "–"}</b><span>현재 간격</span></div></div>
    <div class="btn-row wrap"><button class="btn soft" data-act="chat-card" data-id="${esc(id)}">${ICON.spark} AI에게 묻기</button><button class="btn" data-act="edit" data-id="${esc(id)}">${ICON.edit} 고치기</button></div>
    <div class="btn-row wrap" style="margin-top:8px">${st === "known" ? `<button class="btn ghost sm" data-act="card-unknow" data-id="${esc(id)}">다시 배우기</button>` : `<button class="btn ghost sm" data-act="card-know" data-id="${esc(id)}">알아요로 빼기</button>`}
      ${r ? `<button class="btn ghost sm" data-act="card-reset" data-id="${esc(id)}">진도 초기화</button>` : ""}
      ${c.custom ? `<button class="btn ghost sm danger" data-act="card-del" data-id="${esc(id)}">${ICON.trash} 삭제</button>` : ""}
      <button class="btn ghost sm" data-act="close" style="margin-left:auto">닫기</button></div>`);
}
const EDIT_FIELDS = {
  kana: [["tip", "외우는 팁"]],
  word: [["word", "단어"], ["kana", "읽기 (히라가나)"], ["romaji", "로마자"], ["ko", "뜻"], ["ex", "예문"], ["exKana", "예문 읽기"], ["exKo", "예문 해석"], ["tip", "팁"]],
  en: [["word", "단어·표현"], ["pos", "품사"], ["ko", "뜻 (여러 뜻은 ; 로)"], ["def", "영어 정의"], ["forms", "관련 형태"], ["ex", "예문"], ["exKo", "예문 해석"], ["tip", "팁"]],
  sent: [["ko", "해석"], ["key", "핵심 표현 (문장 속 그대로)"], ["keyKo", "핵심 표현 뜻"], ["tip", "팁"]]
};
function openEdit(id) {
  const c = card(id), base = CARDS[id];
  const fields = EDIT_FIELDS[c.type].filter(([k]) => c.custom || k !== "word");
  openModal(`<h2>카드 고치기</h2><p class="sub">${c.custom ? "내 단어장 카드예요. 바로 고쳐져요." : "기본 카드는 원본을 두고 내 수정본을 덮어써요. 다른 기기에도 동기화돼요."}</p>
    <form id="edit-form">${fields.map(([k, label]) => `<label class="f"><span>${label}</span><textarea name="${k}" rows="${/^ex|tip|def/.test(k) ? 2 : 1}">${esc(c[k] || "")}</textarea></label>`).join("")}
    <div class="row"><button class="btn pri" type="submit">저장</button><button class="btn" type="button" data-act="close">취소</button>
    ${!c.custom && S.edits[id] && S.edits[id].f && Object.keys(S.edits[id].f).length ? `<button class="btn ghost" type="button" data-act="edit-reset" data-id="${esc(id)}">원래대로</button>` : ""}</div></form>`);
  $("#edit-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const vals = {};
    for (const [k] of fields) vals[k] = e.target.elements[k].value.trim();
    if (c.custom) {
      const cc = S.custom.cards[id];
      if (!vals.word && "word" in vals) { toast("단어는 비울 수 없어요."); return; }
      Object.assign(cc, vals, {t: Date.now()});
      if (cc.kana && "kana" in vals && !vals.romaji) cc.romaji = kanaToRomaji(cc.kana);
      rebuildCustom();
    } else {
      const f = {};
      for (const [k] of fields) if (vals[k] !== (base[k] || "")) f[k] = vals[k];
      S.edits[id] = {f, t: Date.now()};
    }
    save();
    closeModal();
    render();
    toast("고쳤어요.");
  });
}

// ------------------------------------------------------------ 내 단어장 만들기 · 카드 추가
function openNewDeck() {
  openModal(`<h2>새 ${LANGS[LANG].name} 단어장</h2><p class="sub">상단에서 고른 언어(${LANGS[LANG].name})로 만들어져요.</p>
    <form id="nd-form"><label class="f"><span>이름</span><input type="text" name="name" maxlength="40" placeholder="${LANG === "en" ? "예: 전기화학 용어, 토플 고급 어휘" : "예: 여행 일본어, 음식 이름"}" required></label>
    <label class="f"><span>설명 (선택)</span><input type="text" name="desc" maxlength="80"></label>
    ${hasAI() ? `<label class="set-row" style="border:0;padding:6px 0"><span class="lbl">만들고 바로 AI로 채우기<small>이름을 주제로 카드 20개를 만들어요</small></span><input type="checkbox" class="switch" name="ai" checked></label>` : ""}
    <div class="row" style="margin-top:10px"><button class="btn pri" type="submit">만들기</button><button class="btn" type="button" data-act="close">취소</button></div></form>`);
  $("#nd-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const el = e.target.elements, now = Date.now();
    const id = "d:" + newId(5);
    S.custom.decks[id] = {id, lang: LANG, name: el.name.value.trim(), desc: el.desc.value.trim(), created: now, t: now};
    rebuildCustom();
    save();
    closeModal();
    go("deck", {gid: id});
    if (el.ai && el.ai.checked) openAiFill(id, true);
  });
}
function deckMenu(gid) {
  const d = S.custom.decks[gid];
  openModal(`<h2>${esc(d.name)}</h2>
    <form id="rn-form"><label class="f"><span>이름</span><input type="text" name="name" value="${esc(d.name)}" maxlength="40"></label>
    <label class="f"><span>설명</span><input type="text" name="desc" value="${esc(d.desc || "")}" maxlength="80"></label>
    <div class="row"><button class="btn pri" type="submit">저장</button><button class="btn ghost danger" type="button" data-act="deck-del" data-id="${gid}">${ICON.trash} 단어장 삭제</button></div></form>`);
  $("#rn-form").addEventListener("submit", (e) => {
    e.preventDefault();
    Object.assign(d, {name: e.target.elements.name.value.trim() || d.name, desc: e.target.elements.desc.value.trim(), t: Date.now()});
    rebuildCustom(); save(); closeModal(); render();
  });
}
function addCustomCards(gid, list) {
  const now = Date.now(), lang = S.custom.decks[gid].lang;
  const existing = new Set((BY_GROUP[gid] || []).map((id) => (CARDS[id].word || "").toLowerCase()));
  let n = 0;
  list.forEach((x, i) => {
    const word = String(x.word || "").trim();
    if (!word || !String(x.ko || "").trim() || existing.has(word.toLowerCase())) return;
    existing.add(word.toLowerCase());
    const id = "c:" + newId(6);
    const kana = lang === "ja" ? String(x.kana || x.reading || "").trim() : "";
    S.custom.cards[id] = {id, deck: gid, word, ko: String(x.ko).trim(), pos: x.pos || "", def: x.def || "", ex: x.ex || "", exKo: x.exKo || "", tip: x.tip || "",
      ...(lang === "ja" ? {kana: kana || word, romaji: x.romaji || kanaToRomaji(kana || word)} : {}), created: now + i, t: now + i};
    n++;
  });
  rebuildCustom();
  save();
  return n;
}
function openAddCard(gid) {
  const ja = S.custom.decks[gid].lang === "ja";
  openModal(`<h2>단어 추가</h2>
    <form id="ac-form"><label class="f"><span>${ja ? "단어 (한자 가능)" : "단어·표현"} *</span><input type="text" name="word" required ${ja ? 'lang="ja"' : 'autocapitalize="off"'}></label>
    ${ja ? `<label class="f"><span>읽기 (히라가나, 한자일 때)</span><input type="text" name="kana" lang="ja"></label>` : `<label class="f"><span>품사 (선택, 예: n., v., adj.)</span><input type="text" name="pos"></label>`}
    <label class="f"><span>뜻 * (여러 뜻은 ; 로 구분)</span><input type="text" name="ko" required></label>
    <label class="f"><span>예문 (선택)</span><input type="text" name="ex" ${ja ? 'lang="ja"' : ""}></label>
    <label class="f"><span>예문 해석 (선택)</span><input type="text" name="exKo"></label>
    <label class="f"><span>메모·팁 (선택)</span><input type="text" name="tip"></label>
    <div class="row"><button class="btn pri" type="submit" name="again" value="1">저장하고 하나 더</button><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" data-act="close">닫기</button></div></form>`);
  const form = $("#ac-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const el = form.elements, again = e.submitter && e.submitter.name === "again";
    const n = addCustomCards(gid, [{word: el.word.value, kana: el.kana && el.kana.value, pos: el.pos && el.pos.value, ko: el.ko.value, ex: el.ex.value, exKo: el.exKo.value, tip: el.tip.value}]);
    if (!n) { toast("이미 있는 단어이거나 빈 칸이 있어요."); return; }
    toast("추가했어요.");
    render();
    if (again) { form.reset(); el.word.focus(); } else closeModal();
  });
}
function parsePaste(text, ja) {
  return String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    let parts = line.split("\t");
    if (parts.length < 2) parts = line.split(/\s+[-=:→]\s+|\s*[|]\s*/);
    if (parts.length < 2) { const i = line.indexOf(","); parts = i > 0 ? [line.slice(0, i), line.slice(i + 1)] : [line]; }
    parts = parts.map((p) => p.trim());
    if (ja && parts.length >= 3) return {word: parts[0], kana: parts[1], ko: parts[2], ex: parts[3] || ""};
    return {word: parts[0], ko: parts[1] || "", ex: parts[2] || "", exKo: parts[3] || ""};
  }).filter((x) => x.word && x.ko);
}
function openPaste(gid) {
  const ja = S.custom.decks[gid].lang === "ja";
  openModal(`<h2>여러 개 붙여넣기</h2>
    <p class="sub">한 줄에 하나씩. 엑셀·구글시트에서 복사하면 칸이 탭으로 나뉘어 그대로 들어가요.<br>
    ${ja ? "형식: <b>단어 → 뜻</b> 또는 <b>단어 → 읽기 → 뜻</b>" : "형식: <b>단어 → 뜻</b> (→ 예문 → 예문 해석)"} · 구분: 탭, " - ", " = ", ":", 쉼표</p>
    <textarea id="paste-ta" rows="9" placeholder="${ja ? "猫\tねこ\t고양이\nありがとう - 고마워요" : "sintering - 소결\nanneal\t(열처리로) 풀림하다\ncalcine, 하소하다"}"></textarea>
    <p class="muted small" id="paste-n">0개 인식</p>
    <div class="row"><button class="btn pri" data-act="paste-go" data-id="${gid}">추가</button><button class="btn ghost" data-act="close">취소</button></div>`);
  const ta = $("#paste-ta");
  ta.addEventListener("input", () => { $("#paste-n").textContent = `${parsePaste(ta.value, ja).length}개 인식`; });
  ta.focus();
}

// ------------------------------------------------------------ AI로 단어장 채우기
const CARDS_SCHEMA = obj({cards: {type: "array", items: obj({word: STR, reading: STR, pos: STR, ko: STR, def: STR, ex: STR, exKo: STR, tip: STR})}});
function openAiFill(gid, auto = false) {
  const d = S.custom.decks[gid], ja = d.lang === "ja";
  if (!hasAI()) { aiNeeded(); return; }
  const levels = ja ? [["입문", "입문 (가나 위주)"], ["N5", "초급 N5"], ["N4", "초급 N4"]] : [["B2", "중급 B2"], ["C1", "고급 C1"], ["pro", "전문 용어"]];
  openModal(`<h2>${ICON.spark} AI로 채우기</h2><p class="sub">주제만 알려주면 ${ja ? "일본어" : "영어"} 카드를 만들어줘요. 이미 있는 단어는 빼고 만들어요.</p>
    <form id="ai-form"><label class="f"><span>주제·분야</span><input type="text" name="topic" value="${esc(d.name)}" required></label>
    <div class="grid2 tight"><label class="f"><span>개수</span><select name="n"><option>10</option><option selected>20</option><option>30</option></select></label>
    <label class="f"><span>수준</span><select name="lv">${levels.map(([v, l], i) => `<option value="${v}" ${i === 1 ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="f"><span>추가 요청 (선택)</span><input type="text" name="extra" placeholder="${ja ? "예: 여행에서 바로 쓰는 것 위주로" : "예: 논문 Results 부분에서 자주 쓰는 동사 위주로"}"></label>
    <div class="row"><button class="btn pri" type="submit">만들기</button><button class="btn ghost" type="button" data-act="close">취소</button></div>
    <p class="muted small">AI 사용료가 조금 들어요 (${S.settings.aiModel === "claude-haiku-5-5" ? "Haiku: 20개에 약 1원" : "Opus: 20개에 약 100~200원"}).</p></form>`);
  $("#ai-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = e.target.elements, n = Number(el.n.value), topic = el.topic.value.trim(), lv = el.lv.value, extra = el.extra.value.trim();
    const have = (BY_GROUP[gid] || []).map((id) => CARDS[id].word).slice(0, 120);
    openModal(`<div class="checking" style="padding:40px 0"><span class="spinner"></span>AI가 "${esc(topic)}" 카드 ${n}개를 만들고 있어요… (30초~1분)</div>`);
    const prompt = ja
      ? `주제 「${topic}」의 일본어 학습 카드 ${n}개를 만들어줘. 학습자는 한국인이고 일본어 수준은 ${lv === "입문" ? "히라가나를 막 익힌 입문자(한자 없이 가나로 쓰는 단어 위주)" : `JLPT ${lv}`}. ${extra}
이미 있는 단어는 제외: ${have.join(", ") || "없음"}
규칙: word=일본어 표기(한자 포함 가능), reading=히라가나 읽기(word와 같으면 그대로), pos="", ko=한국어 뜻(여러 뜻은 '; '로), def="", ex=아주 짧고 쉬운 일본어 예문(단어 사이 띄어쓰기), exKo=예문 해석, tip=한국어 한 문장 외우기 팁(한자음 연결 등). 읽기는 반드시 정확하게.`
      : `주제 「${topic}」의 영어 학습 카드 ${n}개를 만들어줘. 학습자는 한국인 SOFC 재료공학 대학원생, 영어 수준 CEFR B2. 카드 수준: ${lv === "pro" ? "해당 분야 전문 용어" : `CEFR ${lv}`}. ${extra}
이미 있는 단어는 제외: ${have.join(", ") || "없음"}
규칙: word=영어 단어나 표현, reading="", pos=품사 약어(n., v., adj., adv., phr. v., idiom 등), ko=한국어 뜻(여러 뜻은 '; '로, 그 분야에서 실제 쓰는 번역어), def=쉬운 영어 정의, ex=그 주제에 맞는 자연스러운 예문, exKo=예문 해석, tip=한국어 한 문장 팁(뉘앙스·자주 같이 쓰는 말·헷갈리는 말).`;
    try {
      const {json} = await claude({system: TUTOR, messages: [{role: "user", content: prompt}], schema: CARDS_SCHEMA, maxTokens: 16000, effort: "low"});
      aiPreview(gid, json.cards.map((x) => ({...x, kana: x.reading})));
    } catch (err) {
      openModal(`<h2>만들지 못했어요</h2><p class="err">${esc(err.message)}</p><div class="row"><button class="btn" data-act="ai-fill" data-id="${gid}">다시 하기</button><button class="btn ghost" data-act="close">닫기</button></div>`);
    }
  });
  if (auto) $("#ai-form [name=topic]").select();
}
let aiDraft = [];
function aiPreview(gid, list) {
  aiDraft = list;
  const ja = S.custom.decks[gid].lang === "ja";
  openModal(`<h2>${list.length}개를 만들었어요</h2><p class="sub">넣고 싶지 않은 카드는 체크를 빼세요. 넣은 뒤에도 고칠 수 있어요.</p>
    <div class="pick-list">${list.map((x, i) => `<label class="pick"><input type="checkbox" data-i="${i}" checked><span><b class="${ja ? "jp" : ""}">${esc(x.word)}</b>${ja && x.kana && x.kana !== x.word ? ` <small class="jp">${esc(x.kana)}</small>` : ""}${x.pos ? ` <small>${esc(x.pos)}</small>` : ""}<br><span class="muted small">${esc(x.ko)}</span></span></label>`).join("")}</div>
    <div class="row" style="margin-top:12px"><button class="btn pri" data-act="ai-add" data-id="${gid}">선택한 카드 넣기</button><button class="btn ghost" data-act="close">취소</button></div>`);
}
function aiNeeded() {
  openModal(`<h2>${ICON.spark} AI 키가 필요해요</h2><p class="sub">이 기능은 Claude API를 써요. 설정 → AI에서 API 키를 넣으면 쓸 수 있어요.${aiLocked() ? "<br>(키는 저장돼 있지만 동기화가 잠겨 있어요. 설정에서 동기화 비밀번호를 넣어 주세요.)" : ""}</p>
    <div class="row"><button class="btn pri" data-act="settings-ai">설정으로</button><button class="btn ghost" data-act="close">닫기</button></div>`);
}
