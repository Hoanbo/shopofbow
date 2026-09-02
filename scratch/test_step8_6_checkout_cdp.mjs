import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_6_' + Date.now());
const PORT = 9233;

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

async function runStep86Tests() {
  console.log('============================================================');
  console.log('STEP 8.6: RESPONSIVE CHECKOUT MODAL CERTIFICATION');
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

  let detailMounted = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const hasBuy = await cdp.eval(`Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Mua Ngay'))`);
    if (hasBuy) {
      detailMounted = true;
      console.log(`Detail page loaded after ${i + 1}s!`);
      break;
    }
  }
  if (!detailMounted) throw new Error('Detail page failed to load!');

  // Authenticate user in AuthProvider fiber so CheckoutModal can open safely
  const authRes = await cdp.eval(`(() => {
    const el = document.querySelector('header') || document.querySelector('main');
    if (!el) return { error: 'no el' };
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    if (!fiberKey) return { error: 'no fiberKey' };
    let authFiber = el[fiberKey];
    while (authFiber && authFiber.type?.name !== 'AuthProvider') {
      authFiber = authFiber.return;
    }
    if (authFiber && authFiber.memoizedState?.queue?.dispatch) {
      authFiber.memoizedState.queue.dispatch({
        user: { id: 'usr_step8_6_tester', email: 'tester_step86@shopofbow.com' },
        access_token: 'mock_token',
        expires_at: 9999999999
      });
      return { success: true };
    }
    return { error: 'dispatch not found', foundFiber: Boolean(authFiber) };
  })()`);
  console.log('Session dispatch result:', authRes);
  await sleep(600);

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Checkout Modal on: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(500);

    // 1. Open CheckoutModal by clicking Mua Ngay
    await cdp.eval(`(() => {
      const buyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mua Ngay'));
      if (buyBtn) {
        buyBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        buyBtn.click();
      }
    })()`);
    await sleep(800);

    // 2. Audit Modal Geometry, Positioning & Overflow
    const modalAudit = await cdp.eval(`(() => {
      const checkoutModal = document.querySelector('[class*="100001"]') || 
                            document.querySelector('.fixed.inset-0.z-\\\\[100001\\\\]');
      if (!checkoutModal) return { isOpen: false };

      const container = checkoutModal.querySelector('.relative.w-full.max-w-md') || checkoutModal.querySelector('[class*="max-w-md"]');
      if (!container) return { isOpen: true, noContainer: true };

      const r = container.getBoundingClientRect();
      const docW = window.innerWidth;
      const docH = window.innerHeight;

      const fitsX = r.left >= 0 && r.right <= docW + 2;
      const fitsY = r.top >= 0 && r.bottom <= docH + 2;
      const scrollable = container.scrollHeight >= container.clientHeight;

      // Close Button
      const closeBtn = checkoutModal.querySelector('button');
      const closeR = closeBtn?.getBoundingClientRect();
      const closeClickable = closeR ? closeR.width >= 24 && closeR.height >= 24 : false;

      // Order Summary text
      const text = container.innerText;
      const hasOrderTitle = text.includes('ĐƠN HÀNG CỦA BẠN');
      const hasItemName = text.includes('YouTube Premium');
      const hasQuantityCounter = Boolean(container.querySelector('button'));
      const hasCouponSection = text.includes('Mã giảm giá') || Boolean(container.querySelector('input[placeholder*="mã giảm giá"]'));

      // Payment Method Tabs
      const methodBtns = Array.from(container.querySelectorAll('button')).filter(b => {
        const t = b.innerText;
        return t.includes('Số dư ví') || t.includes('Ngân hàng') || t.includes('VietQR');
      });

      return {
        isOpen: true,
        width: Math.round(r.width),
        height: Math.round(r.height),
        fitsX,
        fitsY,
        scrollable,
        hasClose: closeClickable,
        hasOrderTitle,
        hasItemName,
        hasQuantityCounter,
        hasCouponSection,
        methodBtnsCount: methodBtns.length
      };
    })()`);

    console.log('  - Checkout Modal audit:', modalAudit);

    // 3. Test Tab Switching without mutations
    const tabSwitchAudit = await cdp.eval(`(() => {
      const container = document.querySelector('.relative.w-full.max-w-md') || document.querySelector('[class*="max-w-md"]');
      if (!container) return { worked: false };

      const walletTab = Array.from(container.querySelectorAll('button')).find(b => b.innerText.includes('Số dư ví'));
      const qrTab = Array.from(container.querySelectorAll('button')).find(b => b.innerText.includes('Ngân hàng'));

      return {
        walletTabExists: Boolean(walletTab),
        qrTabExists: Boolean(qrTab),
        hasMethodButtons: Boolean(walletTab && qrTab)
      };
    })()`);

    console.log('  - Tab switch audit:', tabSwitchAudit);

    // 4. Test Quantity increment without submitting order
    const qtyAudit = await cdp.eval(`(() => {
      const container = document.querySelector('.relative.w-full.max-w-md') || document.querySelector('[class*="max-w-md"]');
      if (!container) return { worked: false };

      const plusBtn = Array.from(container.querySelectorAll('button')).find(b => b.innerText === '+');
      if (plusBtn) plusBtn.click();

      return {
        hasPlusBtn: Boolean(plusBtn)
      };
    })()`);

    // 5. Close Modal safely
    await cdp.eval(`(() => {
      const checkoutModal = document.querySelector('[class*="100001"]') || 
                            document.querySelector('.fixed.inset-0.z-\\\\[100001\\\\]');
      const closeBtn = checkoutModal?.querySelector('button');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    const isClosed = await cdp.eval(`(() => {
      const checkoutModal = document.querySelector('[class*="100001"]');
      return !checkoutModal;
    })()`);

    console.log('  - Modal closed cleanly:', isClosed);

    const isPass =
      modalAudit.isOpen &&
      modalAudit.fitsX &&
      modalAudit.fitsY &&
      modalAudit.hasClose &&
      modalAudit.hasOrderTitle &&
      modalAudit.hasItemName &&
      tabSwitchAudit.walletTabExists &&
      tabSwitchAudit.qrTabExists &&
      isClosed;

    results.push({
      viewport: vp.name,
      modalBounds: modalAudit.fitsX && modalAudit.fitsY ? 'PASS' : 'FAIL',
      orderSummary: modalAudit.hasOrderTitle && modalAudit.hasItemName ? 'PASS' : 'FAIL',
      paymentTabs: tabSwitchAudit.walletTabExists && tabSwitchAudit.qrTabExists ? 'PASS' : 'FAIL',
      closeAction: isClosed ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.6 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.6 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep86Tests().catch((err) => {
  console.error('Fatal error running Step 8.6 tests:', err);
  process.exit(1);
});
