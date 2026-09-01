// scratch/debug_resolver.ts
import { cleanQueryTokens, normalizeString } from '../src/services/agent/productResolver';
import { resolveProductQuery } from '../src/services/agent/productResolver';

const query = 'xem phim thì có những app gì';
const cleanTokens = cleanQueryTokens(query);
const normClean = normalizeString(cleanTokens);

console.log('cleanTokens:', JSON.stringify(cleanTokens));
console.log('normClean:', JSON.stringify(normClean));

console.log('\nRunning resolveProductQuery...');
const res = await resolveProductQuery(query);
console.log('matched:', res.matched);
console.log('matchType:', res.matchType);
console.log('semanticCandidates:', res.semanticCandidates?.map(p => p.name));
console.log('semanticMatchQuery:', res.semanticMatchQuery);
console.log('candidates (all):', res.candidates.length, 'products');

// Also check individual products
const { searchProducts } = await import('../src/services/agent/tools');
const allRes = await searchProducts({});
const youku = allRes.data?.find(p => p.slug === 'youku-vip');
console.log('\nYouku searchAliases:', JSON.stringify(youku?.searchAliases));
const tv360 = allRes.data?.find(p => p.slug === 'tv360-standard');
console.log('TV360 searchAliases:', JSON.stringify(tv360?.searchAliases));
