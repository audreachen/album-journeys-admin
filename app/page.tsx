import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import AdminNav from '@/lib/AdminNav';
import { resources } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const { db } = await requireAdmin();
  const names = ['generation_requests','ai_generated_media','uploaded_images'];
  const [accounts, ...tableCounts] = await Promise.all([db.rpc('journey_admin_users', {p_offset:0,p_limit:1}), ...names.map(table => db.from(table).select('*', { count: 'exact', head: true }))]);
  const counts = [{count: accounts.data?.[0]?.total_count ?? 0, error: accounts.error}, ...tableCounts];
  const { data: recent, error } = await db.from('generation_requests').select('id,input,status,created_at,user_id').order('created_at',{ascending:false}).limit(5);
  return <main><AdminNav /><p className="eyebrow">A LITTLE ORDER BEHIND THE ADVENTURE</p><h1>Fresh from the journey.</h1><p>Manage the ingredients behind Album Journeys: listeners, prompts, energy maps and the AI that brings them together.</p><div className="grid">{['Listeners','AI requests','AI energy maps','Uploaded images'].map((label,i) => <div className="stat" key={label}><span>{label}</span><strong>{counts[i].error ? 'Unavailable' : counts[i].count ?? 0}</strong></div>)}</div>
    <section className="panel"><div className="toolbar"><h2>Latest AI generations</h2><Link href="/log">View full generation log →</Link></div>{error ? <p className="error">Could not load requests: {error.message}</p> : recent?.length ? <div className="table-scroll"><table><thead><tr><th>Input</th><th>Status</th><th>Timestamp (UTC)</th><th>User ID</th></tr></thead><tbody>{recent.map(r => <tr key={r.id}><td>{r.input?.description ?? JSON.stringify(r.input)}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{new Date(r.created_at).toISOString()}</td><td><small>{r.user_id ?? 'Anonymous'}</small></td></tr>)}</tbody></table></div> : <p>No AI requests yet. New generations in Album Journeys will appear here automatically.</p>}</section>
    <section className="panel"><h2>The ingredients</h2><div className="link-grid">{Object.entries(resources).map(([key,r]) => <Link key={key} href={`/catalog/${key}`}>{r.title}<small>{r.writable ? r.updateOnly ? 'Read · Update' : 'Create · Read · Update · Delete' : 'Read only'}</small></Link>)}<Link href="/images">Uploaded images<small>Upload · Preview · Edit · Delete</small></Link></div></section>
  </main>;
}
