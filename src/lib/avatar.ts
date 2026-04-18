/**
 * Generate a deterministic DiceBear avatar URL for a user.
 * Uses the public DiceBear HTTP API (no key required) so the avatar
 * is identical for the same seed across devices.
 */
export function getDiceBearAvatar(seed: string, style: string = 'thumbs'): string {
  const safeSeed = encodeURIComponent(seed?.trim() || 'anonymous');
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${safeSeed}&radius=50`;
}
