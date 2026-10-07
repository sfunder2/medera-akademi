/* Yönetim paneli */
const app = $("#app");
const A = { users: [], products: [], exams: [], asg: [], curricula: [], up: [], interactions: [], hcps: [], anns: [] };
const sub = {};
let draft = null; // sınav düzenleyici durumu

async function loadAll() {
  const [u, p, e, a, c, up, i, h, an] = await Promise.all([
    sb.from("profiles").select("*").order("created_at"),
    sb.from("products").select("*").order("name"),
    sb.from("exams").select("*").eq("is_practice", false).order("created_at", { ascending: false }),
    sb.from("exam_assignments").select("*"),
    sb.from("curricula").select("*, products(name)").order("created_at", { ascending: false }),
    sb.from("user_products").select("*"),
    sb.from("interactions").select("*, products(name)").order("date", { ascending: false }).limit(2000),
    sb.from("hcps").select("*").order("name"),
    sb.from("announcements").select("*").order("created_at", { ascending: false })
  ]);
  [u, p, e, a, c, up, i, h, an].forEach(r => r.error && console.error(r.error));
  A.anns = an.data || [];
  A.users = u.data || []; A.products = p.data || []; A.exams = e.data || [];
  const examIds = new Set(A.exams.map(x => x.id));
  A.asg = (a.data || []).filter(x => examIds.has(x.exam_id));
  A.curricula = c.data || []; A.up = up.data || []; A.interactions = i.data || []; A.hcps = h.data || [];
  const pend = A.users.filter(x => x.status === "pending").length, b = $("#pendingBadge");
  if (b) { b.hidden = !pend; b.textContent = pend; }
}
const activeUsers = () => A.users.filter(u => u.status === "active");
const STATUS_LABEL = { pending: "Onay bekliyor", active: "Etkin", disabled: "Devre dışı" };
const STATUS_PILL = { pending: "wait", active: "ok", disabled: "bad" };
const userName = id => { const u = A.users.find(x => x.id === id); return u ? (u.full_name || u.email) : "—"; };
const examStats = id => {
  const list = A.asg.filter(a => a.exam_id === id), done = list.filter(a => a.status === "done");
  return { n: list.length, done: done.length, avg: done.length ? Math.round(done.reduce((t, a) => t + a.score, 0) / done.length) : 0 };
};

/* ---------- Genel bakış ---------- */
function vGenel() {
  const done = A.asg.filter(a => a.status === "done");
  const avg = done.length ? Math.round(done.reduce((t, a) => t + a.score, 0) / done.length) : 0;
  const pass = done.length ? Math.round(done.filter(a => a.score >= 70).length / done.length * 100) : 0;
  const comp = A.asg.length ? Math.round(done.length / A.asg.length * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const late = A.asg.filter(a => a.status === "pending" && a.due_date && a.due_date < today);
  const pendingUsers = A.users.filter(u => u.status === "pending");
  const inReview = A.exams.filter(e => e.review_status === "in_review").length + A.curricula.filter(c => c.review_status === "in_review").length;
  const recent = done.slice().sort((x, y) => (y.completed_at || "").localeCompare(x.completed_at || "")).slice(0, 8);
  const exam = id => A.exams.find(e => e.id === id)?.title || "—";
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Genel bakış</h1><p class="muted">Ekibin eğitim durumu ve saha aktivitesi.</p></div></div>
  ${strip([[activeUsers().length, "Etkin kullanıcı"], [A.exams.length, "Sınav"], [A.asg.length - done.length, "Bekleyen atama", "amber"], ["%" + comp, "Tamamlama", "brandc", comp]])}
  ${strip([[avg, "Ortalama puan"], ["%" + pass, "Başarı oranı (≥70)"], [A.hcps.length, "Kayıtlı hekim"], [A.interactions.length, "Kayıtlı etkileşim"]], "quiet")}
  ${pendingUsers.length || inReview ? `<div class="panel" style="margin-bottom:16px"><h2>Bekleyen işler</h2><div class="list" style="margin-top:6px">
    ${pendingUsers.length ? `<div class="item"><div class="grow"><h3>${pendingUsers.length} kullanıcı onay bekliyor</h3><p class="muted small">${pendingUsers.slice(0, 4).map(u => esc(u.full_name || u.email) + " (" + roleLabel(u.job_role) + ")").join(", ")}</p></div><a class="btn sm" href="#/kullanicilar">İncele</a></div>` : ""}
    ${inReview ? `<div class="item"><div class="grow"><h3>${inReview} içerik hukuk incelemesinde</h3><p class="muted small">Avukat rolündeki kullanıcıların onayı bekleniyor.</p></div></div>` : ""}
  </div></div>` : ""}
  <div class="panel" style="margin-bottom:16px"><h2 style="margin-bottom:12px">Rol dağılımı (etkin)</h2>
    ${strip(Object.entries(JOB_ROLES).map(([k, v]) => [activeUsers().filter(u => u.job_role === k).length, v]).concat([[A.users.filter(u => u.role === "admin").length, "Yönetici"]]), "quiet")}</div>
  <div class="grid2">
    <div class="panel"><h2>Son tamamlananlar</h2>
      ${recent.length ? `<div class="list" style="margin-top:8px">${recent.map(a => `<div class="item"><div class="grow"><h3>${esc(userName(a.user_id))}</h3>
        <p class="muted small">${esc(exam(a.exam_id))} · ${fmtDate(a.completed_at)}</p></div><span class="pill ${a.score >= 70 ? "ok" : "wait"}">%${a.score}</span></div>`).join("")}</div>`
      : `<p class="muted" style="margin-top:6px">Henüz tamamlanan sınav yok.</p>`}</div>
    <div class="panel"><h2>Geciken atamalar</h2>
      ${late.length ? `<div class="list" style="margin-top:8px">${late.slice(0, 8).map(a => `<div class="item"><div class="grow"><h3>${esc(userName(a.user_id))}</h3>
        <p class="muted small">${esc(exam(a.exam_id))}</p></div><span class="pill bad">${fmtDate(a.due_date)}</span></div>`).join("")}</div>`
      : `<p class="muted" style="margin-top:6px">Geciken atama yok.</p>`}</div>
  </div>`;
}

/* ---------- Kullanıcılar ---------- */
function vKullanicilar() {
  const q = (sub.uq || "").toLocaleLowerCase("tr"), fs = sub.us ?? (A.users.some(u => u.status === "pending") ? "pending" : ""), fr = sub.ur || "";
  const list = A.users.filter(u => (!q || ((u.full_name || "") + " " + (u.email || "")).toLocaleLowerCase("tr").includes(q)) && (!fs || u.status === fs) && (!fr || u.job_role === fr));
  const cnt = st => A.users.filter(u => !st || u.status === st).length;
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Kullanıcılar</h1>
    <p class="muted">Kayıt olan kullanıcılar onayınızdan sonra içeriğe erişir. Rolü kullanıcı seçer; gerekirse buradan düzeltin.</p></div>
    <input type="search" id="uq" placeholder="İsim veya e-posta ara…" value="${esc(sub.uq || "")}" style="max-width:240px">
    <select id="ur" class="auto"><option value="">Tüm roller</option>${Object.entries(JOB_ROLES).map(([k, v]) => `<option value="${k}" ${fr === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
  <div class="seg">
    <button data-us="pending" class="${fs === "pending" ? "on" : ""}">Onay bekleyen <span class="n">${cnt("pending")}</span></button>
    <button data-us="active" class="${fs === "active" ? "on" : ""}">Etkin <span class="n">${cnt("active")}</span></button>
    <button data-us="disabled" class="${fs === "disabled" ? "on" : ""}">Devre dışı <span class="n">${cnt("disabled")}</span></button>
    <button data-us="" class="${fs === "" ? "on" : ""}">Tümü <span class="n">${cnt("")}</span></button>
  </div>
  <div class="panel"><div class="tablewrap"><table class="t">
    <thead><tr><th>Kullanıcı</th><th>Rol</th><th>Durum</th><th>Ürünler</th><th>Sınav</th><th>Ort.</th><th>Hekim / etkileşim</th><th></th></tr></thead>
    <tbody>${list.map(u => {
      const asg = A.asg.filter(a => a.user_id === u.id), done = asg.filter(a => a.status === "done");
      const avg = done.length ? Math.round(done.reduce((t, a) => t + a.score, 0) / done.length) : null;
      const prods = A.up.filter(x => x.user_id === u.id).map(x => A.products.find(p => p.id === x.product_id)?.name).filter(Boolean);
      const me = u.id === ME.id;
      return `<tr><td><b>${esc(u.full_name || "—")}</b>${u.role === "admin" ? ' <span class="pill ok">Yönetici</span>' : ""}<br><span class="muted small">${esc(u.email)} · ${fmtDate(u.created_at)}</span></td>
        <td><select class="auto" data-jr="${u.id}" aria-label="Rol">${Object.entries(JOB_ROLES).map(([k, v]) => `<option value="${k}" ${u.job_role === k ? "selected" : ""}>${v}</option>`).join("")}</select></td>
        <td><span class="pill ${STATUS_PILL[u.status] || ""}">${STATUS_LABEL[u.status] || u.status}</span></td>
        <td class="small">${prods.length ? prods.map(esc).join(", ") : '<span class="muted">—</span>'}</td>
        <td>${done.length}/${asg.length}</td><td>${avg === null ? "—" : "%" + avg}</td>
        <td>${A.hcps.filter(h => h.owner_id === u.id).length} / ${A.interactions.filter(i => i.owner_id === u.id).length}</td>
        <td><div class="row" style="flex-wrap:nowrap">
          ${u.status === "pending" ? `<button class="btn sm" data-st="${u.id}" data-to="active">Onayla</button><button class="btn danger sm" data-st="${u.id}" data-to="disabled">Reddet</button>` : ""}
          ${u.status === "active" && !me ? `<button class="btn danger sm" data-st="${u.id}" data-to="disabled">Devre dışı bırak</button>` : ""}
          ${u.status === "disabled" ? `<button class="btn ghost sm" data-st="${u.id}" data-to="active">Etkinleştir</button>` : ""}
          <button class="btn ghost sm" data-ap="${u.id}">Ürün ata</button>
          ${me ? "" : `<button class="btn ghost sm" data-role="${u.id}" data-to="${u.role === "admin" ? "user" : "admin"}">${u.role === "admin" ? "Yöneticiliği kaldır" : "Yönetici yap"}</button>`}
        </div></td></tr>`;
    }).join("") || `<tr><td colspan="8" class="muted">Bu filtreye uyan kullanıcı yok.</td></tr>`}</tbody></table></div></div>`;
  $("#uq").oninput = e => { sub.uq = e.target.value; vKullanicilar(); const n = $("#uq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $("#ur").onchange = e => { sub.ur = e.target.value; vKullanicilar(); };
  $$("[data-us]").forEach(b => b.onclick = () => { sub.us = b.dataset.us; vKullanicilar(); });
  $$("[data-jr]").forEach(sel => sel.onchange = async () => {
    check(await sb.rpc("admin_set_job_role", { p_user: sel.dataset.jr, p_job_role: sel.value })); toast("Rol güncellendi"); await loadAll(); vKullanicilar();
  });
  $$("[data-st]").forEach(b => b.onclick = async () => {
    const to = b.dataset.to, msg = { active: "Kullanıcı etkinleştirilsin mi?", disabled: "Kullanıcının erişimi kapatılsın mı?" }[to];
    if (!confirm(msg)) return;
    check(await sb.rpc("admin_set_status", { p_user: b.dataset.st, p_status: to }));
    toast(to === "active" ? "Kullanıcı etkinleştirildi" : "Erişim kapatıldı"); await loadAll(); vKullanicilar();
  });
  $$("[data-role]").forEach(b => b.onclick = async () => {
    if (!confirm(b.dataset.to === "admin" ? "Bu kullanıcı yönetici yapılsın mı?" : "Yönetici yetkisi kaldırılsın mı?")) return;
    check(await sb.rpc("admin_set_role", { p_user: b.dataset.role, p_role: b.dataset.to })); toast("Yetki güncellendi"); await loadAll(); vKullanicilar();
  });
  $$("[data-ap]").forEach(b => b.onclick = () => assignProductsDialog(b.dataset.ap));
}

/* ---------- Hekimler ---------- */
function vHekimler() {
  const q = (sub.hq || "").toLocaleLowerCase("tr"), fo = sub.ho || "", fc = sub.hc || "", fsp = sub.hs || "";
  const cities = [...new Set(A.hcps.map(h => h.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const specs = [...new Set(A.hcps.map(h => h.spec).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const owners = A.users.filter(u => A.hcps.some(h => h.owner_id === u.id));
  const list = A.hcps.filter(h => (!q || (h.name + " " + (h.inst || "")).toLocaleLowerCase("tr").includes(q)) && (!fo || h.owner_id === fo) && (!fc || h.city === fc) && (!fsp || h.spec === fsp));
  const stats = h => { const ii = A.interactions.filter(i => i.hcp_id === h.id); return { n: ii.length, last: ii.map(i => i.date).filter(Boolean).sort().pop() }; };
  const key = h => (h.name || "").toLocaleLowerCase("tr").replace(/^dr\.?\s*/, "").trim() + "|" + (h.inst || "").toLocaleLowerCase("tr").trim();
  const dupCount = {}; A.hcps.forEach(h => { dupCount[key(h)] = (dupCount[key(h)] || 0) + 1; });
  const shared = Object.values(dupCount).filter(n => n > 1).length;
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Hekimler</h1><p class="muted">Tüm temsilcilerin kaydettiği hekimler (salt okunur). Kişisel veri içerir; dışa aktarırken dikkatli olun.</p></div>
    <button class="btn ghost" id="csv" ${list.length ? "" : "disabled"}>CSV indir</button></div>
  ${strip([[A.hcps.length, "Kayıtlı hekim"], [Object.keys(dupCount).length, "Tekil hekim (ad + kurum)"], [shared, "Birden fazla temsilcide", "amber"], [cities.length, "Şehir"]], "quiet")}
  <div class="panel">
    <div class="row" style="margin-bottom:8px">
      <input type="search" id="hq" placeholder="İsim veya kurum ara…" value="${esc(sub.hq || "")}" style="flex:1;min-width:200px">
      <select id="ho" class="auto"><option value="">Tüm temsilciler</option>${owners.map(u => `<option value="${u.id}" ${fo === u.id ? "selected" : ""}>${esc(u.full_name || u.email)}</option>`).join("")}</select>
      <select id="hs" class="auto"><option value="">Tüm uzmanlıklar</option>${specs.map(x => `<option ${fsp === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
      <select id="hc" class="auto"><option value="">Tüm şehirler</option>${cities.map(x => `<option ${fc === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
    ${list.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Hekim</th><th>Uzmanlık</th><th>Kurum</th><th>Şehir</th><th>Temsilci</th><th>Etkileşim</th><th>Son</th></tr></thead><tbody>
      ${list.map(h => { const s = stats(h); return `<tr><td><b>${esc(h.name)}</b>${dupCount[key(h)] > 1 ? ` <span class="pill wait" title="Birden fazla temsilci bu hekimi kaydetmiş">${dupCount[key(h)]} temsilci</span>` : ""}</td>
        <td class="small">${esc(h.spec || "")}</td><td class="small">${esc(h.inst || "")}</td><td class="small">${esc(h.city || "")}</td>
        <td class="small">${esc(userName(h.owner_id))}</td><td>${s.n}</td><td class="small">${fmtDate(s.last)}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty"><div class="ic">${icon.user}</div><h3>Hekim bulunamadı</h3><p>${A.hcps.length ? "Filtreleri değiştirin." : "PJP'ler Paydaşlar sekmesinden hekim eklediğinde burada görünür."}</p></div>`}
  </div>`;
  $("#hq").oninput = e => { sub.hq = e.target.value; vHekimler(); const n = $("#hq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $("#ho").onchange = e => { sub.ho = e.target.value; vHekimler(); };
  $("#hs").onchange = e => { sub.hs = e.target.value; vHekimler(); };
  $("#hc").onchange = e => { sub.hc = e.target.value; vHekimler(); };
  $("#csv").onclick = () => downloadCSV("hekimler.csv", [["Hekim", "Uzmanlık", "Kurum", "Şehir", "Temsilci", "Etkileşim", "Son etkileşim"],
    ...list.map(h => { const s = stats(h); return [h.name, h.spec || "", h.inst || "", h.city || "", userName(h.owner_id), s.n, s.last || ""]; })]);
}

/* ---------- Duyurular ---------- */
function vDuyurular() {
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Duyurular</h1><p class="muted">Duyurular kullanıcıların ana sayfasında görünür. Belirli bir role hedefleyebilirsiniz.</p></div>
    <button class="btn" id="newA">Duyuru yayımla</button></div>
  <div class="panel">${A.anns.length ? `<div class="list">${A.anns.map(a => `<div class="item" style="align-items:flex-start">
    <div class="grow"><h3>${a.pinned ? "📌 " : ""}${esc(a.title)}</h3><p class="muted small">${fmtDate(a.created_at)} · ${a.target_role ? roleLabel(a.target_role) + " rolüne" : "Herkese"}</p>
    ${a.body ? `<p style="font-size:14px;margin-top:6px;white-space:pre-wrap">${esc(a.body)}</p>` : ""}</div>
    <button class="btn ghost sm" data-pin="${a.id}" data-v="${a.pinned ? 0 : 1}">${a.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}</button>
    <button class="btn danger sm" data-ad="${a.id}">Sil</button></div>`).join("")}</div>`
  : `<div class="empty"><div class="ic">${icon.book}</div><h3>Henüz duyuru yok</h3><p>Yeni sınavlar, eğitim takvimi veya önemli güncellemeler için duyuru yayımlayın.</p></div>`}</div>`;
  $("#newA").onclick = () => {
    const d = dialog(`<h2>Duyuru yayımla</h2>
      <div class="field"><label for="at">Başlık</label><input type="text" id="at"></div>
      <div class="field"><label for="ab">Metin</label><textarea id="ab" rows="5"></textarea></div>
      <div class="field"><label for="ar">Kime</label><select id="ar"><option value="">Herkese</option>${Object.entries(JOB_ROLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <label class="check"><input type="checkbox" id="ap"><span>Üstte sabitle</span></label>
      <div class="row end" style="margin-top:14px"><button class="btn ghost" id="x">Vazgeç</button><button class="btn" id="s">Yayımla</button></div>`);
    $("#x", d).onclick = () => d.remove();
    $("#s", d).onclick = async () => {
      const title = $("#at", d).value.trim(); if (!title) { $("#at", d).focus(); return; }
      check(await sb.from("announcements").insert({ title, body: $("#ab", d).value.trim() || null, target_role: $("#ar", d).value || null, pinned: $("#ap", d).checked, created_by: ME.id }));
      d.remove(); toast("Duyuru yayımlandı"); await loadAll(); vDuyurular();
    };
  };
  $$("[data-pin]").forEach(b => b.onclick = async () => { check(await sb.from("announcements").update({ pinned: b.dataset.v === "1" }).eq("id", b.dataset.pin)); await loadAll(); vDuyurular(); });
  $$("[data-ad]").forEach(b => b.onclick = async () => { if (!confirm("Duyuru silinsin mi?")) return; check(await sb.from("announcements").delete().eq("id", b.dataset.ad)); await loadAll(); vDuyurular(); });
}

function assignProductsDialog(uid) {
  if (!A.products.length) { toast("Önce Ürünler sekmesinden ürün ekleyin"); return; }
  const have = new Set(A.up.filter(x => x.user_id === uid).map(x => x.product_id));
  const d = dialog(`<h2>Ürün ata — ${esc(userName(uid))}</h2>
    <div>${A.products.map(p => `<label class="check"><input type="checkbox" value="${p.id}" ${have.has(p.id) ? "checked" : ""}><span>${esc(p.name)} <span class="muted small">${esc(p.area || "")}</span></span></label>`).join("")}</div>
    <div class="row end" style="margin-top:14px"><button class="btn ghost" id="x">Vazgeç</button><button class="btn" id="s">Atamaları kaydet</button></div>`);
  $("#x", d).onclick = () => d.remove();
  $("#s", d).onclick = async () => {
    const want = new Set($$("input:checked", d).map(i => i.value));
    const add = [...want].filter(id => !have.has(id)).map(product_id => ({ user_id: uid, product_id }));
    const del = [...have].filter(id => !want.has(id));
    if (add.length) check(await sb.from("user_products").insert(add));
    if (del.length) check(await sb.from("user_products").delete().eq("user_id", uid).in("product_id", del));
    d.remove(); toast("Ürün atamaları kaydedildi"); await loadAll(); vKullanicilar();
  };
}

/* ---------- Ürünler ---------- */
function vUrunler() {
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Ürünler</h1><p class="muted">Ürün bilgileri kullanıcıların kütüphanesinde ve yapay zekâ asistanında bağlam olarak kullanılır.</p></div>
    <button class="btn" id="addP">Ürün ekle</button></div>
  <div class="panel">${A.products.length ? `<div class="list">${A.products.map(p => `
    <div class="item" style="align-items:flex-start"><div class="avatar">${icon.box.replace(/24/g, "18")}</div>
      <div class="grow"><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.area || "")}${p.molecule ? " · " + esc(p.molecule) : ""} · ${A.up.filter(x => x.product_id === p.id).length} kullanıcıya atandı</p>
      ${p.notes ? `<p style="font-size:14px;margin-top:6px;white-space:pre-wrap">${esc(p.notes)}</p>` : ""}</div>
      <button class="btn ghost sm" data-pe="${p.id}">Düzenle</button><button class="btn danger sm" data-pd="${p.id}">Sil</button></div>`).join("")}</div>`
    : `<div class="empty"><div class="ic">${icon.box}</div><h3>Henüz ürün yok</h3><p>Ürün ekleyin, ardından Kullanıcılar sekmesinden temsilcilere atayın.</p></div>`}</div>`;
  $("#addP").onclick = () => productDialog();
  $$("[data-pe]").forEach(b => b.onclick = () => productDialog(A.products.find(p => p.id === b.dataset.pe)));
  $$("[data-pd]").forEach(b => b.onclick = async () => {
    if (!confirm("Ürün silinsin mi? Atamaları da kaldırılır.")) return;
    check(await sb.from("products").delete().eq("id", b.dataset.pd)); await loadAll(); vUrunler();
  });
}
function productDialog(p = {}) {
  const d = dialog(`<h2>${p.id ? "Ürünü düzenle" : "Ürün ekle"}</h2>
    <div class="field"><label for="pn">Ürün adı</label><input type="text" id="pn" value="${esc(p.name)}"></div>
    <div class="field"><label for="pm">Etken madde</label><input type="text" id="pm" value="${esc(p.molecule)}"></div>
    <div class="field"><label for="pa">Tedavi alanı</label><select id="pa">${AREAS.map(a => `<option ${p.area === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
    <div class="field"><label for="pno">Notlar (endikasyon, önemli çalışmalar, sık sorulanlar)</label><textarea id="pno" rows="6">${esc(p.notes)}</textarea></div>
    <div class="row end"><button class="btn ghost" id="x">Vazgeç</button><button class="btn" id="s">Ürünü kaydet</button></div>`);
  $("#x", d).onclick = () => d.remove();
  $("#s", d).onclick = async () => {
    const row = { name: $("#pn", d).value.trim(), molecule: $("#pm", d).value.trim(), area: $("#pa", d).value, notes: $("#pno", d).value.trim() };
    if (!row.name) { $("#pn", d).focus(); return; }
    check(p.id ? await sb.from("products").update(row).eq("id", p.id) : await sb.from("products").insert(row));
    d.remove(); toast("Ürün kaydedildi"); await loadAll(); vUrunler();
  };
}

/* ---------- Sınavlar ---------- */
function vSinavlar() {
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Sınavlar</h1><p class="muted">Sınav oluşturun, hukuk incelemesine gönderin, onaylananları atayın ve sonuçları izleyin. Onaylı bir sınavı düzenlerseniz yeniden onay gerekir.</p></div>
    <button class="btn" id="newE">Yeni sınav</button></div>
  <div class="panel">${A.exams.length ? `<div class="list">${A.exams.map(e => {
    const s = examStats(e.id);
    return `<div class="item"><div class="grow"><h3>${esc(e.title)}</h3>
      <p class="muted small">${esc(e.area || "Genel")} · ${e.questions.length} soru · ${s.done}/${s.n} tamamlandı${s.done ? ` · ort. %${s.avg}` : ""}</p>
      ${e.review_status === "rejected" && e.review_note ? `<p class="small" style="color:var(--red);margin-top:4px">Ret gerekçesi: ${esc(e.review_note)}</p>` : ""}</div>
      ${reviewPill(e.review_status)}
      ${e.review_status === "draft" || e.review_status === "rejected" ? `<button class="btn ghost sm" data-send="${e.id}">İncelemeye gönder</button>` : ""}
      <button class="btn sm" data-as="${e.id}" ${e.review_status === "approved" ? "" : 'disabled title="Önce hukuk onayı gerekli"'}>Ata</button><button class="btn ghost sm" data-rs="${e.id}">Sonuçlar</button>
      <button class="btn ghost sm" data-ed="${e.id}">Düzenle</button><button class="btn danger sm" data-dl="${e.id}">Sil</button></div>`;
  }).join("")}</div>`
  : `<div class="empty"><div class="ic">${icon.folder}</div><h3>Henüz sınav yok</h3><p>Yapay zekâyla taslak oluşturun ya da soruları kendiniz yazın.</p></div>`}</div>`;
  $("#newE").onclick = newExamDialog;
  $$("[data-as]").forEach(b => b.onclick = () => assignDialog(b.dataset.as));
  $$("[data-send]").forEach(b => b.onclick = async () => {
    check(await sb.from("exams").update({ review_status: "in_review" }).eq("id", b.dataset.send)); toast("Hukuk incelemesine gönderildi"); await loadAll(); vSinavlar();
  });
  $$("[data-rs]").forEach(b => b.onclick = () => resultsDialog(b.dataset.rs));
  $$("[data-ed]").forEach(b => b.onclick = () => location.hash = "#/sinav/" + b.dataset.ed);
  $$("[data-dl]").forEach(b => b.onclick = async () => {
    if (!confirm("Sınav, atamaları ve sonuçlarıyla birlikte silinsin mi?")) return;
    check(await sb.from("exams").delete().eq("id", b.dataset.dl)); await loadAll(); vSinavlar();
  });
}
function newExamDialog() {
  const d = dialog(`<h2>Yeni sınav</h2>
    <div class="field"><label for="ea">Tedavi alanı</label><select id="ea">${AREAS.map(a => `<option>${a}</option>`).join("")}</select></div>
    <div class="field"><label for="ep">Ürün (isteğe bağlı)</label><select id="ep"><option value="">Seçilmedi</option>${A.products.map(p => `<option>${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="et">Konu</label><input type="text" id="et" placeholder="örn. Faz III çalışma sonuçları ve güvenlilik profili"></div>
    <div class="field"><label for="en">Soru sayısı</label><select id="en"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></div>
    <p class="muted small" id="m" style="margin-bottom:12px">Yapay zekâ bir taslak üretir; kaydetmeden önce her soruyu kontrol edebilirsiniz.</p>
    <div class="row end"><button class="btn ghost" id="blank">Boş başla</button><button class="btn" id="gen">Yapay zekâyla taslak oluştur</button></div>`);
  $("#blank", d).onclick = () => {
    draft = { title: $("#et", d).value.trim() || "Yeni sınav", area: $("#ea", d).value, description: "", questions: [blankQ()] };
    d.remove(); location.hash = "#/sinav/yeni";
  };
  $("#gen", d).onclick = async () => {
    const area = $("#ea", d).value, product = $("#ep", d).value, topic = $("#et", d).value.trim(), n = +$("#en", d).value;
    if (!topic) { $("#m", d).textContent = "Bir konu yazın."; return; }
    const b = $("#gen", d); busyBtn(b, true, "Oluşturuluyor");
    const prod = A.products.find(p => p.name === product);
    try {
      const q = normalizeQuiz(await aiJSON(examPrompt({ area, topic, n, product: prod ? `${prod.name} (${prod.molecule || ""}; notlar: ${prod.notes || "yok"})` : "" }), 9000));
      draft = { title: q.title || topic, area, description: "", questions: q.questions };
      d.remove(); location.hash = "#/sinav/yeni";
    } catch (e) { busyBtn(b, false, "Yapay zekâyla taslak oluştur"); $("#m", d).textContent = aiError(e); }
  };
}
const blankQ = () => ({ q: "", options: ["", "", "", ""], answer: 0, explanation: "" });

async function vSinavEdit(id) {
  if (id !== "yeni" && (!draft || draft.id !== id)) {
    app.innerHTML = `<div class="center"><span class="spin"></span></div>`;
    const ex = A.exams.find(e => e.id === id);
    if (!ex) { location.hash = "#/sinavlar"; return; }
    const k = (await sb.from("exam_keys").select("*").eq("exam_id", id).maybeSingle()).data || { answers: [], explanations: [] };
    draft = { id, title: ex.title, area: ex.area, description: ex.description || "",
      questions: ex.questions.map((q, i) => ({ q: q.q, options: q.options.slice(), answer: k.answers[i] ?? 0, explanation: k.explanations[i] || "" })) };
  }
  if (!draft) { location.hash = "#/sinavlar"; return; }
  const s = draft.id ? examStats(draft.id) : null;
  app.innerHTML = `
  <a class="back" href="#/sinavlar">← Sınavlara dön</a>
  <div class="page-head"><div class="grow"><h1>${draft.id ? "Sınavı düzenle" : "Yeni sınav"}</h1>
    ${s && s.done ? `<p class="notice" style="margin-top:8px">Bu sınavı ${s.done} kişi tamamladı. Değişiklikler eski puanları yeniden hesaplamaz.</p>` : ""}</div>
    <button class="btn" id="save">Sınavı kaydet</button></div>
  <div class="panel">
    <div class="row"><div class="field grow"><label for="dt">Başlık</label><input type="text" id="dt" value="${esc(draft.title)}"></div>
      <div class="field"><label for="da">Tedavi alanı</label><select id="da">${AREAS.map(a => `<option ${draft.area === a ? "selected" : ""}>${a}</option>`).join("")}</select></div></div>
    <div class="field"><label for="dd">Açıklama (isteğe bağlı)</label><textarea id="dd" rows="2">${esc(draft.description)}</textarea></div>
    <h2 style="margin-top:8px">Sorular (${draft.questions.length})</h2>
    ${draft.questions.map((q, i) => `<div class="qedit">
      <div class="row"><b class="grow">Soru ${i + 1}</b>
        <button class="btn ghost sm" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Yukarı taşı">↑</button>
        <button class="btn ghost sm" data-dn="${i}" ${i === draft.questions.length - 1 ? "disabled" : ""} aria-label="Aşağı taşı">↓</button>
        <button class="btn danger sm" data-rm="${i}">Kaldır</button></div>
      <textarea data-k="q" data-i="${i}" rows="2" style="margin-top:8px" placeholder="Soru metni">${esc(q.q)}</textarea>
      ${q.options.map((o, j) => `<div class="optrow"><input type="radio" name="ans${i}" data-ans="${i}" value="${j}" ${q.answer === j ? "checked" : ""} aria-label="Doğru cevap ${"ABCD"[j]}">
        <b style="width:16px">${"ABCD"[j]}</b><input type="text" data-k="o" data-i="${i}" data-j="${j}" value="${esc(o)}" placeholder="Şık ${"ABCD"[j]}"></div>`).join("")}
      <textarea data-k="e" data-i="${i}" rows="2" style="margin-top:8px" placeholder="Açıklama (sınav bittikten sonra gösterilir)">${esc(q.explanation)}</textarea>
      <p class="muted small" style="margin-top:4px">Doğru şıkkı soldaki yuvarlak işaretle seçin.</p>
    </div>`).join("")}
    <button class="btn ghost" id="addQ" style="margin-top:14px">Soru ekle</button>
  </div>`;
  $("#dt").oninput = e => draft.title = e.target.value;
  $("#da").onchange = e => draft.area = e.target.value;
  $("#dd").oninput = e => draft.description = e.target.value;
  $$("[data-k]").forEach(el => el.oninput = () => {
    const q = draft.questions[+el.dataset.i];
    if (el.dataset.k === "q") q.q = el.value; else if (el.dataset.k === "e") q.explanation = el.value; else q.options[+el.dataset.j] = el.value;
  });
  $$("[data-ans]").forEach(el => el.onchange = () => draft.questions[+el.dataset.ans].answer = +el.value);
  const move = (i, k) => { const qs = draft.questions; [qs[i], qs[i + k]] = [qs[i + k], qs[i]]; vSinavEdit(id); };
  $$("[data-up]").forEach(b => b.onclick = () => move(+b.dataset.up, -1));
  $$("[data-dn]").forEach(b => b.onclick = () => move(+b.dataset.dn, 1));
  $$("[data-rm]").forEach(b => b.onclick = () => { draft.questions.splice(+b.dataset.rm, 1); vSinavEdit(id); });
  $("#addQ").onclick = () => { draft.questions.push(blankQ()); vSinavEdit(id); };
  $("#save").onclick = saveExam;
}
async function saveExam() {
  const bad = draft.questions.findIndex(q => !q.q.trim() || q.options.some(o => !o.trim()));
  if (!draft.title.trim()) { toast("Başlık yazın"); return; }
  if (!draft.questions.length) { toast("En az bir soru ekleyin"); return; }
  if (bad >= 0) { toast(`Soru ${bad + 1}: metni ve dört şıkkın tamamını doldurun`); return; }
  const b = $("#save"); busyBtn(b, true, "Kaydediliyor");
  try {
    const row = { title: draft.title.trim(), area: draft.area, description: draft.description.trim() || null, questions: draft.questions.map(q => ({ q: q.q.trim(), options: q.options.map(o => o.trim()) })) };
    const key = { answers: draft.questions.map(q => q.answer), explanations: draft.questions.map(q => q.explanation.trim()) };
    let id = draft.id;
    if (id) check(await sb.from("exams").update(row).eq("id", id));
    else id = check(await sb.from("exams").insert({ ...row, is_practice: false, created_by: ME.id }).select().single()).id;
    check(await sb.from("exam_keys").upsert({ exam_id: id, ...key }));
    draft = null; toast("Sınav kaydedildi"); await loadAll(); location.hash = "#/sinavlar";
  } catch { busyBtn(b, false, "Sınavı kaydet"); }
}
function assignDialog(examId) {
  const ex = A.exams.find(e => e.id === examId);
  const already = new Set(A.asg.filter(a => a.exam_id === examId).map(a => a.user_id));
  const d = dialog(`<h2>Sınav ata — ${esc(ex.title)}</h2>
    <div class="field"><label for="due">Son tarih (isteğe bağlı)</label><input type="date" id="due"></div>
    <div class="row" style="margin-bottom:6px"><span class="small" style="font-weight:600">Hızlı seç:</span>
      ${Object.entries(JOB_ROLES).map(([k, v]) => `<button class="btn ghost sm" data-qr="${k}">Tüm ${v}</button>`).join("")}</div>
    <label class="check"><input type="checkbox" id="all"><b>Tümünü seç</b></label>
    <div id="ul">${activeUsers().map(u => `<label class="check"><input type="checkbox" value="${u.id}" ${already.has(u.id) ? "checked disabled" : ""}>
      <span>${esc(u.full_name || u.email)} <span class="muted small">${roleLabel(u.job_role)} · ${esc(u.email)}${already.has(u.id) ? " · zaten atandı" : ""}</span></span></label>`).join("")}</div>
    <div class="row end" style="margin-top:14px"><button class="btn ghost" id="x">Vazgeç</button><button class="btn" id="s">Sınavı ata</button></div>`);
  $("#all", d).onchange = e => $$("#ul input:not([disabled])", d).forEach(i => i.checked = e.target.checked);
  $$("[data-qr]", d).forEach(b => b.onclick = () => $$("#ul input:not([disabled])", d).forEach(i => { if (A.users.find(u => u.id === i.value)?.job_role === b.dataset.qr) i.checked = true; }));
  $("#x", d).onclick = () => d.remove();
  $("#s", d).onclick = async () => {
    const ids = $$("#ul input:checked:not([disabled])", d).map(i => i.value);
    if (!ids.length) { toast("En az bir kullanıcı seçin"); return; }
    const due = $("#due", d).value || null;
    check(await sb.from("exam_assignments").insert(ids.map(user_id => ({ exam_id: examId, user_id, due_date: due }))));
    d.remove(); toast(`${ids.length} kullanıcıya atandı`); await loadAll(); vSinavlar();
  };
}
function resultsDialog(examId) {
  const ex = A.exams.find(e => e.id === examId);
  const list = A.asg.filter(a => a.exam_id === examId).sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
  const d = dialog(`<h2>Sonuçlar — ${esc(ex.title)}</h2>
    ${list.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Kullanıcı</th><th>Durum</th><th>Puan</th><th>Tarih</th><th></th></tr></thead><tbody>
    ${list.map(a => `<tr><td>${esc(userName(a.user_id))}</td>
      <td><span class="pill ${a.status === "done" ? "ok" : "wait"}">${a.status === "done" ? "Tamamlandı" : "Bekliyor"}</span></td>
      <td>${a.score === null || a.score === undefined ? "—" : "%" + a.score}</td>
      <td class="small">${a.status === "done" ? fmtDate(a.completed_at) : (a.due_date ? "Son: " + fmtDate(a.due_date) : "—")}</td>
      <td><div class="row" style="flex-wrap:nowrap">${a.status === "done" ? `<button class="btn ghost sm" data-reset="${a.id}">Sıfırla</button>` : ""}<button class="btn danger sm" data-un="${a.id}">Kaldır</button></div></td></tr>`).join("")}
    </tbody></table></div>` : `<p class="muted">Bu sınav henüz kimseye atanmadı.</p>`}
    <div class="row end" style="margin-top:14px"><button class="btn ghost" id="csv" ${list.length ? "" : "disabled"}>CSV indir</button><button class="btn" id="x">Kapat</button></div>`, { wide: true });
  $("#x", d).onclick = () => d.remove();
  $("#csv", d).onclick = () => downloadCSV(`sonuclar-${ex.title}.csv`, [["Kullanıcı", "E-posta", "Durum", "Puan", "Tamamlanma", "Son tarih"],
    ...list.map(a => { const u = A.users.find(x => x.id === a.user_id) || {}; return [u.full_name, u.email, a.status === "done" ? "Tamamlandı" : "Bekliyor", a.score ?? "", a.completed_at ? fmtDate(a.completed_at) : "", a.due_date || ""]; })]);
  $$("[data-reset]", d).forEach(b => b.onclick = async () => {
    if (!confirm("Sonuç silinip sınav yeniden çözülebilir hale getirilsin mi?")) return;
    check(await sb.from("exam_assignments").update({ status: "pending", score: null, answers: null, completed_at: null }).eq("id", b.dataset.reset));
    await loadAll(); d.remove(); resultsDialog(examId);
  });
  $$("[data-un]", d).forEach(b => b.onclick = async () => {
    if (!confirm("Atama kaldırılsın mı?")) return;
    check(await sb.from("exam_assignments").delete().eq("id", b.dataset.un)); await loadAll(); d.remove(); resultsDialog(examId);
  });
}

/* ---------- Müfredat ---------- */
function vMufredat() {
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Müfredat</h1><p class="muted">Akış: taslak → hukuk incelemesi → onay → yayın. Onaylı bir müfredatı düzenlerseniz yayından kalkar ve yeniden onay gerekir.</p></div>
    <button class="btn" id="newC">Müfredat oluştur</button></div>
  ${A.curricula.length ? A.curricula.map(c => `<div class="panel">
    <div class="row"><div class="grow"><h2>${esc(c.title)}</h2>
      <p class="muted small">${esc(c.area || "")}${c.products ? " · " + esc(c.products.name) : ""} · ${c.modules.length} modül</p></div>
      ${reviewPill(c.review_status)}<span class="pill ${c.published ? "ok" : ""}">${c.published ? "Yayında" : "Yayında değil"}</span>
      ${c.review_status === "draft" || c.review_status === "rejected" ? `<button class="btn ghost sm" data-send="${c.id}">İncelemeye gönder</button>` : ""}
      <button class="btn sm ${c.published ? "ghost" : ""}" data-pub="${c.id}" data-v="${c.published ? "0" : "1"}" ${c.published || c.review_status === "approved" ? "" : 'disabled title="Önce hukuk onayı gerekli"'}>${c.published ? "Yayından kaldır" : "Yayımla"}</button>
      <button class="btn ghost sm" data-tg="${c.id}">${sub.open === c.id ? "Gizle" : "Modüller"}</button>
      <button class="btn ghost sm" data-ce="${c.id}">Düzenle</button>
      <button class="btn danger sm" data-cd="${c.id}">Sil</button></div>
    ${c.review_status === "rejected" && c.review_note ? `<p class="small" style="color:var(--red);margin-top:8px">Ret gerekçesi: ${esc(c.review_note)}</p>` : ""}
    ${sub.open === c.id ? renderModules(c.modules) : ""}</div>`).join("")
  : `<div class="panel"><div class="empty"><div class="ic">${icon.book}</div><h3>Henüz müfredat yok</h3><p>Yapay zekâ destekli üretimle ilk müfredatınızı oluşturun, kontrol edip yayımlayın.</p></div></div>`}`;
  $("#newC").onclick = curriculumDialog;
  $$("[data-send]").forEach(b => b.onclick = async () => {
    check(await sb.from("curricula").update({ review_status: "in_review" }).eq("id", b.dataset.send)); toast("Hukuk incelemesine gönderildi"); await loadAll(); vMufredat();
  });
  $$("[data-pub]").forEach(b => b.onclick = async () => { check(await sb.from("curricula").update({ published: b.dataset.v === "1" }).eq("id", b.dataset.pub)); toast(b.dataset.v === "1" ? "Yayımlandı" : "Yayından kaldırıldı"); await loadAll(); vMufredat(); });
  $$("[data-tg]").forEach(b => b.onclick = () => { sub.open = sub.open === b.dataset.tg ? null : b.dataset.tg; vMufredat(); });
  $$("[data-ce]").forEach(b => b.onclick = () => editCurriculumDialog(A.curricula.find(c => c.id === b.dataset.ce)));
  $$("[data-cd]").forEach(b => b.onclick = async () => { if (!confirm("Müfredat silinsin mi?")) return; check(await sb.from("curricula").delete().eq("id", b.dataset.cd)); await loadAll(); vMufredat(); });
}
function curriculumDialog() {
  const d = dialog(`<h2>Müfredat oluştur</h2>
    <div class="field"><label for="ca">Tedavi alanı</label><select id="ca">${AREAS.map(a => `<option>${a}</option>`).join("")}</select></div>
    <div class="field"><label for="cp">Ürün (isteğe bağlı)</label><select id="cp"><option value="">Seçilmedi</option>${A.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="cf">Odak / hedef</label><textarea id="cf" placeholder="örn. Yeni başlayan temsilciler için hastalık biyolojisi, tanı ve tedavi algoritması"></textarea></div>
    <div class="field"><label for="cw">Süre</label><select id="cw"><option value="4">4 hafta</option><option value="6" selected>6 hafta</option><option value="8">8 hafta</option><option value="12">12 hafta</option></select></div>
    <p class="muted small" id="m" style="margin-bottom:12px">Taslak olarak kaydedilir; kontrol ettikten sonra yayımlayın.</p>
    <div class="row end"><button class="btn ghost" id="x">Vazgeç</button><button class="btn" id="g">Müfredatı oluştur</button></div>`);
  $("#x", d).onclick = () => d.remove();
  $("#g", d).onclick = async () => {
    const area = $("#ca", d).value, pid = $("#cp", d).value, focus = $("#cf", d).value.trim(), weeks = +$("#cw", d).value;
    const prod = A.products.find(p => p.id === pid);
    const b = $("#g", d); busyBtn(b, true, "Oluşturuluyor");
    try {
      const res = await aiJSON(curriculumPrompt({ area, product: prod ? `${prod.name} (${prod.molecule || ""})` : "", focus, weeks }), 9000);
      if (!res || !Array.isArray(res.modules) || !res.modules.length) throw { code: "parse" };
      check(await sb.from("curricula").insert({ title: res.title || `${area} eğitim müfredatı`, area, product_id: pid || null, weeks, modules: res.modules.slice(0, weeks), published: false, created_by: ME.id }));
      d.remove(); toast("Taslak müfredat oluşturuldu"); await loadAll(); vMufredat();
    } catch (e) { busyBtn(b, false, "Müfredatı oluştur"); $("#m", d).textContent = e && "details" in e ? "Kaydedilemedi: " + e.message : aiError(e); }
  };
}
function editCurriculumDialog(c) {
  const mods = JSON.parse(JSON.stringify(c.modules || []));
  const d = dialog(`<h2>Müfredatı düzenle</h2>
    <div class="field"><label for="ct">Başlık</label><input type="text" id="ct" value="${esc(c.title)}"></div>
    ${mods.map((m, i) => `<div class="qedit"><b>Hafta ${i + 1}</b>
      <div class="field" style="margin-top:8px"><label>Modül başlığı</label><input type="text" data-m="${i}" data-k="title" value="${esc(m.title)}"></div>
      <div class="field"><label>Özet</label><textarea data-m="${i}" data-k="summary" rows="2">${esc(m.summary)}</textarea></div>
      <div class="field"><label>Öğrenme hedefleri (her satıra bir tane)</label><textarea data-m="${i}" data-k="objectives" rows="3">${esc((m.objectives || []).join("\n"))}</textarea></div>
      <div class="field" style="margin-bottom:0"><label>Kaynak önerileri (her satıra bir tane)</label><textarea data-m="${i}" data-k="sources" rows="2">${esc((m.sources || []).join("\n"))}</textarea></div>
    </div>`).join("")}
    <div class="row end" style="margin-top:14px"><button class="btn ghost" id="x">Vazgeç</button><button class="btn" id="s">Değişiklikleri kaydet</button></div>`, { wide: true });
  $("#x", d).onclick = () => d.remove();
  $("#s", d).onclick = async () => {
    $$("[data-m]", d).forEach(el => {
      const m = mods[+el.dataset.m], k = el.dataset.k;
      m[k] = (k === "objectives" || k === "sources") ? el.value.split("\n").map(s => s.trim()).filter(Boolean) : el.value.trim();
    });
    check(await sb.from("curricula").update({ title: $("#ct", d).value.trim() || c.title, modules: mods, weeks: mods.length }).eq("id", c.id));
    d.remove(); toast("Müfredat kaydedildi"); await loadAll(); vMufredat();
  };
}

/* ---------- Saha aktivitesi ---------- */
function vSaha() {
  const fu = sub.su || "";
  const hcp = id => A.hcps.find(h => h.id === id) || {};
  const list = A.interactions.filter(i => !fu || i.owner_id === fu);
  app.innerHTML = `
  <div class="page-head"><div class="grow"><h1>Saha aktivitesi</h1><p class="muted">Temsilcilerin kaydettiği hekim etkileşimleri (salt okunur).</p></div>
    <select id="su" class="auto"><option value="">Tüm temsilciler</option>${A.users.map(u => `<option value="${u.id}" ${fu === u.id ? "selected" : ""}>${esc(u.full_name || u.email)}</option>`).join("")}</select>
    <button class="btn ghost" id="csv" ${list.length ? "" : "disabled"}>CSV indir</button></div>
  <div class="panel">${list.length ? `<div class="tablewrap"><table class="t">
    <thead><tr><th>Tarih</th><th>Temsilci</th><th>Hekim</th><th>Kurum / şehir</th><th>Tür</th><th>Ürün</th><th>Not</th></tr></thead>
    <tbody>${list.map(i => { const h = hcp(i.hcp_id); return `<tr><td class="small">${fmtDate(i.date)}</td><td>${esc(userName(i.owner_id))}</td>
      <td>${esc(h.name || "—")}<br><span class="muted small">${esc(h.spec || "")}</span></td><td class="small">${esc(h.inst || "")}${h.city ? "<br>" + esc(h.city) : ""}</td>
      <td class="small">${esc(i.type || "")}</td><td class="small">${esc(i.products?.name || "—")}</td><td class="small" style="max-width:280px;white-space:pre-wrap">${esc(i.notes || "")}</td></tr>`; }).join("")}</tbody></table></div>`
  : `<div class="empty"><div class="ic">${icon.pulse}</div><h3>Etkileşim kaydı yok</h3><p>Temsilciler Paydaşlar sekmesinden kayıt girdiğinde burada görünür.</p></div>`}</div>`;
  $("#su").onchange = e => { sub.su = e.target.value; vSaha(); };
  $("#csv").onclick = () => downloadCSV("saha-aktivitesi.csv", [["Tarih", "Temsilci", "Hekim", "Uzmanlık", "Kurum", "Şehir", "Tür", "Ürün", "Not"],
    ...list.map(i => { const h = hcp(i.hcp_id); return [i.date || "", userName(i.owner_id), h.name || "", h.spec || "", h.inst || "", h.city || "", i.type || "", i.products?.name || "", i.notes || ""]; })]);
}

function downloadCSV(name, rows) {
  const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name.replace(/[\\/:*?"<>|]/g, "-"); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Yönlendirme ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, "") || "genel";
  const [p, arg] = h.split("/");
  const tab = p === "sinav" ? "sinavlar" : p;
  $$("nav.tabs a").forEach(a => a.classList.toggle("active", a.dataset.tab === tab));
  const views = { genel: vGenel, kullanicilar: vKullanicilar, hekimler: vHekimler, urunler: vUrunler, sinavlar: vSinavlar, mufredat: vMufredat, saha: vSaha, duyurular: vDuyurular, sinav: () => vSinavEdit(arg) };
  (views[p] || vGenel)();
}
window.addEventListener("hashchange", () => { if (ME && ME.role === "admin") { route(); window.scrollTo(0, 0); } });
boot(async () => { await loadAll(); $("nav.tabs").hidden = false; route(); }, { adminOnly: true });
