import { cacheRoot, cacheCandidates, removeGenerated } from './lib/local-cache.mjs';
if (process.argv.slice(2).some(a => a !== '--apply')) throw Error('Usage: node scripts/clean-cache.mjs [--apply]');
const apply = process.argv.includes('--apply');
const candidates = await cacheCandidates();
for (const item of candidates) {
  // Re-read leases and pins immediately before every removal; preview is not authority.
  if (apply && (await cacheCandidates()).some(c => c.path === item.path)) await removeGenerated(cacheRoot, item.path);
  console.log(JSON.stringify({ ...item, action: apply ? 'removed-if-still-eligible' : 'preview' }));
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', candidates: candidates.length, policy: 'dead temporary runs >24h; unreferenced host runtimes >30d; unknown data retained' }));
