import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase';
export async function requireAdmin(){const db=await supabaseServer();const {data:{user},error}=await db.auth.getUser();if(error||!user)redirect('/login');const {data:profile}=await db.from('journal_profiles').select('is_superadmin').eq('user_id',user.id).single();const identities=user.identities??[];const google=identities.some(i=>i.provider==='google') || user.app_metadata?.provider==='google';if(!google||profile?.is_superadmin!==true)redirect('/denied');return {db,user};}
