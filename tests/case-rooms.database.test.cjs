// Isolated PostgreSQL tests for multiplayer case rooms; never connects to a live project.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.MEDERA_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const ids={a:id(1),b:id(2),c:id(3),d:id(4),lawyer:id(5),product:id(11),foreign:id(12)};
async function as(who){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[who]]);await db.exec('set role authenticated');}
const rpc=async(name,args=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args.map(x=>typeof x==='object'&&x!==null?JSON.stringify(x):x))).rows[0].result;
(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,full_name text,email text,role text,status text,job_role text);
 create table public.products(id uuid primary key,name text);create table public.user_products(user_id uuid,product_id uuid);
 create table public.duel_members(user_id uuid primary key,region text);
 create function public.is_active() returns boolean language sql stable security definer as $$select coalesce((select status='active' from public.profiles where id=auth.uid()),false)$$;
 create function public.is_admin() returns boolean language sql stable security definer as $$select coalesce((select role='admin' from public.profiles where id=auth.uid()),false)$$;
 create function public.my_job_role() returns text language sql stable security definer as $$select job_role from public.profiles where id=auth.uid()$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const migration=fs.readFileSync(__dirname+'/../supabase/case_rooms_v8.sql','utf8');await db.exec(migration);await db.exec(migration);
 for(const [k,job] of [['a','pjp'],['b','pjp'],['c','pjp'],['d','pjp'],['lawyer','avukat']])await db.query("insert into profiles values($1,$2,$3,'user','active',$4)",[ids[k],'Kişi '+k.toUpperCase(),k+'@test.invalid',job]);
 await db.query('insert into products values($1,$2),($3,$4)',[ids.product,'Ürün',ids.foreign,'Başka']);
 await db.query('insert into user_products values($1,$2)',[ids.a,ids.product]);
 await db.query("insert into duel_members values($1,'Ege'),($2,'Marmara'),($3,'Ege')",[ids.a,ids.b,ids.c]);

 await as('lawyer');await assert.rejects(rpc('case_room_create',[null,'kanit']),/PJP/);
 await as('a');await assert.rejects(rpc('case_room_create',[ids.foreign,'kanit']),/atanmamış/);
 await assert.rejects(rpc('case_room_create',[ids.product,'bilinmeyen']),/check constraint/);
 const room=await rpc('case_room_create',[ids.product,'kanit']);assert.match(room.code,/^[A-Z2-9]{6}$/);
 await assert.rejects(db.query('select * from case_rooms'),/permission denied/);
 await assert.rejects(rpc('case_room_start',[room.id]),/En az 2/);
 await as('b');await assert.rejects(rpc('case_room_state',[room.id]),/üyesi değilsiniz/);
 assert.equal((await rpc('case_room_list')).open.length,1);
 assert.equal(await rpc('case_room_join',[room.code.toLowerCase()]),room.id);
 await assert.rejects(rpc('case_room_start',[room.id]),/kuran kişi/);
 await as('c');await rpc('case_room_join',[room.code]);
 await as('d');await assert.rejects(rpc('case_room_join',[room.code]),/dolu/);
 await as('a');await rpc('case_room_start',[room.id]);
 await as('d');await assert.rejects(rpc('case_room_join',[room.code]),/katılıma açık değil/);

 await as('a');let st=await rpc('case_room_state',[room.id]);
 assert.equal(st.room.status,'live');assert.deepEqual(st.members.map(m=>m.role).sort(),['doctor','observer','rep']);
 const who=Object.fromEntries(st.members.map(m=>[m.role,Object.keys(ids).find(k=>ids[k]===m.user_id)]));
 await as(who.observer);await assert.rejects(rpc('case_room_say',[room.id,'Gözlemci konuşamaz']),/rolünüz yok/);
 await as(who.rep);await assert.rejects(rpc('case_room_say',[room.id,'Önce ben']),/Sıra karşı tarafta/);
 for(let i=0;i<5;i++){
  await as(who.doctor);await rpc('case_room_say',[room.id,'İtiraz '+(i+1)]);
  await assert.rejects(rpc('case_room_say',[room.id,'Üst üste']),/Sıra karşı tarafta/);
  await as(who.rep);await rpc('case_room_say',[room.id,'Yanıt '+(i+1)]);
 }
 st=await rpc('case_room_state',[room.id]);assert.equal(st.room.status,'rating');assert.equal(st.messages.length,10);
 await as(who.doctor);await assert.rejects(rpc('case_room_say',[room.id,'Geç kaldım']),/devam etmiyor/);
 await as(who.rep);await assert.rejects(rpc('case_room_rate',[room.id,{kanit:5,itiraz:5,denge:5,kapanis:5},null]),/puanlama rolünüz yok/);
 await as(who.doctor);await assert.rejects(rpc('case_room_rate',[room.id,{kanit:6,itiraz:5,denge:5,kapanis:5},null]),/1-5/);
 await rpc('case_room_rate',[room.id,{kanit:5,itiraz:4,denge:4,kapanis:3},'Kanıt iyi kullanıldı']);
 await assert.rejects(rpc('case_room_rate',[room.id,{kanit:5,itiraz:5,denge:5,kapanis:5},null]),/zaten puanladınız/);
 await as(who.rep);st=await rpc('case_room_state',[room.id]);assert.equal(st.ratings.length,0,'scores stay hidden until everyone rated');
 await as(who.observer);await rpc('case_room_rate',[room.id,{kanit:3,itiraz:3,denge:3,kapanis:3},null]);
 st=await rpc('case_room_state',[room.id]);assert.equal(st.room.status,'done');assert.equal(st.ratings.length,2);
 const pts=Object.fromEntries(st.members.map(m=>[m.role,m.points]));
 assert.equal(pts.rep,Math.round((75+50)/2));assert.equal(pts.doctor,20);assert.equal(pts.observer,20);
 await rpc('case_room_feedback_save',[room.id,'Koçluk notu']);await rpc('case_room_feedback_save',[room.id,'İkinci not']);
 assert.equal((await rpc('case_room_state',[room.id])).feedback,'Koçluk notu');
 const board=await rpc('case_room_leaderboard');
 assert.equal(board.people[0].points,63);assert.equal(board.people.length,3);
 assert.ok(board.regions.some(r=>r.region==='Ege'));

 // Stale rooms: a live room past 15 minutes moves to rating; ending with no rep answer cancels.
 await as('a');const r2=await rpc('case_room_create',[null,'zaman']);await as('d');await rpc('case_room_join',[r2.code]);await as('a');await rpc('case_room_start',[r2.id]);
 await db.exec('reset role');await db.query("update case_rooms set started_at=now()-interval '20 minutes' where id=$1",[r2.id]);
 await as('a');assert.equal((await rpc('case_room_state',[r2.id])).room.status,'rating');
 const r3=await rpc('case_room_create',[null,'sgk']);await as('b');await rpc('case_room_join',[r3.code]);await as('a');await rpc('case_room_start',[r3.id]);
 const s3=await rpc('case_room_state',[r3.id]);const doc=Object.keys(ids).find(k=>ids[k]===s3.members.find(m=>m.role==='doctor').user_id);
 await as(doc==='a'?'a':'a');await rpc('case_room_end',[r3.id]);assert.equal((await rpc('case_room_state',[r3.id])).room.status,'cancelled');
 console.log('PASS: PJP-only rooms, join limits, random roles, server-enforced turn order and turn limit, rater-only scoring with hidden scores, points and regional leaderboard, stale-room handling');
})().catch(e=>{console.error(e);process.exitCode=1;});
