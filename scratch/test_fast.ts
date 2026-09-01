import { executeAgentMessage, ensureStandaloneAgentInitialized } from '../src/services/agent/agentHostBridge';
import { shopAdapter } from '../src/services/agent/adapters/shopAdapter';
import { setActiveShopAdapter } from '@bow/agent';

async function testFast() {
  process.env.GEMINI_API_KEY = '';
  process.env.VITE_GEMINI_API_KEY = '';
  ensureStandaloneAgentInitialized();
  setActiveShopAdapter(shopAdapter);
  const t0 = Date.now();
  const res = await executeAgentMessage('Xin chào', { role: 'guest', isAuthenticated: false }, { mode: 'standalone' });
  console.log('Fast result in', Date.now() - t0, 'ms:', res.content.substring(0, 50));
}

testFast().catch(console.error);
