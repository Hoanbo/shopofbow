import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_7_' + Date.now());
const PORT = 9234;

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

async function runStep87Tests() {
  console.log('============================================================');
  console.log('STEP 8.7: RESPONSIVE ADMIN CERTIFICATION');
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

  // Start on desktop viewport for clean initial login & transition
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const homeUrl = 'http://localhost:5173/';
  console.log('Navigating to', homeUrl, '...');
  await cdp.send('Page.navigate', { url: homeUrl });

  let pageMounted = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const count = await cdp.eval(`document.querySelector('header') ? 1 : 0`);
    if (count > 0) {
      pageMounted = true;
      console.log(`Home mounted after ${i + 1}s!`);
      break;
    }
  }
  if (!pageMounted) throw new Error('Home failed to mount!');

  // Dispatch Admin Auth state
  const adminRes = await cdp.eval(`(() => {
    const el = document.querySelector('header');
    if (!el) return { error: 'no header' };
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    if (!fiberKey) return { error: 'no fiberKey' };
    let authFiber = el[fiberKey];
    while (authFiber && authFiber.type?.name !== 'AuthProvider') {
      authFiber = authFiber.return;
    }
    if (authFiber && authFiber.memoizedState?.queue?.dispatch) {
      authFiber.memoizedState.queue.dispatch({
        user: { id: 'usr_admin_step87', email: 'hoankb4@gmail.com' },
        access_token: 'mock_admin_token',
        expires_at: 9999999999
      });
      return { success: true };
    }
    return { error: 'dispatch not found' };
  })()`);
  console.log('Admin session dispatch result:', adminRes);
  await sleep(600);

  // Navigate to /admin via user menu SPA link
  await cdp.eval(`(() => {
    const userBtn = document.querySelector('.user-menu-container button');
    if (userBtn) userBtn.click();
  })()`);
  await sleep(400);

  await cdp.eval(`(() => {
    const adminLink = document.querySelector('a[href="/admin"]');
    if (adminLink) adminLink.click();
  })()`);
  await sleep(1000);

  let adminMounted = false;
  for (let i = 0; i < 15; i++) {
    const hasAdminLayout = await cdp.eval(`Boolean(document.querySelector('header span')?.innerText?.includes('Admin') || document.querySelector('aside'))`);
    if (hasAdminLayout) {
      adminMounted = true;
      console.log(`Admin portal mounted successfully after SPA transition!`);
      break;
    }
    await sleep(400);
  }
  if (!adminMounted) throw new Error('Admin portal failed to mount!');

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Admin Responsive on: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(500);

    // 1. Audit Admin Header & Zero Horizontal Overflow
    const headerAudit = await cdp.eval(`(() => {
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const hasOverflowX = docScrollW > docW;

      const header = document.querySelector('header');
      const logo = header?.querySelector('img');
      const logoR = logo?.getBoundingClientRect();

      return {
        hasOverflowX,
        logoVisible: logoR ? logoR.width > 0 && logoR.height > 0 : false
      };
    })()`);

    console.log('  - Header audit:', headerAudit);

    // 2. Audit Sidebar vs Mobile Drawer
    let drawerWorks = true;
    const sidebarAudit = await cdp.eval(`(() => {
      const isLg = window.innerWidth >= 1024;
      const aside = document.querySelector('aside');
      const asideDisplay = aside ? window.getComputedStyle(aside).display : 'none';
      const menuBtn = document.querySelector('header button[aria-label="Menu"]');
      const menuBtnDisplay = menuBtn ? window.getComputedStyle(menuBtn).display : 'none';

      return {
        isLg,
        asideVisible: asideDisplay !== 'none',
        menuBtnVisible: menuBtnDisplay !== 'none'
      };
    })()`);

    console.log('  - Sidebar audit:', sidebarAudit);

    if (vp.width < 1024) {
      // Test opening mobile drawer
      await cdp.eval(`(() => {
        const menuBtn = document.querySelector('header button[aria-label="Menu"]');
        if (menuBtn) menuBtn.click();
      })()`);
      await sleep(300);

      const drawerAudit = await cdp.eval(`(() => {
        const drawer = document.querySelector('.fixed.inset-0.z-50.lg\\\\:hidden');
        const drawerContent = drawer?.querySelector('.w-72');
        const r = drawerContent?.getBoundingClientRect();
        const linksCount = drawerContent?.querySelectorAll('a')?.length || 0;

        // Close drawer
        const closeBtn = drawer?.querySelector('button');
        if (closeBtn) closeBtn.click();

        return {
          isOpen: Boolean(drawer && drawerContent),
          fitsX: r ? r.left >= 0 && r.right <= window.innerWidth : false,
          linksCount
        };
      })()`);
      await sleep(300);

      drawerWorks = drawerAudit.isOpen && drawerAudit.fitsX && drawerAudit.linksCount >= 10;
      console.log('  - Drawer audit:', { drawerWorks, ...drawerAudit });
    }

    // 3. Test Navigation to /admin/orders via SPA NavLink
    console.log('  Navigating to /admin/orders ...');
    if (vp.width < 1024) {
      // Open drawer, click orders link
      await cdp.eval(`(() => {
        const menuBtn = document.querySelector('header button[aria-label="Menu"]');
        if (menuBtn) menuBtn.click();
      })()`);
      await sleep(300);
      await cdp.eval(`(() => {
        const ordersLink = Array.from(document.querySelectorAll('.w-72 a')).find(a => a.getAttribute('href') === '/admin/orders');
        if (ordersLink) ordersLink.click();
      })()`);
    } else {
      await cdp.eval(`(() => {
        const ordersLink = document.querySelector('aside a[href="/admin/orders"]');
        if (ordersLink) ordersLink.click();
      })()`);
    }
    await sleep(600);

    const tableAudit = await cdp.eval(`(() => {
      const docW = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const hasOverflowX = docScrollW > docW;

      const tables = document.querySelectorAll('table');
      const tableWrappers = Array.from(document.querySelectorAll('.overflow-x-auto'));

      return {
        hasOverflowX,
        tablesCount: tables.length,
        hasTableWrapper: tableWrappers.length > 0
      };
    })()`);

    console.log('  - Table audit (/admin/orders):', tableAudit);

    // Navigate back to /admin
    if (vp.width < 1024) {
      await cdp.eval(`(() => {
        const menuBtn = document.querySelector('header button[aria-label="Menu"]');
        if (menuBtn) menuBtn.click();
      })()`);
      await sleep(300);
      await cdp.eval(`(() => {
        const adminOverviewLink = Array.from(document.querySelectorAll('.w-72 a')).find(a => a.getAttribute('href') === '/admin');
        if (adminOverviewLink) adminOverviewLink.click();
      })()`);
    } else {
      await cdp.eval(`(() => {
        const adminOverviewLink = document.querySelector('aside a[href="/admin"]');
        if (adminOverviewLink) adminOverviewLink.click();
      })()`);
    }
    await sleep(500);

    // Ensure drawer is closed for next iteration
    await cdp.eval(`(() => {
      const drawer = document.querySelector('.fixed.inset-0.z-50.lg\\\\:hidden');
      const closeBtn = drawer?.querySelector('button');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(200);

    const isPass =
      !headerAudit.hasOverflowX &&
      headerAudit.logoVisible &&
      (vp.width >= 1024 ? sidebarAudit.asideVisible : drawerWorks) &&
      !tableAudit.hasOverflowX;

    results.push({
      viewport: vp.name,
      noHOverflow: (!headerAudit.hasOverflowX && !tableAudit.hasOverflowX) ? 'PASS' : 'FAIL',
      sidebarLayout: (vp.width >= 1024 ? sidebarAudit.asideVisible : drawerWorks) ? 'PASS' : 'FAIL',
      tableLayout: (!tableAudit.hasOverflowX) ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.7 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.7 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep87Tests().catch((err) => {
  console.error('Fatal error running Step 8.7 tests:', err);
  process.exit(1);
});
