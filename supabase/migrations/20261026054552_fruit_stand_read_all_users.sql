-- Return only the account fields required by the admin UI; never expose auth.users directly.
create function journey_private.admin_users(p_offset integer,p_limit integer)
returns table(user_id uuid,email text,display_name text,created_at timestamptz,last_sign_in_at timestamptz,is_superadmin boolean,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_fruit_stand_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return query select u.id,u.email::text,p.display_name,u.created_at,u.last_sign_in_at,coalesce(p.is_superadmin,false),count(*) over()
 from auth.users u left join public.journal_profiles p on p.user_id=u.id
 order by u.created_at desc limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
end $$;
revoke all on function journey_private.admin_users(integer,integer) from public,anon;
grant usage on schema journey_private to authenticated;
grant execute on function journey_private.admin_users(integer,integer) to authenticated;
create function public.journey_admin_users(p_offset integer default 0,p_limit integer default 25)
returns table(user_id uuid,email text,display_name text,created_at timestamptz,last_sign_in_at timestamptz,is_superadmin boolean,total_count bigint)
language sql stable security invoker set search_path='' as $$select * from journey_private.admin_users(p_offset,p_limit)$$;
revoke all on function public.journey_admin_users(integer,integer) from public,anon;
grant execute on function public.journey_admin_users(integer,integer) to authenticated;
