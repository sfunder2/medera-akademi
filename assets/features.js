/* Document library, revision history, audit and personalized revision. */
const TR_CITIES = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kırıkkale','Kırklareli','Kırşehir','Kilis','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'];
function safeSourceUrl(url) { try { const u=new URL(url); return ['http:','https:'].includes(u.protocol)?u.href:null; } catch {return null;} }
function sourceLinks(sources) {
 return (sources||[]).map(s=>`<button class="linkbtn source-page" data-doc="${esc(s.document_id)}" data-page="${s.page}">${esc(s.title)} · s. ${s.page}</button>`).join('<br>');
}
function bindSourceLinks(root=document) {
 $$('.source-page',root).forEach(b=>b.onclick=()=>showSourcePage(b.dataset.doc,+b.dataset.page));
}
async function showSourcePage(id,page) {
 try { const d=check(await sb.from('source_documents').select('*').eq('id',id).single());
 const p=d.pages.find(p=>p.page===page); if(!p) return toast('Sayfa bulunamadı');
 const url=safeSourceUrl(d.source_url);
 const box=dialog(`<h2>${esc(d.title)} · Sayfa ${page}</h2><p style="white-space:pre-wrap;margin:16px 0">${esc(p.text)}</p>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Orijinal belgeyi aç</a>`:''}<div class="row end"><button class="btn close-source">Kapat</button></div>`,{wide:true});
 $('.close-source',box).onclick=()=>box.remove(); } catch{}
}
async function vBelgeler() {
 app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try {
 const docs=check(await sb.from('source_documents').select('*,products(name)').order('created_at',{ascending:false}));
 const manager=ME.role==='admin', reviewer=manager||ME.job_role==='avukat';
 app.innerHTML=`<div class="page-head"><div class="grow"><h1>Kaynak belgeleri</h1><p class="muted">Belge metinleri özgün sayfa numaralarıyla saklanır. Asistan yalnızca onaylı sürümleri kullanır.</p></div>${manager?'<button class="btn" id="newDoc">Belge ekle</button>':''}</div>
 ${docs.length?docs.map(d=>`<div class="panel"><div class="row"><div class="grow"><h2>${esc(d.title)}</h2><p class="muted small">${esc(d.products?.name||'Genel')} · ${d.pages.length} sayfa</p></div>${reviewPill(d.status)}${manager?`<button class="btn ghost sm" data-doc-edit="${d.id}">Düzenle</button>`:''}</div>
 <details><summary>Sayfaları incele</summary>${d.pages.map(p=>`<details style="margin:12px 0"><summary>Sayfa ${p.page}</summary><p style="white-space:pre-wrap">${esc(p.text)}</p></details>`).join('')}</details>
 ${d.review_note?`<p class="notice">${esc(d.review_note)}</p>`:''}
 <div class="row end">${manager&&['draft','rejected'].includes(d.status)?`<button class="btn ghost" data-doc-send="${d.id}">Hukuk incelemesine gönder</button>`:''}
 ${reviewer&&d.status==='in_review'?`<button class="btn" data-doc-decision="approved" data-id="${d.id}">Onayla</button><button class="btn danger" data-doc-decision="rejected" data-id="${d.id}">Reddet</button>`:''}</div></div>`).join(''):'<div class="panel"><p>Henüz kaynak belge eklenmemiş. Onaylı ürün belgesi eklendiğinde kaynaklı asistan kullanılabilir.</p></div>'}`;
 if(manager) $('#newDoc').onclick=()=>documentDialog();
 $$('[data-doc-edit]').forEach(b=>b.onclick=()=>documentDialog(docs.find(d=>d.id===b.dataset.docEdit)));
 $$('[data-doc-send]').forEach(b=>b.onclick=async()=>{try {check(await sb.from('source_documents').update({status:'in_review'}).eq('id',b.dataset.docSend)); await vBelgeler();}catch{}});
 $$('[data-doc-decision]').forEach(b=>b.onclick=async()=>{
 const note=b.dataset.docDecision==='rejected'?prompt('Ret gerekçesi'):''; if(note===null)return;
 if(b.dataset.docDecision==='rejected'&&!note.trim())return toast('Ret gerekçesi gerekli');
 try{check(await sb.rpc('review_document',{p_id:b.dataset.id,p_decision:b.dataset.docDecision,p_note:note||null}));await vBelgeler();}catch{}
 });
 }catch{app.innerHTML='<div class="panel">Belgeler yüklenemedi.</div>';}
}
async function documentDialog(doc={}) {
 const products=check(await sb.from('products').select('id,name').order('name'));
 const pages=JSON.parse(JSON.stringify(doc.pages||[{page:1,text:''}]));
 const box=dialog(`<h2>${doc.id?'Belgeyi düzenle':'Kaynak belge ekle'}</h2>
 <div class="field"><label>Belge adı</label><input id="docTitle" value="${esc(doc.title)}"></div>
 <div class="field"><label>Ürün</label><select id="docProduct"><option value="">Genel belge</option>${products.map(p=>`<option value="${p.id}" ${doc.product_id===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
 <div class="field"><label>Orijinal belge adresi (isteğe bağlı)</label><input id="docUrl" type="url" value="${esc(doc.source_url)}"></div>
 <p class="muted small">Belgedeki metni sayfa sayfa ekleyin; orijinal sayfa numaralarını koruyun. TXT içeriğini de bir sayfaya aktarabilirsiniz.</p>
 <div class="field"><label>Metin dosyası (.txt)</label><input type="file" accept=".txt,text/plain" id="docFile"></div>
 <div id="docPages"></div><button class="btn ghost" id="addDocPage">Sayfa ekle</button>
 <div class="row end" style="margin-top:14px"><button class="btn ghost" id="cancelDoc">Vazgeç</button><button class="btn" id="saveDoc">Taslağı kaydet</button></div>`,{wide:true});
 function render(){ $('#docPages',box).innerHTML=pages.map((p,i)=>`<div class="qedit"><div class="field"><label>Orijinal sayfa numarası</label><input type="number" min="1" data-pnum="${i}" value="${p.page}"></div><div class="field"><label>Sayfa metni</label><textarea rows="6" maxlength="12000" data-ptext="${i}">${esc(p.text)}</textarea></div><button class="btn danger sm" data-prm="${i}">Sayfayı kaldır</button></div>`).join('');
 $$('[data-pnum]',box).forEach(x=>x.oninput=()=>pages[+x.dataset.pnum].page=+x.value);
 $$('[data-ptext]',box).forEach(x=>x.oninput=()=>pages[+x.dataset.ptext].text=x.value);
 $$('[data-prm]',box).forEach(x=>x.onclick=()=>{pages.splice(+x.dataset.prm,1);render();}); }
 render(); $('#addDocPage',box).onclick=()=>{pages.push({page:Math.max(0,...pages.map(p=>p.page))+1,text:''});render();};
 $('#docFile',box).onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>12000)return toast('Tek sayfa için dosya en fazla 12 KB olmalı; büyük metni sayfalara bölün.');pages.push({page:Math.max(0,...pages.map(p=>p.page))+1,text:await f.text()});if(pages[0]?.text==='')pages.shift();render();};
 $('#cancelDoc',box).onclick=()=>box.remove();
 $('#saveDoc',box).onclick=async()=>{
 const title=$('#docTitle',box).value.trim(),url=$('#docUrl',box).value.trim();
 if(!title||!pages.length||pages.some(p=>!Number.isInteger(p.page)||p.page<1||!p.text.trim())||new Set(pages.map(p=>p.page)).size!==pages.length)return toast('Başlık, metinler ve benzersiz sayfa numaraları gerekli');
 if(url&&!safeSourceUrl(url))return toast('Geçerli http/https adresi yazın');
 const row={title,product_id:$('#docProduct',box).value||null,source_url:url||null,pages};
 try{check(doc.id?await sb.from('source_documents').update(row).eq('id',doc.id):await sb.from('source_documents').insert(row));box.remove();toast('Belge taslak olarak kaydedildi');vBelgeler();}catch{}
 };
}
async function vIslemGecmisi() {
 app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try{const rows=check(await sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200));
 const users=check(await sb.from('profiles').select('id,full_name,email'));
 app.innerHTML=`<div class="page-head"><h1>İşlem geçmişi</h1></div><div class="panel"><p class="muted">Son 200 işlem. Kayıtlar uygulamadan değiştirilemez. Hassas hekim notları yerine değişen alan adları tutulur.</p><div class="tablewrap"><table class="t"><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Kayıt</th><th>Değişen alanlar</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('tr-TR')}</td><td>${esc(users.find(u=>u.id===r.actor_id)?.full_name||users.find(u=>u.id===r.actor_id)?.email||'Sistem')}</td><td>${({INSERT:'Ekleme',UPDATE:'Değişiklik',DELETE:'Silme'})[r.action]||esc(r.action)}</td><td>${esc(r.entity)}<br><small>${esc(r.entity_id)}</small></td><td>${esc((r.changes||[]).join(', '))}</td></tr>`).join('')}</tbody></table></div>${rows.length?'':'<p>Henüz işlem yok.</p>'}</div>`;
 }catch{app.innerHTML='<div class="panel">İşlem geçmişi yüklenemedi.</div>';}
}
async function contentHistoryDialog(kind,id){
 try{const rows=check(await sb.from('content_history').select('*').eq('kind',kind).eq('content_id',id).order('saved_at',{ascending:false}));
 const box=dialog(`<h2>Önceki içerik sürümleri</h2><p class="muted">Atanmış sınavlar atama anındaki sürümle değerlendirilir.</p>${rows.map(r=>`<details style="margin:14px 0"><summary>${new Date(r.saved_at).toLocaleString('tr-TR')} · ${esc(r.snapshot.title)}</summary>${r.snapshot.questions?r.snapshot.questions.map((q,i)=>`<p>${i+1}. ${esc(q.q)}</p><ol type="A">${q.options.map(o=>`<li>${esc(o)}</li>`).join('')}</ol>`).join(''):r.snapshot.modules?renderModules(r.snapshot.modules):''}<p class="muted">Onay: ${esc(r.snapshot.review_status||r.snapshot.status)}</p></details>`).join('')||'<p>Henüz önceki sürüm yok.</p>'}<div class="row end"><button class="btn close-history">Kapat</button></div>`,{wide:true});$('.close-history',box).onclick=()=>box.remove();}catch{}
}
async function vOgrenme(){
 app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try{const items=check(await sb.rpc('learning_plan'));
 const areas=[...new Set(items.map(x=>x.area||'Genel'))];
 app.innerHTML=`<div class="page-head"><div><h1>Kişisel öğrenme planım</h1><p class="muted">Tamamlanan sınavlardaki yanlış ve boş cevaplara göre hazırlanır. Son 100 eksik konu gösterilir.</p></div></div><div class="panel"><h2>Önerilen çalışma sırası</h2>${areas.map(a=>`<p><b>${esc(a)}</b> · ${items.filter(x=>(x.area||'Genel')===a).length} tekrar sorusu</p>`).join('')||'<p>Henüz tekrar gerektiren soru yok. Atanmış sınavları tamamladıkça planın oluşur.</p>'}</div>
 ${items.map((x,i)=>`<div class="panel"><p class="muted small">${esc(x.area||'Genel')} · ${esc(x.exam_title)}</p><h3>${esc(x.question)}</h3><div id="practice-${i}" style="margin-top:12px">${x.options.map((o,j)=>`<button class="opt" data-learn="${i}" data-option="${j}"><span class="k">${'ABCD'[j]||j+1}</span>${esc(o)}</button>`).join('')}</div><p id="feedback-${i}" class="expl" hidden></p></div>`).join('')}`;
 $$('[data-learn]').forEach(b=>b.onclick=()=>{const i=+b.dataset.learn,x=items[i],ok=+b.dataset.option===x.correct;$$('button',$('#practice-'+i)).forEach(n=>{n.disabled=ok;n.classList.toggle('right',ok&&+n.dataset.option===x.correct);});const f=$('#feedback-'+i);f.hidden=false;f.textContent=ok?'Doğru. '+(x.explanation||'Bu konuyu tekrar ettin.'):'Tekrar dene. Önce seçenekleri karşılaştır.';});
 }catch{app.innerHTML='<div class="panel">Öğrenme planı yüklenemedi.</div>';}
}

