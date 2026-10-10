/* Ortak yardımcılar: Supabase istemcisi, giriş, yapay zekâ, arayüz araçları */
const CFG = window.APP_CONFIG || {};
const RECOVERY_LINK = /type=recovery/.test(location.hash);
const CONFIGURED = !!(CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("YOUR_") && CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.includes("YOUR_"));
const sb = CONFIGURED ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
let ME = null;
let RECOVERY = RECOVERY_LINK;
if (sb) sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") RECOVERY = true; });
const JOB_ROLES = { pjp: "PJP", urun_muduru: "Ürün Müdürü", avukat: "Avukat" };
const roleLabel = r => JOB_ROLES[r] || r || "—";
const REVIEW_LABEL = { draft: "Taslak", in_review: "Hukuk incelemesinde", approved: "Hukuk onaylı", rejected: "Reddedildi" };
const REVIEW_PILL = { draft: "", in_review: "wait", approved: "ok", rejected: "bad" };
const reviewPill = s => `<span class="pill ${REVIEW_PILL[s] || ""}">${REVIEW_LABEL[s] || s}</span>`;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = d => d ? new Date(d).toLocaleDateString("tr-TR") : "—";
const initials = n => String(n || "?").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");

const AREAS = ["Onkoloji", "Hematoloji", "Nöroloji", "İmmünoloji", "Oftalmoloji", "Solunum", "Diğer"];
const SPECS = ["Tıbbi Onkoloji", "Hematoloji", "Nöroloji", "Romatoloji", "Göz Hastalıkları", "Göğüs Hastalıkları", "Patoloji", "Diğer"];
const INTERACTION_TYPES = ["Yüz yüze ziyaret", "Uzaktan görüşme", "Kongre / toplantı", "E-posta"];

const icon = {
  book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h6M8 12h6"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  folder: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  pulse: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>',
  user: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  box: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>'
};

function toast(t) {
  const d = document.createElement("div"); d.className = "toast"; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
}
function dialog(html, { wide = false } = {}) {
  const back = document.createElement("div"); back.className = "dialog-back";
  back.innerHTML = `<div class="dialog ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener("click", e => { if (e.target === back) back.remove(); });
  back.addEventListener("keydown", e => { if (e.key === "Escape") back.remove(); });
  document.body.appendChild(back);
  const f = back.querySelector("input,select,textarea,button"); if (f) f.focus();
  return back;
}
function busyBtn(btn, on, label) {
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${label || "Bekleyin"}`; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || label || "Tamam"; }
}
/* Supabase sonuçlarındaki hatayı göster ve fırlat */
function check(res, msg) {
  if (res && res.error) {
    console.error(res.error);
    const net = res.status === 0 || /Failed to fetch|NetworkError|Load failed/i.test(res.error.message || "");
    toast(net ? "İnternet bağlantısı yok. Bu işlem için bağlandığınızda tekrar deneyin." : (msg ? msg + ": " : "") + res.error.message);
    throw res.error;
  }
  return res ? res.data : null;
}

/* ---------- Tema ---------- */
function initTheme() {
  try { const t = localStorage.getItem("medera-theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  const b = $("#themeBtn"); if (!b) return;
  b.onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nx = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nx;
    try { localStorage.setItem("medera-theme", nx); } catch {}
  };
}

/* ---------- Giriş, kayıt, şifre ---------- */
function showSetup(el) {
  el.innerHTML = `<div class="panel auth"><h2>Kurulum tamamlanmadı</h2>
    <p class="muted" style="margin-top:6px">config.js dosyasına Supabase proje adresinizi ve publishable (anon) anahtarınızı yazın. Adımlar README.md dosyasında.</p></div>`;
}
const siteUrl = () => location.origin + location.pathname.replace(/admin\.html$/, "");
function authErr(e) {
  const m = (e && e.message) || "";
  if (/Invalid login credentials/i.test(m)) return "E-posta veya şifre hatalı.";
  if (/Email not confirmed/i.test(m)) return "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki doğrulama bağlantısına tıklayın.";
  if (/already registered|already exists/i.test(m)) return "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.";
  if (/rate limit/i.test(m)) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.";
  if (/Password should be/i.test(m)) return "Şifre en az 8 karakter olmalı.";
  return m || "Bir hata oluştu. Tekrar deneyin.";
}
function showAuth(el, mode = "login") {
  const tabs = mode === "login" || mode === "register" ? `<div class="seg" style="margin-bottom:20px">
      <button data-m="login" class="${mode === "login" ? "on" : ""}">Giriş yap</button>
      <button data-m="register" class="${mode === "register" ? "on" : ""}">Kayıt ol</button></div>` : "";
  let body = "";
  if (mode === "login") body = `
    <h1>Giriş yap</h1><p class="muted" style="margin-bottom:18px">Hesabınıza e-posta ve şifrenizle giriş yapın.</p>
    <div class="field"><label for="em">E-posta</label><input type="email" id="em" autocomplete="email"></div>
    <div class="field"><label for="pw">Şifre</label><input type="password" id="pw" autocomplete="current-password"></div>
    <button class="btn" id="go" style="width:100%">Giriş yap</button>
    <p style="margin-top:14px;text-align:center"><button class="linkbtn" data-m="forgot">Şifremi unuttum</button></p>`;
  if (mode === "register") body = `
    <h1>Kayıt ol</h1><p class="muted" style="margin-bottom:18px">Hesabınız yönetici onayından sonra etkinleşir.</p>
    <div class="field"><label for="fn">Ad soyad</label><input type="text" id="fn" autocomplete="name"></div>
    <div class="field"><label for="em">E-posta</label><input type="email" id="em" autocomplete="email"></div>
    <div class="field"><label for="rl">Rol</label><select id="rl"><option value="">Rolünüzü seçin</option>${Object.entries(JOB_ROLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
    <div class="field"><label for="pw">Şifre</label><input type="password" id="pw" autocomplete="new-password" placeholder="En az 8 karakter"></div>
    <div class="field"><label for="pw2">Şifre (tekrar)</label><input type="password" id="pw2" autocomplete="new-password"></div>
    <button class="btn" id="go" style="width:100%">Kayıt ol</button>`;
  if (mode === "forgot") body = `
    <h1>Şifremi unuttum</h1><p class="muted" style="margin-bottom:18px">E-posta adresinizi yazın, şifre yenileme bağlantısı gönderelim.</p>
    <div class="field"><label for="em">E-posta</label><input type="email" id="em" autocomplete="email"></div>
    <button class="btn" id="go" style="width:100%">Yenileme bağlantısı gönder</button>
    <p style="margin-top:14px;text-align:center"><button class="linkbtn" data-m="login">Girişe dön</button></p>`;
  if (mode === "reset") body = `
    <h1>Yeni şifre belirle</h1><p class="muted" style="margin-bottom:18px">Hesabınız için yeni bir şifre yazın.</p>
    <div class="field"><label for="pw">Yeni şifre</label><input type="password" id="pw" autocomplete="new-password" placeholder="En az 8 karakter"></div>
    <div class="field"><label for="pw2">Yeni şifre (tekrar)</label><input type="password" id="pw2" autocomplete="new-password"></div>
    <button class="btn" id="go" style="width:100%">Şifreyi kaydet</button>`;
  el.innerHTML = `<div class="panel auth">${tabs}${body}<p class="small" id="msg" style="margin-top:12px" role="status"></p></div>`;
  $$("[data-m]", el).forEach(b => b.onclick = () => showAuth(el, b.dataset.m));
  const msg = (t, ok) => { const m = $("#msg", el); m.textContent = t; m.style.color = ok ? "var(--green)" : "var(--red)"; };
  const go = async () => {
    const b = $("#go", el), label = b.textContent;
    const email = $("#em", el)?.value.trim(), pw = $("#pw", el)?.value, pw2 = $("#pw2", el)?.value;
    if ($("#em", el) && !/^\S+@\S+\.\S+$/.test(email)) return msg("Geçerli bir e-posta adresi yazın.");
    if (mode === "register") {
      if (!$("#fn", el).value.trim()) return msg("Ad soyad yazın.");
      if (!$("#rl", el).value) return msg("Rolünüzü seçin.");
    }
    if ((mode === "register" || mode === "reset") && (!pw || pw.length < 8)) return msg("Şifre en az 8 karakter olmalı.");
    if ((mode === "register" || mode === "reset") && pw !== pw2) return msg("Şifreler eşleşmiyor.");
    if (mode === "login" && !pw) return msg("Şifrenizi yazın.");
    busyBtn(b, true, "Bekleyin");
    let r;
    if (mode === "login") r = await sb.auth.signInWithPassword({ email, password: pw });
    if (mode === "register") r = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: siteUrl(), data: { full_name: $("#fn", el).value.trim(), job_role: $("#rl", el).value } } });
    if (mode === "forgot") r = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
    if (mode === "reset") r = await sb.auth.updateUser({ password: pw });
    busyBtn(b, false, label);
    if (r.error) return msg(authErr(r.error));
    if (mode === "login") return location.reload();
    if (mode === "register") {
      if (r.data.session) return location.reload();
      el.innerHTML = `<div class="panel auth"><h2>Kaydınız alındı</h2><p class="muted" style="margin:8px 0 16px">${esc(email)} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra hesabınız yönetici onayına düşer.</p><button class="btn ghost" id="bk">Girişe dön</button></div>`;
      $("#bk", el).onclick = () => showAuth(el, "login"); return;
    }
    if (mode === "forgot") return msg("Bağlantı gönderildi. E-postanızı kontrol edin.", true);
    if (mode === "reset") { RECOVERY = false; history.replaceState(null, "", location.pathname); toast("Şifreniz güncellendi"); setTimeout(() => location.reload(), 800); }
  };
  $("#go", el).onclick = go;
  $$("input", el).forEach(i => i.onkeydown = e => { if (e.key === "Enter") go(); });
}
function showStatus(el, status) {
  const pending = status === "pending";
  el.innerHTML = `<div class="panel auth"><h2>${pending ? "Hesabınız onay bekliyor" : "Hesabınız devre dışı"}</h2>
    <p class="muted" style="margin:8px 0 6px">${pending ? "Kaydınız alındı. Yönetici hesabınızı onayladığında tüm içeriğe erişebileceksiniz." : "Erişiminiz yönetici tarafından kapatıldı. Bir hata olduğunu düşünüyorsanız yöneticinizle iletişime geçin."}</p>
    <p class="small muted" style="margin-bottom:16px">${esc(ME.full_name || "")} · ${esc(ME.email)} · ${roleLabel(ME.job_role)}</p>
    <div class="row">${pending ? `<button class="btn" id="rf">Durumu yenile</button>` : ""}<button class="btn ghost" id="so">Çıkış yap</button></div></div>`;
  const rf = $("#rf", el); if (rf) rf.onclick = () => location.reload();
  $("#so", el).onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

/* Sayfayı başlat: oturum + profil kontrolü */
async function boot(render, { adminOnly = false } = {}) {
  initTheme();
  const el = $("#app");
  if (!CONFIGURED) { showSetup(el); return; }
  el.innerHTML = `<div class="center"><span class="spin"></span></div>`;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showAuth(el, "login"); return; }
  if (RECOVERY) { showAuth(el, "reset"); return; }
  const { data: profile, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (error || !profile) {
    el.innerHTML = `<div class="panel auth"><h2>Profil bulunamadı</h2><p class="muted">Veritabanı kurulumu eksik olabilir (supabase/schema.sql ve upgrade_v2.sql). Hata: ${esc(error?.message)}</p></div>`;
    return;
  }
  ME = profile;
  const so = $("#signOut"); if (so) { so.hidden = false; so.onclick = async () => { await window.offline?.clear(); await sb.auth.signOut(); location.href = location.pathname; }; }
  const un = $("#userName"); if (un) un.textContent = ME.full_name || ME.email;
  const ub = $("#userBtn"); if (ub) ub.hidden = false;
  if (ME.status && ME.status !== "active") { showStatus(el, ME.status); return; }
  if (adminOnly && ME.role !== "admin") {
    el.innerHTML = `<div class="panel auth"><h2>Bu sayfa yöneticilere özel</h2><p class="muted" style="margin:6px 0 16px">Hesabınızın yönetici yetkisi yok.</p><a class="btn" href="./">Uygulamaya dön</a></div>`;
    return;
  }
  const al = $("#adminLink"); if (al && ME.role === "admin") al.hidden = false;
  sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") location.reload(); });
  await render();
}

/* ---------- Yapay zekâ (Supabase Edge Function üzerinden) ---------- */
const SYS = "Sen bir ilaç şirketinin tıbbi işler ekibi için çalışan eğitim asistanısın. Saha temsilcilerine ürünler, tedavi alanları ve klinik çalışmalar hakkında doğru, kaynağa dayalı, tarafsız ve Türkçe yanıt ver. Endikasyon dışı kullanım önerme, bireysel hasta için tedavi önerisi verme. Emin olmadığında bunu açıkça belirt ve kaynak uydurma.";

async function ai({ system = SYS, messages, stream = false, onText, onSources, grounded = false, productId = null, maxTokens = 2000 }) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw { code: "auth", message: "Oturum yok" };
  const res = await fetch(CFG.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token, apikey: CFG.SUPABASE_ANON_KEY },
    body: JSON.stringify({ system, messages, stream, grounded, product_id: productId, max_tokens: maxTokens })
  });
  if (!res.ok) {
    let m = ""; try { m = (await res.json()).error; } catch {}
    throw { code: res.status === 429 ? "rate_limited" : res.status === 404 ? "missing" : "http", message: m || "HTTP " + res.status };
  }
  if (!stream) { const data = await res.json(); if(onSources)onSources(data.sources || []); return data.text || ""; }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; onText && onText(text); }
      else if (ev.type === "error") throw { code: "http", message: ev.error?.message || "Akış hatası", text };
    }
  }
  return text;
}
async function aiJSON(prompt, maxTokens = 6000) {
  const t = await ai({ system: SYS + " Yalnızca geçerli JSON döndür; açıklama ya da kod bloğu ekleme.", messages: [{ role: "user", content: prompt }], maxTokens });
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e < s) throw { code: "parse" };
  try { return JSON.parse(t.slice(s, e + 1)); } catch { throw { code: "parse" }; }
}
function aiError(e) {
  if (!e) return "Yanıt alınamadı. Tekrar deneyin.";
  if ((e.message || "").includes("ANTHROPIC_API_KEY")) return "AI bağlantısı kurulmamış. Yönetici Supabase Secrets bölümüne ANTHROPIC_API_KEY eklemeli.";
  if (e.code === "auth") return "Oturumunuz sona erdi. Yeniden giriş yapın.";
  if (e.name === "TypeError" || e.name === "AbortError") return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  if (e.code === "rate_limited") return "Çok fazla istek gönderildi. Bir dakika bekleyip tekrar deneyin.";
  if (e.code === "missing") return "Yapay zekâ fonksiyonu bulunamadı. Supabase'e 'ai' fonksiyonunu yükleyin (README, adım 3).";
  if (e.code === "parse") return "Yapay zekâ yanıtı okunamadı. Tekrar deneyin.";
  return "Yanıt alınamadı: " + (e.message || "bilinmeyen hata");
}

/* Sınav üretimi (hem kullanıcı hem yönetici kullanır) */
function examPrompt({ area, topic, n, product }) {
  return `"${area}" alanında${product ? ` ${product} ürünüyle ilgili` : ""} "${topic}" konusunda saha temsilcileri için ${n} soruluk çoktan seçmeli bir bilgi sınavı hazırla. Her sorunun tam 4 şıkkı olsun, yalnızca biri doğru. Şu JSON biçiminde yanıt ver: {"title": string, "questions":[{"q": string, "options":[string,string,string,string], "answer": 0-3 arası sayı, "explanation": string}]}`;
}
function normalizeQuiz(res) {
  if (!res || !Array.isArray(res.questions)) throw { code: "parse" };
  const qs = res.questions
    .filter(q => q && q.q && Array.isArray(q.options) && q.options.length >= 4)
    .map(q => ({ q: String(q.q), options: q.options.slice(0, 4).map(String), answer: Math.max(0, Math.min(3, parseInt(q.answer, 10) || 0)), explanation: String(q.explanation || "") }));
  if (!qs.length) throw { code: "parse" };
  return { title: res.title ? String(res.title) : "", questions: qs };
}
function curriculumPrompt({ area, product, focus, weeks }) {
  return `${area} alanında${product ? ` ${product} ürününe odaklı` : ""} saha temsilcileri için ${weeks} haftalık bir eğitim müfredatı hazırla. Odak: ${focus || "genel temel eğitim"}. Her hafta için bir modül olsun. Kaynak önerilerinde yalnızca gerçek ve bilinen kaynak türlerini (kılavuzlar, pivotal çalışma adları, ürün bilgisi) yaz; uydurma kaynak yazma. Şu JSON biçiminde yanıt ver: {"title": string, "modules":[{"title": string, "summary": string, "objectives":[string], "sources":[string]}]}`;
}
function renderModules(mods) {
  return (mods || []).map((m, i) => `<div class="module"><h3>Hafta ${i + 1}: ${esc(m.title)}</h3>
    <p class="muted" style="font-size:14px">${esc(m.summary || "")}</p>
    ${m.objectives && m.objectives.length ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:14px">${m.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    ${m.sources && m.sources.length ? `<p class="muted" style="font-size:12px;margin-top:6px">Kaynak önerileri: ${m.sources.map(esc).join("; ")}</p>` : ""}
  </div>`).join("");
}
function strip(items, cls = "") {
  return `<div class="strip ${cls}">${items.map(([v, l, c, meter]) =>
    `<div class="${c || ""}"><b>${v}</b><span>${l}</span>${meter !== undefined ? `<div class="meter"><i style="width:${meter}%"></i></div>` : ""}</div>`).join("")}</div>`;
}


