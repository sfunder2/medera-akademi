-- =====================================================================
-- Medera Akademi — v2 yükseltmesi
-- schema.sql'den SONRA çalıştırın (SQL Editor → New query → yapıştır → Run)
-- Eklenenler: iş rolleri (PJP / Ürün Müdürü / Avukat), yönetici onayı,
-- hukuk onayı (MLR), duyurular, ürün müdürü ekip raporu
-- =====================================================================

-- ---------- Profil alanları ----------
alter table public.profiles add column if not exists job_role text not null default 'pjp';
-- Preserve v1 accounts only when introducing the status column for the first time.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status') then
    alter table public.profiles add column status text not null default 'active';
    alter table public.profiles alter column status set default 'pending';
  end if;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_job_role_chk check (job_role in ('pjp','urun_muduru','avukat'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_status_chk check (status in ('pending','active','disabled'));
exception when duplicate_object then null; end $$;

-- Re-running this migration never approves pending accounts.

-- ---------- Yardımcı fonksiyonlar ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.my_job_role() returns text
language sql stable security definer set search_path = public as $$
  select job_role from public.profiles where id = auth.uid();
$$;

-- Kayıtta ad ve rolü al; rol listede yoksa PJP
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := coalesce(new.raw_user_meta_data->>'job_role', 'pjp');
begin
  -- İSTEĞE BAĞLI: yalnızca şirket alan adı
  -- if new.email not ilike '%@sirketiniz.com' then raise exception 'Bu e-posta alan adına izin verilmiyor'; end if;
  if v_role not in ('pjp','urun_muduru','avukat') then v_role := 'pjp'; end if;
  insert into public.profiles (id, email, full_name, job_role, status)
  values (new.id, new.email,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
          v_role, 'pending');
  return new;
end $$;

-- ---------- Hukuk onayı alanları ----------
alter table public.exams     add column if not exists review_status text not null default 'draft';
alter table public.exams     add column if not exists review_note   text;
alter table public.exams     add column if not exists reviewed_by   uuid references public.profiles on delete set null;
alter table public.exams     add column if not exists reviewed_at   timestamptz;
alter table public.curricula add column if not exists review_status text not null default 'draft';
alter table public.curricula add column if not exists review_note   text;
alter table public.curricula add column if not exists reviewed_by   uuid references public.profiles on delete set null;
alter table public.curricula add column if not exists reviewed_at   timestamptz;
do $$ begin
  alter table public.exams add constraint exams_review_chk check (review_status in ('draft','in_review','approved','rejected'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.curricula add constraint curricula_review_chk check (review_status in ('draft','in_review','approved','rejected'));
exception when duplicate_object then null; end $$;

-- Existing content requires an explicit review; do not auto-approve on reruns.
update public.curricula set published = false where published and review_status <> 'approved';

-- İçerik değişince onay düşer; onaysız müfredat yayımlanamaz
create or replace function public.curricula_review_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.review_status = old.review_status
     and (new.title is distinct from old.title or new.modules is distinct from old.modules)
     and old.review_status <> 'draft' then
    new.review_status := 'draft'; new.published := false;
  end if;
  if new.published and new.review_status <> 'approved' then
    raise exception 'Hukuk onayı olmadan müfredat yayımlanamaz';
  end if;
  return new;
end $$;
drop trigger if exists curricula_review_guard on public.curricula;
create trigger curricula_review_guard before insert or update on public.curricula
  for each row execute function public.curricula_review_guard();

create or replace function public.exams_review_guard() returns trigger
language plpgsql as $$
begin
  if new.review_status = old.review_status and old.review_status <> 'draft'
     and (new.title is distinct from old.title or new.questions is distinct from old.questions or new.description is distinct from old.description) then
    new.review_status := 'draft';
  end if;
  return new;
end $$;
drop trigger if exists exams_review_guard on public.exams;
create trigger exams_review_guard before update on public.exams
  for each row execute function public.exams_review_guard();

create or replace function public.exam_keys_review_reset() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.answers is distinct from old.answers or new.explanations is distinct from old.explanations then
    update public.exams set review_status = 'draft' where id = new.exam_id and review_status <> 'draft' and not is_practice;
  end if;
  return new;
end $$;
drop trigger if exists exam_keys_review_reset on public.exam_keys;
create trigger exam_keys_review_reset after update on public.exam_keys
  for each row execute function public.exam_keys_review_reset();

-- Onaysız (pratik olmayan) sınav atanamaz
create or replace function public.assignment_review_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.exams e where e.id = new.exam_id and not e.is_practice and e.review_status <> 'approved') then
    raise exception 'Hukuk onayı olmadan sınav atanamaz';
  end if;
  return new;
end $$;
drop trigger if exists assignment_review_guard on public.exam_assignments;
create trigger assignment_review_guard before insert on public.exam_assignments
  for each row execute function public.assignment_review_guard();

-- ---------- Duyurular ----------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text,
  target_role  text check (target_role in ('pjp','urun_muduru','avukat')),
  pinned       boolean not null default false,
  created_by   uuid references public.profiles on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "ann read" on public.announcements;
drop policy if exists "ann admin" on public.announcements;
create policy "ann read" on public.announcements for select to authenticated
  using (public.is_admin() or (public.is_active() and (target_role is null or target_role = public.my_job_role())));
create policy "ann admin" on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Erişim kurallarını "onaylı hesap" şartıyla yenile ----------
drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select to authenticated using (public.is_active());

drop policy if exists "up read" on public.user_products;
create policy "up read" on public.user_products for select to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_admin());

drop policy if exists "exams read" on public.exams;
create policy "exams read" on public.exams for select to authenticated using (
  public.is_admin() or (public.is_active() and (created_by = auth.uid() or public.has_assignment(id))));
drop policy if exists "exams insert" on public.exams;
create policy "exams insert" on public.exams for insert to authenticated
  with check (public.is_admin() or (public.is_active() and created_by = auth.uid() and is_practice));

drop policy if exists "asg read" on public.exam_assignments;
create policy "asg read" on public.exam_assignments for select to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_admin());
drop policy if exists "asg practice self" on public.exam_assignments;
create policy "asg practice self" on public.exam_assignments for all to authenticated
  using (user_id = auth.uid() and public.is_active() and public.owns_practice(exam_id))
  with check (user_id = auth.uid() and public.is_active() and public.owns_practice(exam_id));

drop policy if exists "cur read" on public.curricula;
create policy "cur read" on public.curricula for select to authenticated using ((published and public.is_active()) or public.is_admin());

drop policy if exists "hcps own" on public.hcps;
create policy "hcps own" on public.hcps for all to authenticated
  using (owner_id = auth.uid() and public.is_active()) with check (owner_id = auth.uid() and public.is_active());
drop policy if exists "int own" on public.interactions;
create policy "int own" on public.interactions for all to authenticated
  using (owner_id = auth.uid() and public.is_active())
  with check (owner_id = auth.uid() and public.is_active() and exists (select 1 from public.hcps h where h.id = hcp_id and h.owner_id = auth.uid()));

-- ---------- Fonksiyonlar ----------
create or replace function public.submit_exam(p_assignment uuid, p_answers jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_a public.exam_assignments; v_key jsonb; v_total int; v_correct int; v_score int;
begin
  if not public.is_active() then raise exception 'Hesabınız etkin değil'; end if;
  select * into v_a from public.exam_assignments where id = p_assignment for update;
  if auth.uid() is null or v_a.id is null or v_a.user_id is distinct from auth.uid() then raise exception 'Bu sınava erişiminiz yok'; end if;
  if v_a.status = 'done' then raise exception 'Bu sınav zaten gönderildi'; end if;
  if exists (select 1 from public.exams where id = v_a.exam_id and not is_practice and review_status <> 'approved') then raise exception 'Sınav yeniden hukuk onayı bekliyor'; end if;
  select answers into v_key from public.exam_keys where exam_id = v_a.exam_id;
  v_total := coalesce(jsonb_array_length(v_key), 0);
  if v_total = 0 then raise exception 'Cevap anahtarı bulunamadı'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Geçersiz cevaplar'; end if;
  if jsonb_array_length(p_answers) <> v_total then raise exception 'Cevap sayısı sorularla eşleşmiyor'; end if;
  select count(*) into v_correct
    from jsonb_array_elements_text(v_key) with ordinality as k(val, i)
    where p_answers->>((k.i - 1)::int) = k.val;
  v_score := round(v_correct * 100.0 / v_total);
  update public.exam_assignments set status = 'done', score = v_score, answers = p_answers, completed_at = now() where id = p_assignment;
  return v_score;
end $$;

create or replace function public.class_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with a as (
    select a.* from public.exam_assignments a join public.exams e on e.id = a.exam_id where not e.is_practice
  )
  select jsonb_build_object(
    'members',    (select count(*) from public.profiles where status = 'active'),
    'avg',        (select coalesce(round(avg(score)), 0) from a where status = 'done'),
    'pass',       (select coalesce(round(100.0 * count(*) filter (where score >= 70) / nullif(count(*), 0)), 0) from a where status = 'done'),
    'completion', (select coalesce(round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0)), 0) from a)
  );
$$;

-- Yönetici: hesap durumu (onay / devre dışı)
create or replace function public.admin_set_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yetkiniz yok'; end if;
  if p_status not in ('pending','active','disabled') then raise exception 'Geçersiz durum'; end if;
  if p_user = auth.uid() and p_status <> 'active' then raise exception 'Kendi hesabınızı devre dışı bırakamazsınız'; end if;
  update public.profiles set status = p_status where id = p_user;
end $$;

-- Yönetici: iş rolü
create or replace function public.admin_set_job_role(p_user uuid, p_job_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yetkiniz yok'; end if;
  if p_job_role not in ('pjp','urun_muduru','avukat') then raise exception 'Geçersiz rol'; end if;
  update public.profiles set job_role = p_job_role where id = p_user;
end $$;

-- Hukuk incelemesi: liste (avukat veya yönetici)
create or replace function public.review_items(p_status text default 'in_review') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or (public.is_active() and public.my_job_role() = 'avukat')) then raise exception 'Yetkiniz yok'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'updated' desc) from (
      select jsonb_build_object(
        'kind','exam','id',e.id,'title',e.title,'area',e.area,'description',e.description,
        'questions',e.questions,'answers',k.answers,'explanations',k.explanations,
        'status',e.review_status,'note',e.review_note,'updated',coalesce(e.reviewed_at,e.created_at),
        'reviewer',(select coalesce(full_name,email) from public.profiles where id = e.reviewed_by)) as x
      from public.exams e left join public.exam_keys k on k.exam_id = e.id
      where not e.is_practice and e.review_status = p_status
      union all
      select jsonb_build_object(
        'kind','curriculum','id',c.id,'title',c.title,'area',c.area,
        'product',(select name from public.products where id = c.product_id),
        'modules',c.modules,'status',c.review_status,'note',c.review_note,'updated',coalesce(c.reviewed_at,c.created_at),
        'reviewer',(select coalesce(full_name,email) from public.profiles where id = c.reviewed_by))
      from public.curricula c where c.review_status = p_status
    ) s
  ), '[]'::jsonb);
end $$;

-- Hukuk incelemesi: karar
create or replace function public.review_decide(p_kind text, p_id uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or (public.is_active() and public.my_job_role() = 'avukat')) then raise exception 'Yetkiniz yok'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Geçersiz karar'; end if;
  if p_decision = 'rejected' and coalesce(trim(p_note), '') = '' then raise exception 'Ret için gerekçe yazın'; end if;
  if p_kind = 'exam' then
    update public.exams set review_status = p_decision, review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id and review_status = 'in_review';
  elsif p_kind = 'curriculum' then
    update public.curricula set review_status = p_decision, review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id and review_status = 'in_review';
  else raise exception 'Geçersiz tür'; end if;
  if not found then raise exception 'Bu içerik inceleme kuyruğunda değil'; end if;
end $$;

-- Ürün müdürü: kendi ürünlerine atanmış PJP'lerin özeti (hekim adı içermez)
create or replace function public.manager_report() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' or (me.job_role <> 'urun_muduru' and me.role <> 'admin') then raise exception 'Yetkiniz yok'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product', p.name, 'area', p.area,
      'reps', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', coalesce(u.full_name, u.email),
          'assigned', (select count(*) from public.exam_assignments a join public.exams e on e.id = a.exam_id where a.user_id = u.id and not e.is_practice),
          'done', (select count(*) from public.exam_assignments a join public.exams e on e.id = a.exam_id where a.user_id = u.id and not e.is_practice and a.status = 'done'),
          'avg', (select round(avg(a.score)) from public.exam_assignments a join public.exams e on e.id = a.exam_id where a.user_id = u.id and not e.is_practice and a.status = 'done'),
          'interactions', (select count(*) from public.interactions i where i.owner_id = u.id and i.product_id = p.id),
          'interactions_30d', (select count(*) from public.interactions i where i.owner_id = u.id and i.product_id = p.id and i.date >= current_date - 30),
          'last_interaction', (select max(i.date) from public.interactions i where i.owner_id = u.id and i.product_id = p.id)
        ) order by coalesce(u.full_name, u.email))
        from public.user_products up2 join public.profiles u on u.id = up2.user_id
        where up2.product_id = p.id and u.job_role = 'pjp' and u.status = 'active'), '[]'::jsonb)
    ) order by p.name)
    from public.products p
    where me.role = 'admin' or exists (select 1 from public.user_products up where up.product_id = p.id and up.user_id = me.id)
  ), '[]'::jsonb);
end $$;

revoke execute on function public.admin_set_status(uuid, text), public.admin_set_job_role(uuid, text),
  public.review_items(text), public.review_decide(text, uuid, text, text), public.manager_report() from anon;

-- =====================================================================
-- İLK YÖNETİCİ: siteye kayıt olduktan sonra ayrı çalıştırın
-- update public.profiles set role = 'admin', status = 'active' where email = 'sizin@epostaniz.com';
-- =====================================================================

