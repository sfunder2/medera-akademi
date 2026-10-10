// Isolated PostgreSQL tests for objection tagging and adverse event reports; never connects to a live project.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.MEDERA_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const ids={admin:id(1),manager:id(2),pjp:id(3),other:id(4),lawyer:id(5),product:id(11),foreign:id(12),hcp:id(21),otherHcp:id(22),visit:id(31),otherVisit:id(32)};
async function as(who){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[who]]);await db.exec('set role authenticated');}
const rpc=async(name,args=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
const insertObjection=(o)=>db.query('insert into field_objections(interaction_id,product_id,tag,competitor,region) values($1,$2,$3,$4,$5)',[o.visit??null,o.product??null,o.tag,o.competitor??null,o.region]);
(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,full_name text,email text,role text,status text,job_role text);
 create table public.products(id uuid primary key,name text);create table public.user_products(user_id uuid,product_id uuid);
 create table public.hcps(id uuid primary key,owner_id uuid,name text,city text);
 create table public.interactions(id uuid primary key,owner_id uuid,hcp_id uuid references public.hcps);
 create function public.is_active() returns boolean language sql stable security definer as $$select coalesce((select status='active' from public.profiles where id=auth.uid()),false)$$;
 create function public.is_admin() returns boolean language sql stable security definer as $$select coalesce((select role='admin' from public.profiles where id=auth.uid()),false)$$;
 create function public.my_job_role() returns text language sql stable security definer as $$select job_role from public.profiles where id=auth.uid()$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 grant select on public.hcps,public.interactions,public.user_products to authenticated;`);
 const migration=fs.readFileSync(__dirname+'/../supabase/field_signals_v7.sql','utf8');await db.exec(migration);await db.exec(migration);
 for(const [name,role,job] of [['admin','admin','pjp'],['manager','user','urun_muduru'],['pjp','user','pjp'],['other','user','pjp'],['lawyer','user','avukat']])await db.query("insert into profiles values($1,$2,$3,$4,'active',$5)",[ids[name],name,name+'@test.invalid',role,job]);
 await db.query('insert into products values($1,$2),($3,$4)',[ids.product,'Ürün',ids.foreign,'Başka ürün']);
 for(const [u,p] of [['manager','product'],['pjp','product'],['other','product'],['other','foreign']])await db.query('insert into user_products values($1,$2)',[ids[u],ids[p]]);
 await db.query("insert into hcps values($1,$2,'Dr. Test','İzmir'),($3,$4,'Dr. Başka','Ankara')",[ids.hcp,ids.pjp,ids.otherHcp,ids.other]);
 await db.query('insert into interactions values($1,$2,$3),($4,$5,$6)',[ids.visit,ids.pjp,ids.hcp,ids.otherVisit,ids.other,ids.otherHcp]);

 // Objections: own visit and assigned product only.
 await as('pjp');
 for(let i=0;i<6;i++)await insertObjection({visit:ids.visit,product:ids.product,tag:'rakip',competitor:'Rakip X',region:'Ege'});
 await insertObjection({visit:ids.visit,product:ids.product,tag:'fiyat',region:'Ege'});
 await assert.rejects(insertObjection({visit:ids.otherVisit,product:ids.product,tag:'fiyat',region:'Ege'}),/row-level security/);
 await assert.rejects(insertObjection({product:ids.foreign,tag:'fiyat',region:'Ege'}),/row-level security/);
 await assert.rejects(insertObjection({product:ids.product,tag:'bilinmeyen',region:'Ege'}),/check constraint/);
 await assert.rejects(insertObjection({product:ids.product,tag:'fiyat',region:'Mars'}),/check constraint/);
 await assert.rejects(rpc('objection_heatmap',[30,null]),/ürün müdürleri/);
 await as('other');
 assert.equal((await db.query('select count(*)::int n from field_objections')).rows[0].n,0,'reps must not read others');
 await insertObjection({product:ids.foreign,tag:'kanit',region:'Marmara'});
 // Older baseline: two weeks ago, inserted as superuser.
 await db.exec('reset role');await db.query("insert into field_objections(user_id,product_id,tag,competitor,region,created_at) values($1,$2,'rakip','Rakip X','Ege',now()-interval '14 days')",[ids.pjp,ids.product]);

 // Manager sees only own products, aggregated; alert fires for the Ege wave.
 await as('manager');
 const m=await rpc('objection_heatmap',[30,null]);
 assert.equal(m.total,8);assert.ok(!m.cells.some(c=>c.tag==='kanit'),'foreign product hidden from manager');
 assert.equal(m.alerts.length,1);assert.deepEqual([m.alerts[0].region,m.alerts[0].tag,m.alerts[0].competitor,m.alerts[0].current],['Ege','rakip','Rakip X',6]);
 assert.equal(m.competitors[0].name,'Rakip X');
 await as('admin');assert.equal((await rpc('objection_heatmap',[30,null])).total,9);
 await as('lawyer');await assert.rejects(rpc('objection_heatmap',[30,null]),/ürün müdürleri/);

 // Adverse event reports.
 await as('pjp');
 const pv=(await db.query("insert into pv_reports(product_id,event,serious,source,hcp_id,patient_age,patient_sex) values($1,'Hekim infüzyon sonrası ciddi döküntü bildirdi','evet','hekim',$2,'45-64','kadin') returning report_no,status",[ids.product,ids.hcp])).rows[0];
 assert.match(pv.report_no,/^PV-\d{4}-\d{5}$/);assert.equal(pv.status,'new');
 await assert.rejects(db.query("insert into pv_reports(product_id,event,serious,source,hcp_id) values($1,'Başkasının hekimi için bildirim denemesi','hayir','hekim',$2)",[ids.product,ids.otherHcp]),/row-level security/);
 await assert.rejects(db.query("insert into pv_reports(product_id,event,serious,source,status) values($1,'Durumu kapatılmış olarak gönderme','hayir','hekim','closed')",[ids.product]),/row-level security/);
 await assert.rejects(db.query("insert into pv_reports(event,serious,source) values('Ürün belirtilmemiş bildirim örneği','hayir','hekim')"),/check constraint/);
 await assert.rejects(db.query("update pv_reports set status='closed'"),/permission denied/);
 await assert.rejects(rpc('pv_update',[(await db.query('select id from pv_reports')).rows[0].id,'closed',null]),/tıbbi birim/);
 await as('other');assert.equal((await db.query('select count(*)::int n from pv_reports')).rows[0].n,0,'reports are private to reporter');
 await as('admin');const all=(await db.query('select id from pv_reports')).rows;assert.equal(all.length,1);
 await rpc('pv_update',[all[0].id,'in_review','Hekimle iletişime geçildi']);
 await as('pjp');const mine=(await db.query('select status,unit_note from pv_reports')).rows[0];assert.deepEqual([mine.status,mine.unit_note],['in_review','Hekimle iletişime geçildi']);
 console.log('PASS: objection tagging scope, aggregated heatmap with wave alert, private adverse event reports and medical-unit-only status updates');
})().catch(e=>{console.error(e);process.exitCode=1;});
