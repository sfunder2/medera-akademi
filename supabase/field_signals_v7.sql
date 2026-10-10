-- Saha itirazları ısı haritası ve yan etki (farmakovijilans) hızlı bildirimi.
-- schema.sql ve önceki yükseltmelerden sonra çalıştırın. Dosyanın tamamını çalıştırın; tekrar çalıştırılabilir.
begin;

/* ---------- Saha itirazları ---------- */
-- Temsilci ziyaret kaydında etiket seçer. Bölge, hekimin şehrinden uygulamada hesaplanır.
-- Hekim adı bu tabloda tutulmaz; raporlar yalnızca bölge/etiket sayıları döndürür.
create table if not exists public.field_objections(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 interaction_id uuid references public.interactions(id) on delete set null,
 product_id uuid references public.products(id) on delete set null,
 tag text not null check(tag in ('yan_etki','fiyat','etkinlik','rakip','uygulama','kanit','erisim')),
 competitor text check(competitor is null or length(trim(competitor)) between 2 and 80),
 region text not null check(region in ('Marmara','Ege','Akdeniz','İç Anadolu','Karadeniz','Doğu Anadolu','Güneydoğu Anadolu')),
 created_at timestamptz not null default now()
);
create index if not exists field_objections_time on public.field_objections(created_at);
alter table public.field_objections enable row level security;
revoke all on public.field_objections from anon, authenticated;
grant select, insert, delete on public.field_objections to authenticated;
drop policy if exists "objections own" on public.field_objections;
create policy "objections own" on public.field_objections for all to authenticated
 using (user_id = auth.uid())
 with check (user_id = auth.uid() and public.is_active()
  and (field_objections.interaction_id is null or exists(select 1 from public.interactions i where i.id = field_objections.interaction_id and i.owner_id = auth.uid()))
  and (field_objections.product_id is null or public.is_admin() or exists(select 1 from public.user_products up where up.user_id = auth.uid() and up.product_id = field_objections.product_id)));

-- Isı haritası ve ani artış uyarıları. Yönetici her şeyi, ürün müdürü yalnızca kendi ürünlerini görür.
-- Uyarı kuralı: son 7 günde en az 5 kayıt ve önceki 4 haftanın haftalık ortalamasının en az 2 katı.
create or replace function public.objection_heatmap(p_days int default 30, p_product uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
 v_admin boolean := public.is_admin();
 v_scope uuid[] := '{}';
 v_days int := least(greatest(coalesce(p_days, 30), 7), 180);
begin
 if not public.is_active() or not (v_admin or public.my_job_role() = 'urun_muduru') then
  raise exception 'Bu rapor yöneticiler ve ürün müdürleri içindir' using errcode = '42501';
 end if;
 if not v_admin then
  select coalesce(array_agg(product_id), '{}') into v_scope from public.user_products where user_id = auth.uid();
 end if;
 return (
  with scoped as (
   select * from public.field_objections o
   where (v_admin or o.product_id = any(v_scope)) and (p_product is null or o.product_id = p_product)
  ), recent as (
   select * from scoped where created_at >= now() - make_interval(days => v_days)
  ), trend as (
   select region, tag, coalesce(competitor, '') as competitor,
    count(*) filter (where created_at >= now() - interval '7 days') as cur,
    count(*) filter (where created_at < now() - interval '7 days') as prev
   from scoped where created_at >= now() - interval '35 days'
   group by 1, 2, 3
  )
  select jsonb_build_object(
   'days', v_days,
   'total', (select count(*) from recent),
   'cells', coalesce((select jsonb_agg(jsonb_build_object('region', region, 'tag', tag, 'count', n)) from
     (select region, tag, count(*) as n from recent group by 1, 2) c), '[]'::jsonb),
   'competitors', coalesce((select jsonb_agg(jsonb_build_object('name', competitor, 'count', n) order by n desc) from
     (select competitor, count(*) as n from recent where competitor is not null group by 1 order by 2 desc limit 8) k), '[]'::jsonb),
   'alerts', coalesce((select jsonb_agg(jsonb_build_object('region', region, 'tag', tag, 'competitor', nullif(competitor, ''),
       'current', cur, 'baseline', round(prev / 4.0, 1)) order by cur / greatest(prev / 4.0, 1) desc) from trend
     where cur >= 5 and cur >= 2 * greatest(prev / 4.0, 1)), '[]'::jsonb)
  )
 );
end $$;
revoke all on function public.objection_heatmap(int, uuid) from public, anon;
grant execute on function public.objection_heatmap(int, uuid) to authenticated;

/* ---------- Yan etki hızlı bildirimi ---------- */
-- Temsilci yalnızca kendi bildirimini görür; tıbbi birim (yönetici) hepsini görür ve durumunu günceller.
-- Hastanın adı, kimlik ve iletişim bilgisi alınmaz; yalnızca yaş grubu ve cinsiyet.
create sequence if not exists public.pv_report_seq;
create table if not exists public.pv_reports(
 id uuid primary key default gen_random_uuid(),
 report_no text not null unique default ('PV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.pv_report_seq')::text, 5, '0')),
 reporter_id uuid not null default auth.uid() references public.profiles(id),
 product_id uuid references public.products(id) on delete set null,
 product_name text check(product_name is null or length(trim(product_name)) between 2 and 120),
 event text not null check(length(trim(event)) between 10 and 3000),
 serious text not null check(serious in ('evet', 'hayir', 'bilinmiyor')),
 source text not null check(source in ('hekim', 'eczaci', 'hasta_yakini', 'diger')),
 hcp_id uuid references public.hcps(id) on delete set null,
 patient_age text not null default 'bilinmiyor' check(patient_age in ('0-17', '18-44', '45-64', '65+', 'bilinmiyor')),
 patient_sex text not null default 'bilinmiyor' check(patient_sex in ('kadin', 'erkek', 'bilinmiyor')),
 aware_at timestamptz not null default now() check(aware_at <= now() + interval '5 minutes'),
 status text not null default 'new' check(status in ('new', 'in_review', 'closed')),
 unit_note text check(unit_note is null or length(unit_note) <= 2000),
 handled_by uuid references public.profiles(id),
 handled_at timestamptz,
 created_at timestamptz not null default now(),
 check(product_id is not null or product_name is not null)
);
create index if not exists pv_reports_status on public.pv_reports(status, created_at);
alter table public.pv_reports enable row level security;
revoke all on public.pv_reports from anon, authenticated;
grant select, insert on public.pv_reports to authenticated;
grant usage on sequence public.pv_report_seq to authenticated;
drop policy if exists "pv insert own" on public.pv_reports;
create policy "pv insert own" on public.pv_reports for insert to authenticated
 with check (reporter_id = auth.uid() and public.is_active() and status = 'new' and unit_note is null and handled_by is null and handled_at is null
  and (pv_reports.hcp_id is null or exists(select 1 from public.hcps h where h.id = pv_reports.hcp_id and h.owner_id = auth.uid())));
drop policy if exists "pv read" on public.pv_reports;
create policy "pv read" on public.pv_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

-- Durum yalnızca tıbbi birim (yönetici) tarafından ve bu fonksiyonla değişir.
create or replace function public.pv_update(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
 if not (public.is_active() and public.is_admin()) then raise exception 'Yalnızca tıbbi birim güncelleyebilir' using errcode = '42501'; end if;
 if p_status not in ('new', 'in_review', 'closed') then raise exception 'Geçersiz durum'; end if;
 update public.pv_reports set status = p_status, unit_note = nullif(trim(coalesce(p_note, '')), ''), handled_by = auth.uid(), handled_at = now() where id = p_id;
 if not found then raise exception 'Bildirim bulunamadı'; end if;
end $$;
revoke all on function public.pv_update(uuid, text, text) from public, anon;
grant execute on function public.pv_update(uuid, text, text) to authenticated;

commit;
