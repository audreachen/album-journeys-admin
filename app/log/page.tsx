import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import AdminNav from '@/lib/AdminNav';
import { display } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export default async function Log({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; user?: string }> }) {
  const { db } = await requireAdmin(); const filters = await searchParams;
  const page = Math.max(1, Number(filters.page) || 1);
  let query = db.from('generation_requests').select('*,ai_generated_media(output),llm_responses(output,error,model_key,duration_ms)', { count: 'exact' }).order('created_at', { ascending: false });
  if (['pending','succeeded','failed'].includes(filters.status ?? '')) query = query.eq('status', filters.status!);
  const validUser = filters.user && /^[0-9a-f-]{36}$/i.test(filters.user);
  if (validUser) query = query.eq('user_id', filters.user!);
  const { data, error, count } = await query.range((page-1)*25,page*25-1);
  const filterQuery = `status=${encodeURIComponent(filters.status ?? '')}&user=${encodeURIComponent(filters.user ?? '')}`;
  return <main><AdminNav /><p className="eyebrow">LIVE GENERATION AUDIT</p><h1>AI generation log</h1><p>Real inputs and AI outputs from Album Journeys. Timestamps are UTC. Requests without a signed-in account are marked Anonymous.</p>
    <form className="toolbar"><label>Status <select name="status" defaultValue={filters.status ?? ''}><option value="">All</option>{['pending','succeeded','failed'].map(s => <option key={s}>{s}</option>)}</select></label><label>User ID <input name="user" defaultValue={filters.user} placeholder="UUID" pattern="[0-9a-fA-F-]{36}" /></label><button>Filter</button><Link href="/log">Clear</Link></form>
    {filters.user && !validUser && <p className="error">Enter a valid User ID to filter.</p>}
    {error ? <p className="error" role="alert">Could not load the log: {error.message}</p> : <section className="panel table-scroll"><p className="muted">{count ?? 0} requests · Page {page}</p><table><thead><tr><th>Input</th><th>AI output</th><th>Timestamp</th><th>User ID</th><th>Status / Request</th></tr></thead><tbody>{data?.map(r => <tr key={r.id}><td><pre>{display(r.input)}</pre></td><td>{r.ai_generated_media?.length ? r.ai_generated_media.map((m: {output: unknown},i: number) => <pre key={i}>{display(m.output)}</pre>) : r.llm_responses?.map((v: {output: string | null; error: string | null},i: number) => <pre key={i}>{v.output || v.error || 'No output'}</pre>)}{r.error && <p className="error">{r.error}</p>}{!r.ai_generated_media?.length && !r.llm_responses?.length && !r.error && 'Awaiting response'}</td><td><time>{new Date(r.created_at).toISOString()}</time></td><td><code>{r.user_id ?? 'Anonymous'}</code></td><td><span className={`badge ${r.status}`}>{r.status}</span><p><small>{r.id}</small></p><Link href="/catalog/responses">Inspect LLM responses →</Link></td></tr>)}</tbody></table>{!data?.length && <p>No generation requests match these filters.</p>}</section>}
    <div className="toolbar">{page>1 && <Link href={`?page=${page-1}&${filterQuery}`}>← Previous</Link>}{page*25<(count ?? 0) && <Link href={`?page=${page+1}&${filterQuery}`}>Next →</Link>}</div>
  </main>;
}
