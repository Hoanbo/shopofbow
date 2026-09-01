// scratch/inspect_phase4_discovery.ts
// Deep Inspection script for Phase 4.1 Discovery Investigation

import { supabase } from '../src/lib/supabase';
import { resolveProductQuery } from '../src/services/agent/productResolver';
import { executeGeminiTool } from '../src/services/agent/gemini/geminiTools';
import { processAgentMessage } from '../src/services/agent/agentEngine';

async function runDeepInspection() {
  console.log('=== PHASE 4.1: DEEP INSPECTION & ROOT CAUSE TRACING ===\n');

  // 1. Database Reality Check: What products exist in DB?
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, slug, description, category_id, categories(id, name, slug), product_plans(id, name, duration, price)')
    .eq('is_active', true);

  console.log(`[1. Database Reality] Total active products: ${allProducts?.length || 0}`);
  allProducts?.forEach((p: any) => {
    console.log(` - [${p.id}] ${p.name} (Cat: ${p.categories?.name || p.category_id}) | Plans: ${p.product_plans?.length || 0}`);
    console.log(`   Desc: ${p.description?.substring(0, 100)}...`);
  });

  console.log('\n-------------------------------------------------------------');
  console.log('[2. Tool Inspection: search_products tool]');
  
  const toolQueries = [
    'xem phim',
    'xem phim thì có những app gì',
    'app xem phim',
    'phim',
    'video',
    'giải trí',
  ];

  for (const q of toolQueries) {
    const res = await executeGeminiTool('search_products', { query: q }, { sessionId: 'test', userId: 'u123' });
    console.log(`\nTool Query: "${q}"`);
    console.log(`Tool Success: ${res.success}, Count: ${res.data?.products?.length || 0}`);
    res.data?.products?.forEach((p: any, i: number) => {
      console.log(`   ${i + 1}. ${p.name} (Score/Match details: ${p.categoryName || ''})`);
    });
  }

  console.log('\n-------------------------------------------------------------');
  console.log('[3. Product Resolver Inspection: resolveProductQuery]');
  for (const q of ['xem phim thì có những app gì', 'có những app nào xem phim', 'cho tôi các app xem phim']) {
    const resolved = resolveProductQuery(q, allProducts || []);
    console.log(`\nQuery: "${q}"`);
    console.log(`Resolved Product: ${resolved.product?.name || 'NONE'}`);
    console.log(`Resolved Plan: ${resolved.plan?.name || resolved.plan?.duration || 'NONE'}`);
    console.log(`Semantic Candidates: ${resolved.semanticCandidates?.length || 0}`);
    resolved.semanticCandidates?.forEach((c: any, idx: number) => {
      console.log(`   Candidate ${idx + 1}: ${c.product.name} (Score: ${c.score.totalScore})`);
    });
  }

  console.log('\n-------------------------------------------------------------');
  console.log('[4. Full Agent Engine Trace: processAgentMessage]');
  const mockContext = {
    sessionId: 'inspect_session_1',
    userId: 'u123',
    conversationHistory: [],
    lastAction: null,
  };

  const agentRes = await processAgentMessage('xem phim thì có những app gì', mockContext);
  console.log('\nFinal Agent Response:');
  console.log('Content:\n' + agentRes.content);
  console.log('Action:', agentRes.action);
  console.log('Actions array length:', agentRes.actions?.length || 0);
  console.log('Data payload:', agentRes.data);
  console.log('Suggestions:', agentRes.suggestions);
}

runDeepInspection();
