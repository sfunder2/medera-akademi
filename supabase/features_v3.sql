-- Apply after schema.sql, upgrade_v2.sql and hardening.sql, in one transaction.
create table if not exists public.content_history (
 id uuid primary key default gen_random_uuid(), kind text not null, content_id uuid not null,
 saved_at timestamptz not null default now(), actor_id uuid, snapshot jsonb not null
);
alter table public.content_history enable row level security;
drop policy if exists "history admin" on public.content_history;
create policy "history admin" on public.content_history for select to authenticated using(public.is_admin());
revoke insert,update,delete on public.content_history from anon,authenticated;
create or replace function public.keep_content_history() returns trigger
language plpgsql security definer set search_path=public as $$
declare saved jsonb;
begin
 if to_jsonb(old) is distinct from to_jsonb(new) then
  saved:=to_jsonb(old);
  if tg_table_name='exams' then
   saved:=saved||coalesce((select jsonb_build_object('answers',answers,'explanations',explanations) from public.exam_keys where exam_id=old.id),'{}'::jsonb);
  end if;
  insert into public.content_history(kind,content_id,actor_id,snapshot)
  values(tg_table_name,old.id,auth.uid(),saved);
 end if;
 return new;
end $$;
drop trigger if exists keep_history on public.exams;
create trigger keep_history before update on public.exams for each row execute function public.keep_content_history();
drop trigger if exists keep_history on public.curricula;
create trigger keep_history before update on public.curricula for each row execute function public.keep_content_history();
create or replace function public.keep_key_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.answers is distinct from old.answers or new.explanations is distinct from old.explanations then
  insert into public.content_history(kind,content_id,actor_id,snapshot)
  select 'exams',e.id,auth.uid(),to_jsonb(e)||jsonb_build_object('answers',old.answers,'explanations',old.explanations)
  from public.exams e where e.id=old.exam_id;
 end if;
 return new;
end $$;
drop trigger if exists keep_key_history on public.exam_keys;
create trigger keep_key_history before update on public.exam_keys for each row execute function public.keep_key_history();

create table if not exists public.assignment_snapshots (
 assignment_id uuid primary key references public.exam_assignments(id) on delete cascade,
 exam jsonb not null, answers jsonb not null, explanations jsonb not null,
 captured_at timestamptz not null default now()
);
alter table public.assignment_snapshots enable row level security;
revoke all on public.assignment_snapshots from anon,authenticated;
insert into public.assignment_snapshots(assignment_id,exam,answers,explanations)
select a.id,to_jsonb(e),k.answers,k.explanations from public.exam_assignments a
join public.exams e on e.id=a.exam_id join public.exam_keys k on k.exam_id=e.id
on conflict(assignment_id) do nothing;
create or replace function public.capture_assignment() returns trigger
language plpgsql security definer set search_path=public as $$
declare e jsonb; k public.exam_keys;
begin
 select to_jsonb(x) into e from public.exams x where id=new.exam_id;
 select * into k from public.exam_keys where exam_id=new.exam_id;
 if k.exam_id is null or jsonb_array_length(k.answers)=0 or jsonb_array_length(k.answers)<>jsonb_array_length(e->'questions') then
  raise exception 'Geçerli ve eksiksiz cevap anahtarı gerekli';
 end if;
 insert into public.assignment_snapshots(assignment_id,exam,answers,explanations)
 values(new.id,e,k.answers,k.explanations)
 on conflict(assignment_id) do update set exam=excluded.exam,answers=excluded.answers,explanations=excluded.explanations,captured_at=now();
 return new;
end $$;
drop trigger if exists capture_assignment on public.exam_assignments;
create trigger capture_assignment after insert or update of exam_id on public.exam_assignments
for each row execute function public.capture_assignment();
create or replace function public.my_assignments() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('exams',s.exam) order by a.assigned_at desc)
 from public.exam_assignments a join public.assignment_snapshots s on s.assignment_id=a.id where a.user_id=auth.uid()),'[]');
end $$;
create or replace function public.submit_exam(p_assignment uuid,p_answers jsonb) returns int
language plpgsql security definer set search_path=public as $$
declare a public.exam_assignments; k jsonb; total int; correct int; result int;
begin
 if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 select * into a from public.exam_assignments where id=p_assignment for update;
 if a.id is null or a.user_id is distinct from auth.uid() then raise exception 'Erişim yok'; end if;
 if a.status='done' then raise exception 'Sınav zaten gönderildi'; end if;
 select answers into k from public.assignment_snapshots where assignment_id=a.id;
 total:=coalesce(jsonb_array_length(k),0);
 if total=0 then raise exception 'Sınav sürümü bulunamadı'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Geçersiz cevaplar'; end if;
 if jsonb_array_length(p_answers)<>total then raise exception 'Cevap sayısı eşleşmiyor'; end if;
 select count(*) into correct from jsonb_array_elements_text(k) with ordinality x(val,i)
 where p_answers->>((x.i-1)::int)=x.val;
 result:=round(correct*100.0/total);
 update public.exam_assignments set status='done',score=result,answers=p_answers,completed_at=now() where id=a.id;
 return result;
end $$;
create or replace function public.exam_review(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare a public.exam_assignments;
begin
 if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 select * into a from public.exam_assignments where id=p_assignment;
 if a.id is null or (a.user_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'Erişim yok'; end if;
 if a.status<>'done' then raise exception 'Sınav tamamlanmadı'; end if;
 return (select jsonb_build_object('answers',answers,'explanations',explanations) from public.assignment_snapshots where assignment_id=a.id);
end $$;

create table if not exists public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid, action text not null,
 entity text not null, entity_id text, changes jsonb, created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "audit admin" on public.audit_log;
create policy "audit admin" on public.audit_log for select to authenticated using(public.is_admin());
revoke insert,update,delete on public.audit_log from anon,authenticated;
create or replace function public.record_audit() returns trigger
language plpgsql security definer set search_path=public as $$
declare before_row jsonb; after_row jsonb; changed jsonb;
begin
 before_row:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 if before_row=after_row then return new; end if;
 select jsonb_agg(key) into changed from (select key from jsonb_each(before_row||after_row)
 where before_row->key is distinct from after_row->key) x;
 insert into public.audit_log(actor_id,action,entity,entity_id,changes)
 values(auth.uid(),tg_op,tg_table_name,coalesce(after_row->>'id',before_row->>'id',after_row->>'exam_id',before_row->>'exam_id',after_row->>'user_id',before_row->>'user_id'),changed);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','exams','exam_keys','exam_assignments','curricula','products','user_products','hcps','interactions','announcements'] loop
  execute format('drop trigger if exists record_audit on public.%I',t);
  execute format('create trigger record_audit after insert or update or delete on public.%I for each row execute function public.record_audit()',t);
 end loop;
end $$;

create table if not exists public.institutions (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 3 and 200),
 city text not null, created_by uuid default auth.uid(), created_at timestamptz default now(), unique(name,city)
);
alter table public.institutions enable row level security;
drop policy if exists "institutions read" on public.institutions;
create policy "institutions read" on public.institutions for select to authenticated using(public.is_active());
drop policy if exists "institutions add" on public.institutions;
create policy "institutions add" on public.institutions for insert to authenticated with check(public.is_active() and created_by=auth.uid());
create index if not exists institutions_city_idx on public.institutions(city);

create table if not exists public.source_documents (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 200),
 product_id uuid references public.products(id) on delete cascade, source_url text,
 pages jsonb not null check(jsonb_typeof(pages)='array' and jsonb_array_length(pages) between 1 and 300),
 status text not null default 'draft' check(status in ('draft','in_review','approved','rejected')),
 review_note text, reviewed_by uuid, reviewed_at timestamptz, created_by uuid default auth.uid(),
 created_at timestamptz not null default now()
);
alter table public.source_documents enable row level security;
drop policy if exists "documents read" on public.source_documents;
create policy "documents read" on public.source_documents for select to authenticated using(
 public.is_admin() or (public.is_active() and (public.my_job_role()='avukat' or (status='approved' and
 (product_id is null or exists(select 1 from public.user_products where user_id=auth.uid() and product_id=source_documents.product_id))))));
drop policy if exists "documents admin" on public.source_documents;
create policy "documents admin" on public.source_documents for all to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.document_guard() returns trigger
language plpgsql as $$
declare p jsonb; seen int[]:='{}';
begin
 for p in select value from jsonb_array_elements(new.pages) loop
  if jsonb_typeof(p->'page') is distinct from 'number' or (p->>'page') !~ '^[1-9][0-9]*$'
   or jsonb_typeof(p->'text') is distinct from 'string' or length(trim(p->>'text')) not between 1 and 12000 then raise exception 'Geçersiz sayfa numarası veya metni'; end if;
  if (p->>'page')::int=any(seen) then raise exception 'Sayfa numarası tekrarlanamaz'; end if;
  seen:=array_append(seen,(p->>'page')::int);
 end loop;
 if new.source_url is not null and new.source_url !~ '^https?://' then raise exception 'Kaynak adresi http veya https olmalı'; end if;
 if tg_op='UPDATE' and (new.pages is distinct from old.pages or new.title is distinct from old.title or new.product_id is distinct from old.product_id or new.source_url is distinct from old.source_url) then
  new.status:='draft'; new.reviewed_by:=null; new.reviewed_at:=null; new.review_note:=null;
 end if;
 return new;
end $$;
drop trigger if exists document_guard on public.source_documents;
create trigger document_guard before insert or update on public.source_documents for each row execute function public.document_guard();
drop trigger if exists keep_history on public.source_documents;
create trigger keep_history before update on public.source_documents for each row execute function public.keep_content_history();
drop trigger if exists record_audit on public.source_documents;
create trigger record_audit after insert or update or delete on public.source_documents for each row execute function public.record_audit();
create or replace function public.review_document(p_id uuid,p_decision text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not (public.is_admin() or (public.is_active() and public.my_job_role()='avukat')) then raise exception 'Yetkiniz yok'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Geçersiz karar'; end if;
 if p_decision='rejected' and coalesce(trim(p_note),'')='' then raise exception 'Ret gerekçesi gerekli'; end if;
 update public.source_documents set status=p_decision,review_note=p_note,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id and status='in_review';
 if not found then raise exception 'Belge inceleme kuyruğunda değil'; end if;
end $$;
create or replace function public.search_sources(p_query text,p_product uuid default null) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare query tsquery;
begin
 if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 select to_tsquery('simple',string_agg(quote_literal(word),' | ')) into query
 from (select distinct word from regexp_split_to_table(lower(left(p_query,1000)),'[^[:alnum:]ıİğĞşŞçÇöÖüÜ]+') word
 where length(word)>2 and word not in ('nedir','nasıl','hangi','hakkında','için','ile','bir','olan','bilgi','ver','misin','nelerdir')) t;
 if query is null then return '[]'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (
  select d.id as document_id,d.title,d.source_url,(p->>'page')::int as page,left(p->>'text',6000) as text
  from public.source_documents d cross join lateral jsonb_array_elements(d.pages) p
  where d.status='approved' and (p_product is null or d.product_id=p_product or d.product_id is null)
   and to_tsvector('simple',p->>'text') @@ query
  order by ts_rank(to_tsvector('simple',p->>'text'),query) desc,d.id,(p->>'page')::int limit 6
 ) x),'[]');
end $$;
create or replace function public.learning_plan() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (
  select a.id as assignment_id,s.exam->>'title' as exam_title,s.exam->>'area' as area,
   q->>'q' as question,q->'options' as options,(s.answers->>(n-1)::int)::int as correct,
   s.explanations->>(n-1)::int as explanation,a.completed_at,(n-1)::int as question_index
  from public.exam_assignments a join public.assignment_snapshots s on s.assignment_id=a.id
  cross join lateral jsonb_array_elements(s.exam->'questions') with ordinality z(q,n)
  where a.user_id=auth.uid() and a.status='done' and not (s.exam->>'is_practice')::boolean
  and a.answers->>(n-1)::int is distinct from s.answers->>(n-1)::int
  order by a.completed_at desc,n limit 100
 ) x),'[]');
end $$;
do $$ declare f text; begin
 foreach f in array array['my_assignments()','learning_plan()','search_sources(text,uuid)','review_document(uuid,text,text)'] loop
  execute 'revoke execute on function public.'||f||' from public,anon';
  execute 'grant execute on function public.'||f||' to authenticated';
 end loop;
end $$;

create table if not exists public.cities(name text primary key);
alter table public.cities enable row level security;
drop policy if exists "cities read" on public.cities;
create policy "cities read" on public.cities for select to authenticated using(public.is_active());
insert into public.cities(name) values ('Adana'),('Adıyaman'),('Afyonkarahisar'),('Ağrı'),('Aksaray'),('Amasya'),('Ankara'),('Antalya'),('Ardahan'),('Artvin'),('Aydın'),('Balıkesir'),('Bartın'),('Batman'),('Bayburt'),('Bilecik'),('Bingöl'),('Bitlis'),('Bolu'),('Burdur'),('Bursa'),('Çanakkale'),('Çankırı'),('Çorum'),('Denizli'),('Diyarbakır'),('Düzce'),('Edirne'),('Elazığ'),('Erzincan'),('Erzurum'),('Eskişehir'),('Gaziantep'),('Giresun'),('Gümüşhane'),('Hakkari'),('Hatay'),('Iğdır'),('Isparta'),('İstanbul'),('İzmir'),('Kahramanmaraş'),('Karabük'),('Karaman'),('Kars'),('Kastamonu'),('Kayseri'),('Kırıkkale'),('Kırklareli'),('Kırşehir'),('Kilis'),('Kocaeli'),('Konya'),('Kütahya'),('Malatya'),('Manisa'),('Mardin'),('Mersin'),('Muğla'),('Muş'),('Nevşehir'),('Niğde'),('Ordu'),('Osmaniye'),('Rize'),('Sakarya'),('Samsun'),('Siirt'),('Sinop'),('Sivas'),('Şanlıurfa'),('Şırnak'),('Tekirdağ'),('Tokat'),('Trabzon'),('Tunceli'),('Uşak'),('Van'),('Yalova'),('Yozgat'),('Zonguldak') on conflict do nothing;
insert into public.institutions(name,city,created_by) values ('Ankara Bilkent Şehir Hastanesi','Ankara',null),('Ankara Etlik Şehir Hastanesi','Ankara',null),('Başakşehir Çam ve Sakura Şehir Hastanesi','İstanbul',null),('Adana Şehir Eğitim ve Araştırma Hastanesi','Adana',null),('Mersin Şehir Eğitim ve Araştırma Hastanesi','Mersin',null),('Kayseri Şehir Hastanesi','Kayseri',null),('Bursa Şehir Hastanesi','Bursa',null),('Eskişehir Şehir Hastanesi','Eskişehir',null),('Konya Şehir Hastanesi','Konya',null),('Manisa Şehir Hastanesi','Manisa',null),('Isparta Şehir Hastanesi','Isparta',null),('Elazığ Fethi Sekin Şehir Hastanesi','Elazığ',null),('Yozgat Şehir Hastanesi','Yozgat',null),('Tekirdağ Dr. İsmail Fehmi Cumalıoğlu Şehir Hastanesi','Tekirdağ',null),('Balıkesir Atatürk Şehir Hastanesi','Balıkesir',null),('Kocaeli Şehir Hastanesi','Kocaeli',null),('İzmir Bayraklı Şehir Hastanesi','İzmir',null),('Gaziantep Şehir Hastanesi','Gaziantep',null),('Erzurum Şehir Hastanesi','Erzurum',null) on conflict(name,city) do nothing;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='institution_city_fk' and conrelid='public.institutions'::regclass) then
 alter table public.institutions add constraint institution_city_fk foreign key(city) references public.cities(name);
 end if;
end $$;
grant select on public.cities,public.institutions,public.content_history,public.audit_log to authenticated;
grant insert on public.institutions to authenticated;
grant select,insert,update,delete on public.source_documents to authenticated;

insert into public.institutions(name,city,created_by) values
('Antalya Şehir Hastanesi','Antalya',null),
('Göztepe Prof. Dr. Süleyman Yalçın Şehir Hastanesi','İstanbul',null),
('İstanbul Prof. Dr. Cemil Taşcıoğlu Şehir Hastanesi','İstanbul',null),
('Kahramanmaraş Necip Fazıl Şehir Hastanesi','Kahramanmaraş',null),
('Kartal Dr. Lütfi Kırdar Şehir Hastanesi','İstanbul',null),
('Kütahya Şehir Hastanesi','Kütahya',null),
('Aydın Şehir Hastanesi','Aydın',null)
on conflict(name,city) do nothing;
drop trigger if exists record_audit on public.institutions;
create trigger record_audit after insert or update or delete on public.institutions for each row execute function public.record_audit();

