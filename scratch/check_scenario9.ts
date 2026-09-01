// scratch/check_scenario9.ts
import { processAgentMessage } from '../src/services/agent/agentEngine';

const mockContext = {
  userId: '00000000-0000-0000-0000-000000000001',
  userEmail: 'buyer@example.com',
  userName: 'Test Buyer',
};

const res = await processAgentMessage('tôi cần AI tạo video từ text', mockContext);
console.log('=== RES9 CONTENT ===');
console.log(res.content);
console.log('Includes CapCut:', res.content.includes('CapCut'));
console.log('Includes gần phù hợp:', res.content.includes('gần phù hợp'));
console.log('Includes chuyên dụng:', res.content.includes('chuyên dụng'));
console.log('Data:', res.data);
