// scratch/inspect_yt_match.ts
import { searchProducts } from '../src/services/agent/tools';
import { normalizeString, cleanQueryTokens } from '../src/services/agent/productResolver';

const query = 'tôi cần AI tạo video từ text';
const cleanTokens = cleanQueryTokens(query);
const normClean = normalizeString(cleanTokens);
const normRaw = normalizeString(query);

console.log('cleanTokens:', cleanTokens);
console.log('normClean:', normClean);
console.log('normRaw:', normRaw);

const res = await searchProducts({ keyword: 'YouTube' });
const yt = res.data?.[0];
if (yt) {
  const normName = normalizeString(yt.name);
  const normSlug = normalizeString(yt.slug);
  const allAliases = (yt.searchAliases || []).map(a => normalizeString(a));
  console.log('yt.name:', normName);
  console.log('yt.aliases:', allAliases);
  console.log('normRaw.includes(normName):', normRaw.includes(normName));
  console.log('normClean.startsWith(normName):', normClean.startsWith(normName));
  console.log('regex normName in normClean:', new RegExp(`\\b${normClean}\\b`, 'i').test(normName));
}
