// scratch/test_semantic_trace.ts
import { searchProducts } from '../src/services/agent/tools';
import { scoreProductSemantics } from '../src/services/agent/productResolver';

const res = await searchProducts({});
const allProducts = res.data || [];

console.log(`Loaded ${allProducts.length} products`);

const demandTokens = ['xem', 'phim'];

console.log('\n--- Scoring with demandTokens = ["xem", "phim"] ---');
const scored: { name: string; score: number }[] = [];
for (const p of allProducts) {
  const score = scoreProductSemantics(p, demandTokens);
  if (score > 0) {
    scored.push({ name: p.name, score });
  }
}

scored.sort((a, b) => b.score - a.score);
scored.forEach((s) => console.log(`  ${s.name}: score = ${s.score}`));

const topScore = scored[0]?.score || 0;
const topCandidates = scored.filter((s) => s.score >= topScore - 8);
console.log(`\nTop candidates (within 8 of ${topScore}):`);
topCandidates.forEach((c) => console.log(`  - ${c.name} (${c.score})`));
