const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../assets/field-training.js','utf8');
const nodes=new Map();const node=()=>({innerHTML:'',value:'',hidden:false,disabled:false,textContent:''});
const $=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)};
let requests=[],nextReply;
const unit={id:'unit',product_id:'product',title:'Test itiraz',kind:'branch',skill:'Kanıt kullanımı',version:1,specialty:'Genel',sources:[],payload:{body:'Sunum',start:'n1',nodes:[{id:'n1',prompt:'Hekim sorusu',choices:[{label:'Yanıt',next:'n2'},{label:'Diğer',next:null}]},{id:'n2',prompt:'Takip sorusu',choices:[{label:'Kanıt',next:null},{label:'Diğer',next:null}]}]}};
const context={app:node(),$, $$:()=>[],esc:s=>String(s).replace(/[<>]/g,''),D:{products:[]},ME:{role:'user',job_role:'pjp'},sb:{rpc:async(name,args)=>{requests.push({name,args});if(nextReply)return nextReply;if(name==='field_start')return {data:{attempt_id:'attempt',unit}};if(name==='field_submit')return {data:{score:100,feedback:[]}};return {data:[]};}},sourceLinks:()=>'',bindSourceLinks(){},busyBtn(){},toast(){},fmtDate:String,reviewPill:String};
vm.createContext(context);vm.runInContext(source,context);
const weak=context.fieldWeaknesses([{product_id:'p',skill:'Kanıt',score:40},{product_id:'p',skill:'Kanıt',score:60},{product_id:'p',skill:'Okuma',score:null},{product_id:'q',skill:'Kanıt',score:90}]);assert.equal(weak.length,1);assert.equal(weak[0].average,50);
assert.equal(context.fieldRecommendations([{id:'done',product_id:'p',skill:'A',kind:'objection',version:1},{id:'exam',product_id:'q',skill:'B',kind:'errors',version:1}],[{unit_id:'done',version:1,score:100,product_id:'p',skill:'A'}],[{area:'Onkoloji'}],[{id:'q',area:'Onkoloji'}])[0].id,'exam');
assert.equal(context.fieldWeaknesses(Array.from({length:6},(_,i)=>({product_id:'p',skill:'Kanıt',score:i===5?0:100}))).length,0);
(async()=>{
 await context.fieldRun('unit');assert.match($('#fieldStep').innerHTML,/Hekim sorusu/);assert.equal(requests[0].name,'field_start');
 // Routing uses the server-supplied snapshot, with keys kept out of the client response.
 assert.equal(requests[0].args.p_id,'unit');
 const reading=context.fieldReading({comparison:[{topic:'Etkinlik',product:'<script>',alternative:'Kaynak yok'}],visit:{messages:['A','B','C'],questions:['D','E','F']}});assert.match(reading,/<table/);assert.doesNotMatch(reading,/<script>/);assert.match(reading,/Ana mesajlar/);
 let resolve;nextReply=new Promise(r=>resolve=r);const pending=context.fieldRun('unit');vm.runInContext('fieldGeneration++',context);$('#fieldStep').innerHTML='Başka sayfa';resolve({data:{attempt_id:'late',unit}});await pending;assert.equal($('#fieldStep').innerHTML,'Başka sayfa');
 console.log('PASS: recent-five weakness prioritization, unscored-reading exclusion, source-snapshot startup, escaped comparison cards, stale response suppression');
})().catch(e=>{console.error(e);process.exitCode=1});
