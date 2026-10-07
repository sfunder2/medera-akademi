-- Run after upgrade_v2.sql. Safe to repeat; preserves account decisions.
create or replace function public.exam_review(p_assignment uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_a public.exam_assignments; v jsonb;
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
  select * into v_a from public.exam_assignments where id = p_assignment;
  if v_a.id is null or (v_a.user_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'Erişim yok'; end if;
  if v_a.status <> 'done' then raise exception 'Sınav henüz tamamlanmadı'; end if;
  select jsonb_build_object('answers', answers, 'explanations', explanations) into v
    from public.exam_keys where exam_id = v_a.exam_id;
  return v;
end $$;

create or replace function public.class_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
  return (with a as (
    select a.* from public.exam_assignments a join public.exams e on e.id = a.exam_id where not e.is_practice
  ) select jsonb_build_object(
    'members', (select count(*) from public.profiles where status = 'active'),
    'avg', (select coalesce(round(avg(score)), 0) from a where status = 'done'),
    'pass', (select coalesce(round(100.0 * count(*) filter (where score >= 70) / nullif(count(*), 0)), 0) from a where status = 'done'),
    'completion', (select coalesce(round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0)), 0) from a)));
end $$;

drop policy if exists "exams read" on public.exams;
create policy "exams read" on public.exams for select to authenticated using (
  public.is_admin() or (public.is_active() and ((created_by = auth.uid() and is_practice)
    or (review_status = 'approved' and public.has_assignment(id)))));
drop policy if exists "exams update" on public.exams;
create policy "exams update" on public.exams for update to authenticated
  using (public.is_admin() or (public.is_active() and created_by = auth.uid() and is_practice))
  with check (public.is_admin() or (public.is_active() and created_by = auth.uid() and is_practice));
drop policy if exists "exams delete" on public.exams;
create policy "exams delete" on public.exams for delete to authenticated
  using (public.is_admin() or (public.is_active() and created_by = auth.uid() and is_practice));
drop policy if exists "keys access" on public.exam_keys;
create policy "keys access" on public.exam_keys for all to authenticated
  using (public.is_admin() or (public.is_active() and public.owns_practice(exam_id)))
  with check (public.is_admin() or (public.is_active() and public.owns_practice(exam_id)));

-- A content edit always invalidates approval, even when status changes in the same update.
create or replace function public.exams_review_guard() returns trigger
language plpgsql as $$
begin
  if not new.is_practice and (new.title is distinct from old.title or new.questions is distinct from old.questions
    or new.description is distinct from old.description or new.area is distinct from old.area) then
    new.review_status := 'draft'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
  end if;
  return new;
end $$;
create or replace function public.curricula_review_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.title is distinct from old.title or new.modules is distinct from old.modules
    or new.area is distinct from old.area or new.product_id is distinct from old.product_id or new.weeks is distinct from old.weeks) then
    new.review_status := 'draft'; new.published := false;
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
  end if;
  if new.published and new.review_status <> 'approved' then raise exception 'Hukuk onayı olmadan müfredat yayımlanamaz'; end if;
  return new;
end $$;
drop trigger if exists assignment_review_guard on public.exam_assignments;
create trigger assignment_review_guard before insert or update of exam_id on public.exam_assignments
  for each row execute function public.assignment_review_guard();

-- Default PUBLIC grants also apply to anon; revoke both, then explicitly allow authenticated.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in (
      'submit_exam','exam_review','class_stats','admin_set_role','admin_set_status','admin_set_job_role',
      'review_items','review_decide','manager_report','is_admin','is_active','my_job_role','has_assignment','owns_practice')
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

-- Serialize and limit paid AI requests by account, independently of the browser.
create table if not exists public.ai_usage (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  day date not null default current_date,
  requests int not null default 0
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
create or replace function public.consume_ai_quota() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
  insert into public.ai_usage(user_id, day, requests) values(auth.uid(), current_date, 1)
    on conflict(user_id) do update set day = current_date,
      requests = case when ai_usage.day = current_date then ai_usage.requests + 1 else 1 end
    where ai_usage.day <> current_date or ai_usage.requests < 50
    returning requests into v_count;
  return v_count is not null;
end $$;
revoke execute on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

