import { processAgentMessage, setActiveShopAdapter } from '@bow/agent';
import { shopAdapter } from '../src/services/agent/adapters/shopAdapter';

async function testTrace() {
  console.log('1. Setting adapter');
  setActiveShopAdapter(shopAdapter);
  console.log('2. Calling processAgentMessage');
  const res = await processAgentMessage('Xin chao', { role: 'guest', isAuthenticated: false });
  console.log('3. Got result:', res.content);
}

testTrace().catch(err => console.error('Error:', err));
