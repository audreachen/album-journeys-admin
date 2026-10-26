import Link from 'next/link';
import {requireAdmin} from '@/lib/admin';
import AdminNav from '@/lib/AdminNav';
export const dynamic='force-dynamic';
type Account={user_id:string;email:string|null;display_name:string|null;created_at:string;last_sign_in_at:string|null;is_superadmin:boolean;total_count:number};
export default async function Users({searchParams}:{searchParams:Promise<{page?:string}>}){
 const {db}=await requireAdmin();const query=await searchParams;const page=Math.max(1,Number(query.page)||1);
 const {data,error}=await db.rpc('journey_admin_users',{p_offset:(page-1)*25,p_limit:25});const users:Account[]=data??[];
 return <main><AdminNav/><p className="eyebrow">READ ONLY / ACCOUNTS</p><h1>Listeners</h1><p>All registered accounts, including listeners who have not created a journal profile. Account information is visible only to Google superadmins.</p>{error?<p role="alert" className="error">{error.message}</p>:<section className="panel table-scroll"><p className="muted">{users[0]?.total_count??0} accounts · Page {page}</p><table><thead><tr><th>Name</th><th>Email</th><th>Joined (UTC)</th><th>Last sign-in (UTC)</th><th>Role</th><th>User ID</th></tr></thead><tbody>{users.map(p=><tr key={p.user_id}><td>{p.display_name||'No journal profile'}</td><td>{p.email??'—'}</td><td>{new Date(p.created_at).toISOString()}</td><td>{p.last_sign_in_at?new Date(p.last_sign_in_at).toISOString():'Never'}</td><td>{p.is_superadmin?'Superadmin':'Listener'}</td><td><small>{p.user_id}</small></td></tr>)}</tbody></table>{!users.length&&<p>No accounts on this page.</p>}</section>}<div className="toolbar">{page>1&&<Link href={`?page=${page-1}`}>← Previous</Link>}{page*25<(users[0]?.total_count??0)&&<Link href={`?page=${page+1}`}>Next →</Link>}</div></main>;
}
