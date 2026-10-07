-- =====================================================================
-- Medera Akademi — Supabase veritabanı şeması
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run
-- =====================================================================

-- ---------- Profiller ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Yeni kullanıcı kaydolunca profil oluştur
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- İSTEĞE BAĞLI: yalnızca şirket e-posta alan adına izin vermek için alttaki iki satırın başındaki "--" işaretlerini kaldırın
  -- if new.email not ilike '%@sirketiniz.com' then
  --   raise exception 'Bu e-posta alan adına izin verilmiyor'; end if;
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Ürünler ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  molecule    text,
  area        text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_products (
  user_id     uuid references public.profiles on delete cascade,
  product_id  uuid references public.products on delete cascade,
  primary key (user_id, product_id)
);

-- ---------- Sınavlar ----------
-- questions: [{ "q": "...", "options": ["A","B","C","D"] }]  (doğru cevaplar burada DEĞİL)
create table if not exists public.exams (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  area         text,
  description  text,
  questions    jsonb not null default '[]',
  is_practice  boolean not null default false,
  created_by   uuid references public.profiles on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- Cevap anahtarı ayrı tabloda; kullanıcılar atanmış sınavların anahtarını göremez
create table if not exists public.exam_keys (
  exam_id       uuid primary key references public.exams on delete cascade,
  answers       jsonb not null,              -- [2,0,3,...]
  explanations  jsonb not null default '[]'  -- ["...", ...]
);

create table if not exists public.exam_assignments (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams on delete cascade,
  user_id       uuid not null references public.profiles on delete cascade,
  status        text not null default 'pending' check (status in ('pending','done')),
  score         int,
  answers       jsonb,
  due_date      date,
  assigned_at   timestamptz not null default now(),
  completed_at  timestamptz,
  unique (exam_id, user_id)
);

-- ---------- Müfredat ----------
create table if not exists public.curricula (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  area        text,
  product_id  uuid references public.products on delete set null,
  weeks       int,
  modules     jsonb not null default '[]',
  published   boolean not null default false,
  created_by  uuid references public.profiles on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ---------- Paydaşlar ----------
create table if not exists public.hcps (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles on delete cascade default auth.uid(),
  name        text not null,
  spec        text,
  inst        text,
  city        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles on delete cascade default auth.uid(),
  hcp_id      uuid not null references public.hcps on delete cascade,
  type        text,
  product_id  uuid references public.products on delete set null,
  date        date default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_asg_user on public.exam_assignments(user_id);
create index if not exists idx_asg_exam on public.exam_assignments(exam_id);
create index if not exists idx_hcps_owner on public.hcps(owner_id);
create index if not exists idx_int_owner on public.interactions(owner_id);

-- =====================================================================
-- Satır düzeyi güvenlik (RLS)
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.products         enable row level security;
alter table public.user_products    enable row level security;
alter table public.exams            enable row level security;
alter table public.exam_keys        enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.curricula        enable row level security;
alter table public.hcps             enable row level security;
alter table public.interactions     enable row level security;

-- RLS döngüsünü önlemek için yardımcı fonksiyonlar (RLS'i atlayarak kontrol eder)
create or replace function public.has_assignment(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.exam_assignments where exam_id = p_exam and user_id = auth.uid());
$$;
create or replace function public.owns_practice(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.exams where id = p_exam and created_by = auth.uid() and is_practice);
$$;

-- profiles: herkes kendini, yönetici herkesi görür; kullanıcı yalnızca adını değiştirebilir
create policy "profiles read"  on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles update self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- products
create policy "products read"  on public.products for select to authenticated using (true);
create policy "products admin" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_products
create policy "up read"  on public.user_products for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "up admin" on public.user_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- exams
create policy "exams read" on public.exams for select to authenticated using (
  public.is_admin() or created_by = auth.uid() or public.has_assignment(id));
create policy "exams insert" on public.exams for insert to authenticated
  with check (public.is_admin() or (created_by = auth.uid() and is_practice));
create policy "exams update" on public.exams for update to authenticated
  using (public.is_admin() or (created_by = auth.uid() and is_practice))
  with check (public.is_admin() or (created_by = auth.uid() and is_practice));
create policy "exams delete" on public.exams for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and is_practice));

-- exam_keys: yönetici veya kendi pratik sınavının sahibi
create policy "keys access" on public.exam_keys for all to authenticated
  using (public.is_admin() or public.owns_practice(exam_id))
  with check (public.is_admin() or public.owns_practice(exam_id));

-- exam_assignments
create policy "asg read"  on public.exam_assignments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "asg admin" on public.exam_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "asg practice self" on public.exam_assignments for all to authenticated
  using (user_id = auth.uid() and public.owns_practice(exam_id))
  with check (user_id = auth.uid() and public.owns_practice(exam_id));

-- curricula
create policy "cur read"  on public.curricula for select to authenticated using (published or public.is_admin());
create policy "cur admin" on public.curricula for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- hcps / interactions: herkes kendi kayıtlarını yönetir, yönetici hepsini okur
create policy "hcps own"   on public.hcps for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "hcps admin" on public.hcps for select to authenticated using (public.is_admin());
create policy "int own" on public.interactions for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.hcps h where h.id = hcp_id and h.owner_id = auth.uid()));
create policy "int admin" on public.interactions for select to authenticated using (public.is_admin());

-- =====================================================================
-- Sunucu tarafı fonksiyonlar
-- =====================================================================

-- Sınavı gönder ve sunucuda puanla
create or replace function public.submit_exam(p_assignment uuid, p_answers jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_a public.exam_assignments; v_key jsonb; v_total int; v_correct int; v_score int;
begin
  select * into v_a from public.exam_assignments where id = p_assignment for update;
  if auth.uid() is null or v_a.id is null or v_a.user_id is distinct from auth.uid() then raise exception 'Bu sınava erişiminiz yok'; end if;
  if v_a.status = 'done' then raise exception 'Bu sınav zaten gönderildi'; end if;
  select answers into v_key from public.exam_keys where exam_id = v_a.exam_id;
  v_total := coalesce(jsonb_array_length(v_key), 0);
  if v_total = 0 then raise exception 'Cevap anahtarı bulunamadı'; end if;
  select count(*) into v_correct
    from jsonb_array_elements_text(v_key) with ordinality as k(val, i)
    where p_answers->>((k.i - 1)::int) = k.val;
  v_score := round(v_correct * 100.0 / v_total);
  update public.exam_assignments
     set status = 'done', score = v_score, answers = p_answers, completed_at = now()
   where id = p_assignment;
  return v_score;
end $$;

-- Tamamlanan sınavın cevap anahtarını getir
create or replace function public.exam_review(p_assignment uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_a public.exam_assignments; v jsonb;
begin
  select * into v_a from public.exam_assignments where id = p_assignment;
  if auth.uid() is null or v_a.id is null or (v_a.user_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'Erişim yok'; end if;
  if v_a.status <> 'done' then raise exception 'Sınav henüz tamamlanmadı'; end if;
  select jsonb_build_object('answers', answers, 'explanations', explanations) into v
    from public.exam_keys where exam_id = v_a.exam_id;
  return v;
end $$;

-- Sınıf istatistikleri (pratik sınavlar hariç)
create or replace function public.class_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with a as (
    select a.* from public.exam_assignments a join public.exams e on e.id = a.exam_id where not e.is_practice
  )
  select jsonb_build_object(
    'members',    (select count(*) from public.profiles),
    'avg',        (select coalesce(round(avg(score)), 0) from a where status = 'done'),
    'pass',       (select coalesce(round(100.0 * count(*) filter (where score >= 70) / nullif(count(*), 0)), 0) from a where status = 'done'),
    'completion', (select coalesce(round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0)), 0) from a)
  );
$$;

-- Rol değiştir (yalnızca yönetici)
create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yetkiniz yok'; end if;
  if p_role not in ('user', 'admin') then raise exception 'Geçersiz rol'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'Kendi yönetici yetkinizi kaldıramazsınız'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

revoke execute on function public.submit_exam(uuid, jsonb), public.exam_review(uuid), public.class_stats(), public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.submit_exam(uuid, jsonb), public.exam_review(uuid), public.class_stats(), public.admin_set_role(uuid, text) to authenticated;

-- =====================================================================
-- İLK YÖNETİCİ: siteye bir kez giriş yaptıktan sonra bunu ayrı çalıştırın
-- update public.profiles set role = 'admin' where email = 'sizin@epostaniz.com';
-- =====================================================================

