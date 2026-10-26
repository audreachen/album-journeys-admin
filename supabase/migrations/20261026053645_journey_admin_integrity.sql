-- Enforce useful mix settings at the database boundary, including direct API calls.
create function journey_private.guard_active_mix() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(731905021);
 if not (new.enabled and new.weight>0) and not exists(select 1 from public.prompt_chain_mixes m where m.id<>new.id and m.enabled and m.weight>0) then
 raise exception 'Keep at least one prompt-chain mix enabled with a positive weight.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function journey_private.guard_active_mix() from public,anon,authenticated;
create trigger guard_active_mix before update on public.prompt_chain_mixes for each row execute function journey_private.guard_active_mix();

-- Import newly uploaded listener images on demand through normal admin RLS.
create function public.journey_sync_images() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if not public.is_fruit_stand_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 insert into public.uploaded_images(bucket_id,path,title,created_at)
 select bucket_id,name,left(regexp_replace(name,'^.*/',''),160),created_at from storage.objects where bucket_id in ('journal-photos','profile-pictures') and name not like '%/.emptyFolderPlaceholder' on conflict do nothing;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.journey_sync_images() from public,anon;
grant execute on function public.journey_sync_images() to authenticated;
