/* Source-approved field exercises and durable learning routes. */
const FIELD_KINDS={objection:'İtiraz kartları',branch:'Dallanan görüşmeler',errors:'Hatalı sunumu bul',comparison:'Ürün karşılaştırmaları',visit:'Ziyaret hazırlığı',update:'Mikro eğitim'};
const FIELD_SKILLS=['Tıbbi doğruluk','Kanıt kullanımı','İtiraz karşılama','Dengeli anlatım','Soru sorma'];
let fieldGeneration=0;
const fieldProducts=()=>typeof A!=='undefined'?A.products:D.products;
const fieldManager=()=>ME.role==='admin'||ME.job_role==='urun_muduru';
const fieldReviewer=()=>ME.role==='admin'||ME.job_role==='avukat';
function fieldFailure(e){return `<div class="panel"><h2>Çalışma alanı açılamadı</h2><p>${esc(e.message||'Bağlantı hatası')}</p><p class="muted">Yeni çalışma modülü henüz etkinleştirilmemiş olabilir. Diğer bölümleri kullanabilirsiniz.</p><button class="btn ghost" onclick="vField()">Tekrar dene</button></div>`;}
async function fieldRPC(name,args={}){const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;}
async function vField(mode='library'){
 // Bugün listesinden açılan mikro eğitim doğrudan başlar.
 if(mode==='library'&&globalThis.fieldRunNext){const id=globalThis.fieldRunNext;globalThis.fieldRunNext=null;return fieldRun(id);}
 const generation=++fieldGeneration;
 app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try{
 const [units,history]=await Promise.all([fieldRPC('field_list',{p_manage:mode==='manage'}),fieldRPC('field_history')]);
 if(generation!==fieldGeneration)return;
 const title=mode==='manage'?'İçerik atölyesi':mode==='plan'?'Kişisel gelişim rotam':'Saha senaryoları';
 app.innerHTML=`<div class="page-head"><div class="grow"><h1>${title}</h1><p class="muted">Onaylı kaynaklarla kısa alıştırmalar, hazırlık kartları ve gelişim takibi.</p></div>${mode==='manage'&&fieldManager()?'<button class="btn ghost" id="fieldMicro">Yayından mikro eğitim üret</button><button class="btn" id="fieldNew">İçerik hazırla</button>':''}</div>
 <div class="seg"><button data-field="library">Çalışmalar</button><button data-field="plan">Gelişim rotam</button><button data-field="notices">Ürün değişiklikleri</button>${fieldManager()||fieldReviewer()?'<button data-field="manage">İçerik atölyesi</button>':''}${fieldManager()?'<button data-field="heatmap">Beceri haritası</button>':''}</div><div id="fieldBody"></div>`;
 $$('[data-field]').forEach(b=>{b.classList.toggle('on',b.dataset.field===mode);b.onclick=()=>b.dataset.field==='notices'?vFieldNotices():b.dataset.field==='heatmap'?vFieldHeatmap():vField(b.dataset.field);});
 if($('#fieldNew'))$('#fieldNew').onclick=()=>fieldEditor();
 if($('#fieldMicro'))$('#fieldMicro').onclick=()=>fieldMicro();
 if(mode==='plan'){await fieldPlan(units,history,generation);return;}
 const kinds=Object.entries(FIELD_KINDS);
 $('#fieldBody').innerHTML=`<div class="row" style="margin:16px 0"><select class="auto" id="fieldKind"><option value="">Tüm çalışmalar</option>${kinds.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select class="auto" id="fieldProduct"><option value="">Tüm ürünler</option>${fieldProducts().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><input type="search" id="fieldSearch" placeholder="Başlık, beceri, uzmanlık ara" style="flex:1;min-width:180px"></div><div id="fieldCards"></div>`;
 const render=()=>{const q=$('#fieldSearch').value.toLocaleLowerCase('tr');const list=units.filter(u=>(!$('#fieldKind').value||u.kind===$('#fieldKind').value)&&(!$('#fieldProduct').value||u.product_id===$('#fieldProduct').value)&&(u.title+' '+u.skill+' '+u.specialty).toLocaleLowerCase('tr').includes(q));
 $('#fieldCards').innerHTML=list.length?list.map(u=>fieldCard(u,mode,history)).join(''):'<div class="panel"><h2>Henüz çalışma yok</h2><p class="muted">Ürünün yöneticisi onaylı belgelere dayanarak içerik hazırladığında burada görünür.</p></div>';
 fieldBind(units,mode);};
 $('#fieldKind').onchange=render;$('#fieldProduct').onchange=render;$('#fieldSearch').oninput=render;render();
 }catch(e){if(generation===fieldGeneration)app.innerHTML=fieldFailure(e);}
}
function fieldCard(u,mode,history=[]){const last=history.find(h=>h.unit_id===u.id);return `<div class="panel"><div class="row"><div class="grow"><span class="pill">${FIELD_KINDS[u.kind]}</span><h2>${esc(u.title)}</h2><p class="muted small">${esc(u.product||'')} · ${esc(u.specialty)} · ${esc(u.skill)} · Sürüm ${u.version}</p></div>${mode==='manage'?reviewPill(u.status):last?`<span class="pill ${last.score===null?'':last.score>=70?'ok':'wait'}">${last.score===null?'Okundu':'Son puan: '+last.score}</span>`:''}</div>
 ${mode==='manage'?`<details><summary>İçerik ve kaynaklar</summary><p style="white-space:pre-wrap">${esc(u.payload.body||'')}</p>${(u.payload.nodes||[]).map(n=>`<p><b>${esc(n.prompt)}</b></p><ul>${n.choices.map(c=>`<li>${esc(c.label)}${c.next?' → '+esc(c.next):''}${u.keys?' — Puan '+esc(u.keys[n.id]?.[n.choices.indexOf(c)]?.score)+' · '+esc(u.keys[n.id]?.[n.choices.indexOf(c)]?.feedback):''}</li>`).join('')}</ul>`).join('')}${fieldReading(u.payload)}${fieldCitations(u.sources)}</details>${u.review_note?`<p class="notice">${esc(u.review_note)}</p>`:''}<div class="row end">${fieldManager()?`<button class="btn ghost" data-field-edit="${u.id}">Düzenle</button>`:''}${fieldManager()&&['draft','rejected'].includes(u.status)?`<button class="btn" data-field-send="${u.id}">Hukuk incelemesine gönder</button>`:''}${fieldReviewer()&&u.status==='in_review'?`<button class="btn ghost" data-field-decide="${u.id}" data-decision="rejected">Reddet</button><button class="btn" data-field-decide="${u.id}" data-decision="approved">Onayla</button>`:''}</div>`:`<button class="btn" data-field-run="${u.id}">${['comparison','visit'].includes(u.kind)?'Kartı aç':'Çalışmaya başla'}</button>`}</div>`;}
function fieldBind(units,mode){
 bindSourceLinks();$$('[data-field-run]').forEach(b=>b.onclick=()=>fieldRun(b.dataset.fieldRun));
 $$('[data-field-edit]').forEach(b=>b.onclick=()=>fieldEditor(b.dataset.fieldEdit));
 $$('[data-field-send]').forEach(b=>b.onclick=async()=>{busyBtn(b,true);try{await fieldRPC('field_review',{p_id:b.dataset.fieldSend,p_decision:'in_review'});vField('manage');}catch(e){toast(e.message);busyBtn(b,false);}});
 $$('[data-field-decide]').forEach(b=>b.onclick=()=>{
 const d=dialog(`<h2>${b.dataset.decision==='approved'?'İçeriği onayla':'İçeriği reddet'}</h2><p class="muted">Kaynakları, iddiaları ve doğru/yanlış yanıtların açıklamalarını kontrol edin.</p><div class="field"><label for="fieldNote">İnceleme notu</label><textarea id="fieldNote" maxlength="2000"></textarea></div><button class="btn" id="fieldDecision">Kararı kaydet</button>`);
 $('#fieldDecision',d).onclick=async()=>{const note=$('#fieldNote',d).value.trim();if(b.dataset.decision==='rejected'&&!note)return toast('Ret gerekçesi yazın');try{await fieldRPC('field_review',{p_id:b.dataset.fieldDecide,p_decision:b.dataset.decision,p_note:note});d.remove();vField('manage');}catch(e){toast(e.message);}};
 });
}
async function fieldRun(id){
 const generation=++fieldGeneration;app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try{
 const started=await fieldRPC('field_start',{p_id:id});if(generation!==fieldGeneration)return;
 const u=started.unit;let answers=[],current=u.payload.start,seen=new Set(),done=false;
 app.innerHTML=`<div class="page-head"><div><h1>${esc(u.title)}</h1><p class="muted">${FIELD_KINDS[u.kind]} · ${esc(u.skill)} · Sürüm ${u.version}</p></div></div><div class="panel"><p style="white-space:pre-wrap">${esc(u.payload.body||'')}</p><div style="margin-top:12px">${fieldCitations(u.sources)}</div>${fieldReading(u.payload)}</div><div class="panel" id="fieldStep"></div><button class="btn ghost" onclick="vField()">Çalışma merkezine dön</button>`;
 bindSourceLinks();
 const submit=async()=>{if(done)return;const button=$('#fieldSubmit');if(button)busyBtn(button,true);try{
 const result=await fieldRPC('field_submit',{p_attempt:started.attempt_id,p_answers:answers});if(generation!==fieldGeneration)return;done=true;
 $('#fieldStep').innerHTML=`<h2>${result.score===null?'Okuma tamamlandı':'Puanınız: '+result.score+'/100'}</h2><p class="muted small">Puan, onaylanan senaryonun önceden tanımlı seçenek anahtarından sunucuda hesaplandı. Yazılı AI geri bildirimi puana dahil değildir.</p>${(result.feedback||[]).map(f=>`<div class="review-card"><b>${esc(f.prompt)}</b><p>Seçiminiz: ${esc(f.choice)}</p><p>${esc(f.feedback)}</p><span class="pill">${f.score}/100</span></div>`).join('')}<div class="row"><button class="btn" id="fieldAgain">Tekrar çalış</button><button class="btn ghost" id="fieldPlan">Gelişim rotam</button></div>`;
 $('#fieldAgain').onclick=()=>fieldRun(id);$('#fieldPlan').onclick=()=>vField('plan');
 }catch(e){toast(e.message);if(button)busyBtn(button,false);}};
 const render=()=>{
 if(!current){$('#fieldStep').innerHTML='<h2>Çalışma tamamlandı</h2><button class="btn" id="fieldSubmit">'+(answers.length?'Yanıtları kaydet ve değerlendir':'Okumayı tamamladım')+'</button>';$('#fieldSubmit').onclick=submit;return;}
 const n=u.payload.nodes.find(n=>n.id===current);
 if(!n||seen.has(current)){$('#fieldStep').textContent='Senaryoda döngü veya eksik adım var. İçerik yöneticisine bildirin.';return;}
 $('#fieldStep').innerHTML=`<p class="small muted">Adım ${answers.length+1}</p><h2>${esc(n.prompt)}</h2>${u.kind==='objection'?'<div class="field"><label for="fieldWritten">Önce kendi yanıtınızı yazın (isteğe bağlı)</label><textarea id="fieldWritten" maxlength="4000" rows="3"></textarea><button class="btn ghost sm" id="fieldCoach">Kaynaklara göre geri bildirim al</button><p id="fieldCoachText" style="white-space:pre-wrap" role="status"></p></div>':''}<p class="muted small">Aşağıdaki yanıtı seçin. Puan bu seçenek üzerinden hesaplanır.</p><div class="list" style="margin-top:16px">${n.choices.map((c,i)=>`<button class="btn ghost" data-field-choice="${i}" style="text-align:left;white-space:normal">${esc(c.label)}</button>`).join('')}</div>`;
 const coach=$('#fieldCoach');if(coach)coach.onclick=async()=>{const written=$('#fieldWritten').value.trim();if(!written)return toast('Önce yanıtınızı yazın');busyBtn(coach,true);const target=$('#fieldCoachText');try{const text=await ai({grounded:true,productId:u.product_id,messages:[{role:'user',content:u.title+' — İtiraz: '+n.prompt+'\nTemsilci yanıtı: '+written+'\nBu yanıtı onaylı kaynaklara göre değerlendir. Eksik kanıtları belirt; puan verme.'}],maxTokens:1200});if(generation===fieldGeneration&&target.isConnected)target.textContent=text;}catch(e){if(target.isConnected)target.textContent=aiError(e);}finally{if(coach.isConnected)busyBtn(coach,false);}};
 $$('[data-field-choice]').forEach(b=>b.onclick=()=>{const choice=+b.dataset.fieldChoice;answers.push({node:current,choice,text:$('#fieldWritten')?.value||''});seen.add(current);current=n.choices[choice].next||null;render();});
 };render();
 }catch(e){if(generation===fieldGeneration)app.innerHTML=fieldFailure(e);}
}
function fieldWeaknesses(history){const groups=new Map();for(const h of history){if(h.score===null)continue;const key=h.product_id+'|'+h.skill;const a=groups.get(key)||{product_id:h.product_id,skill:h.skill,values:[]};if(a.values.length<5)a.values.push(h.score);groups.set(key,a);}return [...groups.values()].map(a=>({...a,average:Math.round(a.values.reduce((s,x)=>s+x,0)/a.values.length)})).filter(a=>a.average<70).sort((a,b)=>a.average-b.average);}
async function fieldPlan(units,history,generation){
 const weak=fieldWeaknesses(history);let examErrors=[];try{examErrors=await fieldRPC('learning_plan');}catch{}
 if(generation!==fieldGeneration)return;
 const reason=u=>weak.some(w=>w.product_id===u.product_id&&w.skill===u.skill)?'Düşük puanlı becerinizi tekrar çalışın':examErrors.some(e=>e.area&&e.area===fieldProducts().find(p=>p.id===u.product_id)?.area)?'Sınavda hata yaptığınız tedavi alanında çalışma':history.some(h=>h.unit_id===u.id&&h.version===u.version)?'Tekrar ve pekiştirme':'Henüz çalışmadığınız içerik sürümü';
 const recommended=fieldRecommendations(units,history,examErrors,fieldProducts());
 $('#fieldBody').innerHTML=`<div class="panel"><h2>Bir sonraki çalışma</h2><p class="muted">Son beş çalışma puanı, eksik beceriler ve henüz çalışılmamış sürümler birlikte dikkate alınır. 70 puanın altındaki beceriler tekrar önerilir.</p>${weak.map(w=>`<p><span class="pill wait">${w.average}/100</span> ${esc(fieldProducts().find(p=>p.id===w.product_id)?.name||'Ürün')} — ${esc(w.skill)}</p>`).join('')||'<p>Henüz belirgin bir eksik beceri yok. Yeni çalışmalarla başlayın.</p>'}</div>
 ${examErrors.length?`<div class="panel"><h2>Sınavlardan tekrar edilecekler</h2><p>${examErrors.length} yanlış veya boş cevap için mevcut öğrenme planında tekrar soruları var.</p><a class="btn ghost" href="#/ogrenme">Sınav tekrarlarını aç</a></div>`:''}
 <div class="panel"><h2>Önerilen sıra</h2><p>1. Kaynak sayfasını okuyun · 2. Alıştırmayı tamamlayın · 3. Geri bildirime göre tekrar edin.</p></div>
 ${recommended.slice(0,8).map(u=>'<p class="small muted">'+esc(reason(u))+'</p>'+fieldCard(u,'library',history)).join('')||'<div class="panel">Onaylı çalışma eklendiğinde rotanız burada oluşur.</div>'}
 <div class="panel"><h2>Çalışma geçmişim</h2>${history.length?`<div class="tablewrap"><table class="t"><thead><tr><th>Çalışma</th><th>Sürüm</th><th>Puan</th><th>Tarih</th></tr></thead><tbody>${history.slice(0,40).map(h=>`<tr><td>${esc(h.title)}</td><td>${h.version}</td><td>${h.score??'Okundu'}</td><td>${fmtDate(h.completed_at)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Henüz tamamlanan çalışma yok.</p>'}</div>`;
 fieldBind(units,'library');
}
async function vFieldNotices(){
 const generation=++fieldGeneration;app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try{const notices=await fieldRPC('field_notifications');const units=await fieldRPC('field_list');if(generation!==fieldGeneration)return;
 app.innerHTML=`<div class="page-head"><div><h1>Ürün değişiklikleri</h1><p class="muted">Yeni onaylanan kaynak sürümleri ve bunlara bağlı kontrol çalışmaları.</p></div></div>${notices.map(n=>`<div class="panel"><div class="row"><h2 class="grow">${esc(n.title)}</h2><span class="pill ${n.read_at?'ok':'wait'}">${n.read_at?'Okundu':'Yeni'}</span></div><p class="muted">${esc(n.product||'Genel')} · ${fmtDate(n.created_at)}</p><p>Yeni onaylı belge sürümü. Aşağıdaki güncel sayfaları inceleyin.</p><p class="small">${(n.changes||[]).map(c=>'Sayfa '+esc(c.page)+': '+({added:'eklendi',removed:'kaldırıldı',edited:'değişti'}[c.type]||'güncellendi')).join(' · ')}</p>${sourceLinks(n.pages.map(p=>({document_id:n.document_id,title:n.title,page:p.page})))}${!n.read_at?`<button class="btn ghost" data-notice="${n.id}" style="margin-top:12px">Okudum</button>`:''}</div>`).join('')||'<div class="panel"><p>Henüz yeni bir belge onayı yok. Bildirimler modül etkinleştirildikten sonraki onaylardan oluşur.</p></div>'}<h2>Bilgi kontrolü</h2>${units.filter(u=>u.kind==='update').map(u=>fieldCard(u,'library')).join('')||'<p class="muted">Ürün yöneticisi değişiklik için kısa kontrol çalışması hazırlayabilir.</p>'}<button class="btn ghost" onclick="vField()">Çalışma merkezine dön</button>`;
 bindSourceLinks();fieldBind(units,'library');$$('[data-notice]').forEach(b=>b.onclick=async()=>{try{await fieldRPC('field_notifications',{p_read:b.dataset.notice});vFieldNotices();}catch(e){toast(e.message);}});
 }catch(e){if(generation===fieldGeneration)app.innerHTML=fieldFailure(e);}
}
async function vFieldHeatmap(){const generation=++fieldGeneration;app.innerHTML='<div class="center"><span class="spin"></span></div>';
 try{const rows=await fieldRPC('field_heatmap');if(generation!==fieldGeneration)return;
 app.innerHTML=`<div class="page-head"><div><h1>Ekip beceri haritası</h1><p class="muted">Yetkiniz olan ürünlerdeki çalışma sonuçları. Puanlar eğitim ihtiyaçlarını gösterir.</p></div></div><div class="panel"><div class="row"><select id="heatProduct" class="auto"><option value="">Tüm ürünler</option>${[...new Map(rows.map(r=>[r.product_id,r.product])).entries()].map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select><button class="btn ghost" id="heatCsv">CSV indir</button></div><div id="heatRows"></div></div><button class="btn ghost" onclick="vField()">Çalışma merkezine dön</button>`;
 const filtered=()=>rows.filter(r=>!$('#heatProduct').value||r.product_id===$('#heatProduct').value);
 const render=()=>{$('#heatRows').innerHTML=filtered().length?`<div class="tablewrap"><table class="t"><thead><tr><th>PJP</th><th>Ürün</th><th>Beceri</th><th>Deneme</th><th>Ortalama</th><th>Son çalışma</th></tr></thead><tbody>${filtered().map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.product)}</td><td>${esc(r.skill)}</td><td>${r.attempts}</td><td><span class="pill ${r.average>=70?'ok':'wait'}">${r.average}/100</span></td><td>${fmtDate(r.last_practice)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Henüz puanlanan çalışma yok.</p>';};
 $('#heatProduct').onchange=render;$('#heatCsv').onclick=()=>downloadCSV('ekip-beceri-haritasi.csv',[['PJP','Ürün','Beceri','Deneme','Ortalama','Son çalışma'],...filtered().map(r=>[r.name,r.product,r.skill,r.attempts,r.average,r.last_practice])]);render();
 }catch(e){if(generation===fieldGeneration)app.innerHTML=fieldFailure(e);}
}
async function fieldEditor(id=null){
 try{
 const existing=id?await fieldRPC('field_edit',{p_id:id}):null;
 const d=dialog(`<h2>${id?'İçeriği düzenle':'Yeni saha çalışması'}</h2><p class="muted small">Kaydetme içeriği taslağa döndürür; yeniden hukuk onayı gerekir. Her iddiayı seçilen kaynak sayfalarıyla kontrol edin.</p>
 <div class="grid2"><div class="field"><label for="feProduct">Ürün</label><select id="feProduct">${fieldProducts().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label for="feKind">Çalışma türü</label><select id="feKind">${Object.entries(FIELD_KINDS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div></div>
 <div class="field"><label for="feTitle">Başlık</label><input id="feTitle" maxlength="200"></div>
 <div class="grid2"><div class="field"><label for="feSkill">Hedef beceri</label><select id="feSkill">${FIELD_SKILLS.map(s=>`<option>${s}</option>`).join('')}</select></div><div class="field"><label for="feSpecialty">Uzmanlık</label><select id="feSpecialty"><option>Genel</option>${SPECS.map(s=>`<option>${s}</option>`).join('')}</select></div></div>
 <div class="field"><label for="feBody">Giriş / sunum metni / değişiklik özeti</label><textarea id="feBody" rows="4" maxlength="8000" placeholder="Onaylı kaynaklara dayalı içerik"></textarea></div>
 <div id="feExtras"></div><div id="feNodes"></div><button class="btn ghost" id="feAdd">Alıştırma adımı ekle</button>
 <h3 style="margin-top:20px">Onaylı kaynak sayfaları</h3><div id="feSources" style="max-height:220px;overflow:auto"></div><p id="feStatus" role="status"></p><div class="row end"><button class="btn ghost" id="feCancel">Vazgeç</button><button class="btn" id="feSave">Taslak kaydet</button></div>`,{wide:true});
 if(!fieldProducts().length){$('#feStatus',d).textContent='Önce size bir ürün atanmalı.';$('#feSave',d).disabled=true;return;}
 const get=s=>$(s,d);let sourceOptions=[],sourceRequest=0;
 let nodes=existing?JSON.parse(JSON.stringify(existing.payload.nodes)):[];
 let keys=existing?JSON.parse(JSON.stringify(existing.keys)):{};
 let comparison=existing?.payload.comparison||[];let visit=existing?.payload.visit||{messages:['','',''],questions:['','','']};
 const template=()=>{const id='n'+Date.now()+Math.floor(Math.random()*1000);keys[id]=[{score:100,feedback:''},{score:0,feedback:''}];return {id,prompt:'',choices:[{label:'',next:null},{label:'',next:null}]};};
 if(!existing)nodes=[template()];
 if(existing){get('#feProduct').value=existing.product_id;get('#feKind').value=existing.kind;get('#feTitle').value=existing.title;get('#feSkill').value=existing.skill;get('#feSpecialty').value=existing.specialty;get('#feBody').value=existing.payload.body||'';}
 function extras(){const kind=get('#feKind').value;get('#feAdd').hidden=['comparison','visit'].includes(kind);get('#feNodes').hidden=get('#feAdd').hidden;
 if(kind==='comparison'){
 get('#feExtras').innerHTML='<h3>Kaynaklı karşılaştırma tablosu</h3><p class="muted small">Ürün/alternatif adlarını sütun başlıklarıyla birlikte yazın. Belgede desteklenmeyen farkları belirtin.</p><div id="feCompareRows"></div><button class="btn ghost" id="feCompareAdd">Karşılaştırma satırı ekle</button>';
 const render=()=>{get('#feCompareRows').innerHTML=comparison.map((r,i)=>`<div class="review-card"><div class="field"><label>Başlık (ör. çalışma popülasyonu)</label><input data-cmp="topic" data-i="${i}" value="${esc(r.topic||'')}" maxlength="300"></div><div class="grid2"><div class="field"><label>Ürün bilgisi</label><textarea data-cmp="product" data-i="${i}" maxlength="2000">${esc(r.product||'')}</textarea></div><div class="field"><label>Alternatif / rakip bilgisi</label><textarea data-cmp="alternative" data-i="${i}" maxlength="2000">${esc(r.alternative||'')}</textarea></div></div><button class="btn ghost sm" data-cmp-remove="${i}">Satırı kaldır</button></div>`).join('');$$('[data-cmp]',d).forEach(e=>e.oninput=()=>comparison[+e.dataset.i][e.dataset.cmp]=e.value);$$('[data-cmp-remove]',d).forEach(b=>b.onclick=()=>{comparison.splice(+b.dataset.cmpRemove,1);render();});};
 get('#feCompareAdd').onclick=()=>{comparison.push({topic:'',product:'',alternative:''});render();};if(!comparison.length)comparison=[{topic:'',product:'',alternative:''}];render();
 }else if(kind==='visit'){
 get('#feExtras').innerHTML=`<h3>Üç ana mesaj ve üç olası soru</h3>${['messages','questions'].map(k=>`<div class="field"><label>${k==='messages'?'Ana mesajlar':'Olası hekim soruları'}</label>${visit[k].map((v,i)=>`<input style="margin-bottom:8px" data-visit="${k}" data-i="${i}" value="${esc(v)}" maxlength="2000">`).join('')}</div>`).join('')}`;
 $$('[data-visit]',d).forEach(e=>e.oninput=()=>visit[e.dataset.visit][+e.dataset.i]=e.value);
 }else get('#feExtras').innerHTML='';
 }
 function renderNodes(){get('#feNodes').innerHTML=nodes.map((n,i)=>`<div class="review-card"><h3>Adım ${i+1} · ${esc(n.id)}</h3><div class="field"><label>Soru / hekim itirazı / hatalı sunum sorusu</label><textarea data-node="${i}" data-field="prompt" maxlength="4000">${esc(n.prompt)}</textarea></div>${n.choices.map((c,j)=>`<div class="field"><label>Seçenek ${j+1}</label><input data-node="${i}" data-choice="${j}" data-field="label" value="${esc(c.label)}" maxlength="2000"><div class="grid2"><div class="field"><label>Puan (0-100)</label><input type="number" min="0" max="100" data-node="${i}" data-choice="${j}" data-field="score" value="${keys[n.id][j].score}"></div><div class="field"><label>Sonraki adım (dallanan görüşmeler için)</label><select data-node="${i}" data-choice="${j}" data-field="next"><option value="">Görüşmeyi bitir</option>${nodes.map((other,k)=>k>i?`<option value="${other.id}" ${c.next===other.id?'selected':''}>Adım ${k+1}</option>`:'').join('')}</select></div></div><label>Geri bildirim / doğru yanıtın gerekçesi</label><textarea data-node="${i}" data-choice="${j}" data-field="feedback" maxlength="4000">${esc(keys[n.id][j].feedback)}</textarea></div>`).join('')}<div class="row"><button class="btn ghost sm" data-add-choice="${i}" ${n.choices.length>=6?'disabled':''}>Seçenek ekle</button><button class="btn ghost sm" data-remove-node="${i}">Adımı kaldır</button></div></div>`).join('');
 $$('[data-node]',d).forEach(e=>e.oninput=()=>{const n=nodes[+e.dataset.node],j=+e.dataset.choice,f=e.dataset.field;if(f==='prompt')n.prompt=e.value;else if(f==='score'||f==='feedback')keys[n.id][j][f]=f==='score'?Number(e.value):e.value;else n.choices[j][f]=e.value||null;});
 $$('[data-add-choice]',d).forEach(b=>b.onclick=()=>{const n=nodes[+b.dataset.addChoice];n.choices.push({label:'',next:null});keys[n.id].push({score:0,feedback:''});renderNodes();});
 $$('[data-remove-node]',d).forEach(b=>b.onclick=()=>{const removed=nodes.splice(+b.dataset.removeNode,1)[0];delete keys[removed.id];nodes.forEach(n=>n.choices.forEach(c=>{if(c.next===removed.id)c.next=null;}));renderNodes();});
 }
 get('#feAdd').onclick=()=>{if(nodes.length>=20)return toast('En fazla 20 adım');nodes.push(template());renderNodes();};get('#feKind').onchange=extras;
 async function loadSources(){const seq=++sourceRequest;get('#feSave').disabled=true;get('#feSources').textContent='Kaynaklar yükleniyor…';try{const sources=await fieldRPC('field_source_options',{p_product:get('#feProduct').value});if(seq!==sourceRequest||!d.isConnected)return;sourceOptions=sources;
 get('#feSources').innerHTML=sources.length?sources.map((s,i)=>`<label style="display:block;margin:8px 0"><input type="checkbox" data-source-index="${i}" ${existing?.sources.some(e=>e.document_id===s.document_id&&e.page===s.page&&e.fingerprint===s.fingerprint)?'checked':''}> ${esc(s.title)} · Sayfa ${s.page}<details><summary>Kaynak metni</summary><p style="white-space:pre-wrap">${esc(s.text)}</p></details></label>`).join(''):'<p>Bu ürün için onaylı kaynak yok. Önce Kaynak belgeleri bölümünde belge ekleyip onaylatın.</p>';get('#feSave').disabled=!sources.length;
 }catch(e){get('#feSources').textContent=e.message;}}
 get('#feProduct').onchange=loadSources;get('#feCancel').onclick=()=>d.remove();
 get('#feSave').onclick=async()=>{
 const kind=get('#feKind').value,reading=['comparison','visit'].includes(kind);
 const sources=$$('[data-source-index]:checked',d).map(e=>{const s=sourceOptions[+e.dataset.sourceIndex];return {document_id:s.document_id,title:s.title,page:s.page,fingerprint:s.fingerprint,approved_at:s.approved_at};});
 if(!sources.length)return toast('En az bir onaylı kaynak sayfası seçin');
 if(kind==='comparison'&&(!comparison.length||comparison.some(r=>!r.topic.trim()||!r.product.trim()||!r.alternative.trim())))return toast('Karşılaştırma tablosunu tamamlayın');
 if(kind==='visit'&&[...visit.messages,...visit.questions].some(t=>!t.trim()))return toast('Üç mesajı ve üç soruyu tamamlayın');
 if(!reading&&kind!=='branch')nodes.forEach((n,i)=>n.choices.forEach(c=>c.next=nodes[i+1]?.id||null));
 const payload={body:get('#feBody').value,nodes:reading?[]:nodes,start:reading?null:nodes[0]?.id,comparison:kind==='comparison'?comparison:[],visit:kind==='visit'?visit:null};
 busyBtn(get('#feSave'),true);try{await fieldRPC('field_save',{p_id:id,p_product:get('#feProduct').value,p_kind:kind,p_title:get('#feTitle').value,p_skill:get('#feSkill').value,p_specialty:get('#feSpecialty').value,p_payload:payload,p_sources:sources,p_keys:reading?{}:keys});d.remove();toast('Taslak kaydedildi');vField('manage');}catch(e){get('#feStatus').textContent=e.message;busyBtn(get('#feSave'),false);}
 };
 extras();renderNodes();await loadSources();
 }catch(e){toast(e.message);}
}

function fieldReading(payload){return (typeof microReading==='function'?microReading(payload):'')+(payload.comparison?.length?`<div class="tablewrap"><table class="t"><thead><tr><th>Başlık</th><th>Ürün</th><th>Alternatif / rakip</th></tr></thead><tbody>${payload.comparison.map(r=>`<tr><td>${esc(r.topic)}</td><td>${esc(r.product)}</td><td>${esc(r.alternative)}</td></tr>`).join('')}</tbody></table></div>`:'')+(payload.visit?`<div class="grid2"><div><h3>Ana mesajlar</h3><ul>${payload.visit.messages.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div><div><h3>Olası hekim soruları</h3><ul>${payload.visit.questions.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div>`:'');}

function fieldRecommendations(units,history,examErrors,products){const weak=fieldWeaknesses(history);const priority=u=>weak.some(w=>w.product_id===u.product_id&&w.skill===u.skill)?0:examErrors.some(e=>e.area&&e.area===products.find(p=>p.id===u.product_id)?.area)?1:history.some(h=>h.unit_id===u.id&&h.version===u.version)?3:2;const order={comparison:0,visit:1,errors:2,objection:3,branch:4,update:5};return units.slice().sort((a,b)=>priority(a)-priority(b)||order[a.kind]-order[b.kind]);}

function fieldCitations(sources){return (sources||[]).map(s=>sourceLinks([s])+(s.approved_at?`<span class="muted small"> · Kaynak onayı: ${esc(fmtDate(s.approved_at))}</span>`:"")).join("<br>");}
