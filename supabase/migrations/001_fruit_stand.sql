-- Fruit Stand admin authorization: bootstrap only through privileged SQL editor.
ALTER TABLE public.journal_profiles ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.is_fruit_stand_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.journal_profiles p
  WHERE p.user_id = (SELECT auth.uid()) AND p.is_superadmin = true
  AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = p.user_id AND i.provider = 'google')
 );
$$;
REVOKE ALL ON FUNCTION public.is_fruit_stand_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_fruit_stand_admin() TO authenticated;
-- The existing user-owned profile policies remain in place.
-- Explicit column privileges prevent a user from changing the admin flag through PostgREST.
REVOKE UPDATE ON public.journal_profiles FROM authenticated;
GRANT UPDATE (display_name,avatar_path) ON public.journal_profiles TO authenticated;
CREATE POLICY "fruit_stand_admin_read_profiles" ON public.journal_profiles FOR SELECT TO authenticated USING ((SELECT public.is_fruit_stand_admin()));
CREATE TABLE IF NOT EXISTS public.generated_vibe_maps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
 description text NOT NULL DEFAULT '' CHECK (char_length(description)<=1000),
 energy integer[] NOT NULL CHECK (array_length(energy,1)=10),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_vibe_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fruit_stand_admin_select_maps" ON public.generated_vibe_maps FOR SELECT TO authenticated USING ((SELECT public.is_fruit_stand_admin()));
CREATE POLICY "fruit_stand_admin_insert_maps" ON public.generated_vibe_maps FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_fruit_stand_admin()) AND created_by=(SELECT auth.uid()));
CREATE POLICY "fruit_stand_admin_update_maps" ON public.generated_vibe_maps FOR UPDATE TO authenticated USING ((SELECT public.is_fruit_stand_admin())) WITH CHECK ((SELECT public.is_fruit_stand_admin()));
CREATE POLICY "fruit_stand_admin_delete_maps" ON public.generated_vibe_maps FOR DELETE TO authenticated USING ((SELECT public.is_fruit_stand_admin()));
CREATE POLICY "fruit_stand_admin_read_votes" ON public.vibe_map_votes FOR SELECT TO authenticated USING ((SELECT public.is_fruit_stand_admin()));
