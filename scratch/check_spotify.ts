// scratch/check_spotify.ts
import { searchProducts } from '../src/services/agent/tools';
import { resolveProductQuery } from '../src/services/agent/productResolver';

const res = await searchProducts({ keyword: 'Spotify' });
const spotify = res.data?.[0];
console.log('Spotify name:', spotify?.name);
console.log('Spotify tagline:', spotify?.tagline);
console.log('Spotify description:', spotify?.description);
console.log('Spotify searchAliases:', spotify?.searchAliases);

console.log('\nTesting resolveProductQuery("tôi cần app nghe nhạc")...');
const resolved = await resolveProductQuery('tôi cần app nghe nhạc');
console.log('matched:', resolved.matched);
console.log('matchType:', resolved.matchType);
console.log('candidate:', resolved.candidate?.name);
console.log('candidates:', resolved.candidates?.map(p => p.name));
console.log('semanticCandidates:', resolved.semanticCandidates?.map(p => p.name));
