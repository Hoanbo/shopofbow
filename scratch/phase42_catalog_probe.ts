import { searchProducts } from '../src/services/agent/tools';
import { resolveProductQuery } from '../src/services/agent/productResolver';
import { processAgentMessageV2 } from '../src/services/agent/agentEngine';
import { clearSessionContext } from '../src/services/agent/sessionContext';
import { executeGeminiTool } from '../src/services/agent/gemini/geminiTools';
import type { AgentContext } from '../src/services/agent/types';

const context: AgentContext = {
  userId: null,
  email: null,
  fullName: null,
  role: 'guest',
  isAuthenticated: false,
};

const catalog = (await searchProducts({})).data || [];
const movieNames = ['netflix', 'tv360', 'youtube', 'youku'];
console.log('CATALOG_MOVIE_PRODUCTS');
for (const product of catalog.filter((item) => movieNames.some((name) => item.name.toLowerCase().includes(name)))) {
  console.log(JSON.stringify({
    id: product.id,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    features: product.features || [],
    searchAliases: product.searchAliases || [],
  }));
}

const movieQuery = 'xem phim th? c? nh?ng app g?';
const resolution = await resolveProductQuery(movieQuery);
console.log('MOVIE_RESOLUTION', JSON.stringify({
  matchType: resolution.matchType,
  semanticMatchQuery: resolution.semanticMatchQuery,
  semanticCandidates: (resolution.semanticCandidates || []).map((item) => item.name),
}));

for (const query of [
  movieQuery,
  'C? nh?ng app xem phim n?o?',
  'Netflix gi? bao nhi?u?',
  'Netflix c? nh?ng g?i n?o?',
  'C? nh?ng app nghe nh?c n?o?',
  'T?i mu?n m?t app t?t',
  'C? ph?n m?m qu?n l? t?u v? tr? kh?ng?',
  '??i gi? Netflix th?nh 1.000?',
]) {
  clearSessionContext();
  const response = await processAgentMessageV2(query, context);
  console.log('AGENT', JSON.stringify({
    query,
    type: response.data?.type,
    product: response.data?.product?.name,
    candidates: (response.data?.candidates || []).map((item: { name: string }) => item.name),
    hasAction: Boolean(response.action),
    actionCount: response.actions?.length || 0,
  }));
}

const geminiResult = await executeGeminiTool('search_products', { keyword: movieQuery }, context, movieQuery);
console.log('GEMINI_TOOL', JSON.stringify({
  type: geminiResult.actionData?.type,
  products: (geminiResult.actionData?.products || []).map((item) => item.name),
}));
