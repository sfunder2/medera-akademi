-- Run AFTER duels_v4.sql inside a test transaction; fixtures are always rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();d uuid;s jsonb;idx int;opt int;blocked boolean;score_a int;rule uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data,aud,role)
 values(a,'duel-a-'||a||'@example.invalid','{"full_name":"Test PJP A"}','authenticated','authenticated'),
 (b,'duel-b-'||b||'@example.invalid','{"full_name":"Test PJP B"}','authenticated','authenticated');
 update public.profiles set status='active',job_role='pjp' where id in(a,b);
 update public.duel_questions set status='approved';
 insert into public.duel_reward_rules(name,min_points,amount_try,reward) values('__test_reward__',1,123,'Test reward') returning id into rule;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.duel_choose_region('Marmara');
 blocked:=false;begin perform public.duel_create(a);exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Self-challenge allowed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.duel_choose_region('Ege');
 perform set_config('request.jwt.claim.sub',a::text,true);d:=public.duel_create(b);
 blocked:=false;begin perform public.duel_respond(d,true);exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Challenger accepted own invitation';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.duel_respond(d,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 s:=public.duel_next(d);
 if s ? 'answer' or s ? 'explanation' or s->>'status'<>'question' then raise exception 'Open question exposed keys';end if;
 for idx in 0..4 loop
  if idx=0 then
   update public.duel_players set started_at=clock_timestamp()-interval '31 seconds' where duel_id=d and user_id=a;
   opt:=null;
  else
   select (questions->idx->>'answer')::int into opt from public.duels where id=d;
   update public.duel_players set started_at=clock_timestamp()-interval '10 seconds' where duel_id=d and user_id=a;
  end if;
  s:=public.duel_answer(d,idx,opt);
  if idx=0 then
   blocked:=false;begin perform public.duel_answer(d,0,0);exception when raise_exception then blocked:=true;end;
   if not blocked then raise exception 'Duplicate answer accepted';end if;
  end if;
 end loop;
 if s->>'status'<>'waiting' then raise exception 'Opponent waiting failed';end if;
 if exists(select 1 from public.duel_results where duel_id=d) then raise exception 'Points awarded before opponent completed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);s:=public.duel_next(d);
 for idx in 0..4 loop
  select ((questions->idx->>'answer')::int+1)%4 into opt from public.duels where id=d;
  s:=public.duel_answer(d,idx,opt);
 end loop;
 if s->>'status'<>'finished' then raise exception 'Settlement failed';end if;
 if (select count(*) from public.duel_results where duel_id=d)<>2 then raise exception 'Result count failed';end if;
 select points into score_a from public.duel_results where duel_id=d and user_id=a;
 if score_a not between 628 and 632 then raise exception 'Speed/winner scoring incorrect: %',score_a;end if;
 if (select points from public.duel_results where duel_id=d and user_id=b)<>0 then raise exception 'Wrong-answer points incorrect';end if;
 if (select correct from public.duel_results where duel_id=d and user_id=a)<>4 then raise exception 'Timeout scored as correct';end if;
 perform public.duel_settle(d);
 if (select count(*) from public.duel_results where duel_id=d)<>2 then raise exception 'Duplicate result';end if;
 if (select count(*) from public.duel_rewards where user_id=a and rule_id=rule and amount_try=123 and status='earned')<>1 then raise exception 'Reward missing';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 blocked:=false;begin perform public.duel_create(b);exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Same-opponent daily cap failed';end if;
 blocked:=false;begin perform public.duel_choose_region('Karadeniz');exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Scored player switched region';end if;
 s:=public.duel_dashboard();
 if jsonb_array_length(s->'regions')<>5 then raise exception 'Five regions missing';end if;
 if not exists(select 1 from jsonb_array_elements(s->'regions') j where j->>'region'='Marmara' and (j->>'average')::numeric=score_a) then raise exception 'Region average incorrect';end if;
 if has_function_privilege('anon','public.duel_answer(uuid,integer,integer)','EXECUTE') then raise exception 'Anonymous access allowed';end if;
 perform set_config('dueltest.a',a::text,true);
end $$;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.duel_questions) then raise exception 'PJP can read bank answers';end if;
 if has_table_privilege('authenticated','public.duel_results','INSERT') then raise exception 'Client can forge scores';end if;
 if has_table_privilege('authenticated','public.duel_players','UPDATE') then raise exception 'Client can forge timer';end if;
end $$;
reset role;
rollback;
select 'PASS: region selection, invitation ownership, same-opponent cap, 30-second timeout, server speed scoring, duplicate prevention, winner bonus, region averages, reward snapshots, RLS and no answer-key access. Fixtures rolled back.' as validation;

