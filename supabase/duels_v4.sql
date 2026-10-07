-- Monthly PJP competition. Run transactionally after features_v3.sql.
create table if not exists public.duel_members (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 region text not null check(region in ('Karadeniz','Akdeniz','Marmara','İç Anadolu','Ege')),
 updated_at timestamptz not null default now()
);
create table if not exists public.duel_questions (
 id uuid primary key default gen_random_uuid(), category text not null check(category in ('Rakip analizi','Ürün bilgisi','İlaç bilgisi','Hekim görüşmesi','Saha planlama')),
 question text not null, options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
 answer int not null check(answer between 0 and 3), explanation text not null,
 source_note text, status text not null default 'draft' check(status in ('draft','in_review','approved','rejected')),
 reviewed_by uuid,reviewed_at timestamptz,review_note text,created_by uuid default auth.uid(),created_at timestamptz default now()
);
create table if not exists public.duels (
 id uuid primary key default gen_random_uuid(), challenger uuid not null references public.profiles(id), opponent uuid not null references public.profiles(id),
 season date not null default date_trunc('month',now() at time zone 'Europe/Istanbul')::date,
 status text not null default 'invited' check(status in ('invited','active','finished','declined','expired')),
 questions jsonb, created_at timestamptz not null default now(),expires_at timestamptz not null,
 accepted_at timestamptz,finished_at timestamptz,winner uuid,
 check(challenger<>opponent)
);
create table if not exists public.duel_players (
 duel_id uuid references public.duels(id) on delete cascade,user_id uuid references public.profiles(id),region text not null,
 answers jsonb not null default '[]',started_at timestamptz,score int not null default 0,correct int not null default 0,
 elapsed_ms bigint not null default 0,completed_at timestamptz,primary key(duel_id,user_id)
);
create table if not exists public.duel_results (
 duel_id uuid references public.duels(id),user_id uuid references public.profiles(id),season date not null,region text not null,
 points int not null,correct int not null,elapsed_ms bigint not null,won boolean not null,created_at timestamptz default now(),
 primary key(duel_id,user_id)
);
create table if not exists public.duel_reward_rules (
 id uuid primary key default gen_random_uuid(),name text not null,min_points int not null check(min_points>0),
 amount_try numeric(12,2) not null default 0 check(amount_try>=0),reward text not null,enabled boolean not null default true
);
create table if not exists public.duel_rewards (
 id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id),season date not null,rule_id uuid references public.duel_reward_rules(id),
 name text not null,amount_try numeric(12,2) not null,reward text not null,status text not null default 'earned' check(status in ('earned','approved','delivered')),
 reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz default now(),unique(user_id,season,rule_id)
);
create index if not exists duel_results_season_idx on public.duel_results(season,user_id);
create index if not exists duels_expiry_idx on public.duels(status,expires_at);
do $$ declare t text; begin
 foreach t in array array['duel_members','duel_questions','duels','duel_players','duel_results','duel_reward_rules','duel_rewards'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
grant select,insert,update on public.duel_questions,public.duel_reward_rules to authenticated;
grant select on public.duel_rewards to authenticated;
drop policy if exists "duel questions review" on public.duel_questions;
create policy "duel questions review" on public.duel_questions for select to authenticated using(public.is_admin() or (public.is_active() and public.my_job_role()='avukat'));
drop policy if exists "duel questions admin" on public.duel_questions;
create policy "duel questions admin" on public.duel_questions for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "duel reward rules admin" on public.duel_reward_rules;
create policy "duel reward rules admin" on public.duel_reward_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "duel rewards read" on public.duel_rewards;
create policy "duel rewards read" on public.duel_rewards for select to authenticated using(public.is_admin() or (public.is_active() and user_id=auth.uid()));
create or replace function public.is_pjp() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active' and job_role='pjp');
$$;
create or replace function public.duel_question_guard() returns trigger language plpgsql as $$
begin
 if length(trim(new.question))<5 or length(trim(new.explanation))<5 then raise exception 'Soru ve açıklama gerekli'; end if;
 if exists(select 1 from jsonb_array_elements(new.options) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}'))=0) then raise exception 'Dört şık dolu olmalı'; end if;
 if tg_op='UPDATE' and (new.question is distinct from old.question or new.options is distinct from old.options or new.answer is distinct from old.answer or new.explanation is distinct from old.explanation or new.category is distinct from old.category or new.source_note is distinct from old.source_note) then
  new.status:='draft';new.reviewed_by:=null;new.reviewed_at:=null;new.review_note:=null;
 end if; return new;
end $$;
drop trigger if exists duel_question_guard on public.duel_questions;
create trigger duel_question_guard before insert or update on public.duel_questions for each row execute function public.duel_question_guard();
create or replace function public.duel_review_question(p_id uuid,p_decision text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not(public.is_admin() or (public.is_active() and public.my_job_role()='avukat')) then raise exception 'Yetkiniz yok';end if;
 if p_decision not in ('approved','rejected') or (p_decision='rejected' and coalesce(trim(p_note),'')='') then raise exception 'Geçerli karar ve ret gerekçesi gerekli';end if;
 update public.duel_questions set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_note where id=p_id and status='in_review';
 if not found then raise exception 'Soru inceleme kuyruğunda değil';end if;
end $$;
create or replace function public.duel_choose_region(p_region text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_pjp() then raise exception 'Etkin PJP hesabı gerekli';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if p_region not in ('Karadeniz','Akdeniz','Marmara','İç Anadolu','Ege') or p_region is null then raise exception 'Geçersiz bölge';end if;
 if exists(select 1 from public.duel_members where user_id=auth.uid() and region=p_region) then return;end if;
 if exists(select 1 from public.duel_results where user_id=auth.uid() and season=date_trunc('month',now() at time zone 'Europe/Istanbul')::date)
 or exists(select 1 from public.duels where status in ('invited','active') and expires_at>now() and auth.uid() in (challenger,opponent)) then raise exception 'Davet, düello veya sezon puanı varken bölge değiştirilemez';end if;
 insert into public.duel_members(user_id,region) values(auth.uid(),p_region) on conflict(user_id) do update set region=excluded.region,updated_at=now();
end $$;
create or replace function public.duel_create(p_opponent uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare id uuid; month_start date:=date_trunc('month',now() at time zone 'Europe/Istanbul')::date;
begin
 if not public.is_pjp() then raise exception 'Etkin PJP hesabı gerekli';end if;
 if p_opponent is null or p_opponent=auth.uid() then raise exception 'Başka bir PJP seçin';end if;
 -- Consistent profile lock order makes concurrent invitation limits reliable.
 perform 1 from public.profiles where profiles.id in(auth.uid(),p_opponent) order by profiles.id for update;
 if not exists(select 1 from public.profiles where profiles.id=p_opponent and status='active' and job_role='pjp') then raise exception 'Rakip etkin PJP olmalı';end if;
 if (select count(*) from public.duel_members where user_id in(auth.uid(),p_opponent))<>2 then raise exception 'İki PJP de bölge seçmeli';end if;
 if (select count(distinct category) from public.duel_questions where status='approved')<5 then raise exception 'Beş kategorinin her birinde onaylı soru gerekli';end if;
 if exists(select 1 from public.duels where ((challenger=auth.uid() and opponent=p_opponent) or (opponent=auth.uid() and challenger=p_opponent)) and (created_at at time zone 'Europe/Istanbul')::date=(now() at time zone 'Europe/Istanbul')::date) then raise exception 'Aynı rakiple günde bir düello';end if;
 if (select count(*) from public.duels where auth.uid() in(challenger,opponent) and status in('invited','active','finished') and (created_at at time zone 'Europe/Istanbul')::date=(now() at time zone 'Europe/Istanbul')::date)>=5 then raise exception 'Günlük beş düello sınırı';end if;
 if (select count(*) from public.duels where p_opponent in(challenger,opponent) and status in('invited','active','finished') and (created_at at time zone 'Europe/Istanbul')::date=(now() at time zone 'Europe/Istanbul')::date)>=5 then raise exception 'Rakibin günlük düello sınırı dolu';end if;
 insert into public.duels(challenger,opponent,season,expires_at) values(auth.uid(),p_opponent,month_start,least(now()+interval '24 hours',((month_start+interval '1 month')::timestamp at time zone 'Europe/Istanbul'))) returning duels.id into id;
 return id;
end $$;
create or replace function public.duel_respond(p_duel uuid,p_accept boolean) returns void
language plpgsql security definer set search_path=public as $$
declare d public.duels;q jsonb;
begin
 if not public.is_pjp() then raise exception 'Etkin PJP hesabı gerekli';end if;
 select * into d from public.duels where id=p_duel for update;
 if d.id is null or d.opponent is distinct from auth.uid() then raise exception 'Davet size ait değil';end if;
 if d.status<>'invited' or d.expires_at<=now() then raise exception 'Davet kapanmış';end if;
 if p_accept is null then raise exception 'Kabul veya ret seçin';end if;
 if not p_accept then update public.duels set status='declined' where id=d.id;return;end if;
 if not exists(select 1 from public.profiles where id=d.challenger and status='active' and job_role='pjp') then raise exception 'Rakip artık etkin PJP değil';end if;
 select jsonb_agg(to_jsonb(x) order by random()) into q from (
 select distinct on(category) id,category,question,options,answer,explanation from public.duel_questions where status='approved' order by category,random()) x;
 if jsonb_array_length(q)<>5 then raise exception 'Beş kategoride onaylı soru gerekli';end if;
 update public.duels set status='active',questions=q,accepted_at=now(),expires_at=least(now()+interval '24 hours',((d.season+interval '1 month')::timestamp at time zone 'Europe/Istanbul')) where id=d.id;
 insert into public.duel_players(duel_id,user_id,region) select d.id,m.user_id,m.region from public.duel_members m where m.user_id in(d.challenger,d.opponent);
end $$;
create or replace function public.duel_settle(p_duel uuid) returns void
language plpgsql security definer set search_path=public as $$
declare d public.duels;w uuid;both_done boolean;is_tie boolean;total int;
begin
 select * into d from public.duels where id=p_duel for update;
 if d.id is null or d.status<>'active' then return;end if;
 if not(public.is_admin() or (public.is_pjp() and auth.uid() in(d.challenger,d.opponent))) then raise exception 'Erişim yok';end if;
 select count(*)=2 into both_done from public.duel_players where duel_id=d.id and completed_at is not null;
 if not both_done and d.expires_at>clock_timestamp() then return;end if;
 if both_done then
  select count(distinct score)=1 into is_tie from public.duel_players where duel_id=d.id;
  if not is_tie then select user_id into w from public.duel_players where duel_id=d.id order by score desc limit 1;end if;
 end if;
 update public.duels set status='finished',finished_at=now(),winner=w where id=d.id;
 insert into public.duel_results(duel_id,user_id,season,region,points,correct,elapsed_ms,won)
 select d.id,p.user_id,d.season,p.region,case when p.completed_at is null then 0 else p.score+case when both_done and p.correct>=3 and p.user_id=w then 100 when both_done and p.correct>=3 and is_tie then 50 else 0 end end,p.correct,p.elapsed_ms,coalesce(p.user_id=w,false)
 from public.duel_players p where duel_id=d.id on conflict do nothing;
 insert into public.duel_rewards(user_id,season,rule_id,name,amount_try,reward)
 select t.user_id,d.season,r.id,r.name,r.amount_try,r.reward from (
 select user_id,sum(points) as points from public.duel_results where season=d.season and user_id in(d.challenger,d.opponent) group by user_id) t
 join public.duel_reward_rules r on r.enabled and t.points>=r.min_points on conflict(user_id,season,rule_id) do nothing;
end $$;
create or replace function public.duel_next(p_duel uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.duels;p public.duel_players;q jsonb;i int;
begin
 if not public.is_pjp() then raise exception 'Etkin PJP hesabı gerekli';end if;
 select * into d from public.duels where id=p_duel for update;
 if d.id is null or auth.uid() not in(d.challenger,d.opponent) then raise exception 'Erişim yok';end if;
 perform public.duel_settle(d.id);
 select * into d from public.duels where id=d.id;
 if d.status<>'active' then return jsonb_build_object('status',d.status);end if;
 select * into p from public.duel_players where duel_id=d.id and user_id=auth.uid() for update;
 if p.completed_at is not null then return jsonb_build_object('status','waiting','score',p.score,'correct',p.correct);end if;
 i:=jsonb_array_length(p.answers);q:=d.questions->i;
 if p.started_at is null then update public.duel_players set started_at=clock_timestamp() where duel_id=d.id and user_id=auth.uid() returning started_at into p.started_at;end if;
 return jsonb_build_object('status','question','index',i,'total',5,'question',q->>'question','options',q->'options','category',q->>'category','deadline',p.started_at+interval '30 seconds','server_time',clock_timestamp());
end $$;
create or replace function public.duel_answer(p_duel uuid,p_index int,p_option int default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.duels;p public.duel_players;q jsonb;elapsed bigint;ok boolean;points int;
begin
 if not public.is_pjp() then raise exception 'Etkin PJP hesabı gerekli';end if;
 select * into d from public.duels where id=p_duel for update;
 if d.id is null or auth.uid() not in(d.challenger,d.opponent) or d.status<>'active' or d.expires_at<=clock_timestamp() then raise exception 'Düello açık değil';end if;
 select * into p from public.duel_players where duel_id=d.id and user_id=auth.uid() for update;
 if p.completed_at is not null or p.started_at is null or p_index is distinct from jsonb_array_length(p.answers) then raise exception 'Bu soru artık açık değil';end if;
 if p_option is not null and p_option not between 0 and 3 then raise exception 'Geçersiz şık';end if;
 elapsed:=greatest(0,ceil(extract(epoch from(clock_timestamp()-p.started_at))*1000)::bigint);
 if p_option is null and elapsed<30000 then raise exception 'Süre dolmadan boş cevap gönderilemez';end if;
 q:=d.questions->p_index;ok:=elapsed<30000 and p_option is not null and p_option=(q->>'answer')::int;
 points:=case when ok then 100+greatest(0,floor(50*(30000-elapsed)/30000.0)::int) else 0 end;
 update public.duel_players set answers=answers||jsonb_build_array(p_option),score=score+points,correct=correct+case when ok then 1 else 0 end,
 elapsed_ms=elapsed_ms+least(elapsed,30000),started_at=null,completed_at=case when p_index=4 then clock_timestamp() else null end where duel_id=d.id and user_id=auth.uid();
 perform public.duel_settle(d.id);
 return public.duel_next(d.id);
end $$;
create or replace function public.duel_dashboard(p_season date default date_trunc('month',now() at time zone 'Europe/Istanbul')::date) returns jsonb
language plpgsql security definer set search_path=public as $$
declare expired_duel record;person jsonb;regions jsonb;games jsonb;members jsonb;rewards jsonb;rules jsonb;
begin
 if not(public.is_pjp() or public.is_admin()) then raise exception 'PJP veya yönetici hesabı gerekli';end if;
 if p_season is null or p_season<>date_trunc('month',p_season)::date then raise exception 'Ayın ilk günü gerekli';end if;
 update public.duels set status='expired' where status='invited' and expires_at<=now() and auth.uid() in(challenger,opponent);
 for expired_duel in select id from public.duels where status='active' and expires_at<=now() and (public.is_admin() or auth.uid() in(challenger,opponent)) loop perform public.duel_settle(expired_duel.id);end loop;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into person from (
 select p.id,coalesce(nullif(p.full_name,''),'PJP') as name,m.region,coalesce(sum(r.points),0)::int as points,count(r.duel_id)::int as duels,coalesce(sum(r.correct),0)::int as correct,coalesce(sum(r.elapsed_ms),0)::bigint as elapsed_ms,count(r.duel_id) filter(where r.won)::int as wins
 from public.profiles p join public.duel_members m on m.user_id=p.id left join public.duel_results r on r.user_id=p.id and r.season=p_season
 where p.status='active' and p.job_role='pjp' group by p.id,p.full_name,m.region order by points desc,correct desc,elapsed_ms,p.id) x;
 select jsonb_agg(to_jsonb(x) order by average desc,total desc,region) into regions from (
 select z.region,coalesce(sum(t.points),0)::int as total,count(t.user_id)::int as participants,coalesce(round(avg(t.points),1),0) as average
 from unnest(array['Karadeniz','Akdeniz','Marmara','İç Anadolu','Ege']) z(region)
 left join(select user_id,region,sum(points) as points from public.duel_results where season=p_season group by user_id,region) t on t.region=z.region group by z.region) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into games from(
 select d.id,d.status,d.created_at,d.expires_at,d.challenger,d.opponent,d.winner,
 coalesce(c.full_name,'PJP') as challenger_name,coalesce(o.full_name,'PJP') as opponent_name,
 coalesce((select completed_at is not null from public.duel_players where duel_id=d.id and user_id=auth.uid()),false) as mine_done,
 (select jsonb_agg(jsonb_build_object('user_id',user_id,'score',points,'correct',correct)) from public.duel_results where duel_id=d.id) as results
 from public.duels d join public.profiles c on c.id=d.challenger join public.profiles o on o.id=d.opponent
 where auth.uid() in(d.challenger,d.opponent) and season=p_season order by created_at desc limit 50) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.full_name,''),'PJP'),'region',m.region) order by p.full_name),'[]') into members
 from public.profiles p join public.duel_members m on m.user_id=p.id where p.status='active' and p.job_role='pjp' and p.id<>auth.uid();
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') into rewards from public.duel_rewards r where r.season=p_season and r.user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'min_points',min_points,'amount_try',amount_try,'reward',reward) order by min_points),'[]') into rules from public.duel_reward_rules where enabled;
 return jsonb_build_object('season',p_season,'region',(select region from public.duel_members where user_id=auth.uid()),'people',person,'regions',regions,'games',games,'members',members,'rewards',rewards,'rules',rules,'ready_categories',(select count(distinct category) from public.duel_questions where status='approved'));
end $$;
create or replace function public.duel_reward_decide(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Yönetici gerekli';end if;
 if p_status not in('approved','delivered') then raise exception 'Geçersiz durum';end if;
 update public.duel_rewards set status=p_status,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id and ((p_status='approved' and status='earned') or (p_status='delivered' and status='approved'));
 if not found then raise exception 'Hak ediş durumu değişmiş';end if;
end $$;
do $$ declare f record;t text;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'duel_%' or proname='is_pjp') loop
  execute format('revoke execute on function %s from public,anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
 foreach t in array array['duel_members','duel_questions','duels','duel_results','duel_reward_rules','duel_rewards'] loop
  execute format('drop trigger if exists record_audit on public.%I',t);
  execute format('create trigger record_audit after insert or update or delete on public.%I for each row execute function public.record_audit()',t);
 end loop;
end $$;
insert into public.duel_reward_rules(name,min_points,reward) select 'Bronz',1000,'Bronz başarı rozeti' where not exists(select 1 from public.duel_reward_rules where name='Bronz');
insert into public.duel_reward_rules(name,min_points,reward) select 'Gümüş',2500,'Gümüş başarı rozeti' where not exists(select 1 from public.duel_reward_rules where name='Gümüş');
insert into public.duel_reward_rules(name,min_points,reward) select 'Altın',5000,'Altın başarı rozeti' where not exists(select 1 from public.duel_reward_rules where name='Altın');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Rakip analizi','İki ürünün klinik çalışma sonuçlarını karşılaştırmadan önce hangi bilgiyi kontrol etmelisiniz?','["Yalnızca ürün renklerini","Hasta grubu, çalışma tasarımı ve sonuç ölçütlerini","Sadece tanıtım sloganlarını","Temsilcilerin kişisel görüşlerini"]'::jsonb,1,'Farklı hasta grupları ve çalışma tasarımları, doğrudan karşılaştırmanın yorumunu etkiler.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='İki ürünün klinik çalışma sonuçlarını karşılaştırmadan önce hangi bilgiyi kontrol etmelisiniz?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Rakip analizi','Rakip ürün hakkında doğrulanmamış bir iddia duyduğunuzda en uygun yaklaşım hangisidir?','["İddiayı kesin bilgi olarak paylaşmak","İddiayı büyüterek anlatmak","Onaylı ve güncel kaynaklardan doğrulamak","Kaynağı belirtmeden kullanmak"]'::jsonb,2,'Karşılaştırma iddiaları paylaşılmadan önce güncel ve onaylı kaynaklarla doğrulanmalıdır.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Rakip ürün hakkında doğrulanmamış bir iddia duyduğunuzda en uygun yaklaşım hangisidir?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Ürün bilgisi','Bir ürünün onaylı kullanım bilgisini kontrol etmek için öncelikle hangi kaynağa başvurursunuz?','["Sosyal medya yorumlarına","Güncel onaylı ürün bilgisi ve şirket materyaline","Eski bir tanıtım sloganına","Kişisel tahmine"]'::jsonb,1,'Güncel onaylı ürün bilgisi, ürün eğitiminde temel kaynaktır.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Bir ürünün onaylı kullanım bilgisini kontrol etmek için öncelikle hangi kaynağa başvurursunuz?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Ürün bilgisi','Ürünle ilgili bir sorunun cevabından emin değilseniz ne yapmalısınız?','["Yanıt uydurmak","Konuyu kesin bilgi gibi sunmak","Belirsizliği belirtip ilgili birimden doğrulamak","Rakibin metnini kaynak göstermeden kopyalamak"]'::jsonb,2,'Emin olunmayan bilgiyi doğrulamak ve doğru birime yönlendirmek bilgi güvenilirliğini korur.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Ürünle ilgili bir sorunun cevabından emin değilseniz ne yapmalısınız?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'İlaç bilgisi','Bir ilaç bilgisinin güncelliğini değerlendirirken hangi kontrol uygundur?','["Belgenin sürümü, tarihi ve onay durumu","Belgenin yazı tipi","Broşürün boyutu","Sunumun animasyonu"]'::jsonb,0,'Sürüm, tarih ve onay bilgileri kullanılan metnin güncel ve uygun olduğunu değerlendirmeye yardımcı olur.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Bir ilaç bilgisinin güncelliğini değerlendirirken hangi kontrol uygundur?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'İlaç bilgisi','Bireysel hastanın tedavisi hakkında temsilciye soru yöneltildiğinde uygun yaklaşım nedir?','["Kendi başına tedavi seçmek","Reçete değişikliği önermek","Tıbbi karar vermeden ilgili tıbbi birime yönlendirmek","Doz değişikliği tahmin etmek"]'::jsonb,2,'Temsilci, bireysel hasta için tedavi kararı vermeden soruyu ilgili tıbbi birime yönlendirmelidir.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Bireysel hastanın tedavisi hakkında temsilciye soru yöneltildiğinde uygun yaklaşım nedir?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Hekim görüşmesi','Hekim görüşmesi öncesinde hangi hazırlık daha uygundur?','["Amaç ve ihtiyaçları belirleyip onaylı materyali hazırlamak","Doğrulanmamış iddialar hazırlamak","Her hekim için aynı ezber konuşmayı yapmak","Görüşme amacını hiç düşünmemek"]'::jsonb,0,'Görüşmenin amacı, hekimin ihtiyacı ve uygun materyal planlı bir görüşmenin temelidir.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Hekim görüşmesi öncesinde hangi hazırlık daha uygundur?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Hekim görüşmesi','Görüşme sırasında iyi bir dinleme davranışı hangisidir?','["Hekimin sözünü sürekli kesmek","Soruyu netleştirip anladığınızı özetlemek","Soruları görmezden gelmek","Yalnızca hazırlanan metni okumak"]'::jsonb,1,'Soruyu netleştirmek ve özetlemek ihtiyacın doğru anlaşılmasını sağlar.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Görüşme sırasında iyi bir dinleme davranışı hangisidir?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Saha planlama','Bir ziyaret kaydına hangi bilgi yazılmalıdır?','["Hastanın kimlik ve teşhis bilgileri","Görüşme amacı, genel konu ve takip aksiyonu","Hastanın kimlik numarası","Hasta dosyasının tamamı"]'::jsonb,1,'Ziyaret kayıtları genel görüşme konuları ve takip aksiyonlarına odaklanmalı; hasta bilgisi içermemelidir.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Bir ziyaret kaydına hangi bilgi yazılmalıdır?');

insert into public.duel_questions(category,question,options,answer,explanation,source_note,status) select 'Saha planlama','Görüşme sonunda belirlenen bir takip aksiyonu için hangisi uygundur?','["Aksiyonu hiç kaydetmemek","Sorumlu, hedef tarih ve aksiyonu kaydetmek","Gerçekleşmeyen ziyareti gerçekleşmiş göstermek","Hekim sorusunu değiştirmek"]'::jsonb,1,'Aksiyonun sorumlusu ve hedef tarihinin kaydı, takibin düzenli yapılmasına yardımcı olur.','Başlangıç taslağı: şirketin güncel ürün belgeleri, saha eğitim materyalleri ve politikalarıyla doğrulayın.','draft' where not exists(select 1 from public.duel_questions where question='Görüşme sonunda belirlenen bir takip aksiyonu için hangisi uygundur?');

