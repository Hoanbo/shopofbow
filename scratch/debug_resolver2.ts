// scratch/debug_resolver2.ts
import { searchProducts } from '../src/services/agent/tools';
import { normalizeString, cleanQueryTokens } from '../src/services/agent/productResolver';

const query = 'xem phim thì có những app gì';
const cleanTokens = cleanQueryTokens(query);
const normClean = normalizeString(cleanTokens);
const normRaw = normalizeString(query);

console.log('cleanTokens:', JSON.stringify(cleanTokens));
console.log('normClean:', JSON.stringify(normClean));
console.log('normRaw:', JSON.stringify(normRaw));

const res = await searchProducts({});
const allProducts = res.data || [];
console.log(`\nTotal products: ${allProducts.length}`);

// Simulate Layer 4 scoring
for (const p of allProducts) {
  const normName = normalizeString(p.name);
  const normSlug = normalizeString(p.slug);
  const aliases = (p.searchAliases || []).map((a: string) => normalizeString(a));

  // Layer 4
  const aliasMatch = aliases.some((a: string) => normRaw.includes(a) || (normClean.length >= 3 && (normName.includes(normClean) || normSlug.includes(normClean)) && new RegExp(`\\b${normClean}\\b`, 'i').test(a)));
  const prefixMatch = normRaw.includes(normName) ||
    (normClean.length >= 3 && normName.startsWith(normClean)) ||
    (normClean.length >= 3 && new RegExp(`\\b${normClean}\\b`, 'i').test(normName)) ||
    aliasMatch;
    
  if (prefixMatch) {
    console.log(`LAYER4 MATCH: ${p.name} | normName="${normName}" | aliasMatch=${aliasMatch}`);
    console.log(`  aliases: ${JSON.stringify(aliases.slice(0, 4))}`);
  }
}
