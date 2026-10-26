import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import AdminNav from '@/lib/AdminNav';
import { resources, display, type Field } from '@/lib/catalog';
import { mutateResource } from '../actions';
export const dynamic = 'force-dynamic';
type Row = Record<string, unknown>;
function Fields({ fields, row, providers }: { fields: Field[]; row?: Row; providers: Row[] }) {
  return <>{fields.map(field => <label className="field" key={field.key}><span>{field.label}</span>{field.type === 'checkbox' ? <input type="checkbox" name={field.key} defaultChecked={row ? row[field.key] === true : true} /> : field.type === 'provider' ? <select name={field.key} required defaultValue={String(row?.[field.key] ?? '')}><option value="">Choose a provider</option>{providers.map(p => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}</select> : field.type === 'textarea' || field.type === 'json' ? <textarea name={field.key} required={field.required} maxLength={field.max ?? 12000} rows={field.type === 'json' ? 7 : 3} defaultValue={row ? display(row[field.key]) : ''} /> : <input name={field.key} type={field.type === 'number' ? 'number' : 'text'} step={field.key === 'temperature' ? '0.1' : '1'} required={field.required} maxLength={field.max} defaultValue={String(row?.[field.key] ?? (field.key === 'adapter' ? 'google' : field.key === 'temperature' ? '0.7' : ''))} />}</label>)}</>;
}
export default async function Catalog({ params, searchParams }: { params: Promise<{ resource: string }>; searchParams: Promise<{ page?: string; error?: string; success?: string; q?: string }> }) {
  const { db } = await requireAdmin();
  const { resource } = await params;
  const config = resources[resource]; if (!config) notFound();
  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const q = (query.q ?? '').trim().slice(0,100);
  let request = db.from(config.table).select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const searchField = config.fields.find(f => !['json','number','checkbox','provider'].includes(f.type ?? '') && !f.key.endsWith('_id'))?.key;
  if (q && searchField) request = request.ilike(searchField, `%${q.replace(/[%_\\]/g,'')}%`);
  const { data, error, count } = await request.range((page - 1) * 25, page * 25 - 1);
  const providers = resource === 'models' ? (await db.from('llm_providers').select('id,name')).data ?? [] : [];
  const rows: Row[] = data ?? [];
  return <main><AdminNav /><p className="eyebrow">CONTROL ROOM / {config.writable ? 'MANAGE' : 'READ ONLY'}</p><h1>{config.title}</h1><p>{config.description}</p>
    {query.error && <p role="alert" className="notice error">{query.error}</p>}{query.success && <p role="status" className="notice">{query.success}</p>}
    {config.writable && !config.updateOnly && <details className="panel"><summary>Create a record</summary><form action={mutateResource}><input type="hidden" name="resource" value={resource} /><Fields fields={config.fields} providers={providers} /><button>Create record</button></form></details>}
    {searchField && <form className="toolbar"><label>Search <input name="q" defaultValue={q} maxLength={100} /></label><button>Search</button><Link href={`/catalog/${resource}`}>Clear</Link></form>}
    {error ? <p className="error" role="alert">Could not load records: {error.message}</p> : <section className="panel table-scroll"><p className="muted">{count ?? 0} records · Page {page} · Newest first</p><table><thead><tr>{config.fields.map(f => <th key={f.key}>{f.label}</th>)}<th>ID / Timestamp</th>{config.writable && <th>Actions</th>}</tr></thead><tbody>{rows.map(row => <tr key={String(row.id)}>{config.fields.map(f => <td key={f.key}><pre>{display(row[f.key])}</pre></td>)}<td><small>{String(row.id)}</small><br /><time>{new Date(String(row.created_at)).toISOString()}</time></td>{config.writable && <td><details><summary>Edit</summary><form action={mutateResource}><input type="hidden" name="resource" value={resource} /><input type="hidden" name="id" value={String(row.id)} /><Fields fields={config.fields} row={row} providers={providers} /><button>Save changes</button></form></details>{!config.updateOnly && <details className="delete"><summary>Delete…</summary><p>Delete this record permanently?</p><form action={mutateResource}><input type="hidden" name="resource" value={resource} /><input type="hidden" name="id" value={String(row.id)} /><input type="hidden" name="operation" value="delete" /><button>Confirm deletion</button></form></details>}</td>}</tr>)}</tbody></table>{!rows.length && <p>No records found.</p>}</section>}
    <div className="toolbar">{page > 1 && <Link href={`?page=${page-1}&q=${encodeURIComponent(q)}`}>← Previous</Link>}{page*25 < (count ?? 0) && <Link href={`?page=${page+1}&q=${encodeURIComponent(q)}`}>Next →</Link>}</div>
  </main>;
}
