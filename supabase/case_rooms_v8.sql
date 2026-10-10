-- Sanal vaka odaları: 2-3 PJP aynı senaryoyu canlı oynar (mümessil, hekim, gözlemci).
-- duels_v4.sql'den sonra çalıştırın (bölge bilgisi duel_members tablosundan gelir). Dosyanın tamamını çalıştırın; tekrar çalıştırılabilir.
-- Tablolara doğrudan erişim kapalıdır; tüm işlemler aşağıdaki fonksiyonlarla ve sunucudaki kurallarla yapılır.
begin;

create table if not exists public.case_rooms(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-Z2-9]{6}$'),
 creator uuid not null references public.profiles(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 scenario text not null check(scenario in ('kanit','rakip','zaman','sgk')),
 status text not null default 'waiting' check(status in ('waiting','live','rating','done','cancelled')),
 turn_limit int not null default 5,
 created_at timestamptz not null default now(),
 started_at timestamptz, ended_at timestamptz
);
create table if not exists public.case_room_members(
 room_id uuid references public.case_rooms(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,
 role text check(role in ('rep','doctor','observer')),
 points int not null default 0,
 joined_at timestamptz not null default now(),
 primary key(room_id, user_id)
);
create table if not exists public.case_room_messages(
 id bigint generated always as identity primary key,
 room_id uuid not null references public.case_rooms(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('rep','doctor')),
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create table if not exists public.case_room_ratings(
 room_id uuid references public.case_rooms(id) on delete cascade,
 rater_id uuid references public.profiles(id) on delete cascade,
 role text not null check(role in ('doctor','observer')),
 scores jsonb not null, total int not null check(total between 0 and 100),
 comment text check(comment is null or length(comment) <= 1000),
 created_at timestamptz not null default now(),
 primary key(room_id, rater_id)
);
create table if not exists public.case_room_feedback(
 room_id uuid primary key references public.case_rooms(id) on delete cascade,
 body text not null check(length(body) between 1 and 6000),
 created_at timestamptz not null default now()
);
create index if not exists case_rooms_open on public.case_rooms(status, created_at);
create index if not exists case_room_messages_room on public.case_room_messages(room_id, id);
alter table public.case_rooms enable row level security;
alter table public.case_room_members enable row level security;
alter table public.case_room_messages enable row level security;
alter table public.case_room_ratings enable row level security;
alter table public.case_room_feedback enable row level security;
revoke all on public.case_rooms, public.case_room_members, public.case_room_messages, public.case_room_ratings, public.case_room_feedback from anon, authenticated;

create or replace function public.case_room_player() returns boolean language sql stable security definer set search_path = public as $$
 select public.is_active() and public.my_job_role() = 'pjp'
$$;

-- Süresi dolan canlı odayı puanlamaya, 24 saattir puanlanan odayı sonuca taşır.
create or replace function public.case_room_tick(p_room uuid) returns void language plpgsql security definer set search_path = public as $$
declare r public.case_rooms;
begin
 select * into r from public.case_rooms where id = p_room for update;
 if r.status = 'live' and r.started_at < now() - interval '15 minutes' then
  update public.case_rooms set status = 'rating', ended_at = now() where id = p_room;
 elsif r.status = 'rating' and r.ended_at < now() - interval '24 hours' then
  perform public.case_room_finalize(p_room);
 elsif r.status = 'waiting' and r.created_at < now() - interval '2 hours' then
  update public.case_rooms set status = 'cancelled' where id = p_room;
 end if;
end $$;

-- Mümessilin puanı, hekim ve gözlemci puanlarının ortalamasıdır; puanlayanlar katılım için 20 puan alır.
create or replace function public.case_room_finalize(p_room uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_avg int;
begin
 select round(avg(total))::int into v_avg from public.case_room_ratings where room_id = p_room;
 update public.case_room_members m set points = case when m.role = 'rep' then coalesce(v_avg, 0)
   when exists(select 1 from public.case_room_ratings x where x.room_id = p_room and x.rater_id = m.user_id) then 20 else 0 end
 where m.room_id = p_room;
 update public.case_rooms set status = case when v_avg is null then 'cancelled' else 'done' end where id = p_room;
end $$;

create or replace function public.case_room_create(p_product uuid, p_scenario text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; i int;
begin
 if not public.case_room_player() then raise exception 'Vaka odaları etkin PJP hesaplarına açıktır' using errcode = '42501'; end if;
 if p_product is not null and not exists(select 1 from public.user_products where user_id = auth.uid() and product_id = p_product) then raise exception 'Bu ürün size atanmamış'; end if;
 if (select count(*) from public.case_rooms r join public.case_room_members m on m.room_id = r.id
     where m.user_id = auth.uid() and r.status in ('waiting','live')) >= 2 then raise exception 'Aynı anda en fazla 2 açık odanız olabilir'; end if;
 for i in 1..20 loop
  v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
  exit when not exists(select 1 from public.case_rooms where code = v_code);
 end loop;
 insert into public.case_rooms(code, creator, product_id, scenario) values(v_code, auth.uid(), p_product, p_scenario) returning id into v_id;
 insert into public.case_room_members(room_id, user_id) values(v_id, auth.uid());
 return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.case_room_join(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.case_rooms;
begin
 if not public.case_room_player() then raise exception 'Vaka odaları etkin PJP hesaplarına açıktır' using errcode = '42501'; end if;
 select * into r from public.case_rooms where code = upper(trim(p_code)) for update;
 if r.id is null then raise exception 'Oda bulunamadı'; end if;
 perform public.case_room_tick(r.id);
 if exists(select 1 from public.case_room_members where room_id = r.id and user_id = auth.uid()) then return r.id; end if;
 if (select status from public.case_rooms where id = r.id) <> 'waiting' then raise exception 'Oda artık katılıma açık değil'; end if;
 if (select count(*) from public.case_room_members where room_id = r.id) >= 3 then raise exception 'Oda dolu'; end if;
 insert into public.case_room_members(room_id, user_id) values(r.id, auth.uid());
 return r.id;
end $$;

create or replace function public.case_room_leave(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.case_rooms;
begin
 select * into r from public.case_rooms where id = p_room for update;
 if r.status <> 'waiting' then raise exception 'Başlamış odadan ayrılamazsınız'; end if;
 if r.creator = auth.uid() then update public.case_rooms set status = 'cancelled' where id = p_room;
 else delete from public.case_room_members where room_id = p_room and user_id = auth.uid(); end if;
end $$;

-- Roller rastgele dağıtılır: mümessil, hekim ve (üçüncü kişi varsa) gözlemci.
create or replace function public.case_room_start(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.case_rooms;
begin
 select * into r from public.case_rooms where id = p_room for update;
 if r.creator is distinct from auth.uid() then raise exception 'Odayı yalnızca kuran kişi başlatabilir'; end if;
 if r.status <> 'waiting' then raise exception 'Oda zaten başladı'; end if;
 if (select count(*) from public.case_room_members where room_id = p_room) < 2 then raise exception 'En az 2 katılımcı gerekli'; end if;
 with shuffled as (select user_id, row_number() over (order by random()) as n from public.case_room_members where room_id = p_room)
 update public.case_room_members m set role = (array['rep','doctor','observer'])[s.n] from shuffled s where m.room_id = p_room and m.user_id = s.user_id;
 update public.case_rooms set status = 'live', started_at = now() where id = p_room;
end $$;

-- Sıra kuralı: hekim başlar, sonra mümessil ve hekim sırayla konuşur. Mümessilin son yanıtıyla puanlama başlar.
create or replace function public.case_room_say(p_room uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.case_rooms; v_role text; v_last text; v_rep int;
begin
 perform public.case_room_tick(p_room);
 select * into r from public.case_rooms where id = p_room for update;
 select role into v_role from public.case_room_members where room_id = p_room and user_id = auth.uid();
 if v_role is null or v_role not in ('rep','doctor') then raise exception 'Bu odada konuşma rolünüz yok' using errcode = '42501'; end if;
 if r.status <> 'live' then raise exception 'Görüşme devam etmiyor'; end if;
 select role into v_last from public.case_room_messages where room_id = p_room order by id desc limit 1;
 if coalesce(v_last, 'rep') = v_role then raise exception 'Sıra karşı tarafta'; end if;
 insert into public.case_room_messages(room_id, user_id, role, body) values(p_room, auth.uid(), v_role, trim(p_body));
 select count(*) into v_rep from public.case_room_messages where room_id = p_room and role = 'rep';
 if v_role = 'rep' and v_rep >= r.turn_limit then update public.case_rooms set status = 'rating', ended_at = now() where id = p_room; end if;
end $$;

create or replace function public.case_room_end(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.case_rooms;
begin
 select * into r from public.case_rooms where id = p_room for update;
 if r.status <> 'live' then raise exception 'Görüşme devam etmiyor'; end if;
 if r.creator <> auth.uid() and not exists(select 1 from public.case_room_members where room_id = p_room and user_id = auth.uid() and role = 'doctor')
  then raise exception 'Görüşmeyi kuran kişi veya hekim bitirebilir'; end if;
 if not exists(select 1 from public.case_room_messages where room_id = p_room and role = 'rep') then
  update public.case_rooms set status = 'cancelled', ended_at = now() where id = p_room;
 else update public.case_rooms set status = 'rating', ended_at = now() where id = p_room; end if;
end $$;

-- Puanlar 1-5 arası dört ölçüttür; toplam 0-100'e çevrilir. Mümessil kendine puan veremez.
create or replace function public.case_room_rate(p_room uuid, p_scores jsonb, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_role text; k text; v_sum int := 0;
begin
 perform public.case_room_tick(p_room);
 select role into v_role from public.case_room_members where room_id = p_room and user_id = auth.uid();
 if v_role is null or v_role not in ('doctor','observer') then raise exception 'Bu görüşmeyi puanlama rolünüz yok' using errcode = '42501'; end if;
 if (select status from public.case_rooms where id = p_room) <> 'rating' then raise exception 'Puanlama açık değil'; end if;
 foreach k in array array['kanit','itiraz','denge','kapanis'] loop
  if jsonb_typeof(p_scores->k) is distinct from 'number' or (p_scores->>k) !~ '^[1-5]$' then raise exception 'Her ölçüt için 1-5 arası puan gerekli'; end if;
  v_sum := v_sum + (p_scores->>k)::int;
 end loop;
 insert into public.case_room_ratings(room_id, rater_id, role, scores, total, comment)
  values(p_room, auth.uid(), v_role, jsonb_build_object('kanit',p_scores->'kanit','itiraz',p_scores->'itiraz','denge',p_scores->'denge','kapanis',p_scores->'kapanis'),
   round((v_sum - 4) * 100.0 / 16)::int, nullif(trim(coalesce(p_comment, '')), ''));
 if not exists(select 1 from public.case_room_members m where m.room_id = p_room and m.role in ('doctor','observer')
   and not exists(select 1 from public.case_room_ratings x where x.room_id = p_room and x.rater_id = m.user_id)) then
  perform public.case_room_finalize(p_room);
 end if;
exception when unique_violation then raise exception 'Bu görüşmeyi zaten puanladınız';
end $$;

-- Yapay zekâ geri bildirimi yalnızca koçluk içindir, puana katılmaz. İlk kaydedilen kalır.
create or replace function public.case_room_feedback_save(p_room uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
 if not exists(select 1 from public.case_room_members where room_id = p_room and user_id = auth.uid()) then raise exception 'Oda üyesi değilsiniz' using errcode = '42501'; end if;
 if (select status from public.case_rooms where id = p_room) not in ('rating','done') then raise exception 'Görüşme bitmedi'; end if;
 insert into public.case_room_feedback(room_id, body) values(p_room, left(p_body, 6000)) on conflict (room_id) do nothing;
end $$;

create or replace function public.case_room_state(p_room uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.case_rooms; v_done boolean;
begin
 if not exists(select 1 from public.case_room_members where room_id = p_room and user_id = auth.uid()) then raise exception 'Oda üyesi değilsiniz' using errcode = '42501'; end if;
 perform public.case_room_tick(p_room);
 select * into r from public.case_rooms where id = p_room;
 v_done := r.status = 'done';
 return jsonb_build_object(
  'room', to_jsonb(r) || jsonb_build_object('product', (select name from public.products where id = r.product_id), 'now', now()),
  'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(p.full_name, p.email), 'role', m.role, 'points', m.points,
     'rated', exists(select 1 from public.case_room_ratings x where x.room_id = p_room and x.rater_id = m.user_id)) order by m.joined_at)
     from public.case_room_members m join public.profiles p on p.id = m.user_id where m.room_id = p_room),
  'messages', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'role', role, 'body', body, 'at', created_at) order by id) from public.case_room_messages where room_id = p_room), '[]'::jsonb),
  -- Puanlar herkes puanlayana kadar gizli kalır; kişi yalnızca kendi verdiği puanı görür.
  'ratings', coalesce((select jsonb_agg(jsonb_build_object('role', role, 'scores', scores, 'total', total, 'comment', comment))
     from public.case_room_ratings where room_id = p_room and (v_done or rater_id = auth.uid())), '[]'::jsonb),
  'feedback', (select body from public.case_room_feedback where room_id = p_room)
 );
end $$;

create or replace function public.case_room_list() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
 if not public.case_room_player() then raise exception 'Vaka odaları etkin PJP hesaplarına açıktır' using errcode = '42501'; end if;
 return jsonb_build_object(
  'open', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'scenario', r.scenario, 'product', (select name from public.products where id = r.product_id),
     'creator', (select coalesce(full_name, email) from public.profiles where id = r.creator), 'members', (select count(*) from public.case_room_members where room_id = r.id), 'created_at', r.created_at) order by r.created_at desc)
     from public.case_rooms r where r.status = 'waiting' and r.created_at > now() - interval '2 hours'
     and (select count(*) from public.case_room_members where room_id = r.id) < 3
     and not exists(select 1 from public.case_room_members where room_id = r.id and user_id = auth.uid())), '[]'::jsonb),
  'mine', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'scenario', r.scenario, 'status', r.status, 'role', m.role, 'points', m.points,
     'product', (select name from public.products where id = r.product_id), 'created_at', r.created_at) order by r.created_at desc)
     from public.case_rooms r join public.case_room_members m on m.room_id = r.id
     where m.user_id = auth.uid() and r.created_at > now() - interval '30 days' and r.status <> 'cancelled'), '[]'::jsonb)
 );
end $$;

-- Aylık sıralama. Bölge, bilgi yarışmasında seçilen bölgedir.
create or replace function public.case_room_leaderboard(p_season date default date_trunc('month', now() at time zone 'Europe/Istanbul')::date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
 if not public.is_active() then raise exception 'Etkin oturum gerekli' using errcode = '42501'; end if;
 return (with pts as (
   select m.user_id, sum(m.points) as points, count(*) filter (where m.role = 'rep') as rooms
   from public.case_room_members m join public.case_rooms r on r.id = m.room_id
   where r.status = 'done' and date_trunc('month', r.started_at at time zone 'Europe/Istanbul')::date = p_season group by m.user_id
  ), ppl as (
   select pts.*, coalesce(p.full_name, p.email) as name, coalesce(dm.region, 'Bölge seçilmedi') as region
   from pts join public.profiles p on p.id = pts.user_id left join public.duel_members dm on dm.user_id = pts.user_id
  )
  select jsonb_build_object(
   'people', coalesce((select jsonb_agg(jsonb_build_object('id', user_id, 'name', name, 'region', region, 'points', points, 'rooms', rooms) order by points desc) from (select * from ppl order by points desc limit 50) t), '[]'::jsonb),
   'regions', coalesce((select jsonb_agg(jsonb_build_object('region', region, 'average', avg_points, 'people', n) order by avg_points desc)
     from (select region, round(avg(points))::int as avg_points, count(*) as n from ppl where region <> 'Bölge seçilmedi' group by region) g), '[]'::jsonb)
  ));
end $$;

do $$ declare f text; begin
 foreach f in array array['case_room_player()','case_room_tick(uuid)','case_room_finalize(uuid)'] loop
  execute format('revoke all on function public.%s from public, anon, authenticated', f);
 end loop;
 foreach f in array array['case_room_create(uuid,text)','case_room_join(text)','case_room_leave(uuid)','case_room_start(uuid)','case_room_say(uuid,text)',
   'case_room_end(uuid)','case_room_rate(uuid,jsonb,text)','case_room_feedback_save(uuid,text)','case_room_state(uuid)','case_room_list()','case_room_leaderboard(date)'] loop
  execute format('revoke all on function public.%s from public, anon', f);
  execute format('grant execute on function public.%s to authenticated', f);
 end loop;
end $$;

commit;
