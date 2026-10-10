/* Kullanıcı uygulaması */
const app = $("#app");
const D = { products: [], asg: [], curricula: [], hcps: [], interactions: [], cls: {}, anns: [], reviewCount: 0 };
const sub = {};
const reviews = {};
let chat = [], chatBusy = false;

async function loadAll() {
  const uid = ME.id;
  const [p, a, c, h, i, s, an, rv] = await Promise.all([
    sb.from("user_products").select("products(*)").eq("user_id", uid),
    sb.rpc("my_assignments"),
    sb.from("curricula").select("*, products(name)").eq("published", true).order("created_at", { ascending: false }),
    sb.from("hcps").select("*").eq("owner_id", uid).order("name"),
    sb.from("interactions").select("*, products(name)").eq("owner_id", uid).order("date", { ascending: false }),
    sb.rpc("class_stats"),
    sb.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(20),
    ME.job_role === "avukat" ? sb.rpc("review_items", { p_status: "in_review" }) : Promise.resolve({ data: [] })
  ]);
  [p, a, c, h, i, s, an, rv].forEach(r => r.error && console.error(r.error));
  D.anns = an.data || [];
  D.reviewCount = (rv.data || []).length;
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

/* ---------- Ana sekmeler: Bugün · Öğren · Pratik · Ben ---------- */
const tile = (href, ic, t, d, attrs = "") => `<a class="tile" href="${href}" ${attrs}><span class="ic">${ic}</span><span><b>${t}</b><small>${d}</small></span></a>`;
const todoRow = (href, ic, t, d, tone = "") => `<a class="todo" href="${href}"><span class="ic ${tone}">${ic}</span><span class="tx"><b>${t}</b><small>${d}</small></span><span class="arr" aria-hidden="true">›</span></a>`;
const queuedExam = id => !!window.offline && offline.pending("submit_exam").some(j => j.args.p_assignment === id);
const pendingExams = () => D.asg.filter(a => a.status !== "done" && !queuedExam(a.id)).sort((x, y) => (x.due_date || "9999").localeCompare(y.due_date || "9999"));

function vPortal() {
  const r = ME.job_role, pending = pendingExams(), next = pending[0];
  const hero = r === "avukat" && D.reviewCount
    ? { t: `${D.reviewCount} içerik onayınızı bekliyor`, d: "Yayın öncesi sınav ve müfredatları onaylayın ya da gerekçeyle reddedin.", href: "#/inceleme", b: "İncelemeye başla" }
    : next
    ? { t: esc(next.exams.title), d: next.due_date ? `Son tarih ${fmtDate(next.due_date)}` : "Atanmış sınavınız", href: "#/sinav/" + next.id, b: "Sınava başla" }
    : r === "pjp"
    ? { t: "Bekleyen sınavınız yok", d: "Kısa bir hekim görüşmesiyle pratik yapın.", href: "#/roleplay", b: "Görüşme başlat" }
    : { t: "Bekleyen sınavınız yok", d: "Bir eğitime göz atın ya da asistana soru sorun.", href: "#/ogren", b: "Öğrenmeye başla" };
  const items = [];
  if (pending.length > 1) items.push(todoRow("#/egitim", icon.book, `${pending.length - 1} sınav daha bekliyor`, "Sınavlarım"));
  if (r === "urun_muduru") items.push(todoRow("#/ekip", icon.user, "Ekibinizin durumuna bakın", `${D.products.length} ürün · ekip raporu`));
  const last = qolRead("lastPage");
  if (last && /^#\/(sinav\/[a-zA-Z0-9-]+|mufredat|roleplay|sahacalisma|gelisim)$/.test(last)) items.push(todoRow(last, icon.pulse, "Kaldığınız yerden devam edin", "Son çalışmanız"));
  if (r === "pjp") items.push(todoRow("#/roleplay", icon.user, "Hekim görüşmesi pratiği", "Yaklaşık 5 dakika"));
  if (r === "pjp") items.unshift(todoRow("#/portal", icon.pulse, "Ziyaret kaydet", "Karşılaştığınız itirazları etiketleyin").replace('class="todo"', 'class="todo" id="logVisit"'));
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Merhaba${ME.full_name ? ", " + esc(ME.full_name.split(" ")[0]) : ""}</h1></div></div>
  <div class="hero"><div class="grow"><p class="small hero-k">Sıradaki adım</p><h2>${hero.t}</h2><p>${hero.d}</p></div><a class="btn" href="${hero.href}">${hero.b}</a></div>
  <h2 class="section-t">Bugün yapılacaklar</h2>
  <div class="todos" id="todos">${items.join("")}</div>
  ${D.anns.length ? `<h2 class="section-t">Duyurular</h2><div class="panel">
    ${D.anns.slice(0, 3).map(a => `<div class="ann ${a.pinned ? "pin" : ""}"><h3>${a.pinned ? "📌 " : ""}${esc(a.title)}</h3>
      <p class="muted small">${fmtDate(a.created_at)}</p>${a.body ? `<p>${esc(a.body)}</p>` : ""}</div>`).join("")}</div>` : ""}`;
  // Tekrar soruları ve ürün değişiklikleri sunucudan gelir; gelmezse liste olduğu gibi kalır.
  const box = $("#todos");
  const visit = $("#logVisit"); if (visit) visit.onclick = e => { e.preventDefault(); interactionDialog(); };
  const watchesObjections = r === "urun_muduru" || ME.role === "admin";
  Promise.allSettled([sb.rpc("learning_plan"), sb.rpc("field_notifications"), watchesObjections ? sb.rpc("objection_heatmap", { p_days: 30 }) : Promise.resolve({ data: null }), sb.rpc("field_list"), sb.rpc("field_history"), r === "pjp" ? sb.rpc("case_room_list") : Promise.resolve({ data: null })]).then(([lp, fn, oh, fl, fh, cr]) => {
    if (!box.isConnected) return;
    const extra = [];
    const plan = lp.status === "fulfilled" && !lp.value.error ? lp.value.data || [] : [];
    if (plan.length) extra.push(todoRow("#/ogrenme", icon.search, `${plan.length} yanlış soruyu tekrar edin`, "Tekrar soruları"));
    const notes = fn.status === "fulfilled" && !fn.value.error ? (fn.value.data || []).filter(n => !n.read_at) : [];
    if (notes.length) extra.push(todoRow("#/degisiklik", icon.folder, `${notes.length} ürün değişikliğini okuyun`, esc(notes[0].title), "amber"));
    // Devam eden vaka odası: katılımcı bekleyen, süren veya puanınızı bekleyen oda.
    const rooms = cr.status === "fulfilled" && cr.value.data ? cr.value.data.mine || [] : [];
    rooms.filter(x => ["waiting", "live", "rating"].includes(x.status)).slice(0, 2).forEach(x => extra.push(todoRow("#/oda/" + x.id, icon.user,
      x.status === "rating" ? "Vaka odası: puanlama bekliyor" : "Vaka odanız devam ediyor", (CASE_SCENARIOS[x.scenario]?.title || "") + " · kod " + esc(x.code))));
    // Onaylanmış ve henüz çalışılmamış mikro eğitimler.
    const ok = r => r.status === "fulfilled" && !r.value.error ? r.value.data || [] : [];
    const done = ok(fh), micro = ok(fl).filter(u => u.kind === "update" && u.payload?.podcast && !done.some(h => h.unit_id === u.id && h.version === u.version)).slice(0, 2);
    micro.forEach(u => extra.push(todoRow("#/sahacalisma", icon.book, "Yeni mikro eğitim: " + esc(u.title), "3 dakikalık sesli özet ve 5 soru").replace('class="todo"', `class="todo" data-micro-run="${esc(u.id)}"`)));
    const alerts = oh.status === "fulfilled" && oh.value.data ? oh.value.data.alerts || [] : [];
    alerts.slice(0, 2).forEach(a => extra.unshift(todoRow("#/itirazlar", icon.pulse, "İtiraz dalgası: " + esc(a.region), esc(objectionAlertText(a)), "amber")));
    box.insertAdjacentHTML("afterbegin", extra.join(""));
    $$("[data-micro-run]", box).forEach(a => a.onclick = () => { window.fieldRunNext = a.dataset.microRun; });
    if (!box.children.length) box.innerHTML = `<p class="muted todo-empty">Bugün için başka iş yok. İyi çalışmalar!</p>`;
  });
}

function vOgren() {
  const f = sub.learnFilter || "Tümü";
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Öğren</h1><p class="muted">Eğitimler, ürün bilgileri ve belgeler tek yerde.</p></div></div>
  <input id="learnSearch" class="searchbox" type="search" placeholder="Ürün, eğitim veya belge ara" aria-label="Ara">
  <div class="seg chips" role="group" aria-label="Filtre">${["Tümü", "Eğitim", "Ürün", "Belge", "Not"].map(x => `<button data-lf="${x}" class="${x === f ? "on" : ""}">${x}</button>`).join("")}</div>
  <a class="ask" href="#/kutuphane" id="askAi"><span class="ic">${icon.search}</span><span class="tx"><b>Asistana soru sorun</b><small>Ürünler ve onaylı belgeler hakkında</small></span><span class="arr" aria-hidden="true">›</span></a>
  <div class="panel list-panel"><div class="list" id="learnResults"><p class="muted">Yükleniyor…</p></div></div>
  <p class="small muted more-links">Tümünü gör: <a href="#/mufredat">Eğitimler</a> · <a href="#/kutuphane">Ürünler</a> · <a href="#/belgeler">Belgeler</a></p>`;
  $("#askAi").onclick = () => { sub.libTab = "ai"; };
  let docs = [];
  const root = $("#learnResults"), input = $("#learnSearch");
  const render = () => {
    if (!root.isConnected) return;
    const q = input.value.toLocaleLowerCase("tr"), cur = sub.learnFilter || "Tümü";
    const rows = qolItems(docs).filter(x => x.type !== "Sınav" && x.type !== "Çalışma")
      .filter(x => cur === "Tümü" || x.type === cur)
      .filter(x => !q || (x.title + " " + x.body).toLocaleLowerCase("tr").includes(q)).slice(0, 40);
    root.innerHTML = rows.map((x, i) => `<button class="item item-btn" data-open="${i}"><div class="grow"><h3>${esc(x.title)}</h3><p class="muted small">${esc(x.type)}</p></div><span class="arr" aria-hidden="true">›</span></button>`).join("")
      || `<p class="muted">${q ? "Sonuç bulunamadı. Asistana sormayı deneyin." : "Henüz içerik yok."}</p>`;
    $$("[data-open]", root).forEach(b => b.onclick = () => qolOpen(rows[+b.dataset.open]));
  };
  input.oninput = render;
  $$("[data-lf]").forEach(b => b.onclick = () => { sub.learnFilter = b.dataset.lf; $$("[data-lf]").forEach(x => x.classList.toggle("on", x === b)); render(); });
  render();
  sb.from("source_documents").select("id,title,pages").eq("status", "approved").then(r => { docs = r.data || []; render(); });
}

function vPratik() {
  const r = ME.job_role, pending = pendingExams().length;
  const tiles = [
    tile("#/egitim", icon.book, "Sınavlar", pending ? `${pending} bekleyen` : "Pratik sınavı oluşturun"),
    r === "pjp" ? tile("#/roleplay", icon.user, "Hekim görüşmesi", "Sesli veya yazılı pratik") : "",
    r === "pjp" ? tile("#/vaka", icon.user, "Vaka odası", "Meslektaşlarla canlı vaka") : "",
    r === "pjp" ? tile("#/duello", icon.pulse, "Bilgi yarışması", "Bir meslektaşınızla") : "",
    tile("#/yanlislar", icon.search, "Yanlışlarım", "Hatalı cevaplar ve doğruları"),
    tile("#/ogrenme", icon.folder, "Tekrar soruları", "Eksik konularınıza göre"),
    tile("#/sahacalisma", icon.box, "Saha senaryoları", "Adım adım vaka çalışmaları")
  ].filter(Boolean).join("");
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Pratik</h1><p class="muted">Kendinizi deneyin, eksiklerinizi kapatın.</p></div></div>
  <div class="tiles">${tiles}</div>`;
}

function vBen() {
  const st = myStats(), c = D.cls, r = ME.job_role;
  const recent = D.asg.filter(a => a.status === "done").sort((x, y) => (y.completed_at || "").localeCompare(x.completed_at || "")).slice(0, 3);
  const link = (href, t, extra = "") => `<a class="menu-row" href="${href}"><span>${t}</span>${extra}<span class="arr" aria-hidden="true">›</span></a>`;
  const badge = n => n ? `<span class="badge-n">${n}</span>` : "";
  const work = [
    r === "avukat" ? link("#/inceleme", "Hukuk incelemesi", badge(D.reviewCount)) : "",
    r === "avukat" ? link("#/duellosoru", "Yarışma soruları") : "",
    r === "urun_muduru" ? link("#/ekip", "Ekip raporu") + link("#/beceri", "Beceri haritası") : "",
    r === "urun_muduru" || ME.role === "admin" ? link("#/itirazlar", "Saha itirazları") : "",
    fieldManager() || fieldReviewer() ? link("#/atolye", "İçerik atölyesi") : ""
  ].join("");
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>${esc(ME.full_name || ME.email)}</h1><p class="muted">${roleLabel(r)}${ME.role === "admin" ? " · Yönetici" : ""}</p></div></div>
  <div class="panel"><h2>İlerlemem</h2>
    <div class="mini-stats"><div><b>${st.done}/${st.total}</b><span>Tamamlanan sınav</span></div><div><b>%${st.avg}</b><span>Ortalamam</span></div><div><b>%${c.avg ?? 0}</b><span>Ekip ortalaması</span></div></div>
    ${recent.length ? `<div class="list" style="margin-top:12px">${recent.map(a => `
      <div class="item"><div class="grow"><h3>${esc(a.exams.title)}</h3><p class="muted small">${fmtDate(a.completed_at)}</p></div>
      <span class="pill ${a.score >= 70 ? "ok" : "wait"}">%${a.score}</span></div>`).join("")}</div>` : ""}
  </div>
  ${work ? `<h2 class="section-t">Görevlerim</h2><div class="menu">${work}</div>` : ""}
  <h2 class="section-t">Hesabım</h2>
  <div class="menu">
    ${r === "pjp" ? link("#/paydaslar", "Hekimlerim", `<small>${D.hcps.length} kayıt</small>`) : ""}
    ${link("#/masam", "Notlarım ve favorilerim")}
    ${link("#/yanetki", "Yan etki bildirimlerim")}
    ${link("#/degisiklik", "Ürün değişiklikleri")}
    ${link("#/profil", "Profil ve şifre")}
    ${ME.role === "admin" ? link("admin.html", "Yönetim paneli") : ""}
    <button class="menu-row" id="benTheme"><span>Tema değiştir</span><span class="arr" aria-hidden="true">›</span></button>
    <button class="menu-row danger" id="benOut"><span>Çıkış yap</span></button>
  </div>`;
  $("#benTheme").onclick = () => $("#themeBtn")?.click();
  $("#benOut").onclick = () => $("#signOut")?.click();
}

/* ---------- Sınavlar ---------- */
function vEgitim() {
  const st = myStats(), f = sub.examFilter || "all";
  const list = D.asg.filter(a => f === "all" ? true : f === "done" ? a.status === "done" : a.status === "pending");
  app.innerHTML = `
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
  if (sub.ansFor !== id) { sub.ans = qolRead("exam:"+id, []); sub.ansFor = id; }
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
      : queuedExam(id) ? `<p class="notice" style="margin:0">Cevaplarınız cihazda kayıtlı. Bağlantı gelince otomatik gönderilecek ve puanınız görünecek.</p>`
      : `<span class="muted small">${ans.filter(x => x !== undefined && x !== null).length}/${ex.questions.length} yanıtlandı</span><button class="btn" id="finish">Sınavı gönder</button>`}
  </div>`;
  if (!done && queuedExam(id)) $$(".opt").forEach(b => b.disabled = true);
  $$(".opt:not([disabled])").forEach(b => b.onclick = () => { ans[+b.dataset.q] = +b.dataset.o; qolWrite("exam:"+id,ans); vSinav(id); });
  const fin = $("#finish");
  if (fin) fin.onclick = async () => {
    const answered = ans.filter(x => x !== undefined && x !== null).length;
    if (answered < ex.questions.length && !confirm("Yanıtlanmamış sorular var. Yine de gönderilsin mi?")) return;
    if (!ex.is_practice && !confirm("Gönderdikten sonra cevaplarınızı değiştiremezsiniz. Gönderilsin mi?")) return;
    busyBtn(fin, true, "Gönderiliyor");
    const args = { p_assignment: id, p_answers: ex.questions.map((_, i) => ans[i] ?? null) };
    const r = await sb.rpc("submit_exam", args);
    if (window.offline && offline.isNetworkError(r)) { offline.enqueue({ kind: "submit_exam", args }); toast("Bağlantı yok. Cevaplarınız bağlantı gelince gönderilecek."); vSinav(id); return; }
    if (r.error) { busyBtn(fin, false, "Sınavı gönder"); toast(r.error.message); return; }
    qolDelete("exam:"+id); toast(`Sınav gönderildi: %${r.data}`); await loadAll(); window.scrollTo(0, 0); vSinav(id);
  };
  const rt = $("#retry");
  if (rt) rt.onclick = async () => {
    check(await sb.from("exam_assignments").update({ status: "pending", score: null, answers: null, completed_at: null }).eq("id", id));
    qolDelete("exam:"+id); delete reviews[id]; sub.ans = []; await loadAll(); vSinav(id);
  };
}

/* ---------- Kütüphane ---------- */
function vKutuphane() {
  const tab = sub.libTab || "urun";
  app.innerHTML = `
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
    <label class="check" style="margin-bottom:12px"><input type="checkbox" id="grounded" checked>Yalnızca onaylı belgelerden yanıtla</label><div class="chat"><div class="msgs" id="msgs"></div>
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
  m.innerHTML = chat.map(x => `<div class="msg ${x.role === "user" ? "me" : "ai"}">${x.content ? esc(x.content) : '<span class="spin"></span> Düşünüyor'}${x.sources?.length ? `<div style="margin-top:10px"><b>Kaynak sayfalar</b><br>${sourceLinks(x.sources)}</div>` : ''}</div>`).join("");
  bindSourceLinks(m);
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
    slot.content = await ai({ system: SYS + "\n" + ctxText, messages: turns, stream: !$("#grounded")?.checked, grounded: !!$("#grounded")?.checked, productId: prod?.id || null, onSources: sources => { slot.sources = sources; }, onText: t => { slot.content = t; renderMsgs(); } }) || "Yanıt boş döndü.";
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
  ${list.length ? list.map(c => `<div class="panel" data-curriculum="${esc(c.id)}">
      <h2>${esc(c.title)}</h2><p class="muted small">${esc(c.area || "")}${c.products ? ` · ${esc(c.products.name)}` : ""} · ${c.weeks || c.modules.length} hafta · ${c.modules.length} modül</p>
      ${renderModules(c.modules)}</div>`).join("")
  : `<div class="panel"><div class="empty"><div class="ic">${icon.book}</div><h3>Henüz müfredat yok</h3><p>Yöneticiniz bir müfredat yayımladığında burada görünür.</p></div></div>`}`;
  $$("[data-curriculum]").forEach(panel=>{const completed=qolRead('modules:'+panel.dataset.curriculum,[]);$$('.module',panel).forEach((m,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=completed.includes(i);label.append(input,document.createTextNode(' Bu modülü çalıştım (bu cihazda kaydedilir)'));m.append(label);input.onchange=()=>{const at=completed.indexOf(i);if(input.checked&&at<0)completed.push(i);if(!input.checked&&at>=0)completed.splice(at,1);qolWrite('modules:'+panel.dataset.curriculum,completed);};});});
  $("#fa").onchange = e => { sub.cArea = e.target.value; vMufredat(); };
  $("#fp").onchange = e => { sub.cProd = e.target.value; vMufredat(); };
}

/* ---------- Paydaşlar ---------- */
function vPaydaslar() {
  const t = sub.pTab || "hekim";
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Hekimlerim</h1><p class="muted">Görüştüğünüz hekimler ve ziyaret geçmişi.</p></div></div>
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
      <div class="field"><label for="hci">Şehir</label><select id="hci"><option value="">Şehir seçin</option>${TR_CITIES.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="hi">Kurum</label><input type="text" id="hi" list="institutionOptions" maxlength="200" placeholder="Listeden seçin veya yeni kurum yazın"><datalist id="institutionOptions"></datalist><p class="hint">Listede olmayan kurum, hekim kaydıyla birlikte kurum listesine eklenir.</p></div>
      <div class="row end"><button class="btn ghost" id="hx">Vazgeç</button><button class="btn" id="hsv">Hekimi kaydet</button></div>`);
    let institutionRequest = 0;
    $("#hci", d).onchange = async () => {
      const current = ++institutionRequest, city = $("#hci", d).value;
      $("#institutionOptions", d).innerHTML = '';
      if(!city)return;
      const r=await sb.from('institutions').select('name').eq('city',city).order('name').limit(500);
      if(current===institutionRequest)$("#institutionOptions",d).innerHTML=(r.data||[]).map(x=>`<option value="${esc(x.name)}"></option>`).join('');
    };
    $("#hx", d).onclick = () => d.remove();
    $("#hsv", d).onclick = async () => {
      const name = $("#hn", d).value.trim(); if (!name) { $("#hn", d).focus(); return; }
      const inst = $("#hi", d).value.trim(), city = $("#hci", d).value;
      if(!city || !inst || inst.length<3)return toast('Şehir ve en az 3 karakterli kurum adı gerekli');
      const institution=await sb.from('institutions').insert({name:inst,city,created_by:ME.id});
      if(institution.error && institution.error.code!=='23505'){check(institution);return;}
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
  const d = dialog(`<h2>Ziyaret kaydet</h2>
    <div class="field"><label for="ih">Hekim</label><select id="ih">${D.hcps.map(h => `<option value="${h.id}" ${h.id === hcpId ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="it">Tür</label><select id="it">${INTERACTION_TYPES.map(t => `<option>${t}</option>`).join("")}</select></div>
    <div class="field"><label for="ip">Konuşulan ürün</label><select id="ip"><option value="">—</option>${D.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="idt">Tarih</label><input type="date" id="idt" value="${new Date().toISOString().slice(0, 10)}"></div>
    ${objectionFields()}
    <div class="field"><label for="inn">Notlar</label><textarea id="inn" placeholder="Hasta bilgisi yazmayın."></textarea></div>
    <p class="muted small" style="margin-bottom:12px">Yan etki duyduysanız ayrıca "Yan etki bildir" düğmesini kullanın.</p>
    <div class="row end"><button class="btn ghost" id="ix">Vazgeç</button><button class="btn" id="isv">Ziyareti kaydet</button></div>`);
  bindObjectionFields(d);
  $("#ix", d).onclick = () => d.remove();
  $("#isv", d).onclick = async () => {
    const hcp = D.hcps.find(h => h.id === $("#ih", d).value), productId = $("#ip", d).value || null;
    const row = { owner_id: ME.id, hcp_id: $("#ih", d).value, type: $("#it", d).value, product_id: $("#ip", d).value || null, date: $("#idt", d).value || null, notes: $("#inn", d).value.trim() };
    const res = await sb.from("interactions").insert(row).select().single();
    if (window.offline && offline.isNetworkError(res)) {
      offline.enqueue({ kind: "visit", interaction: row, objections: objectionRows(d, { hcp, productId }) });
      d.remove(); toast("Bağlantı yok. Ziyaret cihaza kaydedildi, bağlantı gelince gönderilecek."); return;
    }
    const saved = check(res);
    await saveObjections(d, { interactionId: saved?.id, hcp, productId });
    d.remove(); toast("Ziyaret kaydedildi"); await loadAll(); if (location.hash.startsWith("#/paydaslar")) vPaydaslar(); else route();
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


/* ---------- Profil ---------- */
function vProfil() {
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Profilim</h1><p class="muted">Hesap bilgileriniz ve şifreniz.</p></div></div>
  <div class="grid2">
    <div class="panel"><h2 style="margin-bottom:14px">Hesap</h2>
      <div class="field"><label for="pn">Ad soyad</label><input type="text" id="pn" value="${esc(ME.full_name || "")}"></div>
      <div class="field"><label>E-posta</label><input type="text" value="${esc(ME.email)}" disabled></div>
      <div class="field"><label>Rol</label><input type="text" value="${roleLabel(ME.job_role)}${ME.role === "admin" ? " · Yönetici" : ""}" disabled>
        <span class="muted small">Rol değişikliği için yöneticinize başvurun.</span></div>
      <button class="btn" id="saveName">Adı kaydet</button></div>
    <div class="panel"><h2 style="margin-bottom:14px">Şifre değiştir</h2>
      <div class="field"><label for="np">Yeni şifre</label><input type="password" id="np" autocomplete="new-password" placeholder="En az 8 karakter"></div>
      <div class="field"><label for="np2">Yeni şifre (tekrar)</label><input type="password" id="np2" autocomplete="new-password"></div>
      <button class="btn" id="savePw">Şifreyi değiştir</button><p class="small" id="pwMsg" style="margin-top:10px"></p></div>
  </div>`;
  $("#saveName").onclick = async () => {
    const n = $("#pn").value.trim(); if (!n) return toast("Ad soyad boş olamaz");
    check(await sb.from("profiles").update({ full_name: n }).eq("id", ME.id));
    ME.full_name = n; $("#userName").textContent = n; toast("Ad güncellendi");
  };
  $("#savePw").onclick = async () => {
    const a = $("#np").value, b = $("#np2").value, m = $("#pwMsg");
    m.style.color = "var(--red)";
    if (a.length < 8) { m.textContent = "Şifre en az 8 karakter olmalı."; return; }
    if (a !== b) { m.textContent = "Şifreler eşleşmiyor."; return; }
    const r = await sb.auth.updateUser({ password: a });
    if (r.error) { m.textContent = authErr(r.error); return; }
    m.style.color = "var(--green)"; m.textContent = "Şifreniz değiştirildi."; $("#np").value = $("#np2").value = "";
  };
}

/* ---------- Ürün müdürü: ekip raporu ---------- */
async function vEkip() {
  app.innerHTML = `<div class="center"><span class="spin"></span></div>`;
  const r = await sb.rpc("manager_report");
  if (r.error) { app.innerHTML = `<div class="panel"><p class="muted">${esc(r.error.message)}</p></div>`; return; }
  const rows = r.data || [];
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Ekip raporu</h1><p class="muted">Ürünlerinize atanmış PJP'lerin eğitim ve saha özeti. Hekim bilgileri gizlilik nedeniyle gösterilmez.</p></div>
    ${rows.length ? `<button class="btn ghost" id="csv">CSV indir</button>` : ""}</div>
  ${rows.length ? rows.map(p => {
    const reps = p.reps || [];
    const done = reps.reduce((t, x) => t + x.done, 0), asg = reps.reduce((t, x) => t + x.assigned, 0);
    const scored = reps.filter(x => x.avg !== null);
    const avg = scored.length ? Math.round(scored.reduce((t, x) => t + Number(x.avg), 0) / scored.length) : 0;
    const i30 = reps.reduce((t, x) => t + x.interactions_30d, 0);
    return `<div class="panel">
      <div class="row"><div class="grow"><h2>${esc(p.product)}</h2><p class="muted small">${esc(p.area || "")} · ${reps.length} PJP</p></div></div>
      ${strip([[reps.length, "PJP"], [`${done}/${asg}`, "Tamamlanan sınav"], [avg, "Ortalama puan", "brandc"], [i30, "Etkileşim (30 gün)"]], "quiet")}
      ${reps.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>PJP</th><th>Sınav</th><th>Ort. puan</th><th>Etkileşim</th><th>Son 30 gün</th><th>Son etkileşim</th></tr></thead><tbody>
        ${reps.map(x => `<tr><td>${esc(x.name)}</td><td>${x.done}/${x.assigned}</td><td>${x.avg === null ? "—" : "%" + x.avg}</td>
          <td>${x.interactions}</td><td>${x.interactions_30d}</td><td>${fmtDate(x.last_interaction)}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">Bu ürüne atanmış PJP yok.</p>`}
    </div>`;
  }).join("") : `<div class="panel"><div class="empty"><div class="ic">${icon.user}</div><h3>Size atanmış ürün yok</h3><p>Yöneticiniz size ürün atadığında ekibinizin özeti burada görünür.</p></div></div>`}`;
  const c = $("#csv");
  if (c) c.onclick = () => downloadCSV("ekip-raporu.csv", [["Ürün", "PJP", "Tamamlanan", "Atanan", "Ort. puan", "Etkileşim", "Son 30 gün", "Son etkileşim"],
    ...rows.flatMap(p => (p.reps || []).map(x => [p.product, x.name, x.done, x.assigned, x.avg ?? "", x.interactions, x.interactions_30d, x.last_interaction || ""]))]);
}

/* ---------- Avukat: hukuk incelemesi ---------- */
async function vInceleme() {
  const st = sub.revTab || "in_review";
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Hukuk incelemesi</h1><p class="muted">Sınav ve müfredatlar onayınızdan sonra kullanıcılara açılır. Onaylanan içerik sonradan değiştirilirse yeniden incelemeye gelir.</p></div></div>
  <div class="seg">
    <button data-rt="in_review" class="${st === "in_review" ? "on" : ""}">Bekleyen</button>
    <button data-rt="approved" class="${st === "approved" ? "on" : ""}">Onaylanan</button>
    <button data-rt="rejected" class="${st === "rejected" ? "on" : ""}">Reddedilen</button>
  </div><div id="rv"><div class="center"><span class="spin"></span></div></div>`;
  $$("[data-rt]").forEach(b => b.onclick = () => { sub.revTab = b.dataset.rt; vInceleme(); });
  const r = await sb.rpc("review_items", { p_status: st });
  if (r.error) { $("#rv").innerHTML = `<div class="panel"><p class="muted">${esc(r.error.message)}</p></div>`; return; }
  const items = r.data || [];
  if (st === "in_review") D.reviewCount = items.length;
  $("#rv").innerHTML = items.length ? items.map(it => `<div class="panel">
    <div class="row"><div class="grow"><h2>${esc(it.title)}</h2>
      <p class="muted small">${it.kind === "exam" ? "Sınav" : "Müfredat"} · ${esc(it.area || "Genel")}${it.product ? " · " + esc(it.product) : ""}${it.reviewer ? ` · ${esc(it.reviewer)}, ${fmtDate(it.updated)}` : ""}</p></div>
      ${reviewPill(it.status)}</div>
    ${it.note ? `<p class="notice" style="margin-top:10px">Not: ${esc(it.note)}</p>` : ""}
    <details style="margin-top:10px" ${st === "in_review" ? "open" : ""}><summary style="cursor:pointer;font-weight:600">İçeriği göster</summary>
      ${it.kind === "exam" ? `${it.description ? `<p style="margin-top:8px">${esc(it.description)}</p>` : ""}
        ${(it.questions || []).map((q, i) => `<div class="review-card"><b>${i + 1}. ${esc(q.q)}</b>
          <ol type="A" style="margin:8px 0 0;padding-left:22px">${q.options.map((o, j) => `<li style="${it.answers && it.answers[i] === j ? "font-weight:700;color:var(--green)" : ""}">${esc(o)}${it.answers && it.answers[i] === j ? " ✓" : ""}</li>`).join("")}</ol>
          ${it.explanations && it.explanations[i] ? `<p class="expl">${esc(it.explanations[i])}</p>` : ""}</div>`).join("")}`
      : renderModules(it.modules)}
    </details>
    ${st === "in_review" ? `<div class="field" style="margin-top:14px"><label for="n_${it.id}">İnceleme notu (ret için zorunlu)</label><textarea id="n_${it.id}" rows="2"></textarea></div>
      <div class="row end"><button class="btn danger" data-dec="rejected" data-k="${it.kind}" data-id="${it.id}">Reddet</button>
      <button class="btn" data-dec="approved" data-k="${it.kind}" data-id="${it.id}">Onayla</button></div>` : ""}
  </div>`).join("") : `<div class="panel"><div class="empty"><div class="ic">${icon.book}</div><h3>${st === "in_review" ? "İnceleme bekleyen içerik yok" : "Kayıt yok"}</h3><p>${st === "in_review" ? "Yönetici bir içeriği incelemeye gönderdiğinde burada görünür." : "Bu durumda içerik bulunmuyor."}</p></div></div>`;
  $$("[data-dec]").forEach(b => b.onclick = async () => {
    const note = $("#n_" + b.dataset.id).value.trim(), dec = b.dataset.dec;
    if (dec === "rejected" && !note) { toast("Ret için gerekçe yazın"); return; }
    if (!confirm(dec === "approved" ? "İçerik onaylansın mı?" : "İçerik reddedilsin mi?")) return;
    const res = await sb.rpc("review_decide", { p_kind: b.dataset.k, p_id: b.dataset.id, p_decision: dec, p_note: note || null });
    if (res.error) { toast(res.error.message); return; }
    toast(dec === "approved" ? "Onaylandı" : "Reddedildi"); vInceleme();
  });
}

function downloadCSV(name, rows) {
  const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Yönlendirme ---------- */
// Dört ana sekme; diğer sayfalar bu sekmelerin içinden açılır ve geri bağlantısı sekmeye döner.
const TABS = [
  ["portal", "Bugün", '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'],
  ["ogren", "Öğren", icon.book],
  ["pratik", "Pratik", '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>'],
  ["ben", "Ben", icon.user]
];
function pageTabs() {
  const r = ME.job_role, m = {
    portal: "portal", degisiklik: "portal",
    ogren: "ogren", mufredat: "ogren", kutuphane: "ogren", belgeler: "ogren",
    pratik: "pratik", egitim: "pratik", sinav: "pratik", yanlislar: "pratik", ogrenme: "pratik", sahacalisma: "pratik", gelisim: "pratik",
    ben: "ben", profil: "ben", masam: "ben"
  };
  if (r === "pjp") Object.assign(m, { roleplay: "pratik", duello: "pratik", vaka: "pratik", oda: "pratik", paydaslar: "ben" });
  if (r === "avukat") Object.assign(m, { inceleme: "ben", duellosoru: "ben" });
  if (r === "urun_muduru") Object.assign(m, { ekip: "ben", beceri: "ben" });
  if (fieldManager() || fieldReviewer()) m.atolye = "ben";
  if (r === "urun_muduru" || ME.role === "admin") m.itirazlar = "ben";
  m.yanetki = "ben";
  return m;
}
function route() {
  fieldGeneration++;
  if (window.stopRoleplay) window.stopRoleplay();
  const h = location.hash.replace(/^#\/?/, "") || "portal";
  const [p, arg] = h.split("/");
  const tabs = pageTabs();
  const page = p in tabs ? p : "portal", tab = tabs[page];
  const badge = ME.job_role === "avukat" && D.reviewCount ? `<span class="badge-n">${D.reviewCount}</span>` : "";
  const links = TABS.map(([k, l, ic]) => `<a href="#/${k}" class="${k === tab ? "active" : ""}"${k === tab ? ' aria-current="page"' : ""}>${ic}<span>${l}</span>${k === "ben" ? badge : ""}</a>`).join("");
  $("#nav").innerHTML = links;
  const bar = $("#tabbar"); if (bar) bar.innerHTML = links;
  const pv = $("#pvBtn"); if (pv) { pv.hidden = false; pv.onclick = pvDialog; }
  const views = { masam: vTools, yanlislar: vMistakes, sahacalisma: vField, gelisim: () => vField("plan"), degisiklik: vFieldNotices, atolye: () => vField("manage"), beceri: vFieldHeatmap, duello: vDuello, duellosoru: vDuelQuestions, ogrenme: vOgrenme, belgeler: vBelgeler, portal: vPortal, ogren: vOgren, pratik: vPratik, ben: vBen, egitim: vEgitim, kutuphane: vKutuphane, mufredat: vMufredat, paydaslar: vPaydaslar, ekip: vEkip, inceleme: vInceleme, profil: vProfil, roleplay: vRoleplay, itirazlar: vItirazlar, yanetki: vYanEtkilerim, vaka: vVaka, oda: () => vOda(arg), sinav: () => vSinav(arg) };
  const hub = TABS.some(t => t[0] === page);
  // Alt sayfalarda, ait olduğu sekmeye dönen tek bir geri bağlantısı (sınav sayfasının kendi bağlantısı var).
  const back = $("#backLink");
  if (back) {
    const t = TABS.find(x => x[0] === tab);
    back.hidden = hub || page === "sinav";
    back.href = "#/" + t[0]; back.textContent = "← " + t[1];
  }
  const rendered = views[page]();
  Promise.resolve(rendered).then(() => {
    if ((location.hash.replace(/^#\/?/, "").split("/")[0] || "portal") !== p && location.hash) return;
    if (!hub) qolPageTools(page);
  }).catch(e => console.error(e));
  if (!hub && !["masam", "yanlislar", "profil"].includes(page)) qolWrite("lastPage", location.hash);
}
window.addEventListener("hashchange", () => { if (ME) { route(); window.scrollTo(0, 0); } });
boot(async () => { await loadAll(); route(); window.offline?.start(); });




