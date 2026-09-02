import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Read approved external environment
const secretsFile = 'C:\\BOW\\.local-secrets\\shopofbow.env';
const env = { ...process.env };

if (fs.existsSync(secretsFile)) {
  const content = fs.readFileSync(secretsFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (k) env[k] = v;
    }
  }
}

console.log('Starting Vite dev server with process environment...');
const child = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
  cwd: 'C:\\BOW\\shopofbow',
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  console.log(`Vite exited with code ${code}`);
  process.exit(code || 0);
});
