'use server';
import { requireAdmin } from '@/lib/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function parseEnergy(form: FormData): number[] | null {
  const values = String(form.get('energy') ?? '').split(',').map(v => Number(v.trim()));
  return values.length === 10 && values.every(v => Number.isInteger(v) && v >= 0 && v <= 100) ? values : null;
}
function mapError(message: string): never {
  redirect('/maps?error=' + encodeURIComponent(message));
}
export async function saveMap(form: FormData) {
  const { db, user } = await requireAdmin();
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const energy = parseEnergy(form);
  if (!title || title.length > 120 || description.length > 1000) mapError('Title or description is invalid.');
  if (!energy) mapError('Enter exactly ten whole-number energy values from 0 to 100, separated by commas.');
  const id = String(form.get('id') ?? '');
  const record = { title, description, energy };
  const result = id
    ? await db.from('generated_vibe_maps').update(record).eq('id', id).select('id').maybeSingle()
    : await db.from('generated_vibe_maps').insert({ ...record, created_by: user.id }).select('id').maybeSingle();
  if (result.error) {
    console.error('Fruit Stand map save failed:', { code: result.error.code, message: result.error.message });
    mapError('Could not save the map. Check server logs for the database error.');
  }
  if (!result.data) mapError('No map was changed. Please refresh and try again.');
  revalidatePath('/');
  revalidatePath('/maps');
  redirect('/maps?success=saved');
}
export async function deleteMap(form: FormData) {
  const { db } = await requireAdmin();
  const id = String(form.get('id') ?? '');
  if (!id) mapError('Missing map ID.');
  const { error } = await db.from('generated_vibe_maps').delete().eq('id', id);
  if (error) {
    console.error('Fruit Stand map delete failed:', { code: error.code, message: error.message });
    mapError('Could not delete the map. Check server logs for the database error.');
  }
  revalidatePath('/');
  revalidatePath('/maps');
  redirect('/maps?success=deleted');
}
export async function signOut() {
  const { db } = await requireAdmin();
  await db.auth.signOut();
  redirect('/login');
}

