import { executeAgentMessage } from '../src/services/agent/agentHostBridge';
import { shopAdapter } from '../src/services/agent/adapters/shopAdapter';
import { setActiveShopAdapter } from '@bow/agent';

async function run() {
  console.log('Setting adapter...');
  setActiveShopAdapter(shopAdapter);
  console.log('Calling executeAgentMessage...');
  const t0 = Date.now();
  const r = await executeAgentMessage('Xin chao', { role: 'guest', isAuthenticated: false }, { mode: 'standalone' });
  console.log('Result in', Date.now() - t0, 'ms:', r);
}

run().catch(console.error);
