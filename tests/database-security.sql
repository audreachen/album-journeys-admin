-- Run through privileged SQL in a transaction. Every fixture is rolled back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.journal_profiles where not is_superadmin limit 1),true);
set local role authenticated;
do $$ declare n integer; denied boolean; begin
 if public.is_fruit_stand_admin() then raise exception 'Nonadmin passed admin authorization'; end if;
 denied=false;begin perform * from public.journey_admin_users();exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Nonadmin read auth accounts';end if;
 select count(*) into n from public.terms; if n<>0 then raise exception 'Nonadmin read catalog'; end if;
 select count(*) into n from public.generation_requests; if n<>0 then raise exception 'Nonadmin read audit trail'; end if;
 denied=false;begin insert into public.terms(term,definition) values('security-test','denied');exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Nonadmin wrote catalog';end if;
 denied=false;begin update public.journal_profiles set is_superadmin=true where user_id=auth.uid();exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Role update escalation possible';end if;
 denied=false;begin insert into public.journal_profiles(user_id,is_superadmin) values(auth.uid(),true);exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Role insert escalation possible';end if;
 -- Preserve the user-facing profile upsert, including its conflict-update of user_id.
 insert into public.journal_profiles(user_id,display_name) values(auth.uid(),'transaction-only test') on conflict(user_id) do update set user_id=excluded.user_id,display_name=excluded.display_name;
 denied=false;begin perform public.journey_sync_images();exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Nonadmin could synchronize images';end if;
 denied=false;begin insert into storage.objects(bucket_id,name) values('admin-images','security-test.png');exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Nonadmin wrote admin storage';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.journal_profiles where is_superadmin limit 1),true);
set local role authenticated;
do $$ declare p uuid;m uuid;r uuid; c integer; denied boolean; begin
 if not public.is_fruit_stand_admin() then raise exception 'Google superadmin denied';end if;
 select count(*) into c from public.journey_admin_users();if c<1 then raise exception 'Admin cannot read auth accounts';end if;
 insert into public.llm_providers(name) values('transaction-test-provider') returning id into p;
 update public.llm_providers set name='transaction-test-provider-edited' where id=p;
 insert into public.llm_models(provider_id,name,model_key) values(p,'transaction-test-model','transaction-test-model') returning id into m;
 update public.llm_models set temperature=0.5 where id=m;
 delete from public.llm_models where id=m;delete from public.llm_providers where id=p;
 insert into public.terms(term,definition) values('transaction-test','test') returning id into r;update public.terms set definition='updated' where id=r;delete from public.terms where id=r;
 insert into public.ai_generation_examples(name,input,output) values('transaction-test','test','{"title":"test","description":"test","energy":[1,2,3,4,5,6,7,8,9,10]}') returning id into r;update public.ai_generation_examples set name='updated' where id=r;delete from public.ai_generation_examples where id=r;
 insert into public.allowed_signup_domains(domain) values('transaction-test.example') returning id into r;update public.allowed_signup_domains set domain='updated-test.example' where id=r;delete from public.allowed_signup_domains where id=r;
 insert into public.whitelisted_email_addresses(email) values('test@transaction-test.example') returning id into r;update public.whitelisted_email_addresses set email='updated@transaction-test.example' where id=r;delete from public.whitelisted_email_addresses where id=r;
 insert into storage.objects(bucket_id,name) values('admin-images','transaction-test.png');
 insert into public.uploaded_images(path,title,uploaded_by) values('transaction-test.png','transaction-test',auth.uid()) returning id into r;update public.uploaded_images set alt_text='updated' where id=r;delete from public.uploaded_images where id=r;
 -- Storage object fixture is removed by transaction rollback; production deletes use the Storage API.
 select count(*) into c from public.prompt_chains;if c<2 then raise exception 'Missing deployed prompt chains';end if;
 update public.prompt_chain_mixes set weight=weight where enabled and weight>0;
 denied=false;begin update public.prompt_chain_mixes set enabled=false;exception when check_violation then denied=true;end;if not denied then raise exception 'All mixes can be disabled';end if;
 denied=false;begin delete from public.generation_requests;exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Admin can alter immutable logs';end if;
end $$;
reset role;
set local role anon;
do $$ declare denied boolean;begin
 denied=false;begin perform public.journey_runtime_config('invalid-token');exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Runtime accepts invalid token';end if;
 denied=false;begin perform * from public.generation_requests;exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Anonymous log read allowed';end if;
end $$;
reset role;
rollback;
select 'PASS: nonadmin, anonymous, superadmin CRUD, profile upsert, immutable audit and storage RLS; fixtures rolled back' as result;
