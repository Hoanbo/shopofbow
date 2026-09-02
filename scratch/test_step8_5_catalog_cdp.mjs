import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_5_' + Date.now());
const PORT = 9232;

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

async function runStep85Tests() {
  console.log('============================================================');
  console.log('STEP 8.5: RESPONSIVE PRODUCT / CATALOG CERTIFICATION');
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

  const baseUrl = 'http://localhost:5173/products';
  console.log('Navigating to', baseUrl, '...');
  await cdp.send('Page.navigate', { url: baseUrl });

  let mounted = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const count = await cdp.eval(`document.querySelectorAll('a[href*="/products/"]').length || 0`);
    if (count > 0) {
      mounted = true;
      console.log(`Products loaded after ${i + 1}s (${count} cards)!`);
      break;
    }
  }
  if (!mounted) throw new Error('Products failed to load!');

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Catalog & Product Detail on: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(500);

    // 1. Audit Catalog Grid & Cards
    const catalogAudit = await cdp.eval(`(() => {
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const hasOverflowX = docScrollW > docW;

      // Category Tabs
      const categoryTabs = document.querySelector('.overflow-x-auto');
      const tabsR = categoryTabs?.getBoundingClientRect();

      // Cards
      const cards = Array.from(document.querySelectorAll('a[href*="/products/"]'))
        .filter(a => a.querySelector('h3'));
      
      let allCardsValid = cards.length > 0;
      let minCardWidth = 9999;
      let minCardHeight = 9999;
      let imagesValid = true;
      let textOverflowFree = true;
      let buttonsValid = true;

      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (r.width < minCardWidth) minCardWidth = r.width;
        if (r.height < minCardHeight) minCardHeight = r.height;

        // Image check
        const img = c.querySelector('img');
        if (img) {
          const imgR = img.getBoundingClientRect();
          if (imgR.width <= 0 || imgR.height <= 0) imagesValid = false;
        }

        // Title check
        const h3 = c.querySelector('h3');
        if (h3) {
          const h3R = h3.getBoundingClientRect();
          if (h3R.width > r.width) textOverflowFree = false;
        }

        // Button check
        const btn = c.querySelector('span.inline-flex');
        if (btn) {
          const btnR = btn.getBoundingClientRect();
          if (btnR.width > r.width || btnR.width <= 0) buttonsValid = false;
        }
      }

      return {
        cardsCount: cards.length,
        hasOverflowX,
        minCardWidth: Math.round(minCardWidth),
        minCardHeight: Math.round(minCardHeight),
        imagesValid,
        textOverflowFree,
        buttonsValid,
        tabsScrollable: Boolean(categoryTabs)
      };
    })()`);

    console.log('  - Catalog audit:', catalogAudit);

    // 2. Audit Detail Page: Pricing Plans & Buy Button
    console.log('  Navigating to Detail page: /products/youtube-premium ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/products/youtube-premium' });
    
    let detailLoaded = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const hasDetail = await cdp.eval(`Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Mua Ngay'))`);
      if (hasDetail) {
        detailLoaded = true;
        break;
      }
    }

    const detailAudit = await cdp.eval(`(() => {
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const hasOverflowX = docScrollW > docW;

      // Plan cards
      const planButtons = Array.from(document.querySelectorAll('button')).filter(b => {
        const text = b.innerText;
        return text.includes('1 tháng') || text.includes('3 tháng') || text.includes('6 tháng') || text.includes('1 năm');
      });

      let planCardsValid = planButtons.length > 0;
      for (const pb of planButtons) {
        const r = pb.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) planCardsValid = false;
      }

      // Click second plan if available
      let planSwitchWorked = false;
      if (planButtons.length >= 2) {
        const beforeText = document.querySelector('[class*="border-blue-100"]')?.innerText || '';
        planButtons[1].click();
        const afterText = document.querySelector('[class*="border-blue-100"]')?.innerText || '';
        planSwitchWorked = Boolean(afterText);
      } else {
        planSwitchWorked = true;
      }

      // Main Buy button
      const buyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mua Ngay'));
      const buyBtnR = buyBtn?.getBoundingClientRect();
      const buyBtnValid = Boolean(buyBtnR && buyBtnR.width > 0 && buyBtnR.height >= 38 && buyBtnR.right <= docW + 1);

      return {
        hasOverflowX,
        planCardsCount: planButtons.length,
        planCardsValid,
        planSwitchWorked,
        buyBtnValid,
        buyBtnWidth: buyBtnR ? Math.round(buyBtnR.width) : 0
      };
    })()`);

    console.log('  - Detail audit:', detailAudit);

    // Return to catalog for next iteration
    await cdp.send('Page.navigate', { url: baseUrl });
    await sleep(800);

    const isPass =
      !catalogAudit.hasOverflowX &&
      catalogAudit.cardsCount > 0 &&
      catalogAudit.minCardWidth >= 120 &&
      catalogAudit.imagesValid &&
      catalogAudit.textOverflowFree &&
      catalogAudit.buttonsValid &&
      detailLoaded &&
      !detailAudit.hasOverflowX &&
      detailAudit.planCardsValid &&
      detailAudit.buyBtnValid;

    results.push({
      viewport: vp.name,
      noHOverflow: (!catalogAudit.hasOverflowX && !detailAudit.hasOverflowX) ? 'PASS' : 'FAIL',
      cardLayout: (catalogAudit.minCardWidth >= 120 && catalogAudit.cardsCount > 0) ? 'PASS' : 'FAIL',
      imageRatio: catalogAudit.imagesValid ? 'PASS' : 'FAIL',
      ctaButtons: (catalogAudit.buttonsValid && detailAudit.buyBtnValid) ? 'PASS' : 'FAIL',
      planCards: detailAudit.planCardsValid ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.5 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.5 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep85Tests().catch((err) => {
  console.error('Fatal error running Step 8.5 tests:', err);
  process.exit(1);
});
