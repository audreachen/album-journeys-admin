-- Additive catalog and immutable generation audit trail. No existing app data is removed.
create schema if not exists journey_private;
revoke all on schema journey_private from public, anon, authenticated;
create table journey_private.runtime_credentials (name text primary key, token_hash text not null);
alter table journey_private.runtime_credentials enable row level security;

-- Close INSERT-based role escalation as well as UPDATE-based escalation.
revoke insert, update on public.journal_profiles from anon, authenticated;
grant insert(user_id,display_name,avatar_path,created_at) on public.journal_profiles to authenticated;
grant update(user_id,display_name,avatar_path) on public.journal_profiles to authenticated;
revoke all on function public.is_fruit_stand_admin() from public, anon;
grant execute on function public.is_fruit_stand_admin() to authenticated;

create table public.llm_providers (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 100),
 adapter text not null default 'google' check(adapter='google'), enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.llm_models (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.llm_providers(id) on delete restrict,
 name text not null check(length(name) between 1 and 100), model_key text not null unique check(length(model_key) between 1 and 120),
 temperature numeric not null default 0.7 check(temperature between 0 and 2), enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create index on public.llm_models(provider_id);
create table public.prompt_chains (
 id uuid primary key default gen_random_uuid(), name text not null unique, feature text not null check(feature='run_energy_map'),
 description text not null default '', created_at timestamptz not null default now()
);
create table public.prompt_chain_steps (
 id uuid primary key default gen_random_uuid(), chain_id uuid not null references public.prompt_chains(id),
 model_id uuid not null references public.llm_models(id) on delete restrict, position integer not null check(position>0),
 prompt_template text not null, created_at timestamptz not null default now(), unique(chain_id,position)
);
create index on public.prompt_chain_steps(model_id);
create table public.prompt_chain_mixes (
 id uuid primary key default gen_random_uuid(), chain_id uuid not null unique references public.prompt_chains(id),
 name text not null, weight integer not null default 100 check(weight between 0 and 10000), enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.terms (
 id uuid primary key default gen_random_uuid(), term text not null unique check(length(term) between 1 and 100),
 definition text not null check(length(definition) between 1 and 2000), created_at timestamptz not null default now()
);
create table public.ai_generation_examples (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 input text not null check(length(input) between 1 and 2000), output jsonb not null check(jsonb_typeof(output)='object'),
 created_at timestamptz not null default now()
);
create table public.allowed_signup_domains (
 id uuid primary key default gen_random_uuid(), domain text not null unique check(domain=lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'),
 created_at timestamptz not null default now()
);
create table public.whitelisted_email_addresses (
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 created_at timestamptz not null default now()
);
create table public.generation_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 chain_id uuid not null references public.prompt_chains(id), input jsonb not null,
 status text not null default 'pending' check(status in ('pending','succeeded','failed')),
 error text, created_at timestamptz not null default now(), completed_at timestamptz
);
create index on public.generation_requests(user_id);
create index on public.generation_requests(chain_id);
create index on public.generation_requests(created_at desc);
create table public.llm_responses (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.generation_requests(id),
 step_id uuid not null references public.prompt_chain_steps(id), model_key text not null, prompt text not null,
 output text, error text, duration_ms integer not null check(duration_ms>=0), created_at timestamptz not null default now()
);
create index on public.llm_responses(request_id);
create index on public.llm_responses(step_id);
create table public.ai_generated_media (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.generation_requests(id),
 kind text not null default 'energy_map' check(kind='energy_map'), output jsonb not null check(jsonb_typeof(output)='object'),
 created_at timestamptz not null default now()
);
create table public.uploaded_images (
 id uuid primary key default gen_random_uuid(), bucket_id text not null default 'admin-images' check(bucket_id in ('admin-images','journal-photos','profile-pictures')),
 path text not null, title text not null check(length(title) between 1 and 160), alt_text text not null default '' check(length(alt_text)<=500),
 uploaded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(bucket_id,path)
);
create index on public.uploaded_images(uploaded_by);

-- Catalog mutations are superadmin-only, and audit records are read-only to admins.
do $$ declare t text; begin
 foreach t in array array['llm_providers','llm_models','terms','ai_generation_examples','allowed_signup_domains','whitelisted_email_addresses','uploaded_images'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('create policy admin_all on public.%I for all to authenticated using ((select public.is_fruit_stand_admin())) with check ((select public.is_fruit_stand_admin()))',t);
 end loop;
 foreach t in array array['prompt_chains','prompt_chain_steps','prompt_chain_mixes','generation_requests','llm_responses','ai_generated_media'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using ((select public.is_fruit_stand_admin()))',t);
 end loop;
end $$;
grant update(name,weight,enabled) on public.prompt_chain_mixes to authenticated;
create policy admin_update on public.prompt_chain_mixes for update to authenticated using ((select public.is_fruit_stand_admin())) with check ((select public.is_fruit_stand_admin()));

insert into public.llm_providers(name) values('Google Gemini');
insert into public.llm_models(provider_id,name,model_key) select id,'Gemini 3.1 Flash Lite','gemini-3.1-flash-lite' from public.llm_providers where name='Google Gemini';
insert into public.prompt_chains(name,feature,description) values
 ('Run energy journey','run_energy_map','Turn a running description and duration into an illustrative ten-point energy map.'),
 ('Gentle run energy journey','run_energy_map','An alternative prompt for a gentler warm-up and cool-down.');
insert into public.prompt_chain_steps(chain_id,model_id,position,prompt_template)
 select c.id,m.id,1,
 'Create an imaginative, illustrative running energy journey for a {{minutes}}-minute run. User description: {{description}}. Return a short title (max 55 characters), one-sentence description, and exactly 10 integer energy numbers from 0 to 100, sampled evenly throughout the run. Do not claim to analyze real audio.' || case when c.name='Gentle run energy journey' then ' Include a gentle warm-up and cool-down.' else '' end
 from public.prompt_chains c cross join public.llm_models m where m.model_key='gemini-3.1-flash-lite';
insert into public.prompt_chain_mixes(chain_id,name,weight,enabled) select id,name,case when name='Run energy journey' then 100 else 0 end,true from public.prompt_chains;
insert into public.terms(term,definition) values('Energy map','Ten illustrative intensity values from 0 to 100 across a run; these are not measured audio features.');
insert into public.ai_generation_examples(name,input,output) values('Gentle build','A 40-minute easy run with a gradual climb','{"title":"Sunrise Strides","description":"An easy opening grows into a bright middle before settling down.","energy":[20,30,40,50,60,65,60,50,35,20]}');

-- A narrowly scoped server credential allows public generation without exposing a service-role key.
-- Credential plaintext is provisioned separately; only its SHA-256 hash lives in journey_private.
create function journey_private.check_runtime_token(p_token text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or not exists(select 1 from journey_private.runtime_credentials where name='generation' and token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) then
 raise exception 'Unauthorized runtime' using errcode='42501'; end if;
end $$;
revoke all on function journey_private.check_runtime_token(text) from public,anon,authenticated;

create function public.journey_runtime_config(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; result jsonb;
begin
 perform journey_private.check_runtime_token(p_token);
 select mix.chain_id into c from public.prompt_chain_mixes mix where enabled and weight>0 and exists(
 select 1 from public.prompt_chain_steps s join public.llm_models m on m.id=s.model_id join public.llm_providers p on p.id=m.provider_id where s.chain_id=mix.chain_id and m.enabled and p.enabled)
 and not exists(select 1 from public.prompt_chain_steps s join public.llm_models m on m.id=s.model_id join public.llm_providers p on p.id=m.provider_id where s.chain_id=mix.chain_id and (not m.enabled or not p.enabled))
 order by -ln(greatest(random(),0.000001))/mix.weight limit 1;
 if c is null then raise exception 'No enabled generation chain'; end if;
 select jsonb_build_object('chain_id',c,'steps',(select jsonb_agg(jsonb_build_object('id',s.id,'prompt_template',s.prompt_template,'model_key',m.model_key,'temperature',m.temperature) order by s.position) from public.prompt_chain_steps s join public.llm_models m on m.id=s.model_id where s.chain_id=c),
 'terms',(select coalesce(jsonb_agg(jsonb_build_object('term',term,'definition',definition)),'[]') from (select term,definition from public.terms order by created_at limit 30) t),
 'examples',(select coalesce(jsonb_agg(jsonb_build_object('input',input,'output',output)),'[]') from (select input,output from public.ai_generation_examples order by created_at desc limit 5) e)) into result;
 return result;
end $$;
create function public.journey_begin_request(p_token text,p_chain_id uuid,p_input jsonb,p_user_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; begin
 perform journey_private.check_runtime_token(p_token);
 insert into public.generation_requests(chain_id,input,user_id) values(p_chain_id,p_input,p_user_id) returning id into r; return r;
end $$;
create function public.journey_record_response(p_token text,p_request_id uuid,p_step_id uuid,p_model_key text,p_prompt text,p_output text,p_error text,p_duration_ms integer) returns void language plpgsql security definer set search_path='' as $$
begin
 perform journey_private.check_runtime_token(p_token);
 if not exists(select 1 from public.generation_requests r join public.prompt_chain_steps s on s.chain_id=r.chain_id where r.id=p_request_id and s.id=p_step_id and r.status='pending') then raise exception 'Invalid pending request'; end if;
 insert into public.llm_responses(request_id,step_id,model_key,prompt,output,error,duration_ms) values(p_request_id,p_step_id,p_model_key,p_prompt,p_output,p_error,p_duration_ms);
end $$;
create function public.journey_finish_request(p_token text,p_request_id uuid,p_output jsonb default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform journey_private.check_runtime_token(p_token);
 update public.generation_requests set status=case when p_error is null then 'succeeded' else 'failed' end,error=p_error,completed_at=now() where id=p_request_id and status='pending';
 if not found then raise exception 'Invalid pending request'; end if;
 if p_error is null then insert into public.ai_generated_media(request_id,output) values(p_request_id,p_output); end if;
end $$;
revoke all on function public.journey_runtime_config(text),public.journey_begin_request(text,uuid,jsonb,uuid),public.journey_record_response(text,uuid,uuid,text,text,text,text,integer),public.journey_finish_request(text,uuid,jsonb,text) from public;
grant execute on function public.journey_runtime_config(text),public.journey_begin_request(text,uuid,jsonb,uuid),public.journey_record_response(text,uuid,uuid,text,text,text,text,integer),public.journey_finish_request(text,uuid,jsonb,text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('admin-images','admin-images',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy fruit_stand_image_access on storage.objects for all to authenticated using(bucket_id in ('admin-images','journal-photos','profile-pictures') and (select public.is_fruit_stand_admin())) with check(bucket_id in ('admin-images','journal-photos','profile-pictures') and (select public.is_fruit_stand_admin()));
-- Index existing uploads without moving or deleting their objects.
insert into public.uploaded_images(bucket_id,path,title,uploaded_by,created_at)
 select bucket_id,name,left(regexp_replace(name,'^.*/',''),160),null,created_at from storage.objects where bucket_id in ('journal-photos','profile-pictures') on conflict do nothing;
