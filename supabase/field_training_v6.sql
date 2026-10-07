-- Apply after features_v3.sql (duels_v4.sql is independent). Run the whole file.
begin;
create table if not exists public.field_units (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 kind text not null check(kind in ('objection','branch','errors','comparison','visit','update')),
 title text not null check(length(trim(title)) between 3 and 200), skill text not null,
 specialty text not null default 'Genel', payload jsonb not null, sources jsonb not null,
 status text not null default 'draft' check(status in ('draft','in_review','approved','rejected')),
 version int not null default 1, review_note text, reviewed_by uuid, reviewed_at timestamptz,
 created_by uuid default auth.uid(), updated_at timestamptz default now()
);
create table if not exists public.field_keys(unit_id uuid primary key references public.field_units(id) on delete cascade, keys jsonb not null);
create table if not exists public.field_attempts(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 unit_id uuid not null references public.field_units(id), product_id uuid not null references public.products(id),
 version int not null, title text not null, skill text not null, kind text not null, snapshot jsonb not null,
 answers jsonb, score int, feedback jsonb, completed_at timestamptz, created_at timestamptz default now()
);
create table if not exists public.field_notices(
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.source_documents(id) on delete cascade,
 product_id uuid references public.products(id), title text not null, fingerprint text not null,
 created_at timestamptz default now(), unique(document_id,fingerprint)
);
alter table public.field_notices add column if not exists changes jsonb not null default '[]';
create table if not exists public.field_notice_reads(
 notice_id uuid references public.field_notices(id) on delete cascade, user_id uuid references public.profiles(id),
 read_at timestamptz default now(), primary key(notice_id,user_id)
);
alter table public.field_units enable row level security;
alter table public.field_keys enable row level security;
alter table public.field_attempts enable row level security;
alter table public.field_notices enable row level security;
alter table public.field_notice_reads enable row level security;
revoke all on public.field_units,public.field_keys,public.field_attempts,public.field_notices,public.field_notice_reads from anon,authenticated;
create index if not exists field_attempt_user on public.field_attempts(user_id,completed_at);
create index if not exists field_unit_product on public.field_units(product_id,status);

create or replace function public.field_access(p_product uuid,p_manage boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_active() and (public.is_admin() or exists(
 select 1 from public.user_products up join public.profiles p on p.id=up.user_id
 where up.user_id=auth.uid() and up.product_id=p_product and (not p_manage or p.job_role='urun_muduru')));
$$;
create or replace function public.field_sources_valid(p_sources jsonb,p_product uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select jsonb_typeof(p_sources)='array' and jsonb_array_length(p_sources)>0 and not exists(
 select 1 from jsonb_array_elements(p_sources) s where not exists(
 select 1 from public.source_documents d cross join lateral jsonb_array_elements(d.pages) p
 where d.id::text=s->>'document_id' and d.status='approved' and (d.product_id=p_product or d.product_id is null)
 and p->>'page'=s->>'page' and md5(p->>'text')=s->>'fingerprint'));
$$;
-- Returns authored units to managers/reviewers; learners receive only approved, current-source units.
create or replace function public.field_list(p_manage boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 return coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('product',p.name)||case when p_manage then jsonb_build_object('keys',(select keys from public.field_keys where unit_id=u.id)) else '{}'::jsonb end order by u.updated_at desc)
 from public.field_units u join public.products p on p.id=u.product_id
 where case when p_manage then public.field_access(u.product_id,true) or public.my_job_role()='avukat'
 else public.field_access(u.product_id) and u.status='approved' and public.field_sources_valid(u.sources,u.product_id) end),'[]');
end $$;
create or replace function public.field_source_options(p_product uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not (public.field_access(p_product,true) or (public.is_active() and public.my_job_role()='avukat')) then raise exception 'Yetkiniz yok'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('document_id',d.id,'title',d.title,'page',p->'page','fingerprint',md5(p->>'text'),'text',p->>'text','approved_at',d.reviewed_at))
 from public.source_documents d cross join lateral jsonb_array_elements(d.pages) p
 where d.status='approved' and (d.product_id=p_product or d.product_id is null)),'[]');
end $$;
create or replace function public.field_save(p_id uuid,p_product uuid,p_kind text,p_title text,p_skill text,p_specialty text,p_payload jsonb,p_sources jsonb,p_keys jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=p_id; n jsonb; c jsonb; seen text[]:='{}'; key jsonb; nodeid text; i int; startid text;
begin
 if not public.field_access(p_product,true) then raise exception 'Ürünün yöneticisi gerekli'; end if;
 if p_id is not null then
  perform 1 from public.field_units where id=p_id and public.field_access(product_id,true) for update;
  if not found then raise exception 'İçeriğe erişim yok'; end if;
 end if;
 if p_kind not in ('objection','branch','errors','comparison','visit','update') or length(trim(p_title)) not between 3 and 200
 or length(trim(p_skill)) not between 1 and 100 or length(p_payload::text)>50000 or length(p_sources::text)>20000
 or jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_keys) is distinct from 'object'
 or not public.field_sources_valid(p_sources,p_product) then raise exception 'Geçerli içerik ve onaylı kaynak sayfaları gerekli'; end if;
 if jsonb_typeof(p_payload->'nodes') is distinct from 'array' or jsonb_array_length(p_payload->'nodes')>20 then raise exception 'En fazla 20 adım'; end if;
 if p_kind not in ('comparison','visit') and jsonb_array_length(p_payload->'nodes')=0 then raise exception 'En az bir alıştırma adımı gerekli'; end if;
 for n in select value from jsonb_array_elements(p_payload->'nodes') loop
  nodeid:=n->>'id';
  if coalesce(nodeid,'')='' or nodeid=any(seen) or length(coalesce(n->>'prompt','')) not between 1 and 4000 then raise exception 'Geçersiz veya tekrarlanan adım'; end if;
  seen:=array_append(seen,nodeid);
  if jsonb_typeof(n->'choices') is distinct from 'array' or jsonb_array_length(n->'choices') not between 2 and 6 then raise exception '2-6 seçenek gerekli'; end if;
  key:=p_keys->nodeid;
  if jsonb_typeof(key) is distinct from 'array' or jsonb_array_length(key)<>jsonb_array_length(n->'choices') then raise exception 'Puan anahtarı eşleşmiyor'; end if;
  i:=0;
  for c in select value from jsonb_array_elements(n->'choices') loop
   if length(coalesce(c->>'label','')) not between 1 and 2000 or jsonb_typeof(key->i->'score') is distinct from 'number'
   or (key->i->>'score') !~ '^(100|[0-9]{1,2})$' or length(coalesce(key->i->>'feedback','')) not between 1 and 4000 then raise exception 'Geçersiz seçenek, puan veya açıklama'; end if;
   i:=i+1;
  end loop;
 end loop;
 startid:=p_payload->>'start';
 if cardinality(seen)>0 and not coalesce(startid=any(seen),false) then raise exception 'Başlangıç adımı bulunamadı'; end if;
 if cardinality(seen)>0 and startid is distinct from seen[1] then raise exception 'İlk adımdan başlanmalı'; end if;
 for n in select value from jsonb_array_elements(p_payload->'nodes') loop
  for c in select value from jsonb_array_elements(n->'choices') loop
   if p_kind<>'branch' and nullif(c->>'next','') is distinct from seen[array_position(seen,n->>'id')+1] then raise exception 'Bu türde tüm adımlar sırayla tamamlanmalı'; end if;
   if coalesce(c->>'next','')<>'' and (not (c->>'next'=any(seen)) or array_position(seen,c->>'next')<=array_position(seen,n->>'id')) then raise exception 'Sonraki adım bulunamadı'; end if;
  end loop;
 end loop;
 if p_kind='comparison' and (jsonb_typeof(p_payload->'comparison') is distinct from 'array' or jsonb_array_length(p_payload->'comparison') not between 1 and 20) then raise exception '1-20 karşılaştırma satırı gerekli'; end if;
 if p_kind='visit' and (jsonb_typeof(p_payload->'visit'->'messages') is distinct from 'array' or jsonb_typeof(p_payload->'visit'->'questions') is distinct from 'array' or jsonb_array_length(p_payload->'visit'->'messages')<>3 or jsonb_array_length(p_payload->'visit'->'questions')<>3) then raise exception 'Üç mesaj ve üç soru gerekli'; end if;
 if p_id is null then
  insert into public.field_units(product_id,kind,title,skill,specialty,payload,sources) values(p_product,p_kind,trim(p_title),trim(p_skill),left(p_specialty,100),p_payload,p_sources) returning id into uid;
 else
  update public.field_units set product_id=p_product,kind=p_kind,title=trim(p_title),skill=trim(p_skill),specialty=left(p_specialty,100),payload=p_payload,sources=p_sources,
  status='draft',version=version+1,reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now() where id=uid;
 end if;
 insert into public.field_keys(unit_id,keys) values(uid,p_keys) on conflict(unit_id) do update set keys=excluded.keys;
 return uid;
end $$;
create or replace function public.field_edit(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u public.field_units;
begin
 select * into u from public.field_units where id=p_id;
 if not public.field_access(u.product_id,true) then raise exception 'Yetkiniz yok'; end if;
 return to_jsonb(u)||jsonb_build_object('keys',(select keys from public.field_keys where unit_id=p_id));
end $$;
create or replace function public.field_review(p_id uuid,p_decision text,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
declare u public.field_units;
begin
 select * into u from public.field_units where id=p_id for update;
 if u.id is null then raise exception 'İçerik bulunamadı'; end if;
 if p_decision='in_review' then
  if not public.field_access(u.product_id,true) or u.status not in ('draft','rejected') then raise exception 'İncelemeye gönderilemez'; end if;
 elsif p_decision in ('approved','rejected') then
  if not public.is_active() or not (public.is_admin() or public.my_job_role()='avukat') or u.status<>'in_review' then raise exception 'İnceleme yetkisi gerekli'; end if;
  if p_decision='rejected' and coalesce(trim(p_note),'')='' then raise exception 'Ret gerekçesi gerekli'; end if;
 else raise exception 'Geçersiz karar'; end if;
 if not public.field_sources_valid(u.sources,u.product_id) then raise exception 'Kaynak değişmiş; yeniden seçip kaydedin'; end if;
 update public.field_units set status=p_decision,review_note=left(p_note,2000),reviewed_by=case when p_decision='in_review' then null else auth.uid() end,
 reviewed_at=case when p_decision='in_review' then null else now() end,updated_at=now() where id=p_id;
end $$;
create or replace function public.field_start(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u public.field_units; a uuid;
begin
 select * into u from public.field_units where id=p_id for share;
 if not public.field_access(u.product_id) or u.status<>'approved' or not public.field_sources_valid(u.sources,u.product_id) then raise exception 'Onaylı güncel içeriğe erişim yok'; end if;
 if (select count(*) from public.field_attempts where user_id=auth.uid() and created_at>now()-interval '1 hour')>=60 then raise exception 'Saatlik çalışma sınırı'; end if;
 insert into public.field_attempts(user_id,unit_id,product_id,version,title,skill,kind,snapshot)
 values(auth.uid(),u.id,u.product_id,u.version,u.title,u.skill,u.kind,to_jsonb(u)||jsonb_build_object('keys',(select keys from public.field_keys where unit_id=u.id))) returning id into a;
 return jsonb_build_object('attempt_id',a,'unit',to_jsonb(u));
end $$;
create or replace function public.field_submit(p_attempt uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.field_attempts; n jsonb; x jsonb; k jsonb; currentid text; picked int; points int:=0; countn int:=0; visited text[]:='{}'; feed jsonb:='[]'; scorev int;
begin
 select * into a from public.field_attempts where id=p_attempt for update;
 if a.user_id is distinct from auth.uid() or not public.field_access(a.product_id) then raise exception 'Erişim yok'; end if;
 if a.completed_at is not null then return jsonb_build_object('score',a.score,'feedback',a.feedback); end if;
 perform 1 from public.field_units where id=a.unit_id and status='approved' and version=a.version for share;
 if not found then raise exception 'İçerik sürümü değişti; çalışmayı yeniden başlatın'; end if;
 if not public.field_sources_valid(a.snapshot->'sources',a.product_id) then raise exception 'Kaynak değişti; çalışmayı yeniden başlatın'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)>20 or length(p_answers::text)>90000 then raise exception 'Geçersiz cevaplar'; end if;
 currentid:=a.snapshot->'payload'->>'start';
 for x in select value from jsonb_array_elements(p_answers) loop
  if coalesce(currentid,'')='' or currentid=any(visited) or x->>'node' is distinct from currentid or jsonb_typeof(x->'choice') is distinct from 'number' or coalesce(x->>'choice','') !~ '^[0-5]$' then raise exception 'Görüşme yolu geçersiz'; end if;
  select value into n from jsonb_array_elements(a.snapshot->'payload'->'nodes') where value->>'id'=currentid;
  picked:=(x->>'choice')::int;
  if n is null or picked>=jsonb_array_length(n->'choices') then raise exception 'Geçersiz seçim'; end if;
  k:=a.snapshot->'keys'->currentid->picked;
  points:=points+(k->>'score')::int;countn:=countn+1;
  feed:=feed||jsonb_build_array(jsonb_build_object('node',currentid,'prompt',n->>'prompt','choice',n->'choices'->picked->>'label','score',(k->>'score')::int,'feedback',k->>'feedback'));
  visited:=array_append(visited,currentid);currentid:=n->'choices'->picked->>'next';
 end loop;
 if coalesce(currentid,'')<>'' then raise exception 'Çalışma tamamlanmadı'; end if;
 scorev:=case when countn=0 then null else round(points::numeric/countn)::int end;
 update public.field_attempts set answers=p_answers,score=scorev,feedback=feed,completed_at=now() where id=a.id;
 return jsonb_build_object('score',scorev,'feedback',feed);
end $$;
create or replace function public.field_history() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (select id,unit_id,product_id,title,skill,kind,version,score,feedback,completed_at
 from public.field_attempts where user_id=auth.uid() and completed_at is not null order by completed_at desc limit 300)t),'[]');
end $$;
create or replace function public.field_heatmap() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_active() or not (public.is_admin() or public.my_job_role()='urun_muduru') then raise exception 'Yönetici yetkisi gerekli'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select a.user_id,coalesce(p.full_name,p.email) as name,a.product_id,pr.name as product,a.skill,count(*) as attempts,round(avg(a.score)) as average,
 min(a.score) as minimum,max(a.completed_at) as last_practice
 from public.field_attempts a join public.profiles p on p.id=a.user_id join public.products pr on pr.id=a.product_id
 where a.completed_at is not null and a.score is not null and public.field_access(a.product_id,true)
 group by a.user_id,p.full_name,p.email,a.product_id,pr.name,a.skill)t),'[]');
end $$;
create or replace function public.field_document_notice() returns trigger
language plpgsql security definer set search_path=public as $$
declare previous jsonb; changesv jsonb;
begin
 if new.status='approved' and (tg_op='INSERT' or old.status is distinct from 'approved' or old.pages is distinct from new.pages) then
 select snapshot->'pages' into previous from public.content_history where kind='source_documents' and content_id=new.id and snapshot->>'status'='approved' and md5((snapshot->'pages')::text)<>md5(new.pages::text) order by saved_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('page',coalesce(a->'page',b->'page'),'type',case when a is null then 'added' when b is null then 'removed' else 'edited' end)),'[]') into changesv
 from jsonb_array_elements(coalesce(previous,'[]')) a full join jsonb_array_elements(new.pages) b on a->>'page'=b->>'page' where a->>'text' is distinct from b->>'text';
 insert into public.field_notices(document_id,product_id,title,fingerprint,changes) values(new.id,new.product_id,new.title,md5(new.pages::text),changesv) on conflict do nothing;
 end if;return new;
end $$;
drop trigger if exists field_document_notice on public.source_documents;
create trigger field_document_notice after insert or update on public.source_documents for each row execute function public.field_document_notice();
create or replace function public.field_notifications(p_read uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_active() then raise exception 'Etkin oturum gerekli'; end if;
 if p_read is not null then
 insert into public.field_notice_reads(notice_id,user_id) select n.id,auth.uid() from public.field_notices n join public.source_documents d on d.id=n.document_id
 where n.id=p_read and d.status='approved' and (n.product_id is null or public.field_access(n.product_id)) on conflict do nothing;
 end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select n.*,pr.name as product,r.read_at,d.pages from public.field_notices n join public.source_documents d on d.id=n.document_id
 left join public.products pr on pr.id=n.product_id left join public.field_notice_reads r on r.notice_id=n.id and r.user_id=auth.uid()
 where d.status='approved' and n.fingerprint=md5(d.pages::text) and (n.product_id is null or public.field_access(n.product_id))
 order by n.created_at desc limit 100)t),'[]');
end $$;
-- Audit writes and approvals without storing answers in the generic audit log.
drop trigger if exists record_audit on public.field_units;
create trigger record_audit after insert or update on public.field_units for each row execute function public.record_audit();
revoke execute on function public.field_document_notice() from public,anon,authenticated;
revoke execute on function public.field_sources_valid(jsonb,uuid) from public,anon,authenticated;
revoke execute on function public.field_access(uuid,boolean) from public,anon;
grant execute on function public.field_access(uuid,boolean) to authenticated;
do $$ declare r record;begin
 for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('field_list','field_source_options','field_save','field_edit','field_review','field_start','field_submit','field_history','field_heatmap','field_notifications') loop
 execute format('revoke execute on function %s from public,anon',r.fn);execute format('grant execute on function %s to authenticated',r.fn);
 end loop;
end $$;
commit;
