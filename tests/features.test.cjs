const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const base=require('node:path').resolve(__dirname,'..')+'/';
const frontend=fs.readFileSync(base+'assets/features.js','utf8');
const cities=Function('return '+frontend.match(/const TR_CITIES = (\[[^;]+\]);/)[1])();
assert.equal(cities.length,81);assert.equal(new Set(cities).size,81);
let handler,mode,paid=0,requestBody;
const response=(x,status=200)=>new Response(JSON.stringify(x),{status});
const source=stripTypeScriptTypes(fs.readFileSync(base+'supabase/functions/ai/index.ts','utf8'));
vm.runInNewContext(source,{Deno:{env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'test-public',ANTHROPIC_API_KEY:'test-only'})[k]},serve:f=>handler=f},Response,console,encodeURIComponent,
 fetch:async(url,options)=>{
 if(url.endsWith('/auth/v1/user'))return response({id:'user'});
 if(url.includes('/rest/v1/profiles'))return response([{status:mode==='pending'?'pending':'active'}]);
 if(url.includes('/rpc/search_sources'))return response(mode==='none'?[]:[{document_id:'id',title:'Onaylı test belgesi',page:7,text:'Test kaynak metni'}]);
 if(url.includes('/rpc/consume_ai_quota'))return response(mode!=='limit');
 if(url==='https://api.anthropic.com/v1/messages'){paid++;requestBody=JSON.parse(options.body);return response({content:[{type:'text',text:'Yanıt [1]'}]});}
 throw Error('Unexpected URL');
 }});
(async()=>{
 const body={messages:[{role:'user',content:'Test kaynak'}],grounded:true,stream:false};
 mode='none';let r=await handler(new Request('https://test.invalid/ai',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,200);assert.match((await r.json()).text,/uygun kaynak bulunamadı/);assert.equal(paid,0);
 mode='approved';r=await handler(new Request('https://test.invalid/ai',{method:'POST',body:JSON.stringify(body)}));const result=await r.json();assert.equal(r.status,200);assert.equal(result.sources[0].page,7);assert.equal(result.sources[0].text,undefined);assert.match(requestBody.system,/sayfa 7/);assert.match(requestBody.system,/Yalnızca aşağıdaki/);assert.equal(paid,1);
 mode='pending';r=await handler(new Request('https://test.invalid/ai',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,403);assert.equal(paid,1);
 mode='limit';r=await handler(new Request('https://test.invalid/ai',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,429);assert.equal(paid,1);
 console.log('PASS: 81 unique cities, no-source fallback, approved-page citations, no raw source leakage, pending-account denial, paid API quota.');
})().catch(e=>{console.error(e);process.exitCode=1});

