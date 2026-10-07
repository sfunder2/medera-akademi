const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.MEDERA_JSDOM_MODULE||'jsdom');
const dom=new JSDOM('<main id="app"></main>',{url:'https://test.invalid'});const document=dom.window.document;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const unit={id:'u',product_id:'p',product:'Ürün',kind:'objection',title:'Kanıt sorusu',skill:'Kanıt kullanımı',specialty:'Genel',version:1,status:'approved',sources:[],payload:{body:'Giriş',start:'n1',nodes:[{id:'n1',prompt:'İtiraz',choices:[{label:'Kaynak göster',next:'n2'},{label:'Tahmin et',next:'n2'}]},{id:'n2',prompt:'Takip',choices:[{label:'Dengeli anlat',next:null},{label:'Abart',next:null}]}]}};
let requests=[],history=[],saved;const sourceOption={document_id:'doc',title:'Onaylı belge',page:1,fingerprint:'hash',text:'Kanıt'};
const context={app:$('#app'),document,$,$$,esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),D:{products:[{id:'p',name:'Ürün',area:'Onkoloji'}]},ME:{role:'user',job_role:'pjp'},FIELD_SKILLS:undefined,SPECS:['Onkoloji'],reviewPill:s=>s,sourceLinks:()=>'',bindSourceLinks(){},fmtDate:String,toast(){},busyBtn(b,on){b.disabled=on},dialog:html=>{const d=document.createElement('div');d.innerHTML=html;document.body.append(d);return d;},ai:async()=> 'Kaynaklı koçluk',aiError:e=>e.message,sb:{rpc:async(name,args)=>{
 requests.push({name,args});let data=[];
 if(name==='field_list')data=[unit];if(name==='field_history')data=history;
 if(name==='field_start')data={attempt_id:'a',unit};
 if(name==='field_submit'){data={score:100,feedback:[{prompt:'İtiraz',choice:'Kanıt',score:100,feedback:'Kaynak doğru'}]};history=[{unit_id:'u',product_id:'p',version:1,skill:'Kanıt kullanımı',title:unit.title,score:100,completed_at:'2026-10-07'}];}
 if(name==='field_source_options')data=[sourceOption];if(name==='field_save'){saved=args;data='new';}
 return {data};
}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../assets/field-training.js','utf8'),context);
const tick=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
(async()=>{
 await context.vField();assert.ok($('[data-field-run]'));$('[data-field-run]').click();await tick();
 assert.ok($('#fieldWritten'));$('#fieldWritten').value='Kanıtı kaynakla sunarım';$('#fieldCoach').click();await tick();assert.equal($('#fieldCoachText').textContent,'Kaynaklı koçluk');
 $('[data-field-choice="0"]').click();assert.match($('#fieldStep').textContent,/Takip/);$('[data-field-choice="0"]').click();$('#fieldSubmit').click();await tick();
 assert.match($('#fieldStep').textContent,/100\/100/);assert.equal(requests.find(r=>r.name==='field_submit').args.p_answers[0].text,'Kanıtı kaynakla sunarım');
 $('#fieldPlan').click();await tick();assert.match($('#fieldBody').textContent,/Çalışma geçmişim/);assert.match($('#fieldBody').textContent,/Kanıt sorusu/);
 context.ME.job_role='urun_muduru';await context.fieldEditor();assert.ok($('#feSave'));$('#feTitle').value='Yeni itiraz';$('[data-source-index]').checked=true;
 $('[data-field="prompt"]').value='Hekim sorusu';$('[data-field="prompt"]').dispatchEvent(new dom.window.Event('input'));
 for(const e of $$('[data-field="label"]')){e.value='Seçenek';e.dispatchEvent(new dom.window.Event('input'));}for(const e of $$('[data-field="feedback"]')){e.value='Gerekçe';e.dispatchEvent(new dom.window.Event('input'));}
 $('#feSave').click();await tick();assert.equal(saved.p_kind,'objection');assert.equal(saved.p_sources[0].fingerprint,'hash');assert.equal(saved.p_payload.start,saved.p_payload.nodes[0].id);assert.equal(saved.p_keys[saved.p_payload.start][0].score,100);
 console.log('PASS: DOM navigation, written coaching, branch progression, persisted answer submission, learning history and no-code authoring form');
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
