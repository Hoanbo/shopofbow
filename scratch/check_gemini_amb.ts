// scratch/check_gemini_amb.ts
import { processAgentMessage } from '../src/services/agent/agentEngine';

const res = await processAgentMessage('tôi cần AI tốt', { userId: 'u123', isAuthenticated: true });
console.log('CONTENT:', res.content);
console.log('Includes cụ thể:', res.content.includes('cụ thể'));
console.log('Includes làm việc gì:', res.content.includes('làm việc gì'));
console.log('Action:', res.action);
