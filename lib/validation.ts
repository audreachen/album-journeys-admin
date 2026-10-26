export function isEnergyMap(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === 'string' && v.title.trim().length > 0 && v.title.length <= 120 && typeof v.description === 'string' && v.description.length <= 1000 && Array.isArray(v.energy) && v.energy.length === 10 && v.energy.every(n => Number.isInteger(n) && n >= 0 && n <= 100);
}
export function imageKind(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
