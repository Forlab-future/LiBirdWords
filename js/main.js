"use strict";
// LiBird Words — 이벤트 · 시작

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    // 이동
    case "home": go("home"); break;
    case "tab": closeModal(); go(el.dataset.tab, {}); break;
    case "settings": closeModal(); go("settings"); break;
    case "settings-ai": closeModal(); go("settings", {focus: "ai"}); break;
    case "lang":
      if (LANG !== el.dataset.lang) { closeModal(); setLang(el.dataset.lang); go(view === "settings" ? "settings" : (TAB_OF[view] || "home"), {}); }
      break;
    case "close": closeModal(); break;
    case "speak": e.stopPropagation(); speak(el.dataset.text, el.dataset.lang); break;
    case "seg": onSeg(el.dataset.seg, el.dataset.v); break;
    case "step": {
      const k = el.dataset.k;
      S.settings[k] = Math.max(0, Math.min(50, (S.settings[k] || 0) + Number(el.dataset.d)));
      S.settings.t = Date.now(); save(); render(); break;
    }
    // 학습
    case "study": closeModal(); startStudy(el.dataset.lang || LANG); break;
    case "study-more": closeModal(); startStudy(el.dataset.lang || LANG, {extra: 5}); break;
    case "deck-study": startStudy(GROUPS[id].lang, {group: id}); break;
    case "free": openFreeModal(el.dataset.lang || LANG); break;
    case "free-go": startFree(el.dataset.lang || LANG, el.dataset.scope, el.dataset.group); break;
    case "quit": if (ctx.done) finishSession(); go("home"); break;
    case "show": selfReveal(); break;
    case "choose": choose(id); break;
    case "hint": hint(); break;
    case "giveup": giveUp(); break;
    case "accept-mine": acceptMine(); break;
    case "grade": grade(Number(el.dataset.g)); break;
    case "free-no": freeAnswer(false); break;
    case "free-yes": freeAnswer(true); break;
    case "sort": closeModal(); startSort(); break;
    case "sort-group": startSort(id); break;
    case "peek": ctx.peek = true; render(); break;
    case "sort-yes": sortAnswer(true); break;
    case "sort-no": sortAnswer(false); break;
    // 단어장
    case "lib-filter": ctx.f = el.dataset.f; render(); break;
    case "deck": closeModal(); go("deck", {gid: id}); break;
    case "card": openCard(id); break;
    case "edit": openEdit(id); break;
    case "edit-reset": S.edits[id] = {f: {}, t: Date.now()}; save(); closeModal(); render(); break;
    case "card-know": S.cards[id] = {...(S.cards[id] || {}), s: "known", t: Date.now()}; save(); closeModal(); render(); toast("학습에서 뺐어요."); break;
    case "card-unknow": S.cards[id] = {s: "new", t: Date.now()}; save(); closeModal(); render(); break;
    case "card-reset": if (confirmInline(el, "이 카드의 학습 기록을 지울까요?")) { S.cards[id] = {s: "new", t: Date.now()}; save(); closeModal(); render(); } break;
    case "card-del": if (confirmInline(el, "이 카드를 지울까요?")) { S.custom.cards[id] = {...S.custom.cards[id], del: true, t: Date.now()}; rebuildCustom(); save(); closeModal(); render(); } break;
    case "new-deck": openNewDeck(); break;
    case "deck-menu": deckMenu(id); break;
    case "deck-del": if (confirmInline(el, "단어장과 그 안의 카드를 지울까요?")) { S.custom.decks[id] = {...S.custom.decks[id], del: true, t: Date.now()}; rebuildCustom(); save(); closeModal(); go("library"); } break;
    case "add-card": openAddCard(id); break;
    case "paste-cards": openPaste(id); break;
    case "paste-go": {
      const list = parsePaste($("#paste-ta").value, S.custom.decks[id].lang === "ja");
      const n = addCustomCards(id, list);
      closeModal(); render(); toast(`${n}개를 넣었어요.${list.length - n ? ` (${list.length - n}개는 중복이라 뺐어요)` : ""}`); break;
    }
    case "ai-fill": openAiFill(id); break;
    case "ai-add": {
      const picked = $$(".pick input:checked").map((x) => aiDraft[Number(x.dataset.i)]);
      const n = addCustomCards(id, picked);
      closeModal(); render(); toast(`${n}개를 넣었어요.`); break;
    }
    // 읽기
    case "passage": go("reader", {pid: id, ko: false, kana: false, ans: {}}); break;
    case "p-new-ai": openPassageAI(); break;
    case "p-paste": openPassagePaste(); break;
    case "p-del": if (confirmInline(el, "이 글을 지울까요?")) { S.custom.passages[id] = {...S.custom.passages[id], del: true, t: Date.now()}; save(); go("read"); } break;
    case "r-play": readAloud(); break;
    case "r-ko": ctx.ko = !ctx.ko; render(); break;
    case "r-kana": ctx.kana = !ctx.kana; render(); break;
    case "r-size": S.settings.readSize = Math.max(14, Math.min(28, (S.settings.readSize || 18) + Number(el.dataset.d) * 2)); save(false); render(); break;
    case "say": if (!e.target.closest("mark")) speak(el.dataset.text, passageById(ctx.pid).lang); break;
    case "gl": case "w": e.stopPropagation(); wordPopup(el.dataset.w); break;
    case "w-add": addWordFromReader(); break;
    case "w-ai": { const w = ctx.wp; closeModal(); CHAT.cardId = null; CHAT.msgs = []; openChat(); sendChat(`글에 나온 「${w.w}」의 뜻과 쓰임새를 알려줘.${w.sentence ? ` 문맥: "${w.sentence}"` : ""}`); break; }
    case "ai-study": aiStudyPassage(id); break;
    case "pq": {
      const qi = Number(el.dataset.q), ci = Number(el.dataset.c), p = passageById(ctx.pid);
      ctx.ans[qi] = ci;
      if (Object.keys(ctx.ans).length === p.questions.length) {
        const right = p.questions.filter((q, i) => ctx.ans[i] === q.answer).length;
        toast(`${p.questions.length}문제 중 ${right}개 맞혔어요!`);
        if (!S.read[p.id]) { S.read[p.id] = Date.now(); save(); }
      }
      render(); break;
    }
    case "r-done": S.read[id] = Date.now(); save(); toast("읽은 글로 표시했어요."); go("read"); break;
    // 게임
    case "g-start": startGame(el.dataset.g); break;
    case "mt": tapMatch(el.dataset.k); break;
    case "sp": answerSpeed(id); break;
    case "ls": answerListen(id); break;
    case "ls-replay": speak(speakText(ctx.q.c), ctx.q.c.lang); break;
    case "cz": answerCloze(Number(el.dataset.i)); break;
    case "g-next": if (ctx.game === "listen") nextListen(); else nextCloze(); break;
    case "quiz": go("quiz"); break;
    case "quiz-pick": {
      if (ctx.q.picked) break;
      ctx.q.picked = id; ctx.n++;
      if (id === ctx.q.id) { ctx.right++; ctx.combo++; } else ctx.combo = 0;
      render(); speak(CARDS[ctx.q.id].ch, "ja", {quiet: true}); break;
    }
    case "quiz-next": newQuizQ(); render(); break;
    case "confuse": go("confuse"); break;
    case "kana-chart": closeModal(); go("chart", {script: "hira"}); break;
    // 설정 · 동기화 · AI
    case "sync-now": syncNow(); break;
    case "pair-show": showPairQR(); break;
    case "pair-cancel": pendingPair = null; render(); break;
    case "disconnect": if (confirmInline(el, "이 기기의 연결을 해제할까요? (기록은 남아요)")) { disconnect(); onSyncChange(); render(); toast("연결을 해제했어요."); } break;
    case "copy": copyText(el.dataset.text); break;
    case "export": exportBackup(); break;
    case "import": $("#import-file").click(); break;
    case "copy-edits": copyText(JSON.stringify(Object.entries(S.edits).filter(([, x]) => x.f && Object.keys(x.f).length).map(([k, x]) => ({id: k, ...x.f})), null, 1)); break;
    case "unknown-all":
      if (confirmInline(el, "'알아요'로 뺀 카드를 모두 다시 학습에 넣을까요?")) {
        const now = Date.now();
        for (const [k, r] of Object.entries(S.cards)) if (r.s === "known") S.cards[k] = {s: "new", t: now};
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
    case "ai-test": aiTest(); break;
    case "ai-del": if (confirmInline(el, "이 기기에서 AI 키를 지울까요?")) { saveAiKey(""); $("#ai-box").innerHTML = aiPanel(); bindAiForm(); } break;
    case "chat": openChat(null); break;
    case "chat-card": closeModal(); openChat(id); break;
    case "chat-new": CHAT.msgs = []; CHAT.err = ""; lsSet("lbw.chat", []); renderChat(); break;
    case "chat-sug": sendChat(el.dataset.q); break;
  }
});
function onSeg(name, v) {
  const st = S.settings;
  if (name === "mode") st.mode[LANG] = v;
  else if (name === "dir") st.dir[LANG] = v;
  else if (/^(mode|dir)-(ja|en)$/.test(name)) { const [k, l] = name.split("-"); st[k][l] = v; }
  else if (name === "aiModel") st.aiModel = v;
  else if (name === "quiz-script") { ctx.script = v; newQuizQ(); render(); return; }
  else if (name === "quiz-mode") { ctx.mode = v; newQuizQ(); render(); return; }
  else if (name === "chart-script") { ctx.script = v; render(); return; }
  else return;
  st.t = Date.now();
  save();
  render();
}
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("change", (e) => {
  const el = e.target, st = S.settings;
  if (el.dataset.deck) st.decks[el.dataset.deck] = el.checked;
  else if (el.dataset.opt) st[el.dataset.opt] = el.checked;
  else if (el.dataset.unlock) st.unlocked[el.dataset.unlock] = el.checked;
  else if (el.id === "import-file" && el.files[0]) { importBackup(el.files[0]); return; }
  else return;
  st.t = Date.now();
  save();
  render();
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "ans-form") { e.preventDefault(); submitAnswer($("#ans").value); }
});
document.addEventListener("keydown", (e) => {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalOpen()) { if (e.key === "Escape") closeModal(); return; }
  const typing = e.target.matches("input, textarea, select");
  if (view === "study" && ctx.q) {
    if (ctx.phase === "ask") {
      if (typing) { if (e.key === "Escape") { e.preventDefault(); giveUp(); } return; }
      if (ctx.q.mode === "choice" && "1234".includes(e.key) && ctx.q.choices[Number(e.key) - 1]) choose(ctx.q.choices[Number(e.key) - 1].id);
      else if (ctx.q.mode === "self" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); selfReveal(); }
    } else if (ctx.phase === "shown") {
      if (ctx.kind === "srs") {
        if ("1234".includes(e.key)) grade(Number(e.key));
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); grade(recGrade(ctx.verdict) || 3); }
      } else {
        if (e.key === "1") freeAnswer(false);
        else if (e.key === "2") freeAnswer(true);
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); freeAnswer(!ctx.verdict || ctx.verdict.ok !== false); }
      }
    }
    return;
  }
  if (typing) return;
  if (view === "sort") {
    if (e.key === "ArrowRight") sortAnswer(true);
    else if (e.key === "ArrowLeft") sortAnswer(false);
    else if (e.key === " ") { e.preventDefault(); ctx.peek = true; render(); }
  } else if (view === "game" && !ctx.result && "1234".includes(e.key)) {
    const i = Number(e.key) - 1;
    if (ctx.game === "speed" && ctx.q.choices[i]) answerSpeed(ctx.q.choices[i].id);
    else if (ctx.game === "listen" && ctx.q.choices[i]) answerListen(ctx.q.choices[i].id);
    else if (ctx.game === "cloze" && ctx.q.choices[i]) answerCloze(i);
  } else if (view === "quiz" && "1234".includes(e.key) && ctx.q && !ctx.q.picked) {
    const o = ctx.q.opts[Number(e.key) - 1];
    if (o) $(`[data-act=quiz-pick][data-id="${o}"]`).click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!syncReady()) return;
  if (document.visibilityState === "hidden") { if (dirty) syncNow(); }
  else if (Date.now() - syncState.lastPull > 60000) syncNow();
});
window.addEventListener("online", () => { if (syncReady()) syncNow(); });
const readPairHash = (text) => { const m = String(text || "").match(/#pair=([A-Za-z0-9_-]+)/); return m ? m[1] : null; };
window.addEventListener("hashchange", () => {
  const code = readPairHash(location.hash);
  if (code) { pendingPair = code; history.replaceState(null, "", location.pathname + location.search); go("settings"); }
});

(async function start() {
  setLang(LANG);
  const code = readPairHash(location.hash);
  if (code) { pendingPair = code; history.replaceState(null, "", location.pathname + location.search); }
  if (SYNC && memKey) { try { await unlockSync(null); } catch (e) { memKey = null; } }
  else await loadAiKey();
  onSyncChange();
  go(pendingPair || (SYNC && !memKey) ? "settings" : "home");
  if (syncReady()) syncNow();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
