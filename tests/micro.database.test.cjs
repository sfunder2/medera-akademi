// Isolated PostgreSQL test: an AI-drafted micro training passes the same server validation, review and scoring as hand-made field content.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.MEDERA_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const ids={admin:'00000000-0000-0000-0000-000000000001',manager:'00000000-0000-0000-0000-000000000002',pjp:'00000000-0000-0000-0000-000000000003',lawyer:'00000000-0000-0000-0000-000000000004',other:'00000000-0000-0000-0000-000000000005',product:'00000000-0000-0000-0000-000000000011',foreign:'00000000-0000-0000-0000-000000000012',doc:'00000000-0000-0000-0000-000000000021'};
async function as(who){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[who]]);await db.exec('set role authenticated');}
const rpc=async(name,args=[])=>{const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`select public.${name}(${placeholders}) as result`,args.map(x=>typeof x==='object'&&x!==null?JSON.stringify(x):x))).rows[0].result;};
async function denied(fn,pattern){await assert.rejects(fn,pattern);}
(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,full_name text,email text,role text,status text,job_role text);
 create table public.products(id uuid primary key,name text);create table public.user_products(user_id uuid,product_id uuid);
 create table public.source_documents(id uuid primary key,title text,product_id uuid,pages jsonb,status text,reviewed_at timestamptz);
 create table public.content_history(kind text,content_id uuid,snapshot jsonb,saved_at timestamptz);
 create function public.is_active() returns boolean language sql stable security definer as $$select coalesce((select status='active' from public.profiles where id=auth.uid()),false)$$;
 create function public.is_admin() returns boolean language sql stable security definer as $$select coalesce((select role='admin' from public.profiles where id=auth.uid()),false)$$;
 create function public.my_job_role() returns text language sql stable security definer as $$select job_role from public.profiles where id=auth.uid()$$;
 create function public.record_audit() returns trigger language plpgsql as $$begin return new;end$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 `);
 const migration=fs.readFileSync(__dirname+'/../supabase/field_training_v6.sql','utf8');await db.exec(migration);await db.exec(migration);
 for(const [name,role,job] of [['admin','admin','pjp'],['manager','user','urun_muduru'],['pjp','user','pjp'],['lawyer','user','avukat'],['other','user','pjp']])await db.query("insert into profiles values($1,$2,$3,$4,'active',$5)",[ids[name],name,name+'@test.invalid',role,job]);
 await db.query('insert into products values($1,$2),($3,$4)',[ids.product,'Ürün',ids.foreign,'Başka ürün']);
 for(const user of ['manager','pjp'])await db.query('insert into user_products values($1,$2)',[ids[user],ids.product]);
 await db.query("insert into source_documents values($1,'Onaylı kaynak',$2,$3,'approved',now())",[ids.doc,ids.product,JSON.stringify([{page:1,text:'Onaylı ürün kanıtı'}])]);
 await as('manager');const sources=await rpc('field_source_options',[ids.product]);assert.equal(sources.length,1);
 const refs=sources.map(({text,...s})=>s);
 // Pure helpers from micro.js turn a drafted training into a field unit.
 const vm=require('node:vm'),ctx={};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(__dirname+'/../assets/micro.js','utf8').split('async function fieldMicro')[0],ctx);
 const draft=ctx.microNormalize({title:'Yeni yayın özeti',summary:'Kısa özet',podcast:'Sesli özet metni.',
  flashcards:[1,2,3].map(i=>({title:'Kart '+i,text:'Kart metni',page:1})),
  quiz:[0,1,2,3,4].map(i=>({q:'Soru '+(i+1),options:['A','B','C','D'],answer:i%4,explanation:'Açıklama',page:1}))},[1]);
 const micro=ctx.microToUnit(draft,sources);
 assert.equal(micro.sources.length,1);assert.equal(micro.payload.nodes.length,5);
 const unit=await rpc('field_save',[null,ids.product,'update',draft.title,'Tıbbi doğruluk','Genel',micro.payload,micro.sources,micro.keys]);
 await rpc('field_review',[unit,'in_review',null]);
 await as('pjp');assert.equal((await rpc('field_list',[false])).length,0,'not visible before approval');
 await as('lawyer');await rpc('field_review',[unit,'approved',null]);
 await as('pjp');const listed=await rpc('field_list',[false]);assert.equal(listed.length,1);
 assert.equal(listed[0].payload.podcast,'Sesli özet metni.');assert.equal(listed[0].payload.flashcards.length,3);assert.equal(listed[0].keys,undefined);
 const start=await rpc('field_start',[unit]);
 const right=await rpc('field_submit',[start.attempt_id,[0,1,2,3,4].map(i=>({node:'q'+(i+1),choice:i%4}))]);assert.equal(right.score,100);
 const again=await rpc('field_start',[unit]);
 const wrong=await rpc('field_submit',[again.attempt_id,[0,1,2,3,4].map(i=>({node:'q'+(i+1),choice:i<2?i%4:(i+1)%4}))]);assert.equal(wrong.score,40);
 assert.match(wrong.feedback[4].feedback,/^Doğru cevap: /);
 console.log('PASS: drafted micro training saves, waits for review, hides answer keys and scores on the server');
})().catch(e=>{console.error(e);process.exitCode=1;});
