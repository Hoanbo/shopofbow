const fs = require('fs');
const p = 'C:\\BOW\\bow-agent\\tests\\test_phase7_1_step4_extraction.ts';
let lines = fs.readFileSync(p, 'utf-8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('yt-1m')) {
    lines[i] = "    { id: 'yt-1m', name: '1 Thang', duration: '1 thang', price: 35000 },";
  }
  if (lines[i].includes('yt-6m')) {
    lines[i] = "    { id: 'yt-6m', name: '6 Thang', duration: '6 thang', price: 280000 },";
  }
  if (lines[i].includes('yt-12m')) {
    lines[i] = "    { id: 'yt-12m', name: '12 Thang', duration: '12 thang', price: 450000 },";
  }
}
fs.writeFileSync(p, lines.join('\n'), 'utf-8');
console.log('Fixed lines in test file');
