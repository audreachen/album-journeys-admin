'use server';
import { requireAdmin } from '@/lib/admin';
import { imageKind } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
function go(key: string,message: string): never { redirect(`/images?${key}=${encodeURIComponent(message)}`); }
export async function saveImage(form: FormData) {
  const { db, user } = await requireAdmin();
  const title = String(form.get('title') ?? '').trim(); const alt = String(form.get('alt_text') ?? '').trim(); const id = String(form.get('id') ?? '');
  if (!title || title.length>160 || alt.length>500) go('error','Enter a title up to 160 characters and alt text up to 500 characters.');
  let existing: { bucket_id: string; path: string } | null = null;
  if (id) { const result = await db.from('uploaded_images').select('bucket_id,path').eq('id',id).single(); if (result.error || !result.data) go('error','Image not found.'); existing=result.data; }
  const file = form.get('file');
  let path = existing?.path; let bucket = existing?.bucket_id ?? 'admin-images'; let newPath: string | undefined;
  if (file instanceof File && file.size) {
    if (file.size>2*1024*1024) go('error','Images must be 2 MB or smaller.');
    const bytes = new Uint8Array(await file.arrayBuffer()); const kind = imageKind(bytes);
    if (!kind || kind !== file.type) go('error','Upload a valid PNG, JPEG or WebP image.');
    // Replacements use a new object, so a failed metadata write cannot overwrite the old image.
    bucket='admin-images'; newPath=`${user.id}/${crypto.randomUUID()}.${kind==='image/png'?'png':kind==='image/webp'?'webp':'jpg'}`;
    const uploaded=await db.storage.from(bucket).upload(newPath,bytes,{contentType:kind,upsert:false});
    if(uploaded.error) go('error',uploaded.error.message);
    path=newPath;
  }
  if (!path) go('error','Choose an image to upload.');
  const record={title,alt_text:alt,bucket_id:bucket,path};
  const result=id ? await db.from('uploaded_images').update(record).eq('id',id).select('id') : await db.from('uploaded_images').insert({...record,uploaded_by:user.id}).select('id');
  if(result.error || !result.data?.length) { if(newPath) await db.storage.from(bucket).remove([newPath]); go('error',result.error?.message ?? 'No image was changed.'); }
  // User-uploaded source images are preserved when their admin catalog entry is replaced.
  let cleanupWarning=false;
  if(newPath && existing?.bucket_id==='admin-images') { const removed=await db.storage.from(existing.bucket_id).remove([existing.path]); cleanupWarning=!!removed.error; }
  revalidatePath('/images'); revalidatePath('/');
  go('success',cleanupWarning?'Image saved; the previous object could not be removed.':'Image saved.');
}
export async function deleteImage(form: FormData) {
  const {db}=await requireAdmin(); const id=String(form.get('id')??'');
  const {data,error}=await db.from('uploaded_images').select('bucket_id,path').eq('id',id).single();
  if(error||!data) go('error','Image not found.');
  const removed=await db.storage.from(data.bucket_id).remove([data.path]); if(removed.error) go('error',removed.error.message);
  const result=await db.from('uploaded_images').delete().eq('id',id).select('id'); if(result.error) go('error',result.error.message);
  revalidatePath('/images');revalidatePath('/');go('success','Image deleted.');
}
export async function syncImages() {
 const {db}=await requireAdmin();const {data,error}=await db.rpc('journey_sync_images');
 if(error)go('error',error.message);
 revalidatePath('/images');go('success',`Imported ${data ?? 0} new listener uploads.`);
}
