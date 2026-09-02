import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_3_' + Date.now());
const PORT = 9230;

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

async function runStep83Tests() {
  console.log('============================================================');
  console.log('STEP 8.3: MOBILE NAVIGATION, AGENT COLLISION & Z-INDEX AUDIT');
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

  let mounted = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const state = await cdp.eval(`({
      href: window.location.href,
      readyState: document.readyState,
      hasRoot: Boolean(document.getElementById('root')),
      childCount: document.getElementById('root')?.children?.length || 0,
      bodyText: document.body?.innerText?.slice(0, 50) || ''
    })`);
    if (i % 5 === 0) console.log(`Mount check #${i}:`, state);
    if (state?.childCount > 0) {
      mounted = true;
      console.log(`React mounted after ${i + 1}s!`);
      break;
    }
  }
  if (!mounted) throw new Error('React failed to mount!');

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Layering: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(600);

    // Trigger test toast to verify rendered DOM geometry and z-index
    await cdp.eval(`(() => {
      if (window.__bowToast) {
        window.__bowToast.info('Kiểm tra hiển thị thông báo');
      }
    })()`);
    await sleep(300);

    const layerAudit = await cdp.eval(`(() => {
      // 1. Header
      const header = document.querySelector('header');
      const headerR = header?.getBoundingClientRect();
      const headerZ = header ? parseInt(window.getComputedStyle(header).zIndex || '0', 10) : null;

      // 2. MobileNav
      const mobileNav = document.querySelector('nav.fixed.inset-x-0.bottom-0');
      const mobileNavR = mobileNav?.getBoundingClientRect();
      const mobileNavZ = mobileNav ? parseInt(window.getComputedStyle(mobileNav).zIndex || '0', 10) : null;
      const isMobileNavVisible = mobileNav && mobileNavR && mobileNavR.height > 0 && window.getComputedStyle(mobileNav).display !== 'none';

      // 3. Launcher
      const launcherBtn = document.querySelector('button[aria-label="Open BOW Agent"]');
      const launcherContainer = launcherBtn?.closest('.fixed');
      const launcherR = launcherBtn?.getBoundingClientRect();
      const launcherZ = launcherContainer ? parseInt(window.getComputedStyle(launcherContainer).zIndex || '0', 10) : null;
      let launcherTopElTag = null;
      let launcherIsClickable = false;
      if (launcherR) {
        const topEl = document.elementFromPoint(launcherR.left + launcherR.width / 2, launcherR.top + launcherR.height / 2);
        launcherTopElTag = topEl ? topEl.tagName : null;
        launcherIsClickable = topEl === launcherBtn || launcherBtn.contains(topEl);
      }

      // Check collision between Launcher & MobileNav
      let launcherCollidesWithMobileNav = false;
      let gapAboveMobileNav = null;
      if (isMobileNavVisible && launcherR && mobileNavR) {
        gapAboveMobileNav = mobileNavR.top - launcherR.bottom;
        // Collision if launcher overlaps or sits under nav (gap < 0)
        launcherCollidesWithMobileNav = gapAboveMobileNav < 0;
      }

      // 4. Toast Container
      const toastContainer = document.querySelector('[aria-live="polite"]');
      const toastR = toastContainer?.getBoundingClientRect();
      const toastZ = toastContainer ? parseInt(window.getComputedStyle(toastContainer).zIndex || '0', 10) : null;
      const toastIsTop = toastR ? toastR.top < window.innerHeight / 2 : true;

      // Check collision between Toast & Launcher
      let toastCollidesWithLauncher = false;
      if (toastR && launcherR && toastR.height > 0) {
        const overlapsX = !(toastR.right < launcherR.left || toastR.left > launcherR.right);
        const overlapsY = !(toastR.bottom < launcherR.top || toastR.top > launcherR.bottom);
        toastCollidesWithLauncher = overlapsX && overlapsY;
      }

      return {
        header: { exists: Boolean(header), z: headerZ, height: headerR?.height },
        mobileNav: { exists: Boolean(mobileNav), visible: isMobileNavVisible, z: mobileNavZ, height: mobileNavR?.height },
        launcher: {
          exists: Boolean(launcherBtn),
          z: launcherZ,
          clickable: launcherIsClickable,
          topEl: launcherTopElTag,
          gapAboveNav: gapAboveMobileNav,
          collidesWithNav: launcherCollidesWithMobileNav
        },
        toast: { exists: Boolean(toastContainer), z: toastZ, isTop: toastIsTop, collidesWithLauncher: toastCollidesWithLauncher }
      };
    })()`);

    console.log('  Layer Audit Details:', {
      headerZ: layerAudit.header.z,
      mobileNavVisible: layerAudit.mobileNav.visible,
      mobileNavZ: layerAudit.mobileNav.z,
      launcherZ: layerAudit.launcher.z,
      launcherClickable: layerAudit.launcher.clickable,
      gapAboveNav: layerAudit.launcher.gapAboveNav !== null ? `${Math.round(layerAudit.launcher.gapAboveNav)}px` : 'N/A',
      toastZ: layerAudit.toast.z,
      toastIsTop: layerAudit.toast.isTop,
    });

    const isCollisionFree =
      !layerAudit.launcher.collidesWithNav &&
      layerAudit.launcher.clickable &&
      layerAudit.toast.isTop &&
      !layerAudit.toast.collidesWithLauncher;

    const zHierarchyValid =
      layerAudit.header.z === 50 &&
      (!layerAudit.mobileNav.visible || layerAudit.mobileNav.z === 50) &&
      layerAudit.launcher.z === 9990 &&
      layerAudit.toast.z === 100010;

    results.push({
      viewport: vp.name,
      navVisible: layerAudit.mobileNav.visible ? 'YES' : 'NO',
      launcherClickable: layerAudit.launcher.clickable ? 'PASS' : 'FAIL',
      gapAboveNav: layerAudit.launcher.gapAboveNav !== null ? `${Math.round(layerAudit.launcher.gapAboveNav)}px` : 'N/A',
      toastPosition: layerAudit.toast.isTop ? 'TOP' : 'BOTTOM',
      collisionFree: isCollisionFree ? 'PASS' : 'FAIL',
      zHierarchy: zHierarchyValid ? 'PASS' : 'FAIL',
      overall: isCollisionFree && zHierarchyValid ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.3 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.3 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep83Tests().catch((err) => {
  console.error('Fatal error running Step 8.3 tests:', err);
  process.exit(1);
});
