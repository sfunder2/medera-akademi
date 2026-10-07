/* Kullanıcı uygulaması */
const app = $("#app");
const D = { products: [], asg: [], curricula: [], hcps: [], interactions: [], cls: {} };
const sub = {};
const reviews = {};
let chat = [], chatBusy = false;

async function loadAll() {
  const uid = ME.id;
  const [p, a, c, h, i, s] = await Promise.all([
    sb.from("user_products").select("products(*)").eq("user_id", uid),
    sb.from("exam_assignments").select("*, exams(id,title,area,description,questions,is_practice)").eq("user_id", uid).order("assigned_at", { ascending: false }),
    sb.from("curricula").select("*, products(name)").eq("published", true).order("created_at", { ascending: false }),
    sb.from("hcps").select("*").eq("owner_id", uid).order("name"),
    sb.from("interactions").select("*, products(name)").eq("owner_id", uid).order("date", { ascending: false }),
    sb.rpc("class_stats")
  ]);
  [p, a, c, h, i, s].forEach(r => r.error && console.error(r.error));
  D.products = (p.data || []).map(x => x.products).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name, "tr"));
  D.asg = (a.data || []).filter(x => x.exams);
  D.curricula = c.data || [];
  D.hcps = h.data || [];
  D.interactions = i.data || [];
  D.cls = s.data || {};
}

function myStats() {
  const done = D.asg.filter(a => a.status === "done");
  const avg = done.length ? Math.round(done.reduce((t, a) => t + (a.score || 0), 0) / done.length) : 0;
  const pass = done.length ? Math.round(done.filter(a => a.score >= 70).length / done.length * 100) : 0;
  return { total: D.asg.length, pending: D.asg.length - done.length, done: done.length, avg, pass };
}
function myStrip(st) {
  return strip([[st.total, "Toplam sınav"], [st.pending, "Bekleyen", "amber"], [st.done, "Tamamlanan"], ["%" + st.avg, "Ortalama puan", "brandc", st.avg]]);
}

/* ---------- Portal ---------- */
function vPortal() {
  const st = myStats(), c = D.cls;
  const recent = D.asg.filter(a => a.status === "done").sort((x, y) => (y.completed_at || "").localeCompare(x.completed_at || "")).slice(0, 5);
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Merhaba, ${esc(ME.full_name || "")}</h1>
    <p class="muted">Atanan sınavlarınızı tamamlayın, ürün bilgilerine ulaşın ve sorularınızı yapay zekâ asistanına sorun.</p></div></div>
  ${myStrip(st)}
  <div class="panel" style="margin-bottom:16px"><h2 style="margin-bottom:12px">Ekip istatistikleri</h2>
    ${strip([[c.members ?? 0, "Üye"], [c.avg ?? 0, "Ortalama puan"], ["%" + (c.pass ?? 0), "Başarı oranı"], ["%" + (c.completion ?? 0), "Tamamlama", "", c.completion ?? 0]], "quiet")}
  </div>
  <div class="grid2">
    <a class="door" href="#/egitim"><div class="ic">${icon.book}</div><h2>Eğitim modülü</h2>
      <p class="muted">Atanan sınavları ve eğitimleri tamamlayın.</p>
      <div class="foot"><span>${st.total} sınav</span><span>Başarı oranı %${st.pass}</span></div></a>
    <a class="door" href="#/kutuphane"><div class="ic">${icon.search}</div><h2>Kütüphane</h2>
      <p class="muted">Ürün bilgileri ve içerikler hakkında yapay zekâ asistanı.</p>
      <div class="foot"><span>${D.products.length} ürün</span><span>Asistan hazır</span></div></a>
  </div>
  <div class="panel mt"><h2>Son sonuçlar</h2>
    ${recent.length ? `<div class="list" style="margin-top:8px">${recent.map(a => `
      <div class="item"><div class="grow"><h3>${esc(a.exams.title)}</h3><p class="muted small">${fmtDate(a.completed_at)}${a.exams.is_practice ? " · Pratik" : ""}</p></div>
      <span class="pill ${a.score >= 70 ? "ok" : "wait"}">%${a.score}</span></div>`).join("")}</div>`
    : `<p class="muted" style="margin-top:6px">Henüz sonuç yok. İlk sınavınızı tamamladığınızda burada görünür.</p>`}
  </div>`;
}

/* ---------- Sınavlar ---------- */
function vEgitim() {
  const st = myStats(), f = sub.examFilter || "all";
  const list = D.asg.filter(a => f === "all" ? true : f === "done" ? a.status === "done" : a.status === "pending");
  app.innerHTML = `
  <a class="back" href="#/portal">← Portala dön</a>
  <div class="page-head"><div class="grow"><h1>Sınavlarım</h1><p class="muted">Atanan sınavlarınızı tamamlayın ya da kendinize pratik sınavı oluşturun.</p></div>
    <button class="btn ghost" id="newExam">Pratik sınavı oluştur</button></div>
  ${myStrip(st)}
  <div class="seg">
    <button data-f="all" class="${f === "all" ? "on" : ""}">Tümü <span class="n">${st.total}</span></button>
    <button data-f="pending" class="${f === "pending" ? "on" : ""}">Bekleyen <span class="n">${st.pending}</span></button>
    <button data-f="done" class="${f === "done" ? "on" : ""}">Tamamlanan <span class="n">${st.done}</span></button>
  </div>
  <div class="panel">
    ${list.length ? `<div class="list">${list.map(a => {
      const e = a.exams, late = a.status === "pending" && a.due_date && a.due_date < new Date().toISOString().slice(0, 10);
      return `<div class="item"><div class="grow"><h3>${esc(e.title)}</h3>
        <p class="muted small">${e.questions.length} soru · ${esc(e.area || "Genel")}${e.is_practice ? " · Pratik" : ""}${a.due_date ? ` · Son tarih ${fmtDate(a.due_date)}` : ""}</p></div>
        ${a.status === "done" ? `<span class="pill ok">%${a.score}</span><button class="btn ghost sm" data-open="${a.id}">İncele</button>`
          : `<span class="pill ${late ? "bad" : "wait"}">${late ? "Gecikti" : "Bekliyor"}</span><button class="btn sm" data-open="${a.id}">Başla</button>`}
        ${e.is_practice ? `<button class="btn danger sm" data-del="${e.id}">Sil</button>` : ""}</div>`;
    }).join("")}</div>`
    : `<div class="empty"><div class="ic">${icon.folder}</div><h3>Sınav bulunamadı</h3>
       <p>Henüz atanmış sınavınız yok. Kendinizi denemek için bir pratik sınavı oluşturabilirsiniz.</p></div>`}
  </div>`;
  $$("[data-f]").forEach(b => b.onclick = () => { sub.examFilter = b.dataset.f; vEgitim(); });
  $$("[data-open]").forEach(b => b.onclick = () => location.hash = "#/sinav/" + b.dataset.open);
  $$("[data-del]").forEach(b => b.onclick = async () => {
    if (!confirm("Bu pratik sınavı silinsin mi?")) return;
    check(await sb.from("exams").delete().eq("id", b.dataset.del)); await loadAll(); vEgitim();
  });
  $("#newExam").onclick = practiceDialog;
}

function practiceDialog() {
  const d = dialog(`<h2>Pratik sınavı oluştur</h2>
    <div class="field"><label for="ea">Tedavi alanı</label><select id="ea">${AREAS.map(a => `<option>${a}</option>`).join("")}</select></div>
    <div class="field"><label for="et">Konu</label><input type="text" id="et" placeholder="örn. Biyobelirteç testlerinin klinik önemi"></div>
    <div class="field"><label for="en">Soru sayısı</label><select id="en"><option>5</option><option selected>8</option><option>10</option></select></div>
    <p class="muted small" id="emsg" style="margin-bottom:12px"></p>
    <div class="row end"><button class="btn ghost" id="ec">Vazgeç</button><button class="btn" id="eg">Sınavı oluştur</button></div>`);
  $("#ec", d).onclick = () => d.remove();
  $("#eg", d).onclick = async () => {
    const area = $("#ea", d).value, topic = $("#et", d).value.trim(), n = +$("#en", d).value;
    if (!topic) { $("#emsg", d).textContent = "Bir konu yazın."; return; }
    const b = $("#eg", d); busyBtn(b, true, "Oluşturuluyor");
    try {
      const quiz = normalizeQuiz(await aiJSON(examPrompt({ area, topic, n })));
      const ex = check(await sb.from("exams").insert({ title: quiz.title || topic, area, is_practice: true, created_by: ME.id, questions: quiz.questions.map(q => ({ q: q.q, options: q.options })) }).select().single());
      check(await sb.from("exam_keys").insert({ exam_id: ex.id, answers: quiz.questions.map(q => q.answer), explanations: quiz.questions.map(q => q.explanation) }));
      const asg = check(await sb.from("exam_assignments").insert({ exam_id: ex.id, user_id: ME.id }).select().single());
      await loadAll(); d.remove(); toast("Pratik sınavı oluşturuldu"); location.hash = "#/sinav/" + asg.id;
    } catch (e) {
      busyBtn(b, false, "Sınavı oluştur");
      $("#emsg", d).textContent = e && "details" in e ? "Kaydedilemedi: " + e.message : aiError(e);
    }
  };
}

async function vSinav(id) {
  const a = D.asg.find(x => x.id === id);
  if (!a) { location.hash = "#/egitim"; return; }
  const ex = a.exams, done = a.status === "done";
  if (done && !reviews[id]) {
    app.innerHTML = `<div class="center"><span class="spin"></span></div>`;
    const r = await sb.rpc("exam_review", { p_assignment: id });
    reviews[id] = r.data || { answers: [], explanations: [] };
  }
  if (sub.ansFor !== id) { sub.ans = []; sub.ansFor = id; }
  const ans = done ? (a.answers || []) : sub.ans;
  const key = reviews[id] || {};
  app.innerHTML = `
  <a class="back" href="#/egitim">← Sınavlara dön</a>
  <div class="page-head"><div class="grow"><h1>${esc(ex.title)}</h1>
    <p class="muted">${esc(ex.area || "Genel")} · ${ex.questions.length} soru${done ? ` · Puanınız %${a.score}` : ""}</p>
    ${ex.description ? `<p style="margin-top:8px">${esc(ex.description)}</p>` : ""}</div></div>
  <div class="panel">
    ${ex.questions.map((q, i) => `<div class="q"><h3>${i + 1}. ${esc(q.q)}</h3>
      ${q.options.map((o, j) => {
        let c = "";
        if (done) { if (key.answers && key.answers[i] === j) c = "right"; else if (ans[i] === j) c = "wrong"; }
        else if (ans[i] === j) c = "sel";
        return `<button class="opt ${c}" data-q="${i}" data-o="${j}" ${done ? "disabled" : ""}><span class="k">${"ABCD"[j]}</span><span>${esc(o)}</span></button>`;
      }).join("")}
      ${done && key.explanations && key.explanations[i] ? `<p class="expl">${esc(key.explanations[i])}</p>` : ""}
    </div>`).join("")}
  </div>
  <div class="row end" style="margin-top:16px">
    ${done ? (ex.is_practice ? `<button class="btn ghost" id="retry">Yeniden çöz</button>` : "")
      : `<span class="muted small">${ans.filter(x => x !== undefined && x !== null).length}/${ex.questions.length} yanıtlandı</span><button class="btn" id="finish">Sınavı gönder</button>`}
  </div>`;
  $$(".opt:not([disabled])").forEach(b => b.onclick = () => { ans[+b.dataset.q] = +b.dataset.o; vSinav(id); });
  const fin = $("#finish");
  if (fin) fin.onclick = async () => {
    const answered = ans.filter(x => x !== undefined && x !== null).length;
    if (answered < ex.questions.length && !confirm("Yanıtlanmamış sorular var. Yine de gönderilsin mi?")) return;
    if (!ex.is_practice && !confirm("Gönderdikten sonra cevaplarınızı değiştiremezsiniz. Gönderilsin mi?")) return;
    busyBtn(fin, true, "Gönderiliyor");
    const r = await sb.rpc("submit_exam", { p_assignment: id, p_answers: ex.questions.map((_, i) => ans[i] ?? null) });
    if (r.error) { busyBtn(fin, false, "Sınavı gönder"); toast(r.error.message); return; }
    toast(`Sınav gönderildi: %${r.data}`); await loadAll(); window.scrollTo(0, 0); vSinav(id);
  };
  const rt = $("#retry");
  if (rt) rt.onclick = async () => {
    check(await sb.from("exam_assignments").update({ status: "pending", score: null, answers: null, completed_at: null }).eq("id", id));
    delete reviews[id]; sub.ans = []; await loadAll(); vSinav(id);
  };
}

/* ---------- Kütüphane ---------- */
function vKutuphane() {
  const tab = sub.libTab || "urun";
  app.innerHTML = `
  <a class="back" href="#/portal">← Portala dön</a>
  <div class="page-head"><div class="grow"><h1>Kütüphane</h1><p class="muted">Ürün bilgileri ve yapay zekâ destekli eğitim asistanı.</p></div></div>
  <div class="grid2" style="margin-bottom:16px">
    <button class="door ${tab === "urun" ? "on" : ""}" data-lt="urun"><h3>Ürün bilgileri</h3><p class="muted small">Tedavi alanı ürünleri ve detaylı bilgiler</p></button>
    <button class="door ${tab === "ai" ? "on" : ""}" data-lt="ai"><h3>Yapay zekâ asistanı</h3><p class="muted small">İçerikler hakkında soru sorun</p></button>
  </div><div id="libBody"></div>`;
  $$("[data-lt]").forEach(b => b.onclick = () => { sub.libTab = b.dataset.lt; vKutuphane(); });
  tab === "ai" ? libAI() : libProducts();
}
function libProducts() {
  $("#libBody").innerHTML = `<div class="panel"><h2>Ürün portföyüm</h2><p class="muted" style="margin-bottom:8px">${D.products.length} ürün</p>
    ${D.products.length ? `<div class="list">${D.products.map(p => `
      <div class="item" style="align-items:flex-start"><div class="avatar">${icon.box.replace(/24/g, "18")}</div>
      <div class="grow"><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.area || "")}${p.molecule ? ` · ${esc(p.molecule)}` : ""}</p>
      ${p.notes ? `<p style="font-size:14px;margin-top:6px;white-space:pre-wrap">${esc(p.notes)}</p>` : ""}</div>
      <button class="btn ghost sm" data-ask="${esc(p.name)}">Asistana sor</button></div>`).join("")}</div>`
    : `<div class="empty"><div class="ic">${icon.box}</div><h3>Henüz atanmış ürün bulunmuyor</h3><p>Ürünleriniz yöneticiniz tarafından atandığında burada görünür.</p></div>`}
  </div>`;
  $$("[data-ask]").forEach(b => b.onclick = () => { sub.libTab = "ai"; sub.ctx = b.dataset.ask; vKutuphane(); });
}
function libAI() {
  const ctx = sub.ctx || "Genel";
  $("#libBody").innerHTML = `<div class="panel">
    <div class="row" style="margin-bottom:14px"><div class="grow"><h2>Eğitim asistanı</h2><p class="muted">Tıbbi literatür destekli yapay zekâ asistanınız</p></div>
      <label for="ctx" class="small" style="font-weight:600">Konu bağlamı</label>
      <select id="ctx" class="auto" style="min-width:160px"><option>Genel</option>
        ${AREAS.map(a => `<option ${ctx === a ? "selected" : ""}>${a}</option>`).join("")}
        ${D.products.map(p => `<option ${ctx === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
    <div class="chat"><div class="msgs" id="msgs"></div>
      <div><div class="composer"><textarea id="ask" placeholder="Bir soru sorun…" aria-label="Soru"></textarea><button class="btn" id="send">Gönder</button></div>
      <p class="hint">Enter ile gönderin, Shift+Enter ile yeni satır ekleyin. Yanıtlar eğitim amaçlıdır; resmi kaynaklarla doğrulayın.</p></div></div></div>`;
  $("#ctx").onchange = e => { sub.ctx = e.target.value; };
  renderMsgs();
  $("#ask").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } };
  $("#send").onclick = sendChat;
}
function renderMsgs() {
  const m = $("#msgs"); if (!m) return;
  if (!chat.length) {
    m.innerHTML = `<div class="empty" style="margin:auto"><div class="ic">${icon.search}</div><h3>Nasıl yardımcı olabilirim?</h3>
      <p>Tıbbi ürünler, tedavi alanları veya klinik çalışmalar hakkında sorularınızı sorabilirsiniz.</p>
      <div class="chips">${["En güncel onkoloji tedavilerini özetle", "Sahada hekimlerin sık sorduğu sorular", "Biyobelirteç testlerinin klinik önemi"].map(c => `<button>${c}</button>`).join("")}</div></div>`;
    $$(".chips button", m).forEach(b => b.onclick = () => { $("#ask").value = b.textContent; sendChat(); });
    return;
  }
  m.innerHTML = chat.map(x => `<div class="msg ${x.role === "user" ? "me" : "ai"}">${x.content ? esc(x.content) : '<span class="spin"></span> Düşünüyor'}</div>`).join("");
  m.scrollTop = m.scrollHeight;
}
async function sendChat() {
  const ta = $("#ask"), q = ta.value.trim();
  if (!q || chatBusy) return;
  ta.value = ""; chat.push({ role: "user", content: q });
  const ctx = sub.ctx || "Genel", prod = D.products.find(p => p.name === ctx);
  const ctxText = prod ? `Konu bağlamı: ${prod.name} (${prod.molecule || "etken madde belirtilmedi"}, ${prod.area || ""}). Ürün notları: ${prod.notes || "yok"}` : `Konu bağlamı: ${ctx}`;
  let turns = chat.slice(-12).filter(x => x.content).map(x => ({ role: x.role, content: x.content }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  const slot = { role: "assistant", content: "" }; chat.push(slot);
  chatBusy = true; $("#send").disabled = true; renderMsgs();
  try {
    slot.content = await ai({ system: SYS + "\n" + ctxText, messages: turns, stream: true, onText: t => { slot.content = t; renderMsgs(); } }) || "Yanıt boş döndü.";
  } catch (e) { slot.content = e.text || aiError(e); }
  chatBusy = false; const s = $("#send"); if (s) s.disabled = false; renderMsgs();
}

/* ---------- Müfredat ---------- */
function vMufredat() {
  const fa = sub.cArea || "", fp = sub.cProd || "";
  const list = D.curricula.filter(c => (!fa || c.area === fa) && (!fp || c.products?.name === fp));
  const prods = [...new Set(D.curricula.map(c => c.products?.name).filter(Boolean))];
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Müfredat</h1><p class="muted">Ekibiniz için hazırlanan yapılandırılmış eğitim planları.</p></div>
    <select id="fa" class="auto"><option value="">Tüm tedavi alanları</option>${AREAS.map(a => `<option ${fa === a ? "selected" : ""}>${a}</option>`).join("")}</select>
    <select id="fp" class="auto"><option value="">Tüm ürünler</option>${prods.map(p => `<option ${fp === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
  ${list.length ? list.map(c => `<div class="panel">
      <h2>${esc(c.title)}</h2><p class="muted small">${esc(c.area || "")}${c.products ? ` · ${esc(c.products.name)}` : ""} · ${c.weeks || c.modules.length} hafta · ${c.modules.length} modül</p>
      ${renderModules(c.modules)}</div>`).join("")
  : `<div class="panel"><div class="empty"><div class="ic">${icon.book}</div><h3>Henüz müfredat yok</h3><p>Yöneticiniz bir müfredat yayımladığında burada görünür.</p></div></div>`}`;
  $("#fa").onchange = e => { sub.cArea = e.target.value; vMufredat(); };
  $("#fp").onchange = e => { sub.cProd = e.target.value; vMufredat(); };
}

/* ---------- Paydaşlar ---------- */
function vPaydaslar() {
  const t = sub.pTab || "hekim";
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Paydaşlar</h1><p class="muted">Hekimleriniz ve etkileşim geçmişi</p></div></div>
  <div class="seg">
    <button data-pt="hekim" class="${t === "hekim" ? "on" : ""}">Hekimler <span class="n">${D.hcps.length}</span></button>
    <button data-pt="etk" class="${t === "etk" ? "on" : ""}">Etkileşimler <span class="n">${D.interactions.length}</span></button>
    <button data-pt="urun" class="${t === "urun" ? "on" : ""}">Ürünler <span class="n">${D.products.length}</span></button>
  </div><div id="pBody"></div>`;
  $$("[data-pt]").forEach(b => b.onclick = () => { sub.pTab = b.dataset.pt; vPaydaslar(); });
  ({ hekim: pHekim, etk: pEtk, urun: pUrun })[t]();
}
function pHekim() {
  const q = (sub.hq || "").toLocaleLowerCase("tr"), sp = sub.hs || "", ci = sub.hc || "";
  const cities = [...new Set(D.hcps.map(h => h.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const list = D.hcps.filter(h => (!q || (h.name + " " + (h.inst || "")).toLocaleLowerCase("tr").includes(q)) && (!sp || h.spec === sp) && (!ci || h.city === ci));
  $("#pBody").innerHTML = `<div class="panel">
    <div class="row" style="margin-bottom:6px">
      <input type="search" id="hq" placeholder="İsim veya kurum ara…" value="${esc(sub.hq || "")}" style="flex:1;min-width:200px">
      <select id="hs" class="auto"><option value="">Tüm uzmanlıklar</option>${SPECS.map(s => `<option ${sp === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <select id="hc" class="auto"><option value="">Tüm şehirler</option>${cities.map(c => `<option ${ci === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <button class="btn" id="addH">Hekim ekle</button></div>
    ${list.length ? `<div class="list">${list.map(h => `
      <div class="item"><div class="avatar">${esc(initials(h.name))}</div>
      <div class="grow"><h3>${esc(h.name)}</h3><p class="muted small">${esc(h.spec || "")} · ${esc(h.inst || "Kurum yok")}${h.city ? " · " + esc(h.city) : ""}</p></div>
      <span class="pill">${D.interactions.filter(i => i.hcp_id === h.id).length} etkileşim</span>
      <button class="btn ghost sm" data-ih="${h.id}">Etkileşim ekle</button><button class="btn danger sm" data-hd="${h.id}">Sil</button></div>`).join("")}</div>`
    : `<div class="empty"><div class="ic">${icon.user}</div><h3>Hekim bulunamadı</h3><p>${D.hcps.length ? "Arama veya filtreleri değiştirin." : "Ziyaret ettiğiniz hekimleri ekleyerek etkileşimlerinizi takip edin."}</p></div>`}
  </div>`;
  $("#hq").oninput = e => { sub.hq = e.target.value; pHekim(); const n = $("#hq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $("#hs").onchange = e => { sub.hs = e.target.value; pHekim(); };
  $("#hc").onchange = e => { sub.hc = e.target.value; pHekim(); };
  $("#addH").onclick = () => {
    const d = dialog(`<h2>Hekim ekle</h2>
      <div class="field"><label for="hn">Ad soyad</label><input type="text" id="hn" placeholder="Dr. …"></div>
      <div class="field"><label for="hsp">Uzmanlık</label><select id="hsp">${SPECS.map(s => `<option>${s}</option>`).join("")}</select></div>
      <div class="field"><label for="hi">Kurum</label><input type="text" id="hi"></div>
      <div class="field"><label for="hci">Şehir</label><input type="text" id="hci"></div>
      <div class="row end"><button class="btn ghost" id="hx">Vazgeç</button><button class="btn" id="hsv">Hekimi kaydet</button></div>`);
    $("#hx", d).onclick = () => d.remove();
    $("#hsv", d).onclick = async () => {
      const name = $("#hn", d).value.trim(); if (!name) { $("#hn", d).focus(); return; }
      check(await sb.from("hcps").insert({ owner_id: ME.id, name, spec: $("#hsp", d).value, inst: $("#hi", d).value.trim(), city: $("#hci", d).value.trim() }));
      d.remove(); toast("Hekim kaydedildi"); await loadAll(); vPaydaslar();
    };
  };
  $$("[data-hd]").forEach(b => b.onclick = async () => {
    if (!confirm("Hekim ve tüm etkileşimleri silinsin mi?")) return;
    check(await sb.from("hcps").delete().eq("id", b.dataset.hd)); await loadAll(); vPaydaslar();
  });
  $$("[data-ih]").forEach(b => b.onclick = () => interactionDialog(b.dataset.ih));
}
function interactionDialog(hcpId) {
  if (!D.hcps.length) { toast("Önce bir hekim ekleyin"); return; }
  const d = dialog(`<h2>Etkileşim ekle</h2>
    <div class="field"><label for="ih">Hekim</label><select id="ih">${D.hcps.map(h => `<option value="${h.id}" ${h.id === hcpId ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="it">Tür</label><select id="it">${INTERACTION_TYPES.map(t => `<option>${t}</option>`).join("")}</select></div>
    <div class="field"><label for="ip">Konuşulan ürün</label><select id="ip"><option value="">—</option>${D.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="idt">Tarih</label><input type="date" id="idt" value="${new Date().toISOString().slice(0, 10)}"></div>
    <div class="field"><label for="inn">Notlar</label><textarea id="inn" placeholder="Hasta bilgisi yazmayın."></textarea></div>
    <div class="row end"><button class="btn ghost" id="ix">Vazgeç</button><button class="btn" id="isv">Etkileşimi kaydet</button></div>`);
  $("#ix", d).onclick = () => d.remove();
  $("#isv", d).onclick = async () => {
    check(await sb.from("interactions").insert({ owner_id: ME.id, hcp_id: $("#ih", d).value, type: $("#it", d).value, product_id: $("#ip", d).value || null, date: $("#idt", d).value || null, notes: $("#inn", d).value.trim() }));
    d.remove(); toast("Etkileşim kaydedildi"); await loadAll(); vPaydaslar();
  };
}
function pEtk() {
  $("#pBody").innerHTML = `<div class="panel">
    <div class="row" style="margin-bottom:6px"><div class="grow"><h2>Etkileşim geçmişi</h2></div><button class="btn" id="addI">Etkileşim ekle</button></div>
    ${D.interactions.length ? `<div class="list">${D.interactions.map(i => {
      const h = D.hcps.find(x => x.id === i.hcp_id);
      return `<div class="item" style="align-items:flex-start"><div class="avatar">${icon.pulse.replace(/24/g, "18")}</div>
        <div class="grow"><h3>${esc(h ? h.name : "—")}</h3><p class="muted small">${esc(i.type || "")} · ${fmtDate(i.date)}${i.products ? " · " + esc(i.products.name) : ""}</p>
        ${i.notes ? `<p style="font-size:14px;margin-top:4px;white-space:pre-wrap">${esc(i.notes)}</p>` : ""}</div>
        <button class="btn danger sm" data-idel="${i.id}">Sil</button></div>`;
    }).join("")}</div>`
    : `<div class="empty"><div class="ic">${icon.pulse}</div><h3>Henüz etkileşim yok</h3><p>Hekim ziyaretlerinizi kaydedin; geçmiş burada tarih sırasıyla görünür.</p></div>`}
  </div>`;
  $("#addI").onclick = () => interactionDialog();
  $$("[data-idel]").forEach(b => b.onclick = async () => { check(await sb.from("interactions").delete().eq("id", b.dataset.idel)); await loadAll(); vPaydaslar(); });
}
function pUrun() {
  const counts = D.products.map(p => D.interactions.filter(i => i.product_id === p.id).length);
  const max = Math.max(1, ...counts);
  $("#pBody").innerHTML = `<div class="panel"><h2 style="margin-bottom:6px">Ürünlere göre etkileşim</h2>
    ${D.products.length ? `<div class="list">${D.products.map((p, k) => `
      <div class="item"><div class="grow"><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.area || "")}</p>
      <div class="meter" style="max-width:320px"><i style="width:${counts[k] / max * 100}%"></i></div></div><span class="pill">${counts[k]} etkileşim</span></div>`).join("")}</div>`
    : `<div class="empty"><div class="ic">${icon.box}</div><h3>Henüz atanmış ürün yok</h3><p>Ürünleriniz atandığında etkileşim dağılımı burada görünür.</p></div>`}
  </div>`;
}

/* ---------- Yönlendirme ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, "") || "portal";
  const [p, arg] = h.split("/");
  const tab = ["mufredat", "paydaslar"].includes(p) ? p : "portal";
  $$("nav.tabs a").forEach(a => a.classList.toggle("active", a.dataset.tab === tab));
  const views = { portal: vPortal, egitim: vEgitim, kutuphane: vKutuphane, mufredat: vMufredat, paydaslar: vPaydaslar, sinav: () => vSinav(arg) };
  (views[p] || vPortal)();
}
window.addEventListener("hashchange", () => { if (ME) { route(); window.scrollTo(0, 0); } });
boot(async () => { await loadAll(); route(); });
