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
    duel_reward_rules: [], duel_rewards: [],
    field_objections: demoObjections(),
    pv_reports: [
      { id: "pv1", report_no: "PV-2026-00041", reporter_id: PEOPLE.pjp.id, product_id: "p-onk", event: "Hekim, ikinci infüzyondan yaklaşık bir saat sonra bir hastada yaygın kaşıntılı döküntü geliştiğini, tedaviye ara verildiğini söyledi.", serious: "hayir", source: "hekim", hcp_id: "h1", patient_age: "45-64", patient_sex: "kadin", aware_at: iso(-3), status: "in_review", unit_note: "Tıbbi birim hekimle iletişime geçti; takip bilgisi bekleniyor.", created_at: iso(-3) },
      { id: "pv2", report_no: "PV-2026-00027", reporter_id: PEOPLE.pjp.id, product_id: "p-hem", event: "Eczacı, bir hastanın tedavinin ilk haftasında bulantı yaşadığını iletti.", serious: "hayir", source: "eczaci", hcp_id: null, patient_age: "65+", patient_sex: "erkek", aware_at: iso(-24), status: "closed", unit_note: "Bildirim değerlendirildi ve kayda alındı. Teşekkürler.", created_at: iso(-24) }
    ]
  };
  // Son 5 haftaya yayılmış itiraz kayıtları; son haftada Ege'de rakip ürün itirazlarında belirgin bir artış var.
  function demoObjections() {
    const rows = [], add = (d, region, tag, product_id, competitor = null) => rows.push({ id: uid("ob"), user_id: "u-team", product_id, tag, competitor, region, created_at: iso(-d - 0.3) });
    // [bölge, etiket, ürün, sıklık]: sıklık küçüldükçe kayıt artar; hiçbiri tek başına dalga eşiğini geçmez.
    const base = [["Marmara", "fiyat", "p-onk", 2], ["Marmara", "yan_etki", "p-onk", 4], ["İç Anadolu", "erisim", "p-hem", 3], ["Ege", "uygulama", "p-onk", 6],
      ["Akdeniz", "kanit", "p-hem", 5], ["Karadeniz", "fiyat", "p-hem", 7], ["Marmara", "etkinlik", "p-hem", 5], ["İç Anadolu", "yan_etki", "p-onk", 8],
      ["Güneydoğu Anadolu", "erisim", "p-onk", 9], ["Doğu Anadolu", "fiyat", "p-onk", 11], ["Akdeniz", "fiyat", "p-onk", 4], ["Ege", "fiyat", "p-hem", 6],
      ["Karadeniz", "yan_etki", "p-onk", 10], ["İç Anadolu", "kanit", "p-onk", 12]];
    for (let d = 1; d < 35; d += 1) base.forEach(([g, t, p, every], i) => { if ((d + i) % every === 0) add(d, g, t, p); });
    [1, 1, 2, 2, 3, 3, 4, 5, 6].forEach((d, i) => add(d, "Ege", i % 3 ? "rakip" : "etkinlik", "p-onk", i % 3 ? "Velcora" : null));
    [9, 23].forEach(d => add(d, "Ege", "rakip", "p-onk", "Velcora"));
    [2, 6, 12, 19, 27].forEach(d => add(d, "Marmara", "rakip", "p-hem", "Lumetrin"));
    return rows;
  }
  const prodOf = id => products.find(p => p.id === id);
  const examOf = id => exams.find(e => e.id === id);
  // Seçilen alanlarda ürün adını ekleyen basit "join".
  const withJoins = (table, row) => {
    if (table === "user_products") return { ...row, products: prodOf(row.product_id) };
    if (["curricula", "interactions", "source_documents", "pv_reports"].includes(table)) return { ...row, products: row.product_id ? { name: prodOf(row.product_id)?.name } : null };
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
        if (table === "pv_reports") list.forEach(r => Object.assign(r, { report_no: "PV-2026-" + String(++seq).padStart(5, "0"), status: "new" }));
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
  // Onaylanmış örnek mikro eğitim: sesli özet, 3 bilgi kartı ve 5 soru.
  const microQuiz = [
    ["Onkavia hangi sıklıkla uygulanır?", ["3 haftada bir", "Her gün", "Haftada bir", "Ayda bir"], "Kısa ürün bilgisine göre 3 haftada bir intravenöz infüzyon."],
    ["İlk infüzyon ne kadar sürer?", ["90 dakika", "15 dakika", "4 saat", "30 dakika"], "İlk infüzyon 90 dakikadır; tolere edilirse sonrakiler 30 dakikaya iner."],
    ["Tedavi süresince hangi izlem önerilir?", ["Düzenli kardiyak değerlendirme", "Göz muayenesi", "Kemik yoğunluğu ölçümü", "İzlem gerekmez"], "Uyarılar bölümüne göre kardiyak fonksiyon düzenli değerlendirilmelidir."],
    ["İnfüzyon reaksiyonları en sık ne zaman görülür?", ["İlk uygulamada", "Tedavi bitiminde", "Altıncı dozda", "Hiç görülmez"], "Reaksiyonlar ilk uygulamada daha sıktır."],
    ["Şüpheli bir advers etkiyi öğrendiğinizde ne yaparsınız?", ["Farmakovijilans birimine bildiririm", "Bir sonraki ziyarette sorarım", "Not almam", "Hastayı ararım"], "Şüpheli advers etkiler farmakovijilans birimine bildirilmelidir."]
  ];
  fieldUnits.push({ id: "f-micro", kind: "update", title: "Onkavia güncel ürün bilgisi: 3 dakikada", product_id: "p-onk", product: "Onkavia", specialty: "Genel", skill: "Tıbbi doğruluk", version: 1, status: "approved",
    payload: { body: "Kısa ürün bilgisinin güncellenen uygulama ve güvenlilik bölümlerinin özeti.", start: "q1",
      podcast: "Merhaba. Bu kısa özette Onkavia'nın güncellenen ürün bilgisine bakıyoruz. Onkavia, HER2 pozitif metastatik meme kanserinde kullanılan bir monoklonal antikor ve üç haftada bir damar yoluyla uygulanıyor. İlk infüzyon doksan dakika sürüyor; hasta iyi tolere ederse sonraki infüzyonlar otuz dakikaya iniyor. Hekimlerin en sık sorduğu konu güvenlilik. Ürün bilgisi, tedavi öncesinde ve tedavi boyunca kalp fonksiyonunun düzenli değerlendirilmesini öneriyor. İnfüzyonla ilişkili reaksiyonlar en çok ilk uygulamada görülüyor. Sahada bir yan etki duyarsanız, ne kadar küçük görünürse görünsün, uygulamadaki Yan etki bildir düğmesiyle tıbbi birime iletin. Şimdi beş kısa soruyla bilgimizi pekiştirelim.",
      flashcards: [{ title: "3 haftada bir", text: "İntravenöz infüzyon; ilk doz 90, sonrakiler 30 dakika.", page: 1 }, { title: "Kardiyak izlem", text: "Tedavi öncesi ve süresince kalp fonksiyonu düzenli değerlendirilir.", page: 2 }, { title: "İlk infüzyona dikkat", text: "İnfüzyon reaksiyonları en sık ilk uygulamada görülür.", page: 2 }],
      nodes: microQuiz.map(([q, options], i) => ({ id: "q" + (i + 1), prompt: q, choices: options.map(label => ({ label, next: i < 4 ? "q" + (i + 2) : null })) })) },
    sources: [{ document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 1, approved_at: iso(-30) }, { document_id: "d-onk", title: "Onkavia kısa ürün bilgisi", page: 2, approved_at: iso(-30) }],
    keys: Object.fromEntries(microQuiz.map(([, options, why], i) => ["q" + (i + 1), options.map((o, j) => ({ score: j ? 0 : 100, feedback: (j ? "Doğru cevap: " + options[0] + ". " : "Doğru. ") + why }))])) });
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

  /* ---------- Vaka odaları: sanal meslektaşlar odaya katılır, konuşur ve puanlar ---------- */
  const BOTS = { "u-kaan": "Kaan Tekin", "u-sena": "Sena Güneş", "u-burcu": "Burcu Yalın", "u-emre": "Emre Çelik" };
  const botLines = {
    doctor: ["Merhaba, kısaca anlatın; bu ilaç neden ilgimi çeksin?", "Bu sonucu hangi çalışmaya dayandırıyorsunuz, kaç hastayla?", "Peki güvenlilik tarafında ne söyleyebilirsiniz?", "SGK ödemesi ve hastanın katkı payı nasıl?", "Tamam, kaynağı e-postayla gönderin, değerlendiririm."],
    rep: ["Teşekkürler hocam, tek cümleyle: onaylı ürün bilgisine göre üç haftada bir uygulanan bir tedavi.", "Bu bilgi kısa ürün bilgisinin birinci sayfasında; isterseniz birlikte bakalım.", "Güvenlilik için düzenli kardiyak izlem öneriliyor; ilgili bölümü paylaşabilirim.", "Geri ödeme ayrıntısını tıbbi bilgi birimimizden size iletebilirim.", "Kaynağı bugün gönderiyorum; bir sonraki ziyarette sorularınızı konuşalım."]
  };
  const roomsDB = [];
  const newRoom = (creator, scenario, product_id, minutesAgo = 0) => {
    const r = { id: uid("room"), code: Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IO]/g, "K"), creator, product_id, scenario, status: "waiting", turn_limit: 5, created_at: iso(-minutesAgo / 1440), started_at: null, ended_at: null, members: [], messages: [], ratings: [], feedback: null };
    roomsDB.push(r); return r;
  };
  const addMember = (r, user_id) => r.members.push({ user_id, name: user_id === ME_DEMO.id ? ME_DEMO.full_name : BOTS[user_id], role: null, points: 0, joined_at: new Date().toISOString() });
  { const open = newRoom("u-burcu", "rakip", "p-hem", 4); addMember(open, "u-burcu"); addMember(open, "u-emre");
    const old = newRoom(ME_DEMO.id, "kanit", "p-onk", 60 * 26); addMember(old, ME_DEMO.id); addMember(old, "u-kaan"); addMember(old, "u-sena");
    Object.assign(old, { status: "done", started_at: iso(-1.05), ended_at: iso(-1.04) }); old.members[0].role = "rep"; old.members[0].points = 72; old.members[1].role = "doctor"; old.members[1].points = 20; old.members[2].role = "observer"; old.members[2].points = 20;
    old.messages = botLines.doctor.flatMap((d, i) => [{ id: i * 2 + 1, role: "doctor", body: d, at: iso(-1.05) }, { id: i * 2 + 2, role: "rep", body: botLines.rep[i], at: iso(-1.05) }]);
    old.ratings = [{ role: "doctor", scores: { kanit: 4, itiraz: 4, denge: 4, kapanis: 3 }, total: 69, comment: "Kaynağa yönlendirmen iyiydi." }, { role: "observer", scores: { kanit: 4, itiraz: 4, denge: 5, kapanis: 3 }, total: 75, comment: "Kapanışta somut bir tarih verebilirdin." }]; }
  const roomTurn = r => { const last = r.messages.at(-1); return last ? (last.role === "doctor" ? "rep" : "doctor") : "doctor"; };
  const roomFinalize = r => { if (r.members.filter(m => ["doctor", "observer"].includes(m.role)).some(m => !r.ratings.some(x => x.rater === m.user_id))) return;
    const avg = Math.round(r.ratings.reduce((t, x) => t + x.total, 0) / r.ratings.length); r.members.forEach(m => m.points = m.role === "rep" ? avg : 20); r.status = "done"; };
  const roomSay = (r, user_id, body) => { const m = r.members.find(x => x.user_id === user_id); r.messages.push({ id: r.messages.length + 1, role: m.role, body, at: new Date().toISOString() });
    if (m.role === "rep" && r.messages.filter(x => x.role === "rep").length >= r.turn_limit) { r.status = "rating"; r.ended_at = new Date().toISOString(); } roomBots(r); };
  // Sırası gelen sanal katılımcı 1,5 saniye sonra konuşur; puanlama aşamasında puan verir.
  function roomBots(r) {
    setTimeout(() => {
      if (r.status === "live") { const who = r.members.find(m => m.role === roomTurn(r)); if (who && who.user_id !== ME_DEMO.id) roomSay(r, who.user_id, botLines[who.role][r.messages.filter(x => x.role === who.role).length % 5]); }
      if (r.status === "rating") { r.members.filter(m => m.user_id !== ME_DEMO.id && ["doctor", "observer"].includes(m.role) && !r.ratings.some(x => x.rater === m.user_id)).forEach((m, i) => {
        const sc = i ? { kanit: 3, itiraz: 4, denge: 4, kapanis: 3 } : { kanit: 4, itiraz: 4, denge: 5, kapanis: 4 };
        r.ratings.push({ rater: m.user_id, role: m.role, scores: sc, total: Math.round((Object.values(sc).reduce((a, b) => a + b, 0) - 4) * 100 / 16), comment: i ? "İtirazları sakin karşıladın." : "Kaynağa dayanman güven verdi." }); }); roomFinalize(r); }
    }, 1500);
  }
  const roomState = r => ({ room: { ...r, product: prodOf(r.product_id)?.name || null, now: new Date().toISOString(), members: undefined, messages: undefined, ratings: undefined },
    members: r.members.map(m => ({ ...m, rated: r.ratings.some(x => x.rater === m.user_id) })), messages: r.messages,
    ratings: r.ratings.filter(x => r.status === "done" || x.rater === ME_DEMO.id), feedback: r.feedback });

  const RPC = {
    case_room_list: () => ({ open: roomsDB.filter(r => r.status === "waiting" && !r.members.some(m => m.user_id === ME_DEMO.id)).map(r => ({ id: r.id, code: r.code, scenario: r.scenario, product: prodOf(r.product_id)?.name, creator: BOTS[r.creator], members: r.members.length, created_at: r.created_at })),
      mine: roomsDB.filter(r => r.members.some(m => m.user_id === ME_DEMO.id) && r.status !== "cancelled").map(r => { const m = r.members.find(x => x.user_id === ME_DEMO.id); return { id: r.id, code: r.code, scenario: r.scenario, status: r.status, role: m.role, points: m.points, product: prodOf(r.product_id)?.name, created_at: r.created_at }; }).reverse() }),
    case_room_create: ({ p_product, p_scenario }) => { const r = newRoom(ME_DEMO.id, p_scenario, p_product); addMember(r, ME_DEMO.id);
      setTimeout(() => r.status === "waiting" && addMember(r, "u-kaan"), 1500); setTimeout(() => r.status === "waiting" && addMember(r, "u-sena"), 3000); return { id: r.id, code: r.code }; },
    case_room_join: ({ p_code }) => { const r = roomsDB.find(x => x.code === String(p_code).toUpperCase()); if (!r) throw { message: "Oda bulunamadı" };
      if (!r.members.some(m => m.user_id === ME_DEMO.id)) addMember(r, ME_DEMO.id);
      // Odayı kuran sanal katılımcı birkaç saniye içinde başlatır; demoda size hekim rolü düşer.
      setTimeout(() => { if (r.status !== "waiting") return; r.members.forEach(m => m.role = m.user_id === ME_DEMO.id ? "doctor" : m.user_id === r.creator ? "rep" : "observer"); r.status = "live"; r.started_at = new Date().toISOString(); }, 2500); return r.id; },
    case_room_leave: ({ p_room }) => { const r = roomsDB.find(x => x.id === p_room); if (r.creator === ME_DEMO.id) r.status = "cancelled"; else r.members = r.members.filter(m => m.user_id !== ME_DEMO.id); return null; },
    case_room_start: ({ p_room }) => { const r = roomsDB.find(x => x.id === p_room); const roles = ["rep", "doctor", "observer"]; r.members.forEach((m, i) => m.role = roles[i]); r.status = "live"; r.started_at = new Date().toISOString(); roomBots(r); return null; },
    case_room_say: ({ p_room, p_body }) => { const r = roomsDB.find(x => x.id === p_room), m = r.members.find(x => x.user_id === ME_DEMO.id);
      if (r.status !== "live") throw { message: "Görüşme devam etmiyor" }; if (roomTurn(r) !== m.role) throw { message: "Sıra karşı tarafta" }; roomSay(r, ME_DEMO.id, p_body); return null; },
    case_room_end: ({ p_room }) => { const r = roomsDB.find(x => x.id === p_room); r.status = r.messages.some(x => x.role === "rep") ? "rating" : "cancelled"; r.ended_at = new Date().toISOString(); roomBots(r); return null; },
    case_room_rate: ({ p_room, p_scores, p_comment }) => { const r = roomsDB.find(x => x.id === p_room), m = r.members.find(x => x.user_id === ME_DEMO.id);
      r.ratings.push({ rater: ME_DEMO.id, role: m.role, scores: p_scores, total: Math.round((Object.values(p_scores).reduce((a, b) => a + b, 0) - 4) * 100 / 16), comment: p_comment || null }); roomFinalize(r); roomBots(r); return null; },
    case_room_feedback_save: ({ p_room, p_body }) => { const r = roomsDB.find(x => x.id === p_room); r.feedback = r.feedback || p_body; return null; },
    case_room_state: ({ p_room }) => roomState(roomsDB.find(x => x.id === p_room)),
    case_room_leaderboard: () => { const mine = roomsDB.filter(r => r.status === "done").reduce((t, r) => t + (r.members.find(m => m.user_id === ME_DEMO.id)?.points || 0), 0);
      const people = [{ id: "u-sena", name: "Sena Güneş", region: "Ege", points: 214 }, { id: "u-kaan", name: "Kaan Tekin", region: "Marmara", points: 158 }, { id: ME_DEMO.id, name: ME_DEMO.full_name, region: "Marmara", points: mine }, { id: "u-burcu", name: "Burcu Yalın", region: "İç Anadolu", points: 96 }].sort((a, b) => b.points - a.points);
      return { people, regions: [{ region: "Ege", average: 214, people: 1 }, { region: "Marmara", average: Math.round((158 + mine) / 2), people: 2 }, { region: "İç Anadolu", average: 96, people: 1 }] }; },
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
    field_list: ({ p_manage } = {}) => p_manage ? fieldUnits.slice() : fieldUnits.filter(u => u.status === "approved"),
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
    field_review: ({ p_id, p_decision }) => { const u = fieldUnits.find(x => x.id === p_id); if (u) u.status = p_decision; return null; },
    field_save: ({ p_id, p_product, p_kind, p_title, p_skill, p_specialty, p_payload, p_sources, p_keys }) => {
      const id = p_id || uid("f"), u = { id, kind: p_kind, title: p_title, product_id: p_product, product: prodOf(p_product)?.name, specialty: p_specialty, skill: p_skill, version: 1, status: "draft", payload: p_payload, sources: p_sources, keys: p_keys };
      const at = fieldUnits.findIndex(x => x.id === id); at >= 0 ? fieldUnits.splice(at, 1, u) : fieldUnits.unshift(u); return id;
    }, field_edit: ({ p_id }) => fieldUnits.find(u => u.id === p_id) || fieldUnits[0],
    field_source_options: ({ p_product } = {}) => DB.source_documents.filter(d => !p_product || d.product_id === p_product).flatMap(d => d.pages.map(p => ({ document_id: d.id, title: d.title, page: p.page, fingerprint: "demo", approved_at: d.created_at, text: p.text }))),
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
    duel_review_question: () => true, duel_reward_decide: () => true,
    // Sunucudaki objection_heatmap ile aynı kural: son 7 günde en az 5 kayıt ve önceki 4 haftanın haftalık ortalamasının 2 katı.
    objection_heatmap: ({ p_days = 30, p_product = null } = {}) => {
      const scope = ME_DEMO.job_role === "urun_muduru" ? myProducts : null, t = Date.now();
      const rows = DB.field_objections.filter(o => (!scope || scope.includes(o.product_id)) && (!p_product || o.product_id === p_product));
      const recent = rows.filter(o => t - new Date(o.created_at) < p_days * day);
      const count = (list, key) => Object.values(list.reduce((m, o) => { const k = key(o); (m[k] = m[k] || { o, n: 0 }).n++; return m; }, {}));
      const trend = count(rows.filter(o => t - new Date(o.created_at) < 35 * day), o => [o.region, o.tag, o.competitor || ""].join("|")).map(({ o }) => {
        const same = rows.filter(x => x.region === o.region && x.tag === o.tag && (x.competitor || "") === (o.competitor || "") && t - new Date(x.created_at) < 35 * day);
        const cur = same.filter(x => t - new Date(x.created_at) < 7 * day).length;
        return { region: o.region, tag: o.tag, competitor: o.competitor, current: cur, baseline: Math.round((same.length - cur) / 4 * 10) / 10 };
      });
      return {
        days: p_days, total: recent.length,
        cells: count(recent, o => o.region + "|" + o.tag).map(({ o, n }) => ({ region: o.region, tag: o.tag, count: n })),
        competitors: count(recent.filter(o => o.competitor), o => o.competitor).map(({ o, n }) => ({ name: o.competitor, count: n })).sort((a, b) => b.count - a.count),
        alerts: trend.filter(a => a.current >= 5 && a.current >= 2 * Math.max(a.baseline, 1)).sort((a, b) => b.current / Math.max(b.baseline, 1) - a.current / Math.max(a.baseline, 1))
      };
    },
    pv_update: ({ p_id, p_status, p_note }) => { Object.assign(DB.pv_reports.find(r => r.id === p_id), { status: p_status, unit_note: p_note || null }); return null; }
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
    if (sys.includes("Yalnızca geçerli JSON") && last.startsWith("Mikro eğitim hazırla")) {
      const docMsg = (body.messages || []).find(m => m.content.startsWith("BELGE: "))?.content || "", title = (docMsg.match(/^BELGE: (.+?) — bölüm/) || [])[1] || "Kaynak belge";
      const p = products.find(x => title.includes(x.name)) || products[0];
      return { text: JSON.stringify({ title: `${p.name}: yeni yayının öne çıkanları`, summary: `${title} belgesinden saha için hazırlanmış kısa özet (demo).`,
        podcast: `Merhaba. Bu sesli özette ${p.name} ile ilgili güncel belgenin öne çıkan noktalarını dinleyeceksiniz. ${p.notes.split("\n").slice(1).join(" ")} Hekim sorularında yalnızca onaylı kaynaklara dayanın ve ayrıntılı klinik soruları tıbbi bilgi birimine yönlendirin. Şimdi beş kısa soruyla pekiştirelim.`,
        flashcards: [{ title: "Uygulama", text: p.notes.split("\n")[1], page: 1 }, { title: "Sık sorulan konular", text: p.notes.split("\n")[2], page: 1 }, { title: "Güvenlilik", text: "Şüpheli advers etkiler farmakovijilans birimine bildirilir.", page: 2 }],
        quiz: microQuiz.map(([q, options, why]) => ({ q, options, answer: 0, explanation: why, page: 1 })) }) };
    }
    if (sys.includes("Yalnızca geçerli JSON")) {
      const topic = (last.match(/"([^"]+)" konusunda/) || [])[1] || "Pratik";
      const qs = exams[0].questions.slice(0, 3).concat(exams[1].questions.slice(0, 2));
      return { text: JSON.stringify({ title: topic + " — pratik sınavı", questions: qs.map(q => ({ q: q.q, options: q.options, answer: 0, explanation: "Demo sınavı: doğru cevap A şıkkıdır." })) }) };
    }
    if (sys.includes("vaka odası görüşmesidir")) return { text: "Bilimsel doğruluk ve kanıt: Mümessil iddialarını kısa ürün bilgisine dayandırdı (\"Bu bilgi kısa ürün bilgisinin birinci sayfasında\").\nİtiraz karşılama: Güvenlilik sorusunu kabul edip ilgili bölümü önerdi; geri ödeme sorusunu doğru birime yönlendirdi.\nDengeli anlatım: Abartılı ifade veya reçete baskısı yok.\nKapanış: Kaynağı gönderme sözü verdi; bir sonraki ziyaret için somut tarih önermedi.\n\nGelişim önerileri:\n1. Hekimin sorusunu önce kendi cümlenizle teyit edin.\n2. Kanıtı sayfa numarasıyla birlikte sunun.\n3. Görüşmeyi tarihli bir sonraki adımla kapatın." };
    if (sys.includes("hekim rolündesin")) return { text: doctorLines[doctorTurn++ % doctorLines.length] };
    if (sys.includes("saha eğitim koçusun")) return { text: "İtiraz karşılama: 78/100 — Hekimin güvenlilik endişesini kabul edip onaylı kaynağa yönlendirdiniz (\"ilgili bölümü birlikte inceleyebiliriz\").\nİletişim yapısı: 72/100 — Açık sorular sordunuz; görüşmeyi bir sonraki adımla kapatmayı unutmayın.\n\nGüçlü yönler:\n• Kanıta dayalı ve dengeli dil\n• Bilmediğiniz ayrıntıda tıbbi bilgi birimine yönlendirme\n\nGeliştirilecekler:\n• Karşılaştırma sorularında kanıt düzeyini netleştirin\n• Görüşme sonunda somut bir takip önerin\nZAYIF KONU: güvenlilik" };
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
    rpc: (name, args = {}) => { try { return Promise.resolve(RPC[name] ? { data: RPC[name](args), error: null } : { data: [], error: null }); } catch (e) { return Promise.resolve({ data: null, error: { message: e.message || String(e) } }); } },
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
