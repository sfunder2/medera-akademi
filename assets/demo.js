/* Demo modu: Supabase yerine tarayıcıda çalışan, örnek verilerle dolu sahte bir istemci.
   Hiçbir veri sunucuya gitmez; sayfa yenilenince her şey başlangıç durumuna döner.
   Ürün, hekim, kurum ve kişi adlarının tamamı kurgusaldır. */
(() => {
  const day = 864e5, now = Date.now();
  const iso = d => new Date(now + d * day).toISOString();
  const date = d => iso(d).slice(0, 10);
  let seq = 1000;
  const uid = p => `${p}-${++seq}`;

  /* ---------- Kişiler ve rol ---------- */
  const PEOPLE = {
    pjp: { id: "u-ayse", full_name: "Ayşe Demir", email: "ayse.demir@demo.medera", job_role: "pjp", role: "user", status: "active" },
    urun_muduru: { id: "u-mert", full_name: "Mert Kaya", email: "mert.kaya@demo.medera", job_role: "urun_muduru", role: "user", status: "active" },
    avukat: { id: "u-zeynep", full_name: "Zeynep Aydın", email: "zeynep.aydin@demo.medera", job_role: "avukat", role: "user", status: "active" }
  };
  const roleParam = new URLSearchParams(location.search).get("rol");
  const ME_DEMO = PEOPLE[roleParam] || PEOPLE.pjp;

  /* ---------- Ürünler (kurgusal) ---------- */
  const products = [
    { id: "p-onk", name: "Onkavia", area: "Onkoloji", molecule: "karvelizumab", notes: "HER2 pozitif metastatik meme kanserinde kullanılan monoklonal antikor (kurgusal ürün).\nUygulama: 3 haftada bir intravenöz infüzyon.\nSık sorulan konular: infüzyon reaksiyonları, kardiyak izlem, kombinasyon tedavileri." },
    { id: "p-hem", name: "Hemaris", area: "Hematoloji", molecule: "rutenatinib", notes: "Kronik miyeloid lösemide kullanılan oral tirozin kinaz inhibitörü (kurgusal ürün).\nUygulama: günde bir kez, aç karnına.\nSık sorulan konular: ilaç etkileşimleri, moleküler yanıt takibi, tedaviye uyum." },
    { id: "p-nor", name: "Nörelin", area: "Nöroloji", molecule: "sefralimod", notes: "Relapsing-remitting multipl sklerozda kullanılan oral immünomodülatör (kurgusal ürün).\nUygulama: günde bir kez, ilk doz izlem altında.\nSık sorulan konular: ilk doz izlemi, lenfosit sayımı, aşılama." }
  ];
  const myProducts = { pjp: ["p-onk", "p-hem", "p-nor"], urun_muduru: ["p-onk", "p-hem"], avukat: [] }[ME_DEMO.job_role];

  /* ---------- Sınavlar ---------- */
  const exams = [
    { id: "e-mab", title: "Monoklonal antikorlar: temel bilgiler", area: "Onkoloji", product_id: "p-onk", is_practice: false,
      description: "Onkavia eğitimine hazırlık için temel kavramlar.",
      questions: [
        { q: "İlaç adlarındaki \"-mab\" eki neyi gösterir?", options: ["Monoklonal antikor", "Küçük moleküllü kinaz inhibitörü", "Hormon analoğu", "Aşı"] },
        { q: "\"-nib\" ekiyle biten ilaçlar genellikle hangi gruptadır?", options: ["Kinaz inhibitörleri", "Monoklonal antikorlar", "Antibiyotikler", "Kortikosteroidler"] },
        { q: "Faz III klinik çalışmanın temel amacı nedir?", options: ["Etkinlik ve güvenliliği geniş hasta grubunda doğrulamak", "İlk kez insanda doz belirlemek", "Ruhsat sonrası maliyet analizi yapmak", "Hayvan modelinde toksisiteyi ölçmek"] },
        { q: "Hekim endikasyon dışı bir kullanım sorarsa ne yapmalısınız?", options: ["Soruyu tıbbi bilgi birimine yönlendirmek", "Kendi deneyiminizi paylaşmak", "Rakip ürünle karşılaştırmak", "Soruyu yanıtsız bırakıp konuyu değiştirmek"] },
        { q: "Görüşmede bir advers olay öğrendiğinizde ne yapılır?", options: ["Şirket prosedürüne göre farmakovijilans birimine hemen iletilir", "Bir sonraki ziyarette hekime tekrar sorulur", "Yalnızca ciddi ise not edilir", "Hastayla doğrudan iletişime geçilir"] }
      ], answers: [0, 0, 0, 0, 0],
      explanations: ["Uluslararası adlandırmada -mab eki monoklonal antikorları gösterir.", "-nib eki küçük moleküllü kinaz (çoğunlukla tirozin kinaz) inhibitörlerini gösterir.", "Faz III, etkinlik ve güvenliliği geniş ve çoğunlukla karşılaştırmalı bir hasta grubunda doğrular.", "Endikasyon dışı sorular tanıtım kapsamında yanıtlanmaz; tıbbi bilgi birimine iletilir.", "Advers olaylar, ciddiyetine bakılmaksızın prosedürde belirtilen sürede farmakovijilans birimine iletilir."] },
    { id: "e-etik", title: "Etik tanıtım kuralları", area: "Diğer", product_id: null, is_practice: false,
      questions: [
        { q: "Tanıtım materyallerinde hangi bilgi yer almalıdır?", options: ["Onaylı kısa ürün bilgisi", "Hekimin kişisel görüşü", "Ruhsat dışı kullanım önerisi", "Rakip ürünün eksikleri"] },
        { q: "Hekime verilebilecek promosyon malzemesi için doğru olan hangisidir?", options: ["Düşük değerli ve tıbbi uygulamayla ilgili olmalı", "Değer sınırı yoktur", "Nakit verilebilir", "Kişisel hediye olabilir"] },
        { q: "Bilimsel toplantı desteğinde esas olan nedir?", options: ["Bilimsel içerik ve şeffaflık", "Sosyal program", "Konaklama süresi", "Katılımcı sayısı"] },
        { q: "Karşılaştırmalı iddia kullanırken ne gerekir?", options: ["Doğrulanabilir ve güncel kanıt", "Satış verisi", "Saha gözlemi", "Hekim yorumu"] },
        { q: "Hasta bilgisini görüşme notuna yazmak doğru mudur?", options: ["Hayır, kişisel sağlık verisi yazılmaz", "Evet, takip için gerekli", "Yalnızca baş harfler yazılabilir", "Hekim izin verirse yazılabilir"] }
      ], answers: [0, 0, 0, 0, 0],
      explanations: ["Tanıtım materyalleri onaylı ürün bilgisiyle uyumlu olmalıdır.", "Promosyon malzemeleri düşük değerli ve meslekle ilgili olmalıdır.", "Destekler bilimsel amaçlı ve şeffaf olmalıdır.", "Karşılaştırmalı iddialar doğrulanabilir kanıta dayanmalıdır.", "Kişisel sağlık verisi saha notlarına yazılmaz."] },
    { id: "e-hem", title: "Hemaris ürün eğitimi", area: "Hematoloji", product_id: "p-hem", is_practice: false,
      questions: [
        { q: "Hemaris hangi ilaç grubundadır?", options: ["Tirozin kinaz inhibitörü", "Monoklonal antikor", "Alkilleyici ajan", "Antimetabolit"] },
        { q: "Hemaris nasıl uygulanır?", options: ["Günde bir kez, aç karnına, oral", "Haftada bir, intravenöz", "Ayda bir, subkutan", "Günde üç kez, tokken"] },
        { q: "Kronik miyeloid lösemide tedavi yanıtı en sık nasıl izlenir?", options: ["Moleküler yanıt (BCR-ABL) ölçümüyle", "Yalnızca fizik muayeneyle", "Görüntülemeyle", "Hasta beyanıyla"] },
        { q: "Hekim ilaç etkileşimini sorduğunda en doğru yaklaşım nedir?", options: ["Onaylı ürün bilgisindeki etkileşim bölümünü göstermek", "Etkileşim olmadığını söylemek", "Tahminde bulunmak", "Konuyu ertelemek"] },
        { q: "Tedaviye uyumu desteklemek için temsilci ne paylaşabilir?", options: ["Onaylı hasta bilgilendirme materyali", "Kendi hazırladığı broşür", "Doz değiştirme önerisi", "Hasta telefon numarası"] }
      ], answers: [0, 0, 0, 0, 0],
      explanations: ["Hemaris (kurgusal) bir tirozin kinaz inhibitörüdür.", "Ürün bilgisine göre günde bir kez aç karnına alınır.", "KML'de moleküler yanıt BCR-ABL düzeyiyle izlenir.", "Etkileşim soruları onaylı ürün bilgisine dayanarak yanıtlanır.", "Yalnızca onaylı hasta materyalleri paylaşılabilir."] },
    { id: "e-nor", title: "Multipl skleroz: hastalık bilgisi", area: "Nöroloji", product_id: "p-nor", is_practice: false,
      questions: [
        { q: "Multipl skleroz hangi sistemi etkiler?", options: ["Merkezi sinir sistemi", "Periferik kas dokusu", "Solunum sistemi", "Endokrin sistem"] },
        { q: "En sık görülen MS formu hangisidir?", options: ["Relapsing-remitting", "Primer progresif", "Sekonder progresif", "Progresif relapsing"] },
        { q: "MS tanısında sık kullanılan görüntüleme yöntemi nedir?", options: ["Manyetik rezonans (MR)", "Direkt grafi", "Ekokardiyografi", "Kemik sintigrafisi"] }
      ], answers: [0, 0, 0],
      explanations: ["MS, merkezi sinir sistemini etkileyen immün aracılı bir hastalıktır.", "Hastaların çoğu relapsing-remitting formla başlar.", "MR, lezyonları göstermede temel yöntemdir."] }
  ];
  const assignments = {
    pjp: [
      { id: "a-mab", exam_id: "e-mab", status: "pending", due_date: date(4) },
      { id: "a-nor", exam_id: "e-nor", status: "pending", due_date: date(11) },
      { id: "a-etik", exam_id: "e-etik", status: "done", score: 80, answers: [0, 0, 0, 2, 0], completed_at: iso(-6) },
      { id: "a-hem", exam_id: "e-hem", status: "done", score: 60, answers: [0, 1, 0, 2, 0], completed_at: iso(-12) }
    ],
    urun_muduru: [
      { id: "a-mab2", exam_id: "e-mab", status: "done", score: 100, answers: [0, 0, 0, 0, 0], completed_at: iso(-3) },
      { id: "a-etik2", exam_id: "e-etik", status: "pending", due_date: date(6) }
    ],
    avukat: [
      { id: "a-etik3", exam_id: "e-etik", status: "done", score: 100, answers: [0, 0, 0, 0, 0], completed_at: iso(-9) }
    ]
  }[ME_DEMO.job_role];

  /* ---------- Tablolar ---------- */
  const DB = {
    profiles: Object.values(PEOPLE),
    products,
    user_products: myProducts.map(product_id => ({ user_id: ME_DEMO.id, product_id })),
    exams, exam_keys: exams.map(e => ({ exam_id: e.id, answers: e.answers, explanations: e.explanations })),
    exam_assignments: assignments.map(a => ({ user_id: ME_DEMO.id, ...a })),
    curricula: [
      { id: "c-onk", title: "Onkavia lansman eğitimi", area: "Onkoloji", product_id: "p-onk", weeks: 4, published: true, created_at: iso(-20), modules: [
        { title: "HER2 pozitif meme kanseri", summary: "Hastalık biyolojisi, tanı ve güncel tedavi basamakları.", objectives: ["HER2 testinin klinik önemini açıklamak", "Tedavi algoritmasındaki yerini tanımlamak"], sources: ["Onkavia kısa ürün bilgisi", "Ulusal tedavi kılavuzu özeti"] },
        { title: "Etki mekanizması", summary: "Monoklonal antikorların hedefe bağlanması ve bağışıklık yanıtı.", objectives: ["Mekanizmayı iki cümlede anlatabilmek"], sources: ["Onkavia kısa ürün bilgisi, bölüm 5.1"] },
        { title: "Güvenlilik ve izlem", summary: "İnfüzyon reaksiyonları ve kardiyak izlem önerileri.", objectives: ["Sık sorulan güvenlilik sorularını onaylı kaynakla yanıtlamak"], sources: ["Onkavia kısa ürün bilgisi, bölüm 4.4 ve 4.8"] },
        { title: "Saha uygulaması", summary: "Ziyaret planı, itiraz karşılama ve dengeli sunum.", objectives: ["Kuşkucu hekim itirazlarına kanıtla yanıt vermek"], sources: ["İtiraz kartları seti"] }
      ] },
      { id: "c-hem", title: "KML'de hedefe yönelik tedavi", area: "Hematoloji", product_id: "p-hem", weeks: 3, published: true, created_at: iso(-35), modules: [
        { title: "KML ve BCR-ABL", summary: "Philadelphia kromozomu ve hastalık seyri.", objectives: ["Moleküler yanıt kavramlarını açıklamak"], sources: ["Hematoloji temel eğitim notları"] },
        { title: "Hemaris ile tedavi", summary: "Doz, uygulama ve ilaç etkileşimleri.", objectives: ["Uygulama talimatını doğru aktarmak"], sources: ["Hemaris kısa ürün bilgisi"] },
        { title: "Tedaviye uyum", summary: "Uyumu destekleyen onaylı materyaller.", objectives: ["Onaylı hasta materyallerini tanımak"], sources: ["Hasta bilgilendirme broşürü"] }
      ] },
      { id: "c-etik", title: "Etik ve uyum temel eğitimi", area: "Diğer", product_id: null, weeks: 2, published: true, created_at: iso(-60), modules: [
        { title: "Tanıtım kuralları", summary: "Tanıtım materyali, promosyon ve bilimsel destek kuralları.", objectives: ["Uygun ve uygunsuz örnekleri ayırt etmek"], sources: ["Şirket etik kuralları"] },
        { title: "Farmakovijilans", summary: "Advers olayı tanıma ve bildirme.", objectives: ["Bildirim akışını adım adım sıralamak"], sources: ["Farmakovijilans prosedürü"] }
      ] }
    ],
    hcps: [
      ["h1", "Dr. Elif Arslan", "Tıbbi Onkoloji", "Merkez Onkoloji Hastanesi", "İstanbul"],
      ["h2", "Dr. Burak Yıldız", "Tıbbi Onkoloji", "Kuzey Üniversitesi Tıp Fakültesi", "Ankara"],
      ["h3", "Dr. Selin Koç", "Hematoloji", "Şehir Eğitim ve Araştırma Hastanesi", "İzmir"],
      ["h4", "Dr. Can Öztürk", "Hematoloji", "Merkez Onkoloji Hastanesi", "İstanbul"],
      ["h5", "Dr. Deniz Şahin", "Nöroloji", "Batı Üniversitesi Hastanesi", "Bursa"],
      ["h6", "Dr. Ece Polat", "Nöroloji", "Kuzey Üniversitesi Tıp Fakültesi", "Ankara"],
      ["h7", "Dr. Murat Aksoy", "Tıbbi Onkoloji", "Güney Devlet Hastanesi", "Antalya"],
      ["h8", "Dr. Gizem Er", "Patoloji", "Şehir Eğitim ve Araştırma Hastanesi", "İzmir"]
    ].map(([id, name, spec, inst, city]) => ({ id, owner_id: PEOPLE.pjp.id, name, spec, inst, city })),
    interactions: [
      ["h1", "Yüz yüze ziyaret", "p-onk", -2, "Kardiyak izlem önerilerini sordu; kısa ürün bilgisi 4.4 paylaşıldı."],
      ["h3", "Yüz yüze ziyaret", "p-hem", -3, "Moleküler yanıt takibi konuşuldu. Hasta materyali talep etti."],
      ["h2", "Uzaktan görüşme", "p-onk", -5, "Kombinasyon tedavisi verileri için tıbbi bilgi birimine yönlendirildi."],
      ["h5", "Kongre / toplantı", "p-nor", -8, "Nöroloji kongresinde stant ziyareti; ilk doz izlemi hakkında bilgi verildi."],
      ["h4", "Yüz yüze ziyaret", "p-hem", -10, "İlaç etkileşimleri bölümü birlikte incelendi."],
      ["h1", "E-posta", "p-onk", -14, "Toplantı sunumu onaylı materyal olarak iletildi."],
      ["h6", "Yüz yüze ziyaret", "p-nor", -17, "Lenfosit sayımı takibini sordu."],
      ["h7", "Uzaktan görüşme", "p-onk", -21, "İnfüzyon süresi ve premedikasyon soruldu."],
      ["h3", "E-posta", "p-hem", -26, "Webinar daveti gönderildi."],
      ["h8", "Yüz yüze ziyaret", null, -33, "HER2 test süreçleri hakkında genel bilgi alışverişi."]
    ].map(([hcp_id, type, product_id, d, notes], i) => ({ id: "i" + i, owner_id: PEOPLE.pjp.id, hcp_id, type, product_id, date: date(d), notes })),
    announcements: [
      { id: "n1", title: "Onkavia lansman eğitimi yayında", body: "4 haftalık yeni müfredat Öğren sekmesinde. İlk modülü bu hafta tamamlamanız bekleniyor.", pinned: true, target_role: null, created_at: iso(-1) },
      { id: "n2", title: "Bölge toplantısı 18 Ekim'de", body: "Toplantı öncesi Hekim görüşmesi pratiğinde en az bir görüşme tamamlayın.", pinned: false, target_role: "pjp", created_at: iso(-4) },
      { id: "n3", title: "Bilgi yarışmasında yeni sezon başladı", body: "Ekim sezonunda ilk 3'e giren PJP'lere eğitim bursu verilecek.", pinned: false, target_role: "pjp", created_at: iso(-7) }
    ],
    source_documents: [
      { id: "d-onk", title: "Onkavia kısa ürün bilgisi", product_id: "p-onk", status: "approved", created_at: iso(-30), source_url: null, pages: [
        { page: 1, text: "Onkavia (karvelizumab) — kurgusal demo belgesi.\nEndikasyon: HER2 pozitif metastatik meme kanseri.\nUygulama: 3 haftada bir intravenöz infüzyon; ilk infüzyon 90 dakika, sonrakiler tolere edilirse 30 dakika." },
        { page: 2, text: "Uyarılar (4.4): Tedavi öncesinde ve tedavi süresince düzenli kardiyak fonksiyon değerlendirmesi önerilir. İnfüzyon reaksiyonları ilk uygulamada daha sıktır." },
        { page: 3, text: "Advers etkiler (4.8): En sık görülenler yorgunluk, bulantı ve infüzyonla ilişkili reaksiyonlardır. Şüpheli advers etkiler farmakovijilans birimine bildirilmelidir." }
      ] },
      { id: "d-hem", title: "Hemaris kısa ürün bilgisi", product_id: "p-hem", status: "approved", created_at: iso(-45), source_url: null, pages: [
        { page: 1, text: "Hemaris (rutenatinib) — kurgusal demo belgesi.\nEndikasyon: Kronik faz Philadelphia kromozomu pozitif KML.\nUygulama: Günde bir kez, aç karnına, her gün aynı saatte." },
        { page: 2, text: "Etkileşimler (4.5): Güçlü CYP3A4 inhibitörleri ve indükleyicileri ile birlikte kullanımdan kaçınılmalıdır. Proton pompası inhibitörleri emilimi azaltabilir." }
      ] }
    ],
    institutions: [], content_history: [], audit_log: [],
    duel_questions: [
      { id: "q1", category: "Ürün bilgisi", question: "Onkavia hangi sıklıkla uygulanır?", options: ["3 haftada bir", "Her gün", "Haftada iki kez", "Ayda bir"], answer: 0, status: "approved", source_note: "Onkavia KÜB s.1" },
      { id: "q2", category: "İlaç bilgisi", question: "Hemaris nasıl alınmalıdır?", options: ["Aç karnına", "Yemekle birlikte", "Yalnızca akşam", "Haftada bir"], answer: 0, status: "in_review", source_note: "Hemaris KÜB s.1" }
    ],
    duel_reward_rules: [], duel_rewards: []
  };
  const prodOf = id => products.find(p => p.id === id);
  const examOf = id => exams.find(e => e.id === id);
  // Seçilen alanlarda ürün adını ekleyen basit "join".
  const withJoins = (table, row) => {
    if (table === "user_products") return { ...row, products: prodOf(row.product_id) };
    if (["curricula", "interactions", "source_documents"].includes(table)) return { ...row, products: row.product_id ? { name: prodOf(row.product_id)?.name } : null };
    return row;
  };

  /* ---------- Sorgu oluşturucu ---------- */
  function query(table) {
    const filters = []; let op = "select", payload = null, single = false, wantRows = false, orderBy = null, limitN = null;
    const rows = () => (DB[table] = DB[table] || []);
    const match = r => filters.every(f => f(r));
    const b = {
      select() { wantRows = true; return b; },
      eq(k, v) { filters.push(r => r[k] === v); return b; },
      neq(k, v) { filters.push(r => r[k] !== v); return b; },
      in(k, vs) { filters.push(r => vs.includes(r[k])); return b; },
      is(k, v) { filters.push(r => (r[k] ?? null) === v); return b; },
      gte(k, v) { filters.push(r => r[k] >= v); return b; },
      lte(k, v) { filters.push(r => r[k] <= v); return b; },
      ilike() { return b; }, or() { return b; }, not() { return b; }, range() { return b; },
      order(k, o = {}) { if (!orderBy) orderBy = [k, o.ascending !== false]; return b; },
      limit(n) { limitN = n; return b; },
      single() { single = true; return b; }, maybeSingle() { single = true; return b; },
      insert(v) { op = "insert"; payload = v; return b; },
      upsert(v) { op = "insert"; payload = v; return b; },
      update(v) { op = "update"; payload = v; return b; },
      delete() { op = "delete"; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    function run() {
      let data;
      if (op === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload]).map(v => ({ id: uid(table), created_at: new Date().toISOString(), ...v }));
        rows().push(...list); data = list;
        if (table === "exam_assignments") list.forEach(a => { a.status = a.status || "pending"; });
      } else if (op === "update") {
        data = rows().filter(match); data.forEach(r => Object.assign(r, payload));
      } else if (op === "delete") {
        data = rows().filter(match); DB[table] = rows().filter(r => !match(r));
        if (table === "hcps") DB.interactions = DB.interactions.filter(i => data.every(h => h.id !== i.hcp_id));
        if (table === "exams") DB.exam_assignments = DB.exam_assignments.filter(a => data.every(e => e.id !== a.exam_id));
      } else {
        data = rows().filter(match);
        if (orderBy) { const [k, asc] = orderBy; data = data.slice().sort((x, y) => String(x[k] ?? "").localeCompare(String(y[k] ?? ""), "tr") * (asc ? 1 : -1)); }
        if (limitN) data = data.slice(0, limitN);
      }
      data = data.map(r => withJoins(table, r));
      if (op !== "select" && !wantRows) return { data: null, error: null };
      return { data: single ? data[0] ?? null : data, error: single && !data.length ? { message: "Kayıt bulunamadı" } : null };
    }
    return b;
  }

  /* ---------- Sunucu fonksiyonları ---------- */
  const myAssignments = () => DB.exam_assignments.filter(a => a.user_id === ME_DEMO.id && examOf(a.exam_id))
    .map(a => ({ ...a, exams: examOf(a.exam_id) }));
  const learningPlan = () => myAssignments().filter(a => a.status === "done").flatMap(a => {
    const key = DB.exam_keys.find(k => k.exam_id === a.exam_id);
    return a.exams.questions.map((q, i) => ({ q, i })).filter(({ i }) => a.answers?.[i] !== key.answers[i]).map(({ q, i }) => ({
      area: a.exams.area, exam_title: a.exams.title, question: q.q, options: q.options, correct: key.answers[i], explanation: key.explanations?.[i]
    }));
  });

  const fieldUnits = [
    { id: "f-obj", kind: "objection", title: "\"Kardiyak risk beni endişelendiriyor\" itirazı", product_id: "p-onk", product: "Onkavia", specialty: "Tıbbi Onkoloji", skill: "İtiraz karşılama", version: 2, status: "approved",
      payload: { body: "Kuşkucu bir onkolog, Onkavia'nın kardiyak güvenliliği konusunda endişelerini dile getiriyor. Onaylı kaynaklara dayanarak dengeli bir yanıt verin.", start: "n1", nodes: [
        { id: "n1", prompt: "Hekim: \"Kardiyak yan etkiler yüzünden bu ilacı yaşlı hastalarımda kullanmaya çekiniyorum.\"", choices: [{ label: "Endişenizi anlıyorum. Ürün bilgisinde tedavi öncesi ve sırasında kardiyak izlem öneriliyor; ilgili bölümü birlikte inceleyebilir miyiz?", next: "n2" }, { label: "Bu konuda hiç sorun yaşanmadı, rahat olabilirsiniz.", next: "n2" }, { label: "Rakip ürünlerde risk çok daha yüksek.", next: "n2" }] },
        { id: "n2", prompt: "Hekim: \"Peki izlem sıklığı konusunda elinizde net bir bilgi var mı?\"", choices: [{ label: "Onaylı ürün bilgisindeki öneriyi paylaşabilirim; ayrıntılı soru için tıbbi bilgi birimimizden size dönüş sağlayabilirim.", next: null }, { label: "Her ay ekokardiyografi yeterli olur diye düşünüyorum.", next: null }] }
      ] },
      sources: [{ document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 2, approved_at: iso(-30) }],
      keys: { n1: [{ score: 100, feedback: "Endişeyi kabul edip onaylı kaynağa yönlendirdiniz." }, { score: 0, feedback: "Güvenlilik konusunda kesin ve kanıtsız güvence verilmez." }, { score: 10, feedback: "Kanıtsız karşılaştırmalı iddia kullanılmaz." }], n2: [{ score: 100, feedback: "Bilinmeyen ayrıntı için doğru birime yönlendirdiniz." }, { score: 20, feedback: "Kişisel tahmin yerine onaylı bilgi paylaşılmalı." }] } },
    { id: "f-visit", kind: "visit", title: "Hematoloji ziyaret hazırlığı: Hemaris", product_id: "p-hem", product: "Hemaris", specialty: "Hematoloji", skill: "Soru sorma", version: 1, status: "approved",
      payload: { body: "Bir hematolog ziyareti öncesi 3 dakikalık hazırlık kartı.", visit: { messages: ["Günde tek doz, aç karnına uygulama", "Moleküler yanıtın düzenli izlenmesi", "Etkileşim bölümünün birlikte gözden geçirilmesi"], questions: ["Proton pompası inhibitörü kullanan hastalarda ne öneriliyor?", "Tedaviye uyumu nasıl destekleyebiliriz?", "Hangi hastalarda doz ayarlaması gerekir?"] }, start: null, nodes: [] },
      sources: [{ document_id: "d-hem", title: "Hemaris kısa ürün bilgisi", page: 2, approved_at: iso(-45) }] },
    { id: "f-comp", kind: "comparison", title: "Onkavia uygulama özellikleri", product_id: "p-onk", product: "Onkavia", specialty: "Tıbbi Onkoloji", skill: "Dengeli anlatım", version: 1, status: "approved",
      payload: { body: "Uygulama özelliklerini tarafsız biçimde özetleyen karşılaştırma kartı.", comparison: [{ topic: "Uygulama sıklığı", product: "3 haftada bir", alternative: "Ürüne göre değişir; onaylı bilgiye bakın" }, { topic: "İlk infüzyon süresi", product: "90 dakika", alternative: "Karşılaştırmalı iddia kullanmayın" }, { topic: "İzlem", product: "Düzenli kardiyak değerlendirme", alternative: "Kendi ürün bilgisine göre" }], start: null, nodes: [] },
      sources: [{ document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 1, approved_at: iso(-30) }] },
    { id: "f-branch", kind: "branch", title: "Zamanı kısıtlı nörolog ile görüşme", product_id: "p-nor", product: "Nörelin", specialty: "Nöroloji", skill: "Kanıt kullanımı", version: 1, status: "approved",
      payload: { body: "Hekimin yalnızca iki dakikası var. Görüşmeyi doğru önceliklendirin.", start: "b1", nodes: [
        { id: "b1", prompt: "Hekim: \"İki dakikam var, ne anlatacaksınız?\"", choices: [{ label: "Size tek bir konuda bilgi vermek istiyorum: ilk doz izlemi. Onaylı özet kartını bırakabilir miyim?", next: "b2" }, { label: "Ürünün bütün özelliklerini hızlıca anlatayım.", next: "b2" }] },
        { id: "b2", prompt: "Hekim: \"Tamam, kartı bırakın. Lenfosit takibi ne sıklıkta?\"", choices: [{ label: "Ürün bilgisindeki öneriyi kartta işaretledim; ayrıntı için tıbbi bilgi birimimiz size dönebilir.", next: null }, { label: "Bence üç ayda bir yeterli.", next: null }] }
      ] }, sources: [] }
  ];
  const fieldHistory = [
    { unit_id: "f-obj", title: fieldUnits[0].title, product_id: "p-onk", skill: "İtiraz karşılama", version: 1, score: 55, completed_at: iso(-9) },
    { unit_id: "f-branch", title: fieldUnits[3].title, product_id: "p-nor", skill: "Kanıt kullanımı", version: 1, score: 85, completed_at: iso(-15) },
    { unit_id: "f-visit", title: fieldUnits[1].title, product_id: "p-hem", skill: "Soru sorma", version: 1, score: null, completed_at: iso(-16) }
  ];
  const notices = [
    { id: "fn1", title: "Onkavia kısa ürün bilgisi", product: "Onkavia", document_id: "d-onk", created_at: iso(-1), read_at: null, changes: [{ page: 2, type: "edited" }], pages: [{ page: 2 }] },
    { id: "fn2", title: "Hemaris kısa ürün bilgisi", product: "Hemaris", document_id: "d-hem", created_at: iso(-20), read_at: iso(-19), changes: [{ page: 2, type: "added" }], pages: [{ page: 2 }] }
  ];
  const reviewQueue = [
    { id: "r1", kind: "exam", title: "Onkavia güvenlilik sınavı", area: "Onkoloji", product: "Onkavia", status: "in_review", updated: iso(-2), description: "Lansman sonrası güvenlilik bilgisi kontrolü.",
      questions: [{ q: "Onkavia tedavisinde hangi izlem önerilir?", options: ["Düzenli kardiyak değerlendirme", "Göz muayenesi", "Kemik yoğunluğu ölçümü", "İzlem gerekmez"] }, { q: "İnfüzyon reaksiyonları en sık ne zaman görülür?", options: ["İlk uygulamada", "Altıncı uygulamada", "Tedavi bitiminde", "Hiç görülmez"] }],
      answers: [0, 0], explanations: ["KÜB 4.4'e göre kardiyak izlem önerilir.", "KÜB'e göre ilk uygulamada daha sıktır."] },
    { id: "r2", kind: "curriculum", title: "Nörelin saha eğitimi", area: "Nöroloji", product: "Nörelin", status: "in_review", updated: iso(-1),
      modules: [{ title: "MS'e genel bakış", summary: "Hastalık formları ve tanı.", objectives: ["Formları ayırt etmek"] }, { title: "İlk doz izlemi", summary: "Uygulama ve izlem adımları.", objectives: ["İzlem adımlarını sıralamak"], sources: ["Nörelin KÜB"] }] },
    { id: "r3", kind: "exam", title: "Etik tanıtım kuralları", area: "Diğer", status: "approved", reviewer: "Zeynep Aydın", updated: iso(-40), questions: exams[1].questions, answers: exams[1].answers }
  ];
  const duel = { region: "Marmara", games: [
    { id: "g1", challenger: PEOPLE.pjp.id, challenger_name: "Ayşe Demir", opponent: "u-kaan", opponent_name: "Kaan Tekin", status: "finished", created_at: iso(-2), winner: PEOPLE.pjp.id, results: [{ user_id: PEOPLE.pjp.id, score: 640, correct: 4 }, { user_id: "u-kaan", score: 455, correct: 3 }] },
    { id: "g2", challenger: "u-sena", challenger_name: "Sena Güneş", opponent: PEOPLE.pjp.id, opponent_name: "Ayşe Demir", status: "invited", created_at: iso(0) }
  ] };
  const duelQs = [
    { category: "Ürün bilgisi", question: "Onkavia hangi sıklıkla uygulanır?", options: ["3 haftada bir", "Her gün", "Haftada iki kez", "Ayda bir"], answer: 0 },
    { category: "İlaç bilgisi", question: "Hemaris nasıl alınmalıdır?", options: ["Aç karnına, günde bir kez", "Yemekle, günde üç kez", "Haftada bir", "Yalnızca akşam"], answer: 0 },
    { category: "Rakip analizi", question: "Karşılaştırmalı iddia kullanmanın şartı nedir?", options: ["Doğrulanabilir ve güncel kanıt", "Satış verisi", "Hekim yorumu", "Saha gözlemi"], answer: 0 },
    { category: "Hekim görüşmesi", question: "Endikasyon dışı soru geldiğinde ne yapılır?", options: ["Tıbbi bilgi birimine yönlendirilir", "Kişisel görüş paylaşılır", "Geçiştirilir", "Rakip ürün önerilir"], answer: 0 },
    { category: "Saha planlama", question: "Ziyaret öncesi en önemli hazırlık hangisidir?", options: ["Hekimin önceki sorularını gözden geçirmek", "Promosyon malzemesi seçmek", "Rakip broşürlerini toplamak", "Randevusuz gitmek"], answer: 0 }
  ];
  const duelPlay = {};

  const RPC = {
    my_assignments: () => myAssignments(),
    exam_review: ({ p_assignment }) => { const a = DB.exam_assignments.find(x => x.id === p_assignment); return DB.exam_keys.find(k => k.exam_id === a?.exam_id) || null; },
    submit_exam: ({ p_assignment, p_answers }) => {
      const a = DB.exam_assignments.find(x => x.id === p_assignment), key = DB.exam_keys.find(k => k.exam_id === a.exam_id);
      const score = Math.round(key.answers.filter((x, i) => p_answers[i] === x).length / key.answers.length * 100);
      Object.assign(a, { status: "done", score, answers: p_answers, completed_at: new Date().toISOString() });
      return score;
    },
    class_stats: () => ({ members: 24, avg: 76, pass: 81, completion: 68 }),
    learning_plan: () => learningPlan(),
    review_items: ({ p_status }) => ME_DEMO.job_role === "avukat" ? reviewQueue.filter(r => r.status === p_status) : [],
    review_decide: ({ p_id, p_decision, p_note }) => { const r = reviewQueue.find(x => x.id === p_id); Object.assign(r, { status: p_decision, note: p_note, reviewer: ME_DEMO.full_name, updated: new Date().toISOString() }); return true; },
    review_document: () => true,
    manager_report: () => [
      { product: "Onkavia", area: "Onkoloji", reps: [
        { name: "Ayşe Demir", done: 2, assigned: 4, avg: 70, interactions: 18, interactions_30d: 6, last_interaction: date(-2) },
        { name: "Kaan Tekin", done: 3, assigned: 4, avg: 82, interactions: 25, interactions_30d: 9, last_interaction: date(-1) },
        { name: "Sena Güneş", done: 4, assigned: 4, avg: 91, interactions: 31, interactions_30d: 11, last_interaction: date(0) },
        { name: "Emre Çelik", done: 1, assigned: 4, avg: 58, interactions: 9, interactions_30d: 2, last_interaction: date(-12) }] },
      { product: "Hemaris", area: "Hematoloji", reps: [
        { name: "Ayşe Demir", done: 2, assigned: 3, avg: 60, interactions: 11, interactions_30d: 4, last_interaction: date(-3) },
        { name: "Burcu Yalın", done: 3, assigned: 3, avg: 88, interactions: 22, interactions_30d: 7, last_interaction: date(-1) }] }
    ],
    field_list: ({ p_manage } = {}) => p_manage ? fieldUnits.concat([{ ...fieldUnits[0], id: "f-draft", title: "Nörelin ilk doz itirazları (taslak)", product: "Nörelin", product_id: "p-nor", status: "draft", version: 1 }]) : fieldUnits,
    field_history: () => fieldHistory,
    field_notifications: ({ p_read } = {}) => { if (p_read) { const n = notices.find(x => x.id === p_read); if (n) n.read_at = new Date().toISOString(); return true; } return notices; },
    field_start: ({ p_id }) => ({ attempt_id: uid("att"), unit: fieldUnits.find(u => u.id === p_id) }),
    field_submit: ({ p_answers }) => {
      const u = fieldUnits.find(x => x.payload.nodes.some(n => n.id === p_answers[0]?.node)) || null;
      if (!u || !p_answers.length) return { score: null, feedback: [] };
      const feedback = p_answers.map(a => { const n = u.payload.nodes.find(x => x.id === a.node), k = u.keys?.[a.node]?.[a.choice] || { score: 70, feedback: "Dengeli bir yanıt." }; return { prompt: n.prompt, choice: n.choices[a.choice].label, feedback: k.feedback, score: k.score }; });
      const score = Math.round(feedback.reduce((t, f) => t + f.score, 0) / feedback.length);
      fieldHistory.unshift({ unit_id: u.id, title: u.title, product_id: u.product_id, skill: u.skill, version: u.version, score, completed_at: new Date().toISOString() });
      return { score, feedback };
    },
    field_heatmap: () => [
      ["Ayşe Demir", "Onkavia", "p-onk", "İtiraz karşılama", 3, 55, -9], ["Ayşe Demir", "Hemaris", "p-hem", "Soru sorma", 2, 78, -16],
      ["Kaan Tekin", "Onkavia", "p-onk", "İtiraz karşılama", 4, 81, -2], ["Kaan Tekin", "Onkavia", "p-onk", "Kanıt kullanımı", 2, 64, -5],
      ["Sena Güneş", "Onkavia", "p-onk", "Dengeli anlatım", 5, 92, -1], ["Burcu Yalın", "Hemaris", "p-hem", "Tıbbi doğruluk", 3, 88, -3],
      ["Emre Çelik", "Onkavia", "p-onk", "İtiraz karşılama", 1, 45, -20]
    ].map(([name, product, product_id, skill, attempts, average, d]) => ({ name, product, product_id, skill, attempts, average, last_practice: iso(d) })),
    field_review: () => true, field_save: () => true, field_edit: ({ p_id }) => fieldUnits.find(u => u.id === p_id) || fieldUnits[0],
    field_source_options: () => DB.source_documents.flatMap(d => d.pages.map(p => ({ document_id: d.id, title: d.title, page: p.page, text: p.text }))),
    duel_dashboard: () => ({
      region: duel.region, ready_categories: 5,
      people: [
        { id: "u-sena", name: "Sena Güneş", region: "Ege", points: 2140, wins: 9, duels: 12 },
        { id: PEOPLE.pjp.id, name: "Ayşe Demir", region: "Marmara", points: 1785, wins: 7, duels: 10 },
        { id: "u-kaan", name: "Kaan Tekin", region: "Marmara", points: 1520, wins: 6, duels: 11 },
        { id: "u-burcu", name: "Burcu Yalın", region: "İç Anadolu", points: 1310, wins: 5, duels: 8 },
        { id: "u-emre", name: "Emre Çelik", region: "Akdeniz", points: 840, wins: 2, duels: 6 }
      ],
      regions: [{ region: "Ege", average: 1650, total: 4950, participants: 3 }, { region: "Marmara", average: 1480, total: 5920, participants: 4 }, { region: "İç Anadolu", average: 1190, total: 3570, participants: 3 }, { region: "Akdeniz", average: 900, total: 1800, participants: 2 }, { region: "Karadeniz", average: 0, total: 0, participants: 0 }],
      members: [{ id: "u-kaan", name: "Kaan Tekin", region: "Marmara" }, { id: "u-sena", name: "Sena Güneş", region: "Ege" }, { id: "u-burcu", name: "Burcu Yalın", region: "İç Anadolu" }],
      games: duel.games,
      rules: [{ name: "Bronz", min_points: 1000, amount_try: 0, reward: "Eğitim sertifikası" }, { name: "Gümüş", min_points: 2000, amount_try: 2500, reward: "Kongre katılım desteği" }],
      rewards: [{ name: "Bronz", reward: "Eğitim sertifikası", amount_try: 0, status: "approved" }]
    }),
    duel_choose_region: ({ p_region }) => { duel.region = p_region; return true; },
    duel_create: ({ p_opponent }) => { const o = RPC.duel_dashboard().members.find(m => m.id === p_opponent); duel.games.unshift({ id: uid("g"), challenger: ME_DEMO.id, challenger_name: ME_DEMO.full_name, opponent: p_opponent, opponent_name: o?.name || "Rakip", status: "invited", created_at: new Date().toISOString() }); return true; },
    duel_respond: ({ p_duel, p_accept }) => { const g = duel.games.find(x => x.id === p_duel); g.status = p_accept ? "active" : "declined"; return true; },
    duel_next: ({ p_duel }) => duelState(p_duel),
    duel_answer: ({ p_duel, p_option }) => { const s = duelPlay[p_duel]; s.answers.push(p_option); return duelState(p_duel); },
    duel_review_question: () => true, duel_reward_decide: () => true
  };
  function duelState(id) {
    const s = duelPlay[id] = duelPlay[id] || { answers: [] }, i = s.answers.length;
    if (i >= duelQs.length) {
      const g = duel.games.find(x => x.id === id), correct = s.answers.filter((a, k) => a === duelQs[k].answer).length;
      Object.assign(g, { status: "finished", winner: correct >= 3 ? ME_DEMO.id : g.challenger === ME_DEMO.id ? g.opponent : g.challenger, results: [{ user_id: ME_DEMO.id, score: correct * 130, correct }, { user_id: g.challenger === ME_DEMO.id ? g.opponent : g.challenger, score: 390, correct: 3 }] });
      return { status: "done" };
    }
    const q = duelQs[i], t = new Date();
    return { status: "question", index: i, total: duelQs.length, category: q.category, question: q.question, options: q.options, server_time: t.toISOString(), deadline: new Date(+t + 30000).toISOString() };
  }

  /* ---------- Yapay zekâ cevapları ---------- */
  const doctorLines = [
    "Bu ürünle ilgili en çok güvenlilik verilerini merak ediyorum. Elinizde onaylı bir kaynak var mı?",
    "Anlıyorum. Peki yaşlı hastalarımda izlem konusunda ne öneriyorsunuz?",
    "Rakip tedavilere göre farkı nedir? Karşılaştırmalı bir çalışma gösterebilir misiniz?",
    "Tamam, bu bilgiyi kaynağıyla birlikte e-postayla iletirseniz değerlendiririm.",
    "Son olarak, hastaların tedaviye uyumu için ne tür destek sağlıyorsunuz?"
  ];
  let doctorTurn = 0;
  function aiReply(body) {
    const sys = body.system || "", last = (body.messages || []).at(-1)?.content || "";
    if (sys.includes("Yalnızca geçerli JSON")) {
      const topic = (last.match(/"([^"]+)" konusunda/) || [])[1] || "Pratik";
      const qs = exams[0].questions.slice(0, 3).concat(exams[1].questions.slice(0, 2));
      return { text: JSON.stringify({ title: topic + " — pratik sınavı", questions: qs.map(q => ({ q: q.q, options: q.options, answer: 0, explanation: "Demo sınavı: doğru cevap A şıkkıdır." })) }) };
    }
    if (sys.includes("hekim rolündesin")) return { text: doctorLines[doctorTurn++ % doctorLines.length] };
    if (sys.includes("saha eğitim koçusun")) return { text: "İtiraz karşılama: 78/100 — Hekimin güvenlilik endişesini kabul edip onaylı kaynağa yönlendirdiniz (\"ilgili bölümü birlikte inceleyebiliriz\").\nİletişim yapısı: 72/100 — Açık sorular sordunuz; görüşmeyi bir sonraki adımla kapatmayı unutmayın.\n\nGüçlü yönler:\n• Kanıta dayalı ve dengeli dil\n• Bilmediğiniz ayrıntıda tıbbi bilgi birimine yönlendirme\n\nGeliştirilecekler:\n• Karşılaştırma sorularında kanıt düzeyini netleştirin\n• Görüşme sonunda somut bir takip önerin" };
    if (last.includes("iddialarını onaylı kaynaklara göre incele")) return { text: "Desteklenen iddialar: Kardiyak izlem önerisi (KÜB s.2).\nDoğrulanamayan iddialar: Görüşmede belirtilen izlem sıklığı onaylı kaynakta yer almıyor.", sources: [{ document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 2 }] };
    if (last.includes("örnek temsilci yanıtı")) return { text: "\"Endişenizi çok iyi anlıyorum. Onaylı ürün bilgisinde tedavi öncesi ve tedavi süresince kardiyak değerlendirme öneriliyor. İsterseniz ilgili bölümü birlikte inceleyelim; ayrıntılı veriler için tıbbi bilgi birimimizden size dönüş sağlayabilirim.\"", sources: [{ document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 2 }] };
    if (last.includes("Temsilci yanıtı:")) return { text: "Yanıtınız hekimin endişesini kabul ediyor; bu iyi bir başlangıç. Onaylı kaynağı (KÜB s.2) açıkça anmanız iddianızı güçlendirir. Kesin güvence veren ifadelerden kaçının.", sources: [{ document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 2 }] };
    const prod = products.find(p => (sys + last).includes(p.name)) || products[0];
    const doc = DB.source_documents.find(d => d.product_id === prod.id);
    return { text: `${prod.name} (${prod.molecule}) ${prod.area.toLocaleLowerCase("tr")} alanında kullanılan kurgusal bir demo ürünüdür.\n\nOnaylı ürün bilgisine göre öne çıkan noktalar:\n• ${prod.notes.split("\n")[1]}\n• ${prod.notes.split("\n")[2]}\n\nHekim sorularında yalnızca onaylı kaynaklara dayanın; ayrıntılı klinik sorular için tıbbi bilgi birimine yönlendirin.`,
      sources: doc ? [{ document_id: doc.id, title: doc.title, page: 1 }, { document_id: doc.id, title: doc.title, page: 2 }] : [] };
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts = {}) => {
    if (!String(url).includes("/functions/v1/ai")) return realFetch(url, opts);
    let body = {}; try { body = JSON.parse(opts.body || "{}"); } catch {}
    await new Promise(r => setTimeout(r, 500));
    if (body.health) return new Response(JSON.stringify({ configured: true }), { headers: { "Content-Type": "application/json" } });
    const r = aiReply(body);
    if (!body.stream) return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
    const sse = r.text.match(/[\s\S]{1,24}/g).map(t => "data: " + JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: t } }) + "\n").join("");
    return new Response(sse, { headers: { "Content-Type": "text/event-stream" } });
  };

  /* ---------- İstemci ---------- */
  const session = { user: { id: ME_DEMO.id, email: ME_DEMO.email }, access_token: "demo" };
  window.supabase = { createClient: () => ({
    from: query,
    rpc: (name, args = {}) => Promise.resolve(RPC[name] ? { data: RPC[name](args), error: null } : { data: [], error: null }),
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: {}, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signUp: async () => ({ data: {}, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null })
    },
    functions: { invoke: async () => ({ data: null, error: null }) }
  }) };

  /* ---------- Demo şeridi ---------- */
  window.MEDERA_DEMO = { role: ME_DEMO.job_role };
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("demoBar"); if (!bar) return;
    const roles = [["pjp", "Saha temsilcisi (PJP)"], ["urun_muduru", "Ürün müdürü"], ["avukat", "Avukat"]];
    bar.innerHTML = `<span><b>Demo</b> · Örnek veriler, hiçbir şey kaydedilmez</span>
      <label>Rol: <select id="demoRole">${roles.map(([k, l]) => `<option value="${k}" ${k === ME_DEMO.job_role ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    bar.querySelector("#demoRole").onchange = e => { location.href = location.pathname + "?rol=" + e.target.value + "#/portal"; };
  });
})();
