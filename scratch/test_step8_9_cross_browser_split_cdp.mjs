import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_9_' + Date.now());
const PORT = 9236;

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

const SPLIT_PROFILES = [
  { name: '1. Chrome Split 50% (960x900)', width: 960, height: 900, isMobile: false },
  { name: '2. Chrome Split narrow (800x900)', width: 800, height: 900, isMobile: false },
  { name: '3. Edge/Tablet Half Split (640x800)', width: 640, height: 800, isMobile: false },
  { name: '4. Tablet Portrait (768x1024)', width: 768, height: 1024, isMobile: true },
  { name: '5. Tablet Landscape (1024x768)', width: 1024, height: 768, isMobile: true },
  { name: '6. Mobile Webview (390x844)', width: 390, height: 844, isMobile: true },
];

async function runStep89Tests() {
  console.log('============================================================');
  console.log('STEP 8.9: CROSS-BROWSER / SPLIT-SCREEN REGRESSION MATRIX');
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

  const baseUrl = 'http://localhost:5173/';
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

  const results = [];

  for (const prof of SPLIT_PROFILES) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Split Profile: [${prof.name}] (${prof.width}x${prof.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: prof.width,
      height: prof.height,
      deviceScaleFactor: 1,
      mobile: prof.isMobile,
    });
    await sleep(500);

    // 1. Audit Header & Document Overflow
    const headerAudit = await cdp.eval(`(() => {
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const hasOverflowX = docScrollW > docW;

      const header = document.querySelector('header');
      const logo = header?.querySelector('img');
      const logoR = logo?.getBoundingClientRect();

      return {
        hasOverflowX,
        headerVisible: Boolean(header),
        logoVisible: logoR ? logoR.width > 0 && logoR.height > 0 : false
      };
    })()`);

    console.log('  - Header & overflow audit:', headerAudit);

    // 2. Audit Launcher Widget & MobileNav Gap
    const launcherAudit = await cdp.eval(`(() => {
      const isBelowLg = window.innerWidth < 1024;
      const launcher = document.querySelector('.fixed.z-\\\\[9990\\\\]') || document.querySelector('[class*="9990"]');
      const launcherBtn = launcher?.querySelector('button');
      const launcherR = launcherBtn?.getBoundingClientRect();

      const mobileNav = document.querySelector('nav.fixed.bottom-0');
      const mobileNavDisplay = mobileNav ? window.getComputedStyle(mobileNav).display : 'none';
      const mobileNavR = mobileNav?.getBoundingClientRect();

      let verticalGap = 999;
      if (isBelowLg && mobileNavR && launcherR) {
        verticalGap = mobileNavR.top - launcherR.bottom;
      }

      return {
        isBelowLg,
        launcherVisible: launcherR ? launcherR.width > 0 && launcherR.height > 0 : false,
        mobileNavVisible: mobileNavDisplay !== 'none',
        verticalGap: Math.round(verticalGap),
        gapSafe: isBelowLg ? verticalGap >= 12 : true
      };
    })()`);

    console.log('  - Launcher & MobileNav audit:', launcherAudit);

    // 3. Test Agent Modal Open / Close in Split Screen
    await cdp.eval(`(() => {
      const launcherBtn = document.querySelector('button[aria-label="Open BOW Agent"]') || 
                          document.querySelector('button[title*="BOW Agent"]');
      if (launcherBtn) launcherBtn.click();
    })()`);
    await sleep(500);

    const modalAudit = await cdp.eval(`(() => {
      const modal = document.querySelector('[class*="z-\\\\[99999\\\\]"]') || document.querySelector('[class*="99999"]');
      if (!modal) return { isOpen: false };

      const r = modal.getBoundingClientRect();
      const docW = window.innerWidth;
      const docH = window.innerHeight;

      const fitsX = r.left >= 0 && r.right <= docW + 2;
      const fitsY = r.top >= 0 && r.bottom <= docH + 2;

      // Close agent modal
      const closeBtn = modal.querySelector('button[aria-label="Đóng"]') || modal.querySelector('button');
      if (closeBtn) closeBtn.click();

      return {
        isOpen: true,
        width: Math.round(r.width),
        height: Math.round(r.height),
        fitsX,
        fitsY
      };
    })()`);
    await sleep(400);

    console.log('  - Agent Modal split audit:', modalAudit);

    const isPass =
      !headerAudit.hasOverflowX &&
      headerAudit.logoVisible &&
      launcherAudit.launcherVisible &&
      launcherAudit.gapSafe &&
      modalAudit.isOpen &&
      modalAudit.fitsX &&
      modalAudit.fitsY;

    results.push({
      profile: prof.name,
      noHOverflow: !headerAudit.hasOverflowX ? 'PASS' : 'FAIL',
      launcherVisible: launcherAudit.launcherVisible ? 'PASS' : 'FAIL',
      gapSafe: launcherAudit.gapSafe ? 'PASS' : 'FAIL',
      modalFits: modalAudit.fitsX && modalAudit.fitsY ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.9 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.9 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep89Tests().catch((err) => {
  console.error('Fatal error running Step 8.9 tests:', err);
  process.exit(1);
});
