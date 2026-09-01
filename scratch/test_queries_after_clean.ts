// scratch/test_queries_after_clean.ts
import { processAgentMessage } from '../src/services/agent/agentEngine';

const guestContext = {
  userId: undefined,
  email: undefined,
  fullName: undefined,
  role: 'guest' as const,
  balance: 0,
  isAuthenticated: false,
};

const queries = [
  'xem phim thì có những app gì',
  'Netflix giá bao nhiêu',
  'shop mình có gì',
  'youtube',
  'tôi cần app nghe nhạc',
  'cho tôi xem api',
];

for (const q of queries) {
  console.log(`\n=== QUERY: "${q}" ===`);
  const res = await processAgentMessage(q, guestContext);
  console.log('CONTENT:\n', res.content);
  console.log('DATA:', res.data ? JSON.stringify(res.data).slice(0, 100) : 'none');
  console.log('ACTIONS:', (res.actions?.length || 0) + (res.action ? 1 : 0));
}
