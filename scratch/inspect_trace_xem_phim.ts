// scratch/inspect_trace_xem_phim.ts
import { clearSessionContext, getSessionContext } from '../src/services/agent/sessionContext';
import { resolveProductQuery } from '../src/services/agent/productResolver';
import { resolveMultiIntent } from '../src/services/agent/intentResolver';
import { processAgentMessage } from '../src/services/agent/agentEngine';
import { searchProducts } from '../src/services/agent/tools';
import { geminiToolDeclarations } from '../src/services/agent/gemini/geminiTools';

async function traceXemPhim() {
  clearSessionContext();
  const query = 'xem phim thì có những app gì';

  console.log('=== TRACING QUERY: "' + query + '" ===\n');

  // 1. Intent Detection
  const intentRes = resolveMultiIntent(query);
  console.log('1. Intent Detection:', intentRes);

  // 2. Product Resolver
  const resolverRes = await resolveProductQuery(query);
  console.log('2. Product Resolver Result:');
  console.log(' - matched:', resolverRes.matched);
  console.log(' - matchType:', resolverRes.matchType);
  console.log(' - confidence:', resolverRes.confidence);
  console.log(' - candidate:', resolverRes.candidate?.name);
  console.log(' - candidates count:', resolverRes.candidates?.length);
  console.log(' - semanticCandidates count:', resolverRes.semanticCandidates?.length);
  resolverRes.semanticCandidates?.forEach((c, i) => console.log(`   ${i + 1}. ${c.name}`));

  // 3. Search Products tool with keyword "xem phim"
  const toolRes1 = await searchProducts({ keyword: 'xem phim' });
  console.log('\n3. searchProducts({ keyword: "xem phim" }) count:', toolRes1.data?.length);

  // 4. Search Products tool with empty params
  const toolResAll = await searchProducts({});
  console.log('4. searchProducts({}) total active products:', toolResAll.data?.length);

  // Check how many products in DB mention "phim" or "video" or "xem"
  const movieProducts = (toolResAll.data || []).filter((p) => {
    const text = `${p.name} ${p.tagline || ''} ${p.description || ''} ${(p.features || []).join(' ')}`.toLowerCase();
    return text.includes('phim') || text.includes('movie') || text.includes('cinema');
  });
  console.log('\n5. Products in Catalog that mention "phim" / "movie" / "cinema":', movieProducts.length);
  movieProducts.forEach((p, i) => {
    console.log(`   ${i + 1}. [${p.id}] ${p.name} (Cat: ${p.categoryName})`);
    console.log(`      Tagline: ${p.tagline}`);
    console.log(`      Features: ${p.features?.slice(0, 2).join(' | ')}`);
  });

  // 6. Full Agent Engine Call with fresh session
  console.log('\n6. Full Agent Engine execution (Fresh Session):');
  clearSessionContext();
  const res = await processAgentMessage(query, { sessionId: 'fresh_session_xem_phim', userId: 'user_test' });
  console.log('Agent Response Content:\n' + res.content);
  console.log('\nAction:', res.action);
  console.log('Actions count:', res.actions?.length);
  console.log('Data:', res.data);
}

traceXemPhim();
