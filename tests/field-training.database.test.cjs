// Isolated PostgreSQL integration tests; never connect to a live Supabase project.
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
 const payload={body:'Kaynağa dayalı test',start:'n1',nodes:[{id:'n1',prompt:'Kanıtı nasıl sunarsın?',choices:[{label:'Kaynakla',next:'n2'},{label:'Tahminle',next:'n2'}]},{id:'n2',prompt:'İkinci soru',choices:[{label:'Dengeli',next:null},{label:'Abartılı',next:null}]}]};
 const keys={n1:[{score:100,feedback:'Kanıt gösterildi'},{score:0,feedback:'Tahmin yeterli değil'}],n2:[{score:100,feedback:'Dengeli'},{score:0,feedback:'Abartı'}]};
 const saveArgs=[null,ids.product,'objection','Test çalışması','Kanıt kullanımı','Genel',payload,refs,keys];
 const unit=await rpc('field_save',saveArgs);
 await denied(()=>rpc('field_review',[unit,'approved',null]),/İnceleme yetkisi/);
 await rpc('field_review',[unit,'in_review',null]);
 await as('pjp');assert.equal((await rpc('field_list',[false])).length,0);await denied(()=>rpc('field_start',[unit]),/erişim yok/);
 await denied(()=>db.query('select * from field_keys'),/permission denied/);
 await denied(()=>rpc('field_save',saveArgs),/yöneticisi/);
 await as('lawyer');const queue=await rpc('field_list',[true]);assert.equal(queue[0].keys.n1[0].score,100);await rpc('field_review',[unit,'approved','Kaynaklar kontrol edildi']);
 await as('other');assert.equal((await rpc('field_list',[false])).length,0);await denied(()=>rpc('field_start',[unit]),/erişim yok/);
 await as('pjp');const listed=await rpc('field_list',[false]);assert.equal(listed.length,1);assert.equal(listed[0].keys,undefined);
 const start=await rpc('field_start',[unit]);assert.equal(start.unit.keys,undefined);
 await denied(()=>rpc('field_submit',[start.attempt_id,[{node:'n1',choice:0}]]),/tamamlanmadı/);
 await denied(()=>rpc('field_submit',[start.attempt_id,[{node:'n1'},{node:'n2',choice:0}]]),/geçersiz/);
 const result=await rpc('field_submit',[start.attempt_id,[{node:'n1',choice:0,score:0},{node:'n2',choice:1,score:100}]]);assert.equal(result.score,50);
 assert.equal((await rpc('field_submit',[start.attempt_id,[]])).score,50);
 assert.equal((await rpc('field_history')).length,1);
 await as('manager');const heat=await rpc('field_heatmap');assert.equal(heat[0].average,50);assert.equal(heat[0].name,'pjp');
 const edit=await rpc('field_edit',[unit]);assert.equal(edit.keys.n2[1].score,0);
 await rpc('field_save',[unit,...saveArgs.slice(1)]);assert.equal((await rpc('field_list',[true]))[0].status,'draft');
 await rpc('field_review',[unit,'in_review',null]);await as('lawyer');await rpc('field_review',[unit,'approved',null]);
 await as('pjp');const inProgress=await rpc('field_start',[unit]);const notices=await rpc('field_notifications');assert.equal(notices.length,1);await rpc('field_notifications',[notices[0].id]);assert.ok((await rpc('field_notifications'))[0].read_at);
 for(const kind of ['branch','errors','update','comparison','visit']){
  await as('manager');const reading=['comparison','visit'].includes(kind);
  const body=reading?{body:'Kaynaklı okuma',nodes:[],start:null,comparison:[{topic:'Kanıt',product:'Onaylı bilgi',alternative:'Karşılaştırma kanıtı yok'}],visit:{messages:['A','B','C'],questions:['D','E','F']}}:payload;
  const created=await rpc('field_save',[null,ids.product,kind,'Test '+kind,'Kanıt kullanımı','Genel',body,refs,reading?{}:keys]);await rpc('field_review',[created,'in_review',null]);
  await as('lawyer');await rpc('field_review',[created,'approved',null]);await as('pjp');const session=await rpc('field_start',[created]);const submitted=await rpc('field_submit',[session.attempt_id,reading?[]:[{node:'n1',choice:0},{node:'n2',choice:0}]]);assert.equal(submitted.score,reading?null:100);
 }
 await db.exec('reset role');await db.query("insert into content_history select 'source_documents',id,jsonb_build_object('pages',pages,'status','approved'),now() from source_documents where id=$1",[ids.doc]);
 await db.exec('reset role');await db.query("update source_documents set pages=$1 where id=$2",[JSON.stringify([{page:1,text:'Değişmiş kanıt'}]),ids.doc]);
 await as('pjp');assert.equal((await rpc('field_list',[false])).length,0);await denied(()=>rpc('field_submit',[inProgress.attempt_id,[{node:'n1',choice:0},{node:'n2',choice:0}]]),/Kaynak değişti/);
 await db.exec('reset role');await db.query("update source_documents set status='draft' where id=$1",[ids.doc]);await db.query("update source_documents set status='approved' where id=$1",[ids.doc]);await as('pjp');const latestNotices=await rpc('field_notifications');assert.equal(latestNotices.length,1);assert.equal(latestNotices[0].changes[0].type,'edited');assert.equal(latestNotices[0].read_at,null);
 console.log('PASS: six exercise types, changed-page notifications, migration replay, product isolation, review permissions, hidden keys, strict complete-path scoring, idempotent submission, durable history, scoped heatmap, source-change invalidation and read receipts');
 await db.close();
})().catch(async e=>{console.error(e);await db.close();process.exitCode=1});
