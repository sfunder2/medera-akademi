/* Çevrimdışı çalışma: okunan veriler cihazda saklanır, bağlantı yokken son kopya gösterilir;
   sınav gönderme, ziyaret kaydı ve yan etki bildirimi kuyruğa alınır, bağlantı gelince gönderilir.
   shared.js'ten sonra, app.js'ten önce yüklenir; mevcut `sb` istemcisini sarar. */
(() => {
  if (!sb) return;
  const realFrom = sb.from.bind(sb), realRpc = sb.rpc.bind(sb), realGetSession = sb.auth.getSession.bind(sb.auth);
  // Yalnızca okuma yapan sunucu fonksiyonları önbelleğe alınır.
  const READ_RPCS = ["my_assignments", "class_stats", "learning_plan", "review_items", "manager_report", "exam_review",
    "field_list", "field_history", "field_notifications", "field_heatmap", "objection_heatmap", "duel_dashboard"];
  const WRITE_METHODS = ["insert", "update", "upsert", "delete"];
  const SLOW_MS = 8000;

  /* ---------- Cihaz deposu (IndexedDB) ---------- */
  let dbp = null;
  const idb = () => dbp = dbp || new Promise((res, rej) => {
    const r = indexedDB.open("medera-offline", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("cache");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const store = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("cache", mode), q = fn(t.objectStore("cache")); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
  const cacheGet = key => store("readonly", s => s.get(key)).catch(() => null);
  const cachePut = (key, data) => store("readwrite", s => s.put({ data, at: Date.now() }, key)).catch(() => {});
  const cacheClear = () => store("readwrite", s => s.clear()).catch(() => {});

  // Önbellek anahtarı oturumdaki kullanıcıya bağlıdır; aynı cihazda başka hesap başkasının verisini görmez.
  const authKey = () => Object.keys(localStorage).find(k => /^sb-.+-auth-token$/.test(k));
  const storedSession = () => { try { return JSON.parse(localStorage.getItem(authKey()) || "null"); } catch { return null; } };
  const userId = () => (typeof ME !== "undefined" && ME?.id) || storedSession()?.user?.id || "anon";

  const isNetworkError = r => !navigator.onLine || (r && r.error && (r.status === 0 || /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(r.error.message || "")));
  const offlineResult = () => ({ data: null, error: { message: "TypeError: Failed to fetch", code: "" }, status: 0 });

  // Sorguyu çalıştırır; ağ hatasında veya çok yavaş bağlantıda cihazdaki son kopyayı döndürür.
  async function readThrough(key, run) {
    const fullKey = userId() + "|" + key;
    if (!navigator.onLine) { const c = await cacheGet(fullKey); return c ? { data: c.data, error: null, status: 200, offline: true } : offlineResult(); }
    const live = Promise.resolve(run()).then(r => { if (!r.error) cachePut(fullKey, r.data); return r; });
    const slow = new Promise(res => setTimeout(() => res("slow"), SLOW_MS));
    const first = await Promise.race([live, slow]);
    if (first !== "slow" && !isNetworkError(first)) return first;
    const c = await cacheGet(fullKey);
    if (c) return { data: c.data, error: null, status: 200, offline: true };
    return first === "slow" ? live : first;
  }

  // Zincirleme sorgu oluşturucuyu kaydeder (select, eq, order...) ve çalıştırılırken önbellekle sarar.
  function wrap(builder, key, cacheable, calls = []) {
    const proxy = new Proxy(builder, {
      get(target, prop) {
        if (prop === "then") return (res, rej) => {
          const write = calls.some(c => WRITE_METHODS.includes(c[0]));
          const run = () => target.then(x => x);
          const p = !cacheable || write ? run() : readThrough(key + JSON.stringify(calls), run);
          return p.then(res, rej);
        };
        const v = target[prop];
        if (typeof v !== "function") return v;
        return (...args) => {
          calls.push([prop, args]);
          const out = v.apply(target, args);
          // select(), eq() gibi adımlar bazen yeni bir oluşturucu döndürür; zincir boyunca sarmalamayı koru.
          return out === target ? proxy : out && typeof out.then === "function" ? wrap(out, key, cacheable, calls) : out;
        };
      }
    });
    return proxy;
  }
  sb.from = table => wrap(realFrom(table), "from:" + table, true);
  sb.rpc = (name, args = {}, opts) => wrap(realRpc(name, args, opts), "rpc:" + name + JSON.stringify(args), READ_RPCS.includes(name) && !(name === "field_notifications" && args.p_read));

  // Süresi dolmuş oturum çevrimdışı yenilenemez; okunacak veriler için saklı oturum kullanılır.
  sb.auth.getSession = async () => {
    // Çevrimdışıyken yenileme denemesi saniyelerce bekletir; saklı oturum hemen kullanılır.
    if (!navigator.onLine) { const s = storedSession(); if (s?.access_token) return { data: { session: s }, error: null }; }
    const r = await realGetSession();
    if (r.data?.session || navigator.onLine && !r.error) return r;
    const s = storedSession();
    return s?.access_token ? { data: { session: s }, error: null } : r;
  };

  /* ---------- Gönderim kuyruğu ---------- */
  const qKey = () => "medera:queue:" + userId();
  const readQ = () => { try { return JSON.parse(localStorage.getItem(qKey()) || "[]"); } catch { return []; } };
  const writeQ = q => { try { localStorage.setItem(qKey(), JSON.stringify(q)); } catch {} renderBar(); };
  const LABEL = { submit_exam: "Sınav cevapları", visit: "Ziyaret kaydı", pv: "Yan etki bildirimi" };

  // Kayıtlara cihazda kimlik verilir: gönderim sırasında bağlantı koparsa yeniden deneme çift kayıt oluşturmaz.
  const newId = () => crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  function enqueue(job) {
    if (job.kind === "pv") job.row = { id: newId(), ...job.row };
    if (job.kind === "visit") job.interaction = { id: newId(), ...job.interaction };
    writeQ(readQ().concat({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), at: new Date().toISOString(), ...job }));
  }
  const duplicate = r => r?.error?.code === "23505";
  async function runJob(j) {
    if (j.kind === "submit_exam") return realRpc("submit_exam", j.args);
    if (j.kind === "pv") {
      const r = await realFrom("pv_reports").insert(j.row).select("report_no").single();
      return duplicate(r) ? realFrom("pv_reports").select("report_no").eq("id", j.row.id).single() : r;
    }
    if (j.kind === "visit") {
      let r = await realFrom("interactions").insert(j.interaction).select().single();
      if (duplicate(r)) return { data: j.interaction, error: null }; // önceki denemede kaydedilmiş
      if (r.error || !j.objections?.length) return r;
      const o = await realFrom("field_objections").insert(j.objections.map(x => ({ ...x, interaction_id: r.data.id })));
      return o.error ? { ...o, partial: true } : r;
    }
    return { error: { message: "Bilinmeyen kayıt türü" } };
  }
  let syncing = false;
  async function sync() {
    if (syncing || !navigator.onLine || typeof ME === "undefined" || !ME) return;
    const pending = readQ().filter(j => !j.failed);
    if (!pending.length) return;
    syncing = true; renderBar();
    let sent = 0, sentPv = [];
    for (const j of pending) {
      const r = await runJob(j);
      if (isNetworkError(r)) break; // bağlantı yine koptu; sırayı koru
      const q = readQ(), i = q.findIndex(x => x.id === j.id);
      if (r.error && !r.partial) { if (i >= 0) { q[i].failed = r.error.message; writeQ(q); } continue; }
      if (i >= 0) { q.splice(i, 1); writeQ(q); }
      sent++; if (j.kind === "pv" && r.data?.report_no) sentPv.push(r.data.report_no);
      if (j.kind === "submit_exam" && typeof qolDelete === "function") qolDelete("exam:" + j.args.p_assignment);
    }
    syncing = false; renderBar();
    if (sent) {
      toast(sentPv.length ? `Yan etki bildirimi tıbbi birime iletildi: ${sentPv.join(", ")}` : `Bekleyen ${sent} kayıt gönderildi`);
      if (typeof loadAll === "function" && typeof route === "function") { await loadAll(); route(); }
    }
  }

  /* ---------- Durum şeridi ---------- */
  function renderBar() {
    const bar = document.getElementById("netBar"); if (!bar) return;
    const q = readQ(), waiting = q.filter(j => !j.failed).length, failed = q.filter(j => j.failed);
    const parts = [];
    if (!navigator.onLine) parts.push("<b>Çevrimdışısınız.</b> Son indirilen içerikleri görüyorsunuz.");
    if (waiting) parts.push(syncing ? `${waiting} kayıt gönderiliyor…` : `${waiting} kayıt bağlantı gelince gönderilecek.`);
    if (failed.length) parts.push(`<button class="linkbtn" id="netFailed">${failed.length} kayıt gönderilemedi</button>`);
    bar.hidden = !parts.length; bar.className = "net-bar" + (navigator.onLine ? "" : " off");
    bar.innerHTML = parts.join(" ");
    const f = document.getElementById("netFailed");
    if (f) f.onclick = () => {
      const d = dialog(`<h2>Gönderilemeyen kayıtlar</h2><p class="muted small">Sunucu bu kayıtları kabul etmedi. Bilgileri kontrol edip yeniden girin; yan etki bildirimiyse tıbbi birimi arayın.</p>
        ${failed.map(j => `<div class="item"><div class="grow"><h3>${LABEL[j.kind] || j.kind}</h3><p class="muted small">${new Date(j.at).toLocaleString("tr-TR")} · ${esc(j.failed)}</p></div><button class="btn danger sm" data-drop="${j.id}">Sil</button></div>`).join("")}
        <div class="row end"><button class="btn" id="netClose">Kapat</button></div>`);
      $("#netClose", d).onclick = () => d.remove();
      $$("[data-drop]", d).forEach(b => b.onclick = () => { writeQ(readQ().filter(j => j.id !== b.dataset.drop)); b.closest(".item").remove(); });
    };
  }

  /* ---------- Arka planda içerik indirme ---------- */
  // Açılmamış sayfalar da çevrimdışı çalışsın diye ana içerikler bağlantı varken sessizce indirilir.
  async function prefetch() {
    if (!navigator.onLine || typeof ME === "undefined" || !ME) return;
    const k = "medera:prefetch:" + ME.id;
    try { if (Date.now() - (+localStorage.getItem(k) || 0) < 6 * 36e5) return; } catch {}
    const jobs = [
      sb.from("source_documents").select("*,products(name)").order("created_at", { ascending: false }),
      sb.from("source_documents").select("id,title,pages").eq("status", "approved"),
      sb.rpc("learning_plan"), sb.rpc("field_list", { p_manage: false }), sb.rpc("field_history"), sb.rpc("field_notifications"),
      sb.from("pv_reports").select("*, products(name)").eq("reporter_id", ME.id).order("created_at", { ascending: false }),
      ...(typeof D !== "undefined" ? D.asg.filter(a => a.status === "done").map(a => sb.rpc("exam_review", { p_assignment: a.id })) : [])
    ];
    await Promise.allSettled(jobs.map(j => Promise.resolve(j)));
    try { localStorage.setItem(k, String(Date.now())); } catch {}
  }

  window.addEventListener("online", () => { renderBar(); sync(); });
  window.addEventListener("offline", renderBar);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
  setInterval(() => { if (readQ().some(j => !j.failed)) sync(); }, 60000);

  window.offline = {
    isNetworkError, enqueue, sync, renderBar, clear: cacheClear,
    pending: kind => readQ().filter(j => !j.failed && (!kind || j.kind === kind)),
    // Oturum açıldıktan sonra app.js çağırır.
    start() { renderBar(); sync(); setTimeout(prefetch, 3000); }
  };
})();
