import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_4_' + Date.now());
const PORT = 9231;

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

async function runStep84Tests() {
  console.log('============================================================');
  console.log('STEP 8.4: RESPONSIVE HEADER CERTIFICATION');
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
    const count = await cdp.eval(`document.getElementById('root')?.children?.length || 0`);
    if (count > 0) {
      mounted = true;
      console.log(`React mounted after ${i + 1}s!`);
      break;
    }
  }
  if (!mounted) throw new Error('React failed to mount!');

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Header on: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(500);

    // 1. Logo Check
    const logoCheck = await cdp.eval(`(() => {
      const logoLink = document.querySelector('header a[href="/"]');
      const logoImg = logoLink?.querySelector('img');
      const logoText = logoLink?.innerText || '';
      const r = logoLink?.getBoundingClientRect();
      return {
        exists: Boolean(logoLink && logoImg),
        hasText: logoText.includes('BOW'),
        width: r?.width,
        height: r?.height,
        visible: r ? r.width > 0 && r.height > 0 : false
      };
    })()`);

    console.log('  - Logo check:', logoCheck);

    // 2. Search Check
    const searchCheck = await cdp.eval(`(() => {
      const isMobileSize = window.innerWidth < 768;
      if (!isMobileSize) {
        // Desktop search bar
        const desktopSearch = document.querySelector('header input[type="text"], header input[placeholder*="Tìm kiếm"]');
        const r = desktopSearch?.getBoundingClientRect();
        return {
          mode: 'desktop',
          exists: Boolean(desktopSearch),
          visible: r ? r.width > 0 && r.height > 0 : false
        };
      } else {
        // Mobile search trigger
        const searchBtn = document.querySelector('header button[aria-label="Search"]');
        const r = searchBtn?.getBoundingClientRect();
        return {
          mode: 'mobile',
          triggerExists: Boolean(searchBtn),
          triggerVisible: r ? r.width > 0 && r.height > 0 : false
        };
      }
    })()`);

    console.log('  - Search check:', searchCheck);

    // If mobile, test Apple-style search toggle
    let mobileSearchWorks = true;
    if (vp.width < 768) {
      await cdp.eval(`(() => {
        const btn = document.querySelector('header button[aria-label="Search"]');
        if (btn) btn.click();
      })()`);
      await sleep(300);

      const expandedSearch = await cdp.eval(`(() => {
        const input = document.querySelector('header input[placeholder*="Tìm kiếm"]');
        const cancelBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('Hủy'));
        const r = input?.getBoundingClientRect();
        return {
          expanded: Boolean(input && cancelBtn),
          inputVisible: r ? r.width > 0 && r.height > 0 : false
        };
      })()`);

      // Dismiss search
      await cdp.eval(`(() => {
        const cancelBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('Hủy'));
        if (cancelBtn) cancelBtn.click();
      })()`);
      await sleep(300);

      mobileSearchWorks = expandedSearch.expanded && expandedSearch.inputVisible;
      console.log('  - Mobile search toggle check:', { mobileSearchWorks });
    }

    // 3. Notification Menu Check
    const notifCheck = await cdp.eval(`(() => {
      const bellBtn = document.querySelector('header button[title="Thông báo"]');
      if (!bellBtn) return { exists: false };
      bellBtn.click();
      return { exists: true };
    })()`);
    await sleep(400);

    const notifDropdown = await cdp.eval(`(() => {
      const panel = document.querySelector('.notif-menu-container .animate-fade-up, header div[class*="top-[60px]"], header div[class*="top-[calc(100%"]');
      if (!panel) return { isOpen: false };
      const r = panel.getBoundingClientRect();
      const fitsX = r.left >= 0 && r.right <= window.innerWidth + 1;
      const fitsY = r.top >= 0 && r.bottom <= window.innerHeight + 1;

      // Close panel
      document.body.click();
      return {
        isOpen: true,
        width: r.width,
        height: r.height,
        fitsX,
        fitsY
      };
    })()`);
    await sleep(300);

    console.log('  - Notification dropdown check:', notifDropdown);

    // 4. Desktop Navigation Links vs MobileNav
    const navLinksCheck = await cdp.eval(`(() => {
      const isLg = window.innerWidth >= 1024;
      const desktopNav = document.querySelector('header nav.hidden.lg\\\\:flex');
      const hasLinks = desktopNav?.querySelectorAll('a')?.length >= 3;
      return {
        isLg,
        desktopNavExpected: isLg,
        desktopNavHasLinks: Boolean(hasLinks),
        computedDisplay: desktopNav ? window.getComputedStyle(desktopNav).display : 'none'
      };
    })()`);

    console.log('  - Navigation links check:', navLinksCheck);

    // 5. Auth State Check: Guest vs Admin
    // Test Guest first
    const guestCheck = await cdp.eval(`(() => {
      const loginBtn = Array.from(document.querySelectorAll('header a')).find(a => a.innerText.includes('Đăng nhập'));
      return {
        hasLoginBtn: Boolean(loginBtn),
        visible: loginBtn ? loginBtn.getBoundingClientRect().width > 0 : false
      };
    })()`);

    // Test Authenticated User / Admin
    await cdp.eval(`(() => {
      const header = document.querySelector('header');
      const fiberKey = Object.keys(header).find(k => k.startsWith('__reactFiber$'));
      let authFiber = header[fiberKey];
      while (authFiber && authFiber.type?.name !== 'AuthProvider') {
        authFiber = authFiber.return;
      }
      if (authFiber && authFiber.memoizedState?.queue?.dispatch) {
        authFiber.memoizedState.queue.dispatch({
          user: { id: 'usr_admin_step8_4', email: 'hoankb4@gmail.com' },
          access_token: 'mock_admin_token',
          expires_at: 9999999999
        });
      }
    })()`);
    await sleep(600);

    const authCheck = await cdp.eval(`(() => {
      const isMd = window.innerWidth >= 768;
      if (!isMd) {
        // Mobile uses bottom bar for profile
        return { isMobile: true, pass: true };
      }
      const userMenuBtn = document.querySelector('.user-menu-container button');
      if (!userMenuBtn) return { hasUserMenuBtn: false };
      
      const btnText = userMenuBtn.innerText;
      const isAdminBadge = btnText.includes('Admin');
      
      // Open user dropdown
      userMenuBtn.click();
      return {
        hasUserMenuBtn: true,
        isAdminBadge,
        btnText: btnText.replace(/\\n/g, ' ')
      };
    })()`);

    await sleep(300);

    let dropdownAudit = { isOpen: true, fitsX: true, hasBalance: true, hasAdminLink: true };
    if (vp.width >= 768) {
      dropdownAudit = await cdp.eval(`(() => {
        const dropdown = document.querySelector('.user-menu-container div[class*="absolute"]');
        if (!dropdown || window.getComputedStyle(dropdown).display === 'none') {
          return { isOpen: false };
        }
        const r = dropdown.getBoundingClientRect();
        const text = dropdown.innerText;
        const fitsX = r.left >= 0 && r.right <= window.innerWidth + 1;
        const hasBalance = text.includes('Số dư:');
        const hasAdminLink = text.includes('Quản trị Admin');

        // Close menu
        document.body.click();
        return {
          isOpen: true,
          fitsX,
          hasBalance,
          hasAdminLink,
          width: r.width,
          height: r.height
        };
      })()`);
      await sleep(300);
    }

    console.log('  - Auth & Admin menu check:', {
      authCheck,
      dropdownAudit
    });

    const isPass =
      logoCheck.exists &&
      logoCheck.visible &&
      (vp.width >= 768 ? searchCheck.visible : (searchCheck.triggerVisible && mobileSearchWorks)) &&
      notifCheck.exists &&
      notifDropdown.isOpen &&
      notifDropdown.fitsX &&
      (vp.width >= 1024 ? navLinksCheck.computedDisplay !== 'none' : navLinksCheck.computedDisplay === 'none') &&
      (vp.width >= 768 ? (authCheck.hasUserMenuBtn && dropdownAudit.isOpen && dropdownAudit.fitsX && dropdownAudit.hasAdminLink) : true);

    results.push({
      viewport: vp.name,
      logo: logoCheck.visible ? 'PASS' : 'FAIL',
      search: (vp.width >= 768 ? searchCheck.visible : mobileSearchWorks) ? 'PASS' : 'FAIL',
      notifMenu: notifDropdown.fitsX ? 'PASS' : 'FAIL',
      navLinks: (vp.width >= 1024 ? navLinksCheck.computedDisplay !== 'none' : navLinksCheck.computedDisplay === 'none') ? 'PASS' : 'FAIL',
      adminMenu: (vp.width >= 768 ? dropdownAudit.hasAdminLink : true) ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.4 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.4 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep84Tests().catch((err) => {
  console.error('Fatal error running Step 8.4 tests:', err);
  process.exit(1);
});
