const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.MEDERA_JSDOM_MODULE||'jsdom');
const dom=new JSDOM('<main id="app"></main>',{url:'https://test.invalid'});const document=dom.window.document;
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const $=s=>document.querySelector(s);let calls=[];
const ctx={window:dom.window,document,app:$('#app'),$,D:{products:[]},ME:{role:'admin'},SYS:'Eğitim',esc:String,toast(){},aiError:e=>e.message,ai:async args=>{calls.push(args);return 'Hangi kanıtı gösterebilirsiniz?';},Blob,URL,setTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../assets/roleplay.js','utf8'),ctx);
(async()=>{
 ctx.vRoleplay();assert.equal($('#rpProduct').value,'__general__');assert.match(document.body.textContent,/henüz ürün atanmamış/);assert.equal($('#rpMic').disabled,true);
 await $('#rpStart').onclick();assert.equal($('#rpSend').disabled,false);assert.equal($('#rpFinish').disabled,true);assert.match(calls[0].system,/yalnızca iletişim/);
 $('#rpAnswer').value='Onaylı kaynağı inceleyip size bilgi vereceğim';await $('#rpSend').onclick();assert.equal($('#rpFinish').disabled,false);assert.equal($('#rpAnswer').value,'');
 await $('#rpFinish').onclick();assert.equal(calls.length,3);assert.ok(calls.every(x=>!x.grounded));assert.match($('#rpFeedback').textContent,/tıbbi doğruluk değerlendirilmez/);
 assert.equal($('#rpReport').hidden,false);ctx.window.stopRoleplay();dom.window.close();console.log('PASS: actual empty-product default, admin assignment guidance, unsupported microphone fallback, general conversation and nonclinical report');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
