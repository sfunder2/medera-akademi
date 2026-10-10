/* Sanal vaka odaları: 2-3 PJP aynı vakayı canlı oynar. Kurallar (sıra, roller, puan) sunucuda uygulanır.
   Değişiklikler anlık kanal sinyaliyle ve yedek olarak 3 saniyede bir sorgulanarak ekrana yansır. */
const CASE_SCENARIOS = {
  kanit: { title: "Kanıt isteyen akademisyen", doctor: "Analitik bir akademisyen hekimsiniz. Çalışma tasarımını, hasta sayısını, birincil sonlanım noktasını ve istatistiksel anlamlılığı sorgulayın; genel ifadelerle yetinmeyin.",
    objections: ["Bu sonuç hangi çalışmadan, kaç hastayla?", "Birincil sonlanım noktası neydi?", "Bu fark klinik olarak anlamlı mı?"] },
  rakip: { title: "Rakip ürünü tercih eden hekim", doctor: "Rakip tedaviden memnun bir hekimsiniz. Neden değiştirmeniz gerektiğini sorgulayın ve karşılaştırmalı kanıt isteyin.",
    objections: ["Mevcut tedavimden memnunum, neden değiştireyim?", "Karşılaştırmalı bir çalışma var mı?", "Hastalarım alıştığı tedaviyi istiyor."] },
  zaman: { title: "Zamanı olmayan poliklinik hekimi", doctor: "Kapıda 2 dakikanız var. Kısa konuşun, sözü kesin, tek cümlelik özet isteyin.",
    objections: ["İki dakikam var, kısaca ne?", "Tek cümleyle özetleyin.", "Broşürü bırakın, bakarım."] },
  sgk: { title: "Geri ödeme ve maliyet kaygısı", doctor: "Hastalarınızın maliyetini önemseyen bir hekimsiniz. Geri ödeme, katkı payı ve daha ucuz alternatifleri sorun.",
    objections: ["SGK ödüyor mu?", "Hastanın katkı payı ne kadar?", "Daha ucuz alternatif varken neden bu?"] }
};
const CASE_ROLES = { rep: "Mümessil", doctor: "Hekim", observer: "Gözlemci" };
const CASE_RUBRIC = { kanit: "Bilimsel doğruluk ve kanıt", itiraz: "İtiraz karşılama", denge: "Dengeli anlatım (abartı ve baskı yok)", kapanis: "Kapanış ve sonraki adım" };
const CASE_STATUS = { waiting: ["Katılımcı bekleniyor", "wait"], live: ["Görüşme sürüyor", "ok"], rating: ["Puanlanıyor", "wait"], done: ["Tamamlandı", "ok"], cancelled: ["İptal", ""] };

async function vVaka() {
  app.innerHTML = `<div class="center"><span class="spin"></span></div>`;
  const [l, b] = await Promise.all([sb.rpc("case_room_list"), sb.rpc("case_room_leaderboard")]);
  if (l.error) { app.innerHTML = `<div class="panel"><h2>Vaka odası açılamadı</h2><p class="muted">${window.offline && offline.isNetworkError(l) ? "Vaka odası için internet bağlantısı gerekli." : esc(l.error.message)}</p></div>`; return; }
  const { open, mine } = l.data, board = b.data || { people: [], regions: [] };
  const sc = s => CASE_SCENARIOS[s]?.title || s;
  app.innerHTML = `<div class="page-head"><div class="grow"><h1>Vaka odası</h1><p class="muted">Meslektaşlarınızla aynı vakayı canlı oynayın. Sistem rolleri dağıtır: biri mümessil, biri hekim, biri gözlemci.</p></div></div>
  <div class="grid2">
    <div class="panel"><h2>Oda kur</h2>
      <div class="field"><label for="crScenario">Vaka</label><select id="crScenario">${Object.entries(CASE_SCENARIOS).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join("")}</select></div>
      <div class="field"><label for="crProduct">Ürün</label><select id="crProduct"><option value="">Genel iletişim (ürün yok)</option>${D.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></div>
      <button class="btn" id="crCreate">Oda kur</button></div>
    <div class="panel"><h2>Kodla katıl</h2><p class="muted small" style="margin-bottom:10px">Meslektaşınızın paylaştığı 6 haneli kodu yazın.</p>
      <div class="row"><input id="crCode" maxlength="6" placeholder="ÖRN. K7M2QX" style="text-transform:uppercase;flex:1;min-width:140px"><button class="btn" id="crJoin">Katıl</button></div></div>
  </div>
  <div class="panel mt"><h2>Açık odalar</h2>${open.length ? `<div class="list">${open.map(r => `<div class="item"><div class="grow"><h3>${esc(sc(r.scenario))}</h3><p class="muted small">${esc(r.creator)} · ${esc(r.product || "Genel")} · ${r.members}/3 kişi</p></div><button class="btn sm" data-join="${esc(r.code)}">Katıl</button></div>`).join("")}</div>` : `<p class="muted">Şu an açık oda yok. Bir oda kurup kodu meslektaşlarınıza gönderin.</p>`}</div>
  ${mine.length ? `<div class="panel mt"><h2>Odalarım</h2><div class="list">${mine.map(r => `<div class="item"><div class="grow"><h3>${esc(sc(r.scenario))}</h3><p class="muted small">${fmtDate(r.created_at)}${r.role ? " · " + CASE_ROLES[r.role] : ""}${r.status === "done" ? ` · ${r.points} puan` : ""}</p></div><span class="pill ${CASE_STATUS[r.status][1]}">${CASE_STATUS[r.status][0]}</span><a class="btn ghost sm" href="#/oda/${esc(r.id)}">Aç</a></div>`).join("")}</div></div>` : ""}
  <div class="grid2 mt"><div class="panel"><h2>Bu ayın sıralaması</h2>${board.people.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>#</th><th>PJP</th><th>Bölge</th><th>Puan</th></tr></thead><tbody>${board.people.slice(0, 10).map((p, i) => `<tr ${p.id === ME.id ? 'style="font-weight:700"' : ""}><td>${i + 1}</td><td>${esc(p.name)}</td><td>${esc(p.region)}</td><td>${p.points}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Bu ay henüz tamamlanan vaka yok.</p>`}</div>
    <div class="panel"><h2>Bölgeler</h2>${board.regions.length ? `<div class="list">${board.regions.map(r => `<div class="item"><div class="grow"><h3>${esc(r.region)}</h3><p class="muted small">${r.people} kişi</p></div><span class="pill">ort. ${r.average}</span></div>`).join("")}</div>` : `<p class="muted">Bölge sıralaması için PJP'lerin Bilgi yarışmasında bölge seçmesi gerekir.</p>`}</div></div>`;
  $("#crCreate").onclick = async () => {
    const b = $("#crCreate"); busyBtn(b, true, "Kuruluyor");
    const r = await sb.rpc("case_room_create", { p_product: $("#crProduct").value || null, p_scenario: $("#crScenario").value });
    if (r.error) { busyBtn(b, false, "Oda kur"); return toast(r.error.message); }
    location.hash = "#/oda/" + r.data.id;
  };
  const join = async code => { const r = await sb.rpc("case_room_join", { p_code: code }); if (r.error) return toast(r.error.message); location.hash = "#/oda/" + r.data; };
  $("#crJoin").onclick = () => { const c = $("#crCode").value.trim(); if (c.length !== 6) return toast("6 haneli kodu yazın"); join(c); };
  $$("[data-join]").forEach(x => x.onclick = () => join(x.dataset.join));
}

async function vOda(id) {
  const hash = location.hash, alive = () => location.hash === hash && app.isConnected;
  let st = null, shape = "", lastKey = "", timer = null, channel = null, recognition = null, sending = false, offset = 0;
  const stop = () => { clearInterval(timer); if (channel && sb.removeChannel) sb.removeChannel(channel); if (recognition) recognition.abort(); };
  const ping = () => { try { channel?.send({ type: "broadcast", event: "tick", payload: {} }); } catch {} };
  async function refresh() {
    if (!alive()) return stop();
    const r = await sb.rpc("case_room_state", { p_room: id });
    if (!alive()) return stop();
    if (r.error) { stop(); app.innerHTML = `<div class="panel"><h2>Oda açılamadı</h2><p class="muted">${window.offline && offline.isNetworkError(r) ? "Vaka odası için internet bağlantısı gerekli." : esc(r.error.message)}</p><a class="btn ghost" href="#/vaka">Vaka odasına dön</a></div>`; return; }
    st = r.data; offset = new Date(st.room.now) - Date.now(); render();
  }
  const me = () => st.members.find(m => m.user_id === ME.id) || {};
  const sc = () => CASE_SCENARIOS[st.room.scenario] || CASE_SCENARIOS.kanit;
  const turn = () => { const last = st.messages.at(-1); return last ? (last.role === "doctor" ? "rep" : "doctor") : "doctor"; };
  const transcript = () => st.messages.map(m => `${m.role === "rep" ? "Mümessil" : "Hekim"}: ${m.body}`).join("\n");

  function brief(role) {
    const s = sc(), prod = st.room.product ? D.products.find(p => p.name === st.room.product) : null;
    if (role === "doctor") return `<p><b>Rolünüz: Hekim.</b> ${esc(s.doctor)}</p><p class="muted small">Şu itirazları sırayla kullanabilirsiniz:</p><ul>${s.objections.map(o => `<li>${esc(o)}</li>`).join("")}</ul><p class="muted small">Klinik veri uydurmayın; mümessilden kanıt isteyin.</p>`;
    if (role === "rep") return `<p><b>Rolünüz: Mümessil.</b> Karşınızda: ${esc(s.title.toLocaleLowerCase("tr"))}. ${st.room.product ? `Ürün: ${esc(st.room.product)}.` : "Genel iletişim pratiği; ürün iddiası kullanmayın."}</p>${prod?.notes ? `<p class="muted small" style="white-space:pre-wrap">${esc(prod.notes)}</p>` : ""}<p class="muted small">Yalnızca onaylı bilgiye dayanın; bilmediğinizi tıbbi bilgi birimine yönlendirin.</p>`;
    return `<p><b>Rolünüz: Gözlemci.</b> Görüşmeyi dinleyin ve not alın. Bitince mümessili şu ölçütlerle puanlayacaksınız:</p><ul>${Object.values(CASE_RUBRIC).map(x => `<li>${x}</li>`).join("")}</ul>`;
  }
  function members() { return `<div class="room-members">${st.members.map(m => `<span class="pill ${m.user_id === ME.id ? "ok" : ""}">${esc(m.name)}${m.role ? " · " + CASE_ROLES[m.role] : ""}</span>`).join("")}</div>`; }

  function render() {
    const s = st.room.status, role = me().role, nextShape = s + "|" + (role || "");
    const head = `<div class="page-head"><div class="grow"><h1>${esc(sc().title)}</h1><p class="muted">${esc(st.room.product || "Genel iletişim")} · <span class="pill ${CASE_STATUS[s][1]}">${CASE_STATUS[s][0]}</span></p></div></div>`;
    if (s === "waiting") {
      const creator = st.room.creator === ME.id;
      app.innerHTML = head + `<div class="panel"><p class="muted">Oda kodu</p><p class="room-code">${esc(st.room.code)}</p><p class="muted small">Kodu meslektaşlarınıza gönderin. 2 kişiyle başlayabilirsiniz; 3. kişi gözlemci olur.</p>
        <h3 style="margin-top:16px">Katılımcılar (${st.members.length}/3)</h3>${members()}
        <div class="row end" style="margin-top:16px"><button class="btn ghost" id="roomLeave">${creator ? "Odayı kapat" : "Odadan çık"}</button>${creator ? `<button class="btn" id="roomStart" ${st.members.length < 2 ? "disabled" : ""}>Başlat ve rolleri dağıt</button>` : `<span class="muted small">Odayı kuran kişinin başlatması bekleniyor.</span>`}</div></div>`;
      $("#roomLeave").onclick = async () => { const r = await sb.rpc("case_room_leave", { p_room: id }); if (r.error) return toast(r.error.message); ping(); location.hash = "#/vaka"; };
      const sb_ = $("#roomStart"); if (sb_) sb_.onclick = async () => { busyBtn(sb_, true, "Başlıyor"); const r = await sb.rpc("case_room_start", { p_room: id }); if (r.error) { busyBtn(sb_, false, "Başlat ve rolleri dağıt"); return toast(r.error.message); } ping(); refresh(); };
      shape = nextShape; return;
    }
    if (s === "live") {
      if (shape !== nextShape) {
        app.innerHTML = head + `<div class="panel">${members()}<div class="brief">${brief(role)}</div></div>
          <div class="panel mt"><div class="row"><h2 class="grow">Görüşme</h2><span class="pill wait" id="roomClock"></span></div><div id="roomLog" class="room-log" role="log" aria-live="polite"></div>
          ${role === "rep" || role === "doctor" ? `<p id="roomTurn" class="small" role="status"></p><textarea id="roomSay" rows="3" maxlength="2000" placeholder="Yazın veya mikrofonu kullanın"></textarea>
            <div class="row" style="margin-top:8px"><button class="btn ghost" id="roomMic">Mikrofon</button><button class="btn" id="roomSend">Gönder</button>${role === "doctor" || st.room.creator === ME.id ? `<button class="btn ghost" id="roomEnd">Görüşmeyi bitir</button>` : ""}</div>`
          : `<p class="muted small" style="margin-top:10px">Gözlemcisiniz: konuşma yok, not alın. ${st.room.creator === ME.id ? "" : ""}</p>${st.room.creator === ME.id ? `<button class="btn ghost" id="roomEnd">Görüşmeyi bitir</button>` : ""}<textarea id="roomNotes" rows="3" placeholder="Notlarınız (yalnızca bu cihazda)"></textarea>`}</div>`;
        shape = nextShape; bindLive(role);
      }
      $("#roomLog").innerHTML = st.messages.map(m => `<div class="msg ${m.role === role ? "me" : "ai"}"><b>${m.role === "rep" ? "Mümessil" : "Hekim"}</b><br>${esc(m.body)}</div>`).join("") || `<p class="muted">Hekim görüşmeyi başlatacak.</p>`;
      $("#roomLog").scrollTop = $("#roomLog").scrollHeight;
      const t = $("#roomTurn"); if (t) { const mine = turn() === role; t.textContent = mine ? "Sıra sizde." : `Sıra ${role === "rep" ? "hekimde" : "mümessilde"}, bekleniyor…`; $("#roomSend").disabled = !mine || sending; }
      const left = Math.max(0, Math.ceil((new Date(st.room.started_at) - (Date.now() + offset)) / 1000) + 900);
      $("#roomClock").textContent = `Kalan ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} · Mümessil yanıtı ${st.messages.filter(m => m.role === "rep").length}/${st.room.turn_limit}`;
      return;
    }
    // Puanlama ve sonuç: form seçimleri kaybolmasın diye yalnızca durum değişince yeniden çizilir.
    const key = JSON.stringify([s, st.members.map(m => [m.rated, m.points]), st.ratings.length, !!st.feedback, st.messages.length]);
    if (key === lastKey && shape === nextShape) return;
    lastKey = key;
    const rated = me().rated, rater = role === "doctor" || role === "observer";
    const mineRating = st.ratings[0];
    app.innerHTML = head + `<div class="panel">${members()}</div>
      ${s === "rating" && rater && !rated ? `<div class="panel mt"><h2>Mümessili puanlayın</h2><p class="muted small">Her ölçüt için 1 (zayıf) - 5 (çok iyi). Puanlar herkes puanlayınca açıklanır.</p>
        ${Object.entries(CASE_RUBRIC).map(([k, l]) => `<div class="field"><label>${l}</label><div class="tag-chips" data-rubric="${k}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="tag-chip" data-n="${n}" aria-pressed="false">${n}</button>`).join("")}</div></div>`).join("")}
        <div class="field"><label for="rateNote">Kısa geri bildirim (isteğe bağlı)</label><textarea id="rateNote" rows="2" maxlength="1000"></textarea></div><button class="btn" id="rateSend">Puanı gönder</button></div>` : ""}
      ${s === "rating" && (!rater || rated) ? `<div class="panel mt"><p>${rated ? `Puanınız kaydedildi (${mineRating?.total ?? ""}/100). Diğer puanlar bekleniyor.` : "Görüşme bitti. Hekim ve gözlemcinin puanları bekleniyor."}</p></div>` : ""}
      ${s === "done" ? `<div class="panel mt"><h2>Sonuç</h2><div class="mini-stats">${st.members.map(m => `<div><b>${m.points}</b><span>${esc(m.name)} · ${CASE_ROLES[m.role] || ""}</span></div>`).join("")}</div>
        <div class="list" style="margin-top:12px">${st.ratings.map(x => `<div class="item"><div class="grow"><h3>${CASE_ROLES[x.role]} puanı: ${x.total}/100</h3><p class="muted small">${Object.entries(CASE_RUBRIC).map(([k, l]) => `${l}: ${x.scores[k]}`).join(" · ")}</p>${x.comment ? `<p style="font-size:14px;margin-top:4px">${esc(x.comment)}</p>` : ""}</div></div>`).join("")}</div></div>` : ""}
      ${s === "cancelled" ? `<div class="panel mt"><p class="muted">Oda kapatıldı veya görüşme yapılmadan bitti.</p></div>` : ""}
      ${st.messages.length ? `<div class="panel mt"><div class="row"><h2 class="grow">Yapay zekâ geri bildirimi</h2>${!st.feedback && s !== "cancelled" ? `<button class="btn ghost sm" id="roomAi">Değerlendirme iste</button>` : ""}</div>
        ${st.feedback ? `<p style="white-space:pre-wrap">${esc(st.feedback)}</p>` : `<p class="muted small">Eğitim amaçlı koçluk notudur; puana katılmaz.</p>`}</div>
        <details class="panel mt"><summary>Görüşme metni</summary><div class="room-log">${st.messages.map(m => `<div class="msg ${m.role === "rep" ? "me" : "ai"}"><b>${m.role === "rep" ? "Mümessil" : "Hekim"}</b><br>${esc(m.body)}</div>`).join("")}</div></details>` : ""}
      <div class="row end mt"><a class="btn ghost" href="#/vaka">Vaka odasına dön</a></div>`;
    shape = nextShape;
    $$("[data-rubric]").forEach(g => $$(".tag-chip", g).forEach(b => b.onclick = () => $$(".tag-chip", g).forEach(x => x.setAttribute("aria-pressed", String(x === b)))));
    const rs = $("#rateSend"); if (rs) rs.onclick = async () => {
      const scores = Object.fromEntries(Object.keys(CASE_RUBRIC).map(k => [k, +($(`[data-rubric="${k}"] [aria-pressed="true"]`)?.dataset.n || 0)]));
      if (Object.values(scores).some(n => !n)) return toast("Dört ölçütün hepsini puanlayın");
      busyBtn(rs, true, "Gönderiliyor");
      const r = await sb.rpc("case_room_rate", { p_room: id, p_scores: scores, p_comment: $("#rateNote").value });
      if (r.error) { busyBtn(rs, false, "Puanı gönder"); return toast(r.error.message); }
      ping(); refresh();
    };
    const ab = $("#roomAi"); if (ab) ab.onclick = async () => {
      busyBtn(ab, true, "Hazırlanıyor");
      try {
        const text = await ai({ system: SYS + " Sen bir saha eğitim koçusun. Bu bir vaka odası görüşmesidir: bir PJP mümessil, bir PJP hekim rolünde. Senaryo: " + sc().title + ". Yalnızca mümessili değerlendir: bilimsel doğruluk ve kanıt kullanımı, itiraz karşılama, dengeli anlatım, kapanış. Her başlık için somut bir alıntıyla kısa yorum yaz ve üç gelişim önerisi ver. Klinik doğruluk hakkında kesin hüküm verme; onaylı kaynakla kontrol edilmesini öner. Puan verme.", messages: [{ role: "user", content: transcript() }], maxTokens: 1500 });
        const r = await sb.rpc("case_room_feedback_save", { p_room: id, p_body: text });
        if (r.error) toast(r.error.message); ping(); refresh();
      } catch (e) { busyBtn(ab, false, "Değerlendirme iste"); toast(aiError(e)); }
    };
  }
  function bindLive(role) {
    const end = $("#roomEnd"); if (end) end.onclick = async () => { if (!confirm("Görüşme bitirilsin ve puanlamaya geçilsin mi?")) return; const r = await sb.rpc("case_room_end", { p_room: id }); if (r.error) return toast(r.error.message); ping(); refresh(); };
    const send = $("#roomSend"); if (!send) return;
    const box = $("#roomSay");
    box.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } };
    send.onclick = async () => {
      const text = box.value.trim(); if (!text || sending) return;
      sending = true; busyBtn(send, true, "Gönderiliyor");
      const r = await sb.rpc("case_room_say", { p_room: id, p_body: text });
      sending = false; busyBtn(send, false, "Gönder");
      if (r.error) return toast(r.error.message);
      box.value = ""; if (recognition) recognition.stop(); ping(); refresh();
    };
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("#roomMic");
    if (!Rec) { mic.disabled = true; mic.textContent = "Mikrofon desteklenmiyor"; return; }
    mic.onclick = () => {
      if (recognition) { recognition.stop(); return; }
      recognition = new Rec(); recognition.lang = "tr-TR"; recognition.continuous = true;
      recognition.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) box.value = (box.value + " " + e.results[i][0].transcript).trim().slice(0, 2000); };
      recognition.onend = () => { recognition = null; if (mic.isConnected) mic.textContent = "Mikrofon"; };
      recognition.onerror = () => toast("Mikrofon kullanılamadı; yazarak devam edin.");
      try { recognition.start(); mic.textContent = "Dinleniyor… (durdur)"; } catch { recognition = null; }
    };
  }

  app.innerHTML = `<div class="center"><span class="spin"></span></div>`;
  if (typeof sb.channel === "function") { try { channel = sb.channel("vaka-" + id).on("broadcast", { event: "tick" }, () => refresh()).subscribe(); } catch { channel = null; } }
  timer = setInterval(refresh, 3000);
  await refresh();
}
