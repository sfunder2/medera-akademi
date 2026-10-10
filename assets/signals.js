/* Sahadan gelen sinyaller: itiraz etiketleri, itiraz ısı haritası ve yan etki hızlı bildirimi.
   Kullanıcı uygulaması, yönetim paneli ve demo sayfası birlikte kullanır. */
const OBJECTION_TAGS = { yan_etki: "#YanEtki", fiyat: "#Fiyat", etkinlik: "#Etkinlik", rakip: "#RakipÜrün", uygulama: "#Uygulama", kanit: "#KanıtYetersiz", erisim: "#Erişim" };
const REGIONS = ["Marmara", "Ege", "Akdeniz", "İç Anadolu", "Karadeniz", "Doğu Anadolu", "Güneydoğu Anadolu"];
const CITY_REGION = Object.fromEntries(Object.entries({
  "Marmara": "İstanbul,Edirne,Kırklareli,Tekirdağ,Çanakkale,Kocaeli,Yalova,Sakarya,Bilecik,Bursa,Balıkesir",
  "Ege": "İzmir,Manisa,Aydın,Denizli,Muğla,Afyonkarahisar,Kütahya,Uşak",
  "Akdeniz": "Antalya,Isparta,Burdur,Mersin,Adana,Hatay,Osmaniye,Kahramanmaraş",
  "İç Anadolu": "Ankara,Konya,Kayseri,Eskişehir,Sivas,Kırıkkale,Aksaray,Karaman,Kırşehir,Niğde,Nevşehir,Yozgat,Çankırı",
  "Karadeniz": "Trabzon,Samsun,Ordu,Giresun,Rize,Artvin,Sinop,Kastamonu,Bartın,Zonguldak,Karabük,Bolu,Düzce,Amasya,Tokat,Çorum,Gümüşhane,Bayburt",
  "Doğu Anadolu": "Erzurum,Erzincan,Kars,Ardahan,Iğdır,Ağrı,Van,Muş,Bitlis,Bingöl,Tunceli,Elazığ,Malatya,Hakkari",
  "Güneydoğu Anadolu": "Gaziantep,Şanlıurfa,Diyarbakır,Mardin,Batman,Siirt,Şırnak,Adıyaman,Kilis"
}).flatMap(([region, cities]) => cities.split(",").map(c => [c, region])));
const regionOf = city => CITY_REGION[city] || null;
const PV_STATUS = { new: ["Yeni", "bad"], in_review: ["İncelemede", "wait"], closed: ["Kapandı", "ok"] };
const PV_SERIOUS = { evet: "Ciddi", hayir: "Ciddi değil", bilinmiyor: "Ciddiyet bilinmiyor" };

/* ---------- Ziyaret kaydında itiraz etiketleri ---------- */
function objectionFields() {
  return `<div class="field"><label>Karşılaştığınız itirazlar <span class="muted small">(isteğe bağlı)</span></label>
    <div class="tag-chips">${Object.entries(OBJECTION_TAGS).map(([k, l]) => `<button type="button" class="tag-chip" data-tag="${k}" aria-pressed="false">${l}</button>`).join("")}</div>
    <input type="text" id="objCompetitor" maxlength="80" placeholder="Rakip ürünün adı" hidden style="margin-top:8px"></div>`;
}
function bindObjectionFields(d) {
  $$(".tag-chip", d).forEach(b => b.onclick = () => {
    b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
    $("#objCompetitor", d).hidden = $('[data-tag="rakip"]', d).getAttribute("aria-pressed") !== "true";
  });
}
function objectionRows(d, { hcp, productId }) {
  const tags = $$('.tag-chip[aria-pressed="true"]', d).map(b => b.dataset.tag);
  if (!tags.length) return [];
  const region = regionOf(hcp?.city);
  if (!region) { toast("İtirazlar kaydedilmedi: hekimin şehri bilinmiyor."); return []; }
  const competitor = tags.includes("rakip") ? $("#objCompetitor", d).value.trim() || null : null;
  return tags.map(tag => ({ user_id: ME.id, product_id: productId || null, tag, competitor: tag === "rakip" ? competitor : null, region }));
}
// Etiketler ayrı tabloya yazılır; tablo yoksa ziyaret kaydı yine de kalır.
async function saveObjections(d, { interactionId, hcp, productId }) {
  const rows = objectionRows(d, { hcp, productId });
  if (!rows.length) return true;
  const r = await sb.from("field_objections").insert(rows.map(x => ({ ...x, interaction_id: interactionId })));
  if (r.error) { console.error(r.error); toast("Ziyaret kaydedildi ama itiraz etiketleri kaydedilemedi."); return false; }
  return true;
}

/* ---------- Yan etki hızlı bildirimi ---------- */
function pvDialog() {
  const prods = typeof fieldProducts === "function" ? fieldProducts() : [];
  const hcps = typeof D !== "undefined" ? D.hcps : [];
  const draft = typeof qolRead === "function" ? qolRead("pvDraft", {}) : {};
  const d = dialog(`<h2>Yan etki bildir</h2>
    <p class="muted small" style="margin-bottom:14px">Bildirim doğrudan tıbbi birime gider. Hastanın adını, kimlik veya iletişim bilgisini yazmayın.</p>
    <div class="field"><label for="pvEvent">Ne oldu?</label><textarea id="pvEvent" rows="4" maxlength="3000" placeholder="Örn. Hekim, ikinci infüzyondan sonra bir hastada yaygın döküntü geliştiğini söyledi."></textarea></div>
    <div class="field"><label for="pvProduct">İlaç</label><select id="pvProduct"><option value="" selected>İlacı seçin</option>${prods.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}<option value="__other">Listede yok</option></select>
      <input type="text" id="pvProductName" maxlength="120" placeholder="İlacın adı" hidden style="margin-top:8px"></div>
    <div class="field"><label>Ciddi mi? <span class="muted small">(hastaneye yatış, hayati tehlike, kalıcı hasar veya ölüm)</span></label>
      <div class="tag-chips" id="pvSerious">${Object.entries({ evet: "Evet", hayir: "Hayır", bilinmiyor: "Bilmiyorum" }).map(([k, l]) => `<button type="button" class="tag-chip" data-serious="${k}" aria-pressed="${k === "bilinmiyor"}">${l}</button>`).join("")}</div></div>
    <details class="settings"><summary>Ek bilgiler (önerilir)</summary>
      <div class="field"><label for="pvSource">Bilgiyi kimden aldınız?</label><select id="pvSource"><option value="hekim">Hekim</option><option value="eczaci">Eczacı</option><option value="hasta_yakini">Hasta / yakını</option><option value="diger">Diğer</option></select></div>
      ${hcps.length ? `<div class="field"><label for="pvHcp">Hekim</label><select id="pvHcp"><option value="">Seçilmedi</option>${hcps.map(h => `<option value="${esc(h.id)}">${esc(h.name)}${h.inst ? " · " + esc(h.inst) : ""}</option>`).join("")}</select></div>` : ""}
      <div class="grid2"><div class="field"><label for="pvAge">Hastanın yaş grubu</label><select id="pvAge"><option value="bilinmiyor">Bilinmiyor</option><option>0-17</option><option>18-44</option><option>45-64</option><option>65+</option></select></div>
      <div class="field"><label for="pvSex">Cinsiyet</label><select id="pvSex"><option value="bilinmiyor">Bilinmiyor</option><option value="kadin">Kadın</option><option value="erkek">Erkek</option></select></div></div>
      <div class="field"><label for="pvAware">Bilgiyi ne zaman öğrendiniz?</label><input type="datetime-local" id="pvAware"></div>
    </details>
    <p class="small" id="pvMsg" role="status"></p>
    <div class="row end"><button class="btn ghost" id="pvCancel">Vazgeç</button><button class="btn" id="pvSend">Tıbbi birime gönder</button></div>`);
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  $("#pvAware", d).value = local; $("#pvAware", d).max = local;
  $("#pvEvent", d).value = draft.event || "";
  $("#pvEvent", d).oninput = e => typeof qolWrite === "function" && qolWrite("pvDraft", { event: e.target.value });
  $("#pvProduct", d).onchange = e => { $("#pvProductName", d).hidden = e.target.value !== "__other"; };
  $$("[data-serious]", d).forEach(b => b.onclick = () => $$("[data-serious]", d).forEach(x => x.setAttribute("aria-pressed", String(x === b))));
  $("#pvCancel", d).onclick = () => d.remove();
  $("#pvSend", d).onclick = async () => {
    const choice = $("#pvProduct", d).value, productId = choice === "__other" ? "" : choice;
    const event = $("#pvEvent", d).value.trim(), productName = $("#pvProductName", d).value.trim();
    const msg = $("#pvMsg", d); msg.style.color = "var(--red)";
    if (event.length < 10) { msg.textContent = "Ne olduğunu en az bir cümleyle yazın."; $("#pvEvent", d).focus(); return; }
    if (!choice) { msg.textContent = "İlacı seçin."; $("#pvProduct", d).focus(); return; }
    if (!productId && productName.length < 2) { msg.textContent = "İlacın adını yazın."; $("#pvProductName", d).focus(); return; }
    const b = $("#pvSend", d); busyBtn(b, true, "Gönderiliyor");
    const aware = $("#pvAware", d).value ? new Date($("#pvAware", d).value) : new Date();
    const row = {
      reporter_id: ME.id, product_id: productId || null, product_name: productId ? null : productName, event,
      serious: $("[data-serious][aria-pressed=true]", d).dataset.serious, source: $("#pvSource", d).value,
      hcp_id: $("#pvHcp", d)?.value || null, patient_age: $("#pvAge", d).value, patient_sex: $("#pvSex", d).value,
      aware_at: (aware > new Date() ? new Date() : aware).toISOString()
    };
    const r = await sb.from("pv_reports").insert(row).select("report_no").single();
    if (window.offline && offline.isNetworkError(r)) {
      // Bağlantı yok: bildirim cihazda bekler ve bağlantı gelince kendiliğinden gönderilir.
      offline.enqueue({ kind: "pv", row });
      if (typeof qolDelete === "function") qolDelete("pvDraft");
      $(".dialog", d).innerHTML = `<h2>Bildirim cihazda bekliyor</h2><p style="margin:10px 0">İnternet bağlantısı yok. Bildiriminiz kaydedildi ve bağlantı gelir gelmez tıbbi birime otomatik gönderilecek; takip numarası o zaman oluşur.</p>
        ${row.serious === "evet" ? `<p class="notice">Ciddi bir durum bildirdiniz. Bağlantınız uzun süre gelmeyecekse tıbbi birimi telefonla arayın.</p>` : ""}
        <div class="row end"><button class="btn" id="pvDone">Tamam</button></div>`;
      $("#pvDone", d).onclick = () => d.remove();
      return;
    }
    if (r.error) { busyBtn(b, false, "Tıbbi birime gönder"); msg.textContent = "Gönderilemedi: " + r.error.message + ". Bildirimi tıbbi birime telefonla iletin."; return; }
    if (typeof qolDelete === "function") qolDelete("pvDraft");
    $(".dialog", d).innerHTML = `<h2>Bildirim iletildi</h2><p style="margin:10px 0">Takip numarası: <b>${esc(r.data.report_no)}</b></p>
      <p class="muted small">Tıbbi birim bildirimi inceleyecek. Durumunu Ben → Yan etki bildirimlerim bölümünden izleyebilirsiniz. Hekimden ek bilgi gelirse yeni bir bildirim yapıp bu numarayı yazın.</p>
      <div class="row end"><button class="btn" id="pvDone">Tamam</button></div>`;
    $("#pvDone", d).onclick = () => d.remove();
  };
}
async function vYanEtkilerim() {
  app.innerHTML = `<div class="center"><span class="spin"></span></div>`;
  const r = await sb.from("pv_reports").select("*, products(name)").eq("reporter_id", ME.id).order("created_at", { ascending: false });
  const rows = r.data || [], waiting = window.offline ? offline.pending("pv") : [];
  app.innerHTML = `<div class="page-head"><div class="grow"><h1>Yan etki bildirimlerim</h1><p class="muted">Tıbbi birime ilettiğiniz bildirimler ve durumları.</p></div><button class="btn" id="pvNew">Yan etki bildir</button></div>
    ${waiting.length ? `<div class="panel"><div class="list">${waiting.map(j => `<div class="item"><div class="grow"><h3>Gönderilmeyi bekliyor</h3><p class="muted small">${new Date(j.at).toLocaleString("tr-TR")} · ${PV_SERIOUS[j.row.serious]}</p><p style="font-size:14px;margin-top:4px">${esc(j.row.event)}</p></div><span class="pill wait">Cihazda</span></div>`).join("")}</div></div>` : ""}
    ${r.error && !waiting.length ? `<div class="panel"><p class="muted">Bildirimler yüklenemedi. Veritabanı güncellemesi (field_signals_v7.sql) yapılmamış olabilir.</p></div>`
    : r.error ? "" : rows.length ? `<div class="panel"><div class="list">${rows.map(x => `<div class="item"><div class="grow"><h3>${esc(x.report_no)} · ${esc(x.products?.name || x.product_name || "")}</h3>
      <p class="muted small">${fmtDate(x.created_at)} · ${PV_SERIOUS[x.serious]}</p><p style="font-size:14px;margin-top:4px">${esc(x.event)}</p>
      ${x.unit_note ? `<p class="notice" style="margin:8px 0 0">Tıbbi birim: ${esc(x.unit_note)}</p>` : ""}</div>
      <span class="pill ${PV_STATUS[x.status][1]}">${PV_STATUS[x.status][0]}</span></div>`).join("")}</div></div>`
    : `<div class="panel"><div class="empty"><div class="ic">${icon.pulse}</div><h3>Henüz bildiriminiz yok</h3><p>Sahada bir yan etki duyduğunuzda üstteki "Yan etki bildir" düğmesini kullanın.</p></div></div>`}`;
  $("#pvNew").onclick = pvDialog;
}

/* ---------- Tıbbi birim: bildirim listesi (yönetim paneli) ---------- */
async function vYanEtkiAdmin() {
  const st = sub.pvTab || "new";
  app.innerHTML = `<div class="page-head"><div class="grow"><h1>Yan etki bildirimleri</h1><p class="muted">Sahadan gelen bildirimler. Yasal bildirim süresi, temsilcinin bilgiyi öğrendiği andan başlar.</p></div></div>
    <div class="seg">${Object.entries(PV_STATUS).map(([k, [l]]) => `<button data-pv="${k}" class="${k === st ? "on" : ""}">${l}</button>`).join("")}</div><div id="pvRows"><div class="center"><span class="spin"></span></div></div>`;
  $$("[data-pv]").forEach(b => b.onclick = () => { sub.pvTab = b.dataset.pv; vYanEtkiAdmin(); });
  const r = await sb.from("pv_reports").select("*, products(name)").eq("status", st).order("created_at", { ascending: false });
  const box = $("#pvRows"); if (!box) return;
  if (r.error) { box.innerHTML = `<div class="panel"><p class="muted">Bildirimler yüklenemedi: ${esc(r.error.message)}. supabase/field_signals_v7.sql dosyasını çalıştırdığınızdan emin olun.</p></div>`; return; }
  const users = typeof A !== "undefined" ? A.users : [], hcps = typeof A !== "undefined" ? A.hcps : [];
  const hours = x => Math.floor((Date.now() - new Date(x.aware_at)) / 36e5);
  box.innerHTML = (r.data || []).map(x => { const u = users.find(y => y.id === x.reporter_id), h = hcps.find(y => y.id === x.hcp_id);
    return `<div class="panel"><div class="row"><div class="grow"><h2>${esc(x.report_no)} · ${esc(x.products?.name || x.product_name || "")}</h2>
      <p class="muted small">Öğrenildi: ${new Date(x.aware_at).toLocaleString("tr-TR")}${x.status !== "closed" ? ` (${hours(x)} saat önce)` : ""} · Bildiren: ${esc(u?.full_name || u?.email || "—")}</p></div>
      <span class="pill ${x.serious === "evet" ? "bad" : x.serious === "bilinmiyor" ? "wait" : ""}">${PV_SERIOUS[x.serious]}</span></div>
      <p style="margin:10px 0;white-space:pre-wrap">${esc(x.event)}</p>
      <p class="muted small">Kaynak: ${esc({ hekim: "Hekim", eczaci: "Eczacı", hasta_yakini: "Hasta / yakını", diger: "Diğer" }[x.source])}${h ? ` · ${esc(h.name)}, ${esc(h.inst || "")} ${esc(h.city || "")}` : ""} · Hasta: ${esc(x.patient_age)}, ${esc({ kadin: "kadın", erkek: "erkek", bilinmiyor: "cinsiyet bilinmiyor" }[x.patient_sex])}</p>
      ${x.unit_note ? `<p class="notice" style="margin-top:10px">Not: ${esc(x.unit_note)}</p>` : ""}
      ${st !== "closed" ? `<div class="field" style="margin-top:12px"><label for="pvn_${x.id}">Birim notu (temsilci görür)</label><textarea id="pvn_${x.id}" rows="2" maxlength="2000">${esc(x.unit_note || "")}</textarea></div>
        <div class="row end">${st === "new" ? `<button class="btn ghost" data-pvset="in_review" data-id="${x.id}">İncelemeye al</button>` : ""}<button class="btn" data-pvset="closed" data-id="${x.id}">Kapat</button></div>` : ""}</div>`; }).join("")
    || `<div class="panel"><div class="empty"><div class="ic">${icon.pulse}</div><h3>Bu durumda bildirim yok</h3></div></div>`;
  $$("[data-pvset]").forEach(b => b.onclick = async () => {
    const res = await sb.rpc("pv_update", { p_id: b.dataset.id, p_status: b.dataset.pvset, p_note: $("#pvn_" + b.dataset.id).value });
    if (res.error) return toast(res.error.message);
    toast(b.dataset.pvset === "closed" ? "Bildirim kapatıldı" : "İncelemeye alındı"); vYanEtkiAdmin();
  });
}

/* ---------- İtiraz ısı haritası ---------- */
const objectionAlertText = a => `${a.region} bölgesinde ${OBJECTION_TAGS[a.tag]}${a.competitor ? ` (${a.competitor})` : ""} itirazları son 7 günde ${a.current} kez kaydedildi`;
async function vItirazlar() {
  const days = sub.objDays || 30, prod = sub.objProd || "";
  const prods = typeof fieldProducts === "function" ? fieldProducts() : [];
  app.innerHTML = `<div class="page-head"><div class="grow"><h1>Saha itirazları</h1><p class="muted">Temsilcilerin ziyaret sonrası etiketlediği itirazlar. Hekim adı gösterilmez.</p></div>
    <select id="objProd" class="auto"><option value="">Tüm ürünler</option>${prods.map(p => `<option value="${esc(p.id)}" ${prod === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
    <div class="seg">${[7, 30, 90].map(n => `<button data-days="${n}" class="${n === days ? "on" : ""}">Son ${n} gün</button>`).join("")}</div>
    <div id="objBody"><div class="center"><span class="spin"></span></div></div>`;
  $$("[data-days]").forEach(b => b.onclick = () => { sub.objDays = +b.dataset.days; vItirazlar(); });
  $("#objProd").onchange = e => { sub.objProd = e.target.value; vItirazlar(); };
  const r = await sb.rpc("objection_heatmap", { p_days: days, p_product: prod || null });
  const box = $("#objBody"); if (!box) return;
  if (r.error) { box.innerHTML = `<div class="panel"><p class="muted">Rapor yüklenemedi: ${esc(r.error.message)}</p></div>`; return; }
  const m = r.data, max = Math.max(1, ...m.cells.map(c => c.count));
  const cell = (region, tag) => m.cells.find(c => c.region === region && c.tag === tag)?.count || 0;
  const tags = Object.keys(OBJECTION_TAGS).filter(t => m.cells.some(c => c.tag === t));
  box.innerHTML = `
    ${m.alerts.map((a, i) => `<div class="alert-card"><div class="grow"><b>İtiraz dalgası</b><p>${esc(objectionAlertText(a))}. Önceki haftalık ortalama: ${String(a.baseline).replace(".", ",")}.</p></div>
      ${typeof fieldEditor === "function" && fieldManager() ? `<button class="btn" data-micro="${i}">Mikro eğitim hazırla</button>` : ""}</div>`).join("")}
    ${m.total ? `<div class="panel"><div class="row"><h2 class="grow">Bölge ve itiraz türü</h2><span class="muted small">${m.total} kayıt</span></div>
      <div class="tablewrap"><table class="t heat"><thead><tr><th>İtiraz</th>${REGIONS.map(x => `<th>${x.replace(" Anadolu", " A.")}</th>`).join("")}</tr></thead><tbody>
      ${tags.map(t => `<tr><th scope="row">${OBJECTION_TAGS[t]}</th>${REGIONS.map(g => { const n = cell(g, t); return `<td style="--heat:${Math.round(n / max * 55)}%" title="${g} · ${OBJECTION_TAGS[t]}: ${n}">${n || ""}</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div></div>
      ${m.competitors.length ? `<div class="panel"><h2>En çok anılan rakip ürünler</h2><div class="list">${m.competitors.map(c => `<div class="item"><div class="grow"><h3>${esc(c.name)}</h3><div class="meter" style="max-width:320px"><i style="width:${c.count / m.competitors[0].count * 100}%"></i></div></div><span class="pill">${c.count}</span></div>`).join("")}</div></div>` : ""}`
    : `<div class="panel"><div class="empty"><div class="ic">${icon.pulse}</div><h3>Bu dönemde itiraz kaydı yok</h3><p>Temsilciler ziyaret kaydederken itiraz etiketi seçtikçe harita dolar.</p></div></div>`}`;
  $$("[data-micro]").forEach(b => b.onclick = async () => {
    const a = m.alerts[+b.dataset.micro];
    await fieldEditor();
    const set = (s, v) => { const n = $(s); if (n) { n.value = v; n.dispatchEvent(new Event("change")); } };
    set("#feKind", "objection");
    set("#feTitle", `${a.competitor || OBJECTION_TAGS[a.tag].slice(1)} itirazına yanıt (${a.region})`);
    set("#feSkill", "İtiraz karşılama");
    if (prod) set("#feProduct", prod);
    toast("Taslak açıldı. Kaynakları seçip hukuk incelemesine gönderin.");
  });
}
