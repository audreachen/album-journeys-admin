'use server';
import { requireAdmin } from '@/lib/admin';
import { resources } from '@/lib/catalog';
import { isEnergyMap } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
function go(resource: string, key: string, message: string): never { redirect(`/catalog/${resource}?${key}=${encodeURIComponent(message)}`); }
export async function mutateResource(form: FormData) {
  const { db } = await requireAdmin();
  const resource = String(form.get('resource') ?? '');
  const config = resources[resource];
  if (!config?.writable) throw new Error('Unsupported administrative operation.');
  const id = String(form.get('id') ?? '');
  const operation = String(form.get('operation') ?? 'save');
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) go(resource, 'error', 'Invalid record ID.');
  if (config.updateOnly && (!id || operation === 'delete')) go(resource, 'error', 'This resource supports updates only.');
  if (operation === 'delete' && !id) go(resource, 'error', 'Missing record ID.');
  let result;
  if (operation === 'delete') result = await db.from(config.table).delete().eq('id', id).select('id');
  else {
    const record: Record<string, unknown> = {};
    for (const field of config.fields) {
      const raw = String(form.get(field.key) ?? '').trim();
      if (field.type === 'checkbox') record[field.key] = form.has(field.key);
      else if (field.type === 'number') { const n = Number(raw); if (!raw || !Number.isFinite(n)) go(resource, 'error', `${field.label} must be a number.`); record[field.key] = n; }
      else if (field.type === 'json') { try { record[field.key] = JSON.parse(raw); } catch { go(resource, 'error', 'Output must be valid JSON.'); } }
      else { if (field.required && !raw || field.max && raw.length > field.max) go(resource, 'error', `Check ${field.label}.`); record[field.key] = raw; }
    }
    if (resource === 'domains') record.domain = String(record.domain).toLowerCase();
    if (resource === 'whitelist') record.email = String(record.email).toLowerCase();
    if (resource === 'examples' && !isEnergyMap(record.output)) go(resource, 'error', 'Example output needs title, description and exactly ten integer energy values (0–100).');
    if (resource === 'providers' && record.adapter !== 'google') go(resource, 'error', 'Only the Google adapter is supported by the running app.');
    result = id ? await db.from(config.table).update(record).eq('id', id).select('id') : await db.from(config.table).insert(record).select('id');
  }
  if (result.error) go(resource, 'error', result.error.code === '23503' ? 'This record is still referenced. Remove its references before deleting.' : result.error.code === '23505' ? 'That record already exists.' : result.error.message);
  if (!result.data?.length) go(resource, 'error', 'No record changed. Refresh and try again.');
  revalidatePath('/'); revalidatePath(`/catalog/${resource}`);
  go(resource, 'success', operation === 'delete' ? 'Record deleted.' : 'Changes saved.');
}
