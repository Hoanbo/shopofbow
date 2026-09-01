// scratch/check_t14.ts
import { processAgentMessage } from '../src/services/agent/agentEngine';

const res14 = await processAgentMessage('tôi cần phần mềm quản lý tàu vũ trụ', {
  userId: 'u123',
  isAuthenticated: true,
  role: 'user',
  email: 'u123@example.com',
  fullName: 'User Test',
  balance: 1000,
});

console.log('=== RES14 CONTENT ===');
console.log(JSON.stringify(res14.content));
console.log('Includes "chưa có":', res14.content.includes('chưa có'));
console.log('Includes "chưa tìm thấy":', res14.content.includes('chưa tìm thấy'));
console.log('Includes "không có":', res14.content.includes('không có'));
