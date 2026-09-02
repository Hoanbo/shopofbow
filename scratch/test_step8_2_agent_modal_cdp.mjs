import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_step8_2_' + Date.now());
const PORT = 9229;

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

async function runStep82Tests() {
  console.log('============================================================');
  console.log('STEP 8.2: RESPONSIVE AGENT MODAL CERTIFICATION');
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

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        if (msg.params.type === 'error') {
          console.error('[Browser Console Error]', text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails);
      }
    } catch {}
  });

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
    console.log(`Testing Viewport: [${vp.name}] (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile,
    });
    await sleep(600);

    // 1. Ensure modal is closed first
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Đóng"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 2. Open Modal via floating launcher
    const launcherClick = await cdp.eval(`(() => {
      const launcher = document.querySelector('button[aria-label="Open BOW Agent"]');
      if (!launcher) return { found: false };
      launcher.click();
      return { found: true };
    })()`);

    if (!launcherClick.found) {
      console.log('  ❌ Launcher button not found!');
      results.push({ viewport: vp.name, status: 'FAIL', reason: 'Launcher not found' });
      continue;
    }
    await sleep(600);

    // 3. Inspect Modal Geometry & Overflow
    const modalGeom = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      if (!modal) return { exists: false };
      
      // Chat Window Container
      const chatBox = modal.querySelector('.relative.z-10') || modal.querySelector('[class*="rounded-"]');
      if (!chatBox) return { exists: true, noChatBox: true };

      const r = chatBox.getBoundingClientRect();
      const docScrollW = document.documentElement.scrollWidth;
      const docClientW = document.documentElement.clientWidth;

      return {
        exists: true,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        docScrollWidth: docScrollW,
        docClientWidth: docClientW,
        hasDocHorizontalOverflow: docScrollW > docClientW,
        fitsInViewportX: r.left >= -1 && r.right <= window.innerWidth + 1,
        fitsInViewportY: r.top >= -1 && r.bottom <= window.innerHeight + 1,
      };
    })()`);

    console.log('  - Geometry check:', {
      box: `${Math.round(modalGeom.width)}x${Math.round(modalGeom.height)}`,
      fitsX: modalGeom.fitsInViewportX,
      fitsY: modalGeom.fitsInViewportY,
      docHScroll: modalGeom.hasDocHorizontalOverflow,
    });

    // 4. Inspect Close Button accessibility
    const closeBtnCheck = await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Đóng"]');
      if (!closeBtn) return { exists: false };
      const r = closeBtn.getBoundingClientRect();
      const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        exists: true,
        width: r.width,
        height: r.height,
        top: r.top,
        right: r.right,
        isClickable: Boolean(topEl && (topEl === closeBtn || closeBtn.contains(topEl))),
        topElTag: topEl ? topEl.tagName : null
      };
    })()`);

    console.log('  - Close button check:', {
      size: `${Math.round(closeBtnCheck.width)}x${Math.round(closeBtnCheck.height)}`,
      clickable: closeBtnCheck.isClickable,
      topEl: closeBtnCheck.topElTag
    });

    // 5. Inspect Input Bar Pinning & Dynamic Height Clearance
    const inputBarCheck = await cdp.eval(`(() => {
      const input = document.querySelector('input[placeholder*="Hỏi giá gói"]');
      if (!input) return { exists: false };
      const r = input.getBoundingClientRect();
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      const chatBox = modal?.querySelector('.relative.z-10');
      const boxR = chatBox?.getBoundingClientRect();
      return {
        exists: true,
        inputBottom: r.bottom,
        windowHeight: window.innerHeight,
        insideModalBottom: boxR ? (r.bottom <= boxR.bottom + 2) : false,
        inputVisible: r.bottom <= window.innerHeight && r.top >= 0,
      };
    })()`);

    console.log('  - Input bar check:', {
      visible: inputBarCheck.inputVisible,
      insideBottom: inputBarCheck.insideModalBottom
    });

    // 6. Test Message Scrolling & No Body Scroll
    // Send a message to populate chat and trigger action card
    await cdp.eval(`(() => {
      const input = document.querySelector('input[placeholder*="Hỏi giá gói"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Mua YouTube Premium 1 tháng');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const sendBtn = document.querySelector('button[aria-label="Send"]');
      if (sendBtn) sendBtn.click();
    })()`);

    // Wait for agent to respond with action card
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const isReady = await cdp.eval(`(() => {
        const isTyping = Boolean(document.querySelector('.animate-bounce'));
        const actionBtn = document.querySelector('.animate-fade-up button') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mua ngay'));
        return !isTyping && Boolean(actionBtn);
      })()`);
      if (isReady) break;
    }

    const scrollCheck = await cdp.eval(`(() => {
      const msgContainer = document.querySelector('.flex-1.overflow-y-auto');
      if (!msgContainer) return { exists: false };
      
      const beforeScroll = msgContainer.scrollTop;
      msgContainer.scrollTop = 50;
      const canScroll = msgContainer.scrollHeight > msgContainer.clientHeight;
      const bodyScrollY = window.scrollY;

      return {
        exists: true,
        canScroll,
        scrollHeight: msgContainer.scrollHeight,
        clientHeight: msgContainer.clientHeight,
        bodyScrollY,
        bodyScrollIsZero: bodyScrollY === 0
      };
    })()`);

    console.log('  - Scroll check:', {
      msgScrollable: scrollCheck.canScroll,
      bodyScrollZero: scrollCheck.bodyScrollIsZero
    });

    // 7. Test CTA Card bounds
    const ctaCheck = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      const chatBox = modal?.querySelector('.relative.z-10');
      const boxW = chatBox ? chatBox.getBoundingClientRect().width : 0;
      const actionCards = Array.from(modal.querySelectorAll('.animate-fade-up, [class*="border-blue-"]'));
      
      let allCardsFit = true;
      for (const card of actionCards) {
        const r = card.getBoundingClientRect();
        if (r.width > boxW) allCardsFit = false;
      }
      return {
        cardsCount: actionCards.length,
        allCardsFit,
        boxWidth: boxW
      };
    })()`);

    console.log('  - CTA bounds check:', {
      cardsCount: ctaCheck.cardsCount,
      allCardsFit: ctaCheck.allCardsFit
    });

    // 8. Test Checkout Modal on top of Agent
    const checkoutTest = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      const buyBtns = Array.from(modal?.querySelectorAll('button') || []).filter(b => b.innerText.includes('Mua ngay'));
      if (buyBtns.length === 0) return { hasBuyBtn: false };
      const buyBtn = buyBtns[0];
      buyBtn.scrollIntoView({ behavior: 'instant', block: 'center' });

      // Dispatch mock session on AuthProvider first
      const fiberKey = Object.keys(modal).find(k => k.startsWith('__reactFiber$'));
      let authFiber = modal[fiberKey];
      while (authFiber && authFiber.type?.name !== 'AuthProvider') {
        authFiber = authFiber.return;
      }
      if (authFiber && authFiber.memoizedState?.queue?.dispatch) {
        authFiber.memoizedState.queue.dispatch({
          user: { id: 'usr_p8_step8_2', email: 'tester@shopofbow.com' },
          access_token: 'mock_token',
          expires_at: 9999999999
        });
      }

      // Dispatch click via React props
      const propKey = Object.keys(buyBtn).find(k => k.startsWith('__reactProps$'));
      if (propKey && buyBtn[propKey]?.onClick) {
        buyBtn[propKey].onClick({ stopPropagation: () => {}, preventDefault: () => {} });
      } else {
        buyBtn.click();
      }

      return { hasBuyBtn: true };
    })()`);

    await sleep(1500);
    const checkoutLayerCheck = await cdp.eval(`(() => {
      const checkoutModal = document.querySelector('[class*="100001"]') ||
                            document.querySelector('.fixed.inset-0.z-\\\\[100001\\\\]');
      if (!checkoutModal) return { isOpen: false };
      const r = checkoutModal.getBoundingClientRect();
      const closeBtn = checkoutModal.querySelector('button');
      
      // Close it after verify
      if (closeBtn) closeBtn.click();
      return {
        isOpen: true,
        isCoveringAgent: r.width > 0 && r.height > 0,
        hasClose: Boolean(closeBtn)
      };
    })()`);

    console.log('  - Checkout Modal layering:', {
      openedOnTop: checkoutLayerCheck.isOpen,
      coveringAgent: checkoutLayerCheck.isCoveringAgent
    });

    // Close Agent Modal
    await sleep(500);
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Đóng"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    const isPass =
      modalGeom.exists &&
      modalGeom.fitsInViewportX &&
      modalGeom.fitsInViewportY &&
      !modalGeom.hasDocHorizontalOverflow &&
      closeBtnCheck.exists &&
      closeBtnCheck.isClickable &&
      inputBarCheck.exists &&
      inputBarCheck.inputVisible &&
      scrollCheck.exists &&
      scrollCheck.bodyScrollIsZero &&
      ctaCheck.allCardsFit &&
      checkoutLayerCheck.isOpen;

    results.push({
      viewport: vp.name,
      geometry: modalGeom.fitsInViewportX && modalGeom.fitsInViewportY ? 'PASS' : 'FAIL',
      noDocOverflow: !modalGeom.hasDocHorizontalOverflow ? 'PASS' : 'FAIL',
      closeBtn: closeBtnCheck.isClickable ? 'PASS' : 'FAIL',
      inputBar: inputBarCheck.inputVisible ? 'PASS' : 'FAIL',
      scroll: scrollCheck.bodyScrollIsZero ? 'PASS' : 'FAIL',
      ctaFit: ctaCheck.allCardsFit ? 'PASS' : 'FAIL',
      checkoutOnTop: checkoutLayerCheck.isOpen ? 'PASS' : 'FAIL',
      overall: isPass ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('STEP 8.2 FINAL MATRIX RESULTS:');
  console.log('============================================================');
  console.table(results);

  const allPass = results.every((r) => r.overall === 'PASS');
  console.log('\nSTEP 8.2 OVERALL RESULT:', allPass ? '✅ PASS' : '❌ FAIL');

  await cdp.close();
  try {
    chromeProcess.kill();
  } catch {}
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  process.exit(allPass ? 0 : 1);
}

runStep82Tests().catch((err) => {
  console.error('Fatal error running Step 8.2 tests:', err);
  process.exit(1);
});
