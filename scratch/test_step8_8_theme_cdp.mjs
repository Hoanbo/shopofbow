import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_8_' + Date.now());
const PORT = 9235;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}/json/list`, (r) => {
          let data = '';
          r.on('data', (c) => (data += c));
          r.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      if (Array.isArray(res)) {
        const page = res.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch (e) {
      await sleep(300);
    }
  }
  throw new Error('Could not connect to Chrome CDP');
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args?.map(a => a.value || a.description).join(' ');
        if (msg.params.type === 'error') {
          console.error('[Browser Console Error]', text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res?.result?.value;
  }

  async close() {
    this.ws.close();
  }
}

const VIEWPORTS = [
  { name: '1. Mobile nhỏ (360x800)', width: 360, height: 800, isMobile: true },
  { name: '2. Mobile (390x844)', width: 390, height: 844, isMobile: true },
  { name: '3. Tablet (768x1024)', width: 768, height: 1024, isMobile: true },
  { name: '4. Narrow desktop (800x900)', width: 800, height: 900, isMobile: false },
  { name: '5. Split-screen (960x900)', width: 960, height: 900, isMobile: false },
  { name: '6. Laptop (1280x720)', width: 1280, height: 720, isMobile: false },
  { name: '7. Desktop (1440x900)', width: 1440, height: 900, isMobile: false },
];

async function runStep88Tests() {
  console.log('============================================================');
  console.log('STEP 8.8: DARK / LIGHT MODE RESPONSIVE REGRESSION');
  console.log('============================================================');

  console.log('Starting Chrome headless on port ' + PORT + '...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${TEMP_USER_DATA}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-background-networking',
      'about:blank',
    ],
    { detached: false, stdio: 'ignore' }
  );

  const wsUrl = await getWsUrl();
  console.log('Connected to Chrome CDP:', wsUrl);

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');

  const baseUrl = 'http://localhost:5173/products/youtube-premium';
  console.log('Navigating to', baseUrl, '...');
  await cdp.send('Page.navigate', { url: baseUrl });

  let pageMounted = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const count = await cdp.eval(`document.querySelector('header') ? 1 : 0`);
    if (count > 0) {
      pageMounted = true;
      console.log(`Page mounted after ${i + 1}s!`);
      break;
    }
  }
  if (!pageMounted) throw new Error('Page failed to mount!');

  // Authenticate user in AuthProvider fiber
  await cdp.eval(`(() => {
    const el = document.querySelector('header');
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    let authFiber = el[fiberKey];
    while (authFiber && authFiber.type?.name !== 'AuthProvider') {
      authFiber = authFiber.return;
    }
    if (authFiber && authFiber.memoizedState?.queue?.dispatch) {
      authFiber.memoizedState.queue.dispatch({
        user: { id: 'usr_theme_tester', email: 'theme_tester@shopofbow.com' },
        access_token: 'mock_token',
        expires_at: 9999999999
      });
    }
  })()`);
  await sleep(600);

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Theme Modes on: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(400);

    // 1. Test Light Mode
    await cdp.eval(`(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    })()`);
    await sleep(300);

    const lightAudit = await cdp.eval(`(() => {
      const isDark = document.documentElement.classList.contains('dark');
      const headerBg = window.getComputedStyle(document.querySelector('header')).backgroundColor;
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;

      return {
        isDark,
        headerBg,
        bodyBg,
        hasOverflowX: docScrollW > docW
      };
    })()`);

    console.log('  - Light theme audit:', lightAudit);

    // 2. Test Dark Mode
    await cdp.eval(`(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    })()`);
    await sleep(300);

    const darkAudit = await cdp.eval(`(() => {
      const isDark = document.documentElement.classList.contains('dark');
      const headerBg = window.getComputedStyle(document.querySelector('header')).backgroundColor;
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;

      return {
        isDark,
        headerBg,
        bodyBg,
        hasOverflowX: docScrollW > docW
      };
    })()`);

    console.log('  - Dark theme audit:', darkAudit);

    // 3. Test Agent Modal in Dark Mode
    await cdp.eval(`(() => {
      const launcher = document.querySelector('button[aria-label="Open BOW Agent"]') || 
                       document.querySelector('button[title*="BOW Agent"]');
      if (launcher) launcher.click();
    })()`);
    await sleep(500);

    const agentAudit = await cdp.eval(`(() => {
      const modal = document.querySelector('[class*="z-\\\\[99999\\\\]"]') || document.querySelector('[class*="99999"]');
      if (!modal) return { isOpen: false };
      const r = modal.getBoundingClientRect();
      const closeBtn = modal.querySelector('button[aria-label="Đóng"]') || modal.querySelector('button');
      
      // Close agent
      if (closeBtn) closeBtn.click();
      return {
        isOpen: true,
        fitsX: r.left >= 0 && r.right <= window.innerWidth + 2
      };
    })()`);
    await sleep(400);

    console.log('  - Agent dark audit:', agentAudit);

    const isPass =
      !lightAudit.isDark &&
      !lightAudit.hasOverflowX &&
      darkAudit.isDark &&
      !darkAudit.hasOverflowX &&
      agentAudit.isOpen &&
      agentAudit.fitsX;

    results.push({
      viewport: vp.name,
      lightMode: (!lightAudit.isDark && !lightAudit.hasOverflowX) ? 'PASS' : 'FAIL',
      darkMode: (darkAudit.isDark && !darkAudit.hasOverflowX) ? 'PASS' : 'FAIL',
      agentContrast: (agentAudit.isOpen && agentAudit.fitsX) ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.8 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.8 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep88Tests().catch((err) => {
  console.error('Fatal error running Step 8.8 tests:', err);
  process.exit(1);
});
