/* Otonom içerik üretici: onaylı bir kaynak belgeden mikro eğitim (sesli özet, 3 bilgi kartı, 5 soruluk test) hazırlar.
   Üretilen içerik "Mikro eğitim" türünde taslak olarak kaydedilir ve onaylanmadan yayınlanmaz.
   Test soruları saha çalışması adımları olarak saklanır; puanı sunucu hesaplar. */
// Yapay zekâ fonksiyonu her mesajı 12.000 karakterde keser ve son 20 mesajı alır.
// Belge bu yüzden aynı istekte en fazla 9 parçaya bölünerek gönderilir (yaklaşık 100.000 karakter).
const MICRO_CHUNK = 11500, MICRO_CHUNKS = 9;

function microChunks(pages) {
  const chunks = []; let cur = "";
  for (const p of pages) {
    const part = `[Sayfa ${p.page}]\n${p.text}\n\n`;
    if (cur && cur.length + part.length > MICRO_CHUNK) { chunks.push(cur); cur = ""; }
    if (chunks.length === MICRO_CHUNKS) break;
    cur += part.slice(0, MICRO_CHUNK);
  }
  if (cur && chunks.length < MICRO_CHUNKS) chunks.push(cur);
  return chunks;
}
async function microGenerate(doc, pages) {
  const chunks = microChunks(pages);
  const messages = chunks.flatMap((c, i) => [{ role: "user", content: `BELGE: ${doc.title} — bölüm ${i + 1}/${chunks.length}\n\n${c}` }, { role: "assistant", content: "Bu bölümü okudum." }]);
  messages.push({ role: "user", content: microPrompt() });
  const t = await ai({ system: SYS + " Yalnızca geçerli JSON döndür; açıklama ya da kod bloğu ekleme.", messages, maxTokens: 8000 });
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  try { return { raw: JSON.parse(t.slice(a, b + 1)), used: chunks.join("").match(/\[Sayfa \d+\]/g).length }; } catch { throw { code: "parse" }; }
}

function microPrompt() {
  return `Mikro eğitim hazırla: Yukarıdaki onaylı kaynak belgeden ilaç firmasının saha temsilcileri için Türkçe bir mikro eğitim hazırla. Belge İngilizce olabilir; çıktının tamamı Türkçe olsun.
Yalnızca belgedeki bilgileri kullan. Belgede olmayan iddia, doz, istatistik veya rakip karşılaştırması ekleme. Her bilgi kartı ve soru için dayandığı belge sayfa numarasını yaz.
Şu JSON biçiminde yanıt ver:
{"title": "en fazla 80 karakterlik başlık",
 "summary": "2-3 cümlelik özet",
 "podcast": "araçta dinlenecek, yaklaşık 3 dakikalık (400-450 kelime), sohbet dilinde seslendirme metni; başlık veya madde işareti kullanma",
 "flashcards": [{"title": "kısa başlık", "text": "en fazla 2 cümle", "page": sayfa_numarası}] (tam 3 kart: öne çıkan 3 nokta),
 "quiz": [{"q": "soru", "options": ["A", "B", "C", "D"], "answer": 0-3 arası doğru şık, "explanation": "kısa açıklama", "page": sayfa_numarası}] (tam 5 soru)}`;
}

// Yapay zekâ çıktısını düzenleyicinin beklediği biçime getirir; eksikleri boş bırakır.
function microNormalize(raw, pageNumbers) {
  const page = p => pageNumbers.includes(+p) ? +p : pageNumbers[0];
  const str = (v, n) => String(v ?? "").trim().slice(0, n);
  const cards = (raw.flashcards || []).slice(0, 3).map(c => ({ title: str(c.title, 80), text: str(c.text, 400), page: page(c.page) }));
  while (cards.length < 3) cards.push({ title: "", text: "", page: pageNumbers[0] });
  const quiz = (raw.quiz || []).slice(0, 5).map(q => {
    const options = (q.options || []).slice(0, 4).map(o => str(o, 300));
    while (options.length < 4) options.push("");
    return { q: str(q.q, 600), options, answer: [0, 1, 2, 3].includes(+q.answer) ? +q.answer : 0, explanation: str(q.explanation, 800), page: page(q.page) };
  });
  while (quiz.length < 5) quiz.push({ q: "", options: ["", "", "", ""], answer: 0, explanation: "", page: pageNumbers[0] });
  return { title: str(raw.title, 120), summary: str(raw.summary, 1000), podcast: str(raw.podcast, 8000), flashcards: cards, quiz };
}

// Taslağı mevcut saha içeriği biçimine çevirir: sorular sırayla ilerleyen adımlar, anahtar sunucuda.
function microToUnit(m, docOptions) {
  const nodes = m.quiz.map((q, i) => ({ id: "q" + (i + 1), prompt: q.q, choices: q.options.map(label => ({ label, next: i < m.quiz.length - 1 ? "q" + (i + 2) : null })) }));
  const keys = Object.fromEntries(m.quiz.map((q, i) => ["q" + (i + 1), q.options.map((o, j) => ({
    score: j === q.answer ? 100 : 0,
    feedback: (j === q.answer ? "Doğru. " : `Doğru cevap: ${q.options[q.answer]}. `) + (q.explanation || `Kaynak: sayfa ${q.page}.`)
  }))]));
  const used = [...new Set([...m.flashcards.map(c => c.page), ...m.quiz.map(q => q.page)])];
  const sources = docOptions.filter(s => used.includes(+s.page)).map(s => ({ document_id: s.document_id, title: s.title, page: s.page, fingerprint: s.fingerprint, approved_at: s.approved_at }));
  return { payload: { body: m.summary, podcast: m.podcast, flashcards: m.flashcards, start: "q1", nodes }, keys, sources };
}

async function fieldMicro() {
  const generation = ++fieldGeneration;
  const prods = fieldProducts();
  app.innerHTML = `<div class="page-head"><div class="grow"><h1>Yayından mikro eğitim üret</h1><p class="muted">Onaylı bir kaynak belgeden sesli özet, 3 bilgi kartı ve 5 soruluk test hazırlanır. İçerik onaylanmadan yayınlanmaz.</p></div></div>
    <div class="panel"><div class="grid2"><div class="field"><label for="mpProduct">Ürün</label><select id="mpProduct">${prods.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="mpDoc">Onaylı kaynak belge</label><select id="mpDoc"></select></div></div>
      <p class="muted small" id="mpInfo">Yeni bir yayın için önce Kaynak belgeleri bölümünden PDF'i ekleyip hukuk onayına gönderin.</p>
      <div class="row end"><button class="btn ghost" onclick="vField('manage')">Vazgeç</button><button class="btn" id="mpGen" disabled>Mikro eğitimi üret</button></div></div>
    <div id="mpEdit"></div>`;
  let options = [], docs = [];
  const loadDocs = async () => {
    $("#mpDoc").innerHTML = "<option>Yükleniyor…</option>"; $("#mpGen").disabled = true;
    try { options = await fieldRPC("field_source_options", { p_product: $("#mpProduct").value }); } catch (e) { options = []; toast(e.message); }
    if (generation !== fieldGeneration) return;
    docs = [...new Map(options.map(o => [o.document_id, { id: o.document_id, title: o.title }])).values()];
    $("#mpDoc").innerHTML = docs.length ? docs.map(d => `<option value="${esc(d.id)}">${esc(d.title)} · ${options.filter(o => o.document_id === d.id).length} sayfa</option>`).join("") : "<option value=''>Bu ürün için onaylı belge yok</option>";
    $("#mpGen").disabled = !docs.length;
  };
  $("#mpProduct").onchange = loadDocs; await loadDocs();
  $("#mpGen").onclick = async () => {
    const doc = docs.find(d => d.id === $("#mpDoc").value); if (!doc) return;
    const pages = options.filter(o => o.document_id === doc.id).sort((a, b) => a.page - b.page);
    const b = $("#mpGen"); busyBtn(b, true, "Hazırlanıyor (1-2 dakika)");
    $("#mpInfo").textContent = `${pages.length} sayfa okunuyor…`;
    try {
      const { raw, used } = await microGenerate(doc, pages);
      if (generation !== fieldGeneration) return;
      microEditor(microNormalize(raw, pages.slice(0, used).map(p => +p.page)), doc, pages);
      $("#mpInfo").textContent = (used < pages.length ? `Belge uzun olduğu için ilk ${used} sayfa (${pages.length} sayfadan) kullanıldı. ` : "") + "Taslak hazır. Kontrol edip düzenleyin, sonra onaya gönderin.";
    } catch (e) { $("#mpInfo").textContent = aiError(e); }
    finally { busyBtn(b, false, "Yeniden üret"); }
  };
}

function microEditor(m, doc, docOptions) {
  const pagesOpt = sel => docOptions.map(o => `<option ${+o.page === +sel ? "selected" : ""}>${o.page}</option>`).join("");
  $("#mpEdit").innerHTML = `<div class="panel"><h2>Taslak</h2>
    <div class="field"><label for="mtTitle">Başlık</label><input id="mtTitle" maxlength="120" value="${esc(m.title)}"></div>
    <div class="field"><label for="mtSummary">Kısa özet</label><textarea id="mtSummary" rows="3" maxlength="1000">${esc(m.summary)}</textarea></div>
    <div class="field"><div class="row"><label for="mtPodcast" class="grow">Sesli özet metni (~3 dakika)</label><button class="btn ghost sm" type="button" data-listen-src="#mtPodcast">Dinle</button></div><textarea id="mtPodcast" rows="9" maxlength="8000">${esc(m.podcast)}</textarea></div></div>
    <div class="panel"><h2>Bilgi kartları</h2><div class="flashcards">${m.flashcards.map((c, i) => `<div class="flashcard edit"><input data-card-title="${i}" maxlength="80" placeholder="Başlık" value="${esc(c.title)}"><textarea data-card-text="${i}" rows="3" maxlength="400">${esc(c.text)}</textarea><label class="muted small">Kaynak sayfa <select data-card-page="${i}" class="auto">${pagesOpt(c.page)}</select></label></div>`).join("")}</div></div>
    <div class="panel"><h2>Pekiştirme testi</h2>${m.quiz.map((q, i) => `<div class="qedit"><div class="field"><label>${i + 1}. soru</label><textarea data-q="${i}" rows="2" maxlength="600">${esc(q.q)}</textarea></div>
      ${q.options.map((o, j) => `<div class="row" style="margin-bottom:6px"><label class="check"><input type="radio" name="ans${i}" data-ans="${i}" value="${j}" ${q.answer === j ? "checked" : ""}> ${"ABCD"[j]}</label><input class="grow" data-opt="${i}:${j}" maxlength="300" value="${esc(o)}"></div>`).join("")}
      <div class="grid2"><div class="field"><label>Açıklama</label><input data-exp="${i}" maxlength="800" value="${esc(q.explanation)}"></div><div class="field"><label>Kaynak sayfa</label><select data-qpage="${i}">${pagesOpt(q.page)}</select></div></div></div>`).join("")}</div>
    <p class="notice">Taslak, ürün onayından (hukuk/medikal inceleme) geçtikten sonra temsilcilere açılır ve Bugün listelerinde görünür.</p>
    <div class="row end"><button class="btn" id="mtSave">Taslağı kaydet ve onaya gönder</button></div>`;
  $("#mtSave").onclick = async () => {
    const read = () => ({
      title: $("#mtTitle").value.trim(), summary: $("#mtSummary").value.trim(), podcast: $("#mtPodcast").value.trim(),
      flashcards: m.flashcards.map((_, i) => ({ title: $(`[data-card-title="${i}"]`).value.trim(), text: $(`[data-card-text="${i}"]`).value.trim(), page: +$(`[data-card-page="${i}"]`).value })),
      quiz: m.quiz.map((_, i) => ({ q: $(`[data-q="${i}"]`).value.trim(), options: [0, 1, 2, 3].map(j => $(`[data-opt="${i}:${j}"]`).value.trim()), answer: +($(`[data-ans="${i}"]:checked`)?.value || 0), explanation: $(`[data-exp="${i}"]`).value.trim(), page: +$(`[data-qpage="${i}"]`).value }))
    });
    const x = read();
    if (x.title.length < 3 || !x.podcast || x.flashcards.some(c => !c.title || !c.text) || x.quiz.some(q => !q.q || q.options.some(o => !o))) return toast("Başlık, sesli özet, 3 kart ve 5 sorunun tüm şıkları dolu olmalı.");
    const unit = microToUnit(x, docOptions), b = $("#mtSave"); busyBtn(b, true, "Kaydediliyor");
    try {
      const id = await fieldRPC("field_save", { p_id: null, p_product: $("#mpProduct").value, p_kind: "update", p_title: x.title, p_skill: "Tıbbi doğruluk", p_specialty: "Genel", p_payload: unit.payload, p_sources: unit.sources, p_keys: unit.keys });
      await fieldRPC("field_review", { p_id: id, p_decision: "in_review" });
      toast("Mikro eğitim onaya gönderildi"); vField("manage");
    } catch (e) { busyBtn(b, false, "Taslağı kaydet ve onaya gönder"); toast(e.message); }
  };
}

/* ---------- Öğrenen tarafı: sesli özet ve bilgi kartları ---------- */
function microReading(payload) {
  return (payload.podcast ? `<div class="podcast"><div class="row"><b class="grow">Sesli özet · yaklaşık 3 dakika</b><button class="btn sm" type="button" data-listen-src=".podcast-text">Dinle</button></div>
      <details><summary>Metni oku</summary><p class="podcast-text" style="white-space:pre-wrap">${esc(payload.podcast)}</p></details></div>` : "")
    + (payload.flashcards?.length ? `<div class="flashcards">${payload.flashcards.map(c => `<div class="flashcard"><b>${esc(c.title)}</b><p>${esc(c.text)}</p><span class="muted small">Kaynak s. ${esc(c.page)}</span></div>`).join("")}</div>` : "");
}
// Telefonun Türkçe sesiyle okuma. Uzun metin cümlelere bölünür; bazı tarayıcılar uzun tek parçayı yarıda keser.
let microSpeaking = null;
function microStop() { if (window.speechSynthesis) speechSynthesis.cancel(); if (microSpeaking) microSpeaking.textContent = "Dinle"; microSpeaking = null; }
document.addEventListener("click", e => {
  const b = e.target.closest("[data-listen-src]"); if (!b) return;
  if (!window.speechSynthesis) return toast("Bu cihaz sesli okumayı desteklemiyor.");
  if (microSpeaking === b) return microStop();
  microStop();
  const src = b.closest(".podcast, .field, .panel")?.querySelector(b.dataset.listenSrc) || $(b.dataset.listenSrc);
  const text = (src?.value ?? src?.textContent ?? "").trim(); if (!text) return;
  const parts = text.match(/[^.!?…]+[.!?…]*/g) || [text];
  parts.forEach((t, i) => { const u = new SpeechSynthesisUtterance(t.trim()); u.lang = "tr-TR"; if (i === parts.length - 1) u.onend = () => { if (microSpeaking === b) microStop(); }; speechSynthesis.speak(u); });
  microSpeaking = b; b.textContent = "Durdur";
});
window.addEventListener("hashchange", microStop);

/* ---------- PDF'ten sayfa metni (kaynak belge ekleme) ---------- */
async function pdfPages(file) {
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; s.onload = res; s.onerror = () => rej(Error("PDF okuyucu yüklenemedi. İnternet bağlantınızı kontrol edin.")); document.head.append(s); });
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  if (pdf.numPages > 300) throw Error("Belge en fazla 300 sayfa olabilir.");
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    const text = c.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text) pages.push({ page: i, text: text.slice(0, 12000) });
  }
  return { pages, total: pdf.numPages };
}
