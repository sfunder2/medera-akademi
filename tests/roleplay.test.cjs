const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),node=()=>({style:{},value:'',checked:true,disabled:false,hidden:false,textContent:'',children:[],append(...x){this.children.push(...x)},scrollIntoView(){}});
const $=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)};
let calls=[],aborted=0,cancelled=0,deferred;
class Recognition{start(){}abort(){aborted++}}
const context={window:{SpeechRecognition:Recognition,speechSynthesis:{cancel(){cancelled++},speak(){}}},SpeechSynthesisUtterance:class{},ME:{role:'user'},app:node(),D:{products:[{id:'p1',name:'Ürün'}]},$,esc:String,SYS:'Eğitim',toast(){},document:{createElement:node},ai:async x=>{calls.push(x);if(deferred)return deferred;return x.grounded?'Kaynak bulunamadı':'Test hekim yanıtı';},aiError:e=>e.message,Blob,URL,setTimeout};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../assets/roleplay.js','utf8'),context);
(async()=>{
 context.vRoleplay();$('#rpProduct').value='p1';await $('#rpStart').onclick();
 assert.equal(calls.length,1);assert.equal($('#rpSend').disabled,false);
 $('#rpMic').onclick();assert.equal($('#rpMic').textContent,'Mikrofonu kapat');
 $('#rpAnswer').value='Ürün kanıtını sunacağım';await $('#rpSend').onclick();
 assert.ok(aborted>0);assert.equal(calls[1].messages.at(-1).content,'Ürün kanıtını sunacağım');
 const rows=$('#rpTranscript').children;assert.equal(rows[1].children[0].textContent,'Siz');assert.equal(rows[2].children[0].textContent,'Hekim');
 await $('#rpFinish').onclick();assert.equal(calls[2].grounded,true);assert.equal(calls[2].productId,'p1');
 assert.match($('#rpFeedback').textContent,/Ses tonu: ölçülmedi/);assert.equal($('#rpSend').disabled,true);
 context.window.stopRoleplay();assert.ok(cancelled>0);
 context.D.products=[];context.vRoleplay();assert.match(context.app.innerHTML,/Genel iletişim çalışması/);$('#rpProduct').value='__general__';await $('#rpStart').onclick();assert.match(calls.at(-1).system,/Gerçek ilaç adı/);assert.equal($('#rpSend').disabled,false);assert.equal($('#rpFinish').disabled,true);
 context.D.products=[{id:'p1',name:'Ürün'}];context.vRoleplay();$('#rpProduct').value='p1';let resolve;deferred=new Promise(r=>resolve=r);const pending=$('#rpStart').onclick();context.window.stopRoleplay();const count=$('#rpTranscript').children.length;resolve('Geç yanıt');await pending;assert.equal($('#rpTranscript').children.length,count);
 console.log('PASS: voice cleanup, turn order, approved-source evaluation, no invented tone score, completed-session lock, stale response suppression');
})().catch(e=>{console.error(e);process.exitCode=1});
