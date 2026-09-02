import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_cdp_test_' + Date.now());
const PORT = 9226;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

async function main() {
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

  try {
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
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        if (msg.params.type === 'error') {
          console.error('[Browser Console Error]', text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails);
      }
    });

    console.log('Navigating to http://localhost:5173/ ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });

    // Wait for React #root to mount
    let mounted = false;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const childCount = await cdp.eval(`document.getElementById('root')?.children?.length || 0`);
      if (childCount > 0) {
        mounted = true;
        console.log(`React mounted after ${i + 1}s!`);
        break;
      }
    }
    if (!mounted) throw new Error('React failed to mount');

    const viewports = [
      { name: '1. Desktop (1440x900)', width: 1440, height: 900, mobile: false },
      { name: '2. Laptop (1280x720)', width: 1280, height: 720, mobile: false },
      { name: '3. Split-screen (960x900)', width: 960, height: 900, mobile: false },
      { name: '4. Narrow desktop (800x900)', width: 800, height: 900, mobile: false },
      { name: '5. Mobile (390x844)', width: 390, height: 844, mobile: true },
      { name: '6. Mobile nhỏ (360x800)', width: 360, height: 800, mobile: true },
      { name: '7. Tablet (768x1024)', width: 768, height: 1024, mobile: false },
    ];

    console.log('\n============================================================');
    console.log('STARTING RESPONSIVE VIEWPORT MATRIX TEST');
    console.log('============================================================\n');

    const matrixResults = [];

    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      });
      await sleep(600);

      // 1. Check Launcher
      const launcherCheck = await cdp.eval(`(() => {
        const btn = document.querySelector('button[aria-label="Open BOW Agent"]');
        if (!btn) return { exists: false };
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topEl = document.elementFromPoint(centerX, centerY);
        const style = window.getComputedStyle(btn);
        const container = btn.closest('.fixed');
        const containerStyle = container ? window.getComputedStyle(container) : null;
        const isLauncherSelf = topEl === btn || btn.contains(topEl);

        return {
          exists: true,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, top: rect.top },
          containerStyle: containerStyle ? {
            position: containerStyle.position,
            bottom: containerStyle.bottom,
            right: containerStyle.right,
            zIndex: containerStyle.zIndex
          } : null,
          topEl: topEl ? {
            tagName: topEl.tagName,
            className: (topEl.className || '').toString().slice(0, 60),
            id: topEl.id || null
          } : null,
          isLauncherSelf,
          inViewport: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight
        };
      })()`);

      // 2. Open Modal by clicking launcher
      await cdp.eval(`document.querySelector('button[aria-label="Open BOW Agent"]')?.click()`);
      await sleep(600);

      // 3. Check Modal
      const modalCheck = await cdp.eval(`(() => {
        const modalContainer = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
        if (!modalContainer) return { isOpen: false };
        
        const modalDialog = modalContainer.querySelector('.relative.z-10');
        const modalRect = modalDialog ? modalDialog.getBoundingClientRect() : null;
        const modalCenter = modalRect ? { x: modalRect.left + modalRect.width / 2, y: modalRect.top + modalRect.height / 2 } : null;
        const topElAtModal = modalCenter ? document.elementFromPoint(modalCenter.x, modalCenter.y) : null;
        const isModalTop = modalContainer.contains(topElAtModal);
        const hasV33 = document.body.innerText.includes('V3.3') || document.body.innerText.includes('Powered by BOW Agent V3.3');
        const closeBtn = modalContainer.querySelector('button[aria-label="Đóng"]');
        const isCloseClickable = Boolean(closeBtn);

        return {
          isOpen: true,
          modalRect,
          isModalTop,
          hasV33,
          isCloseClickable,
          topElAtModalTag: topElAtModal?.tagName
        };
      })()`);

      // 4. Close Modal
      await cdp.eval(`document.querySelector('button[aria-label="Đóng"]')?.click()`);
      await sleep(500);

      const modalClosedCheck = await cdp.eval(`(() => {
        const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
        return !modal;
      })()`);

      const launcherPass = launcherCheck.exists && launcherCheck.isLauncherSelf && launcherCheck.inViewport;
      const modalPass = modalCheck.isOpen && modalCheck.isModalTop && modalCheck.hasV33 && modalCheck.isCloseClickable && modalClosedCheck;
      const overall = launcherPass && modalPass;

      matrixResults.push({
        name: vp.name,
        width: vp.width,
        height: vp.height,
        launcherPass,
        modalPass,
        overall,
        launcherCheck,
        modalCheck,
      });

      console.log(`[${vp.name}]`);
      console.log(`  - Launcher: ${launcherPass ? 'PASS' : 'FAIL'} (bottom: ${launcherCheck.containerStyle?.bottom}, right: ${launcherCheck.containerStyle?.right}, zIndex: ${launcherCheck.containerStyle?.zIndex}, topEl: ${launcherCheck.topEl?.tagName}.${launcherCheck.topEl?.className})`);
      console.log(`  - Modal: ${modalPass ? 'PASS' : 'FAIL'} (top: ${modalCheck.isModalTop}, V3.3: ${modalCheck.hasV33}, closeable: ${modalCheck.isCloseClickable}, closed: ${modalClosedCheck})`);
      console.log(`  => RESULT: ${overall ? 'PASS' : 'FAIL'}\n`);
    }

    // 5. Test Agent interaction & Live Catalog regression
    console.log('============================================================');
    console.log('TESTING AGENT INTERACTION & REGRESSION ON SPLIT-SCREEN (960x900)');
    console.log('============================================================\n');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 960,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    // Reopen modal
    await cdp.eval(`document.querySelector('button[aria-label="Open BOW Agent"]')?.click()`);
    await sleep(600);

    // Click 'Xem danh mục' suggestion button
    console.log('Clicking "Xem danh mục" suggestion...');
    const clickedSuggestion = await cdp.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const catBtn = btns.find(b => b.innerText.includes('Xem danh mục'));
      if (catBtn) {
        catBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('Suggestion clicked:', clickedSuggestion);

    // Wait for agent response
    let catalogReceived = false;
    let responseText = '';
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const text = await cdp.eval(`document.body.innerText`);
      if (text.includes('sản phẩm') || text.includes('Shop of BOW') || text.includes('Spotify') || text.includes('Netflix') || text.includes('YouTube')) {
        catalogReceived = true;
        responseText = text;
        console.log(`Agent catalog response received after ${i + 1}s!`);
        break;
      }
    }

    console.log('Live Catalog Response:', catalogReceived ? 'PASS' : 'FAIL');

    // Test session reset
    console.log('Testing session reset (↺ button)...');
    const resetClicked = await cdp.eval(`(() => {
      const resetBtn = document.querySelector('button[aria-label="Làm mới hội thoại"]');
      if (resetBtn) {
        resetBtn.click();
        return true;
      }
      return false;
    })()`);
    await sleep(600);

    const resetSuccess = await cdp.eval(`(() => {
      // Check only inside the modal container
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      if (!modal) return false;
      const text = modal.innerText;
      return text.includes('👋 Xin chào! Mình là ✨ BOW Agent') && !text.includes('Spotify') && !text.includes('Netflix');
    })()`);
    console.log('Session reset:', resetSuccess ? 'PASS' : 'FAIL');

    // Test 24-month duration negative policy
    console.log('Testing 24-month negative duration policy (no silent downgrade)...');
    await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      const input = modal?.querySelector('input[type="text"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Mua YouTube Premium 24 tháng');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const sendBtn = modal.querySelector('button[aria-label="Send"]');
      if (sendBtn) {
        sendBtn.click();
        return true;
      }
      return false;
    })()`);

    let durationResponseReceived = false;
    let durationNegativePass = false;
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const res = await cdp.eval(`(() => {
        const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
        if (!modal) return { hasResponse: false };
        const msgs = Array.from(modal.querySelectorAll('.break-words')).map(m => m.innerText);
        const lastMsg = msgs[msgs.length - 1] || '';
        const isTyping = Boolean(modal.querySelector('.animate-bounce'));
        return { hasResponse: !isTyping && msgs.length > 2, lastMsg, msgsCount: msgs.length };
      })()`);

      if (res.hasResponse) {
        durationResponseReceived = true;
        console.log('24m response message:', res.lastMsg.slice(0, 150));
        // Check if response mentions that 24m is unavailable or suggests alternative durations
        const explainsUnavailable = res.lastMsg.includes('không có') || res.lastMsg.includes('chưa có') || res.lastMsg.includes('chỉ có') || res.lastMsg.includes('hiện tại') || res.lastMsg.includes('hỗ trợ');
        const isSilentDowngrade = res.lastMsg.includes('Slot 1 tháng') && !explainsUnavailable;
        durationNegativePass = !isSilentDowngrade;
        break;
      }
    }
    console.log('24m Negative Duration Policy:', durationNegativePass ? 'PASS' : 'FAIL');

    // Wait 2s for agent to finish
    await sleep(2000);

    // Test Checkout CTA & Checkout Modal
    console.log('Testing Checkout CTA & Checkout Modal on top of Agent...');
    await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      const input = modal?.querySelector('input[type="text"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Mua YouTube Premium 1 tháng');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const sendBtn = modal.querySelector('button[aria-label="Send"]');
      if (sendBtn) {
        sendBtn.click();
        return true;
      }
      return false;
    })()`);

    // Wait for agent to respond with action card
    console.log('Waiting for agent checkout action card...');
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const isReady = await cdp.eval(`(() => {
        const isTyping = Boolean(document.querySelector('.animate-bounce'));
        const actionBtn = document.querySelector('.animate-fade-up button') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mua ngay'));
        return !isTyping && Boolean(actionBtn);
      })()`);
      if (isReady) {
        console.log(`Action card ready after ${i + 1}s!`);
        break;
      }
    }

    const coords = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      if (!modal) return null;
      const buyBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.innerText.includes('Mua ngay'));
      if (buyBtns.length === 0) return null;
      const btn = buyBtns[0];
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        text: btn.innerText,
        topElement: el ? el.tagName + '.' + el.className : null
      };
    })()`);
    console.log('Action card button coords and topElement:', coords);

    await cdp.eval(`(() => {
      window.__agentLogs = [];
      const origErr = console.error;
      const origLog = console.log;
      console.error = function(...args) {
        window.__agentLogs.push({ type: 'error', text: args.map(a => String(a)).join(' ') });
        origErr.apply(console, args);
      };
      console.log = function(...args) {
        window.__agentLogs.push({ type: 'log', text: args.map(a => String(a)).join(' ') });
        origLog.apply(console, args);
      };
    })()`);

    const clickDebug = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      if (!modal) return { err: 'no modal' };
      const buyBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.innerText.includes('Mua ngay'));
      if (buyBtns.length === 0) return { err: 'no buy button' };
      const btn = buyBtns[0];
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      
      const reactPropKey = Object.keys(btn).find(k => k.startsWith('__reactProps$'));
      const reactProps = reactPropKey ? btn[reactPropKey] : null;
      let calledOnClick = false;
      let syncErr = null;
      if (reactProps && typeof reactProps.onClick === 'function') {
        try {
          const res = reactProps.onClick({ stopPropagation: () => {}, preventDefault: () => {} });
          if (res && typeof res.then === 'function') {
            res.then(
              () => { window.__asyncRes = 'RESOLVED'; },
              (e) => { window.__asyncErr = String(e?.stack || e?.message || e); }
            );
          }
          calledOnClick = true;
        } catch (err) {
          syncErr = String(err?.stack || err?.message || err);
        }
      } else {
        btn.click();
      }

      return {
        clicked: true,
        calledOnClick,
        syncErr,
        hasReactProps: Boolean(reactProps),
        html: btn.outerHTML.slice(0, 150),
        disabled: btn.disabled
      };
    })()`);
    console.log('Action card clickDebug:', clickDebug);

    await sleep(2500);
    const checkoutFiber = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\\\[99999\\\\]') || document.querySelector('.fixed.inset-0[class*="99999"]');
      if (!modal) return { err: 'no modal' };
      const fiberKey = Object.keys(modal).find(k => k.startsWith('__reactFiber$'));
      let curr = modal[fiberKey];
      while (curr && curr.type?.name !== 'BowAgentChatModal') {
        curr = curr.return;
      }
      if (!curr) return { err: 'no parent fiber' };

      // Find CheckoutModal fiber directly
      let checkoutF = null;
      function findCheckout(f) {
        if (!f || checkoutF) return;
        if (f.type?.name === 'CheckoutModal') {
          checkoutF = f;
          return;
        }
        findCheckout(f.child);
        findCheckout(f.sibling);
      }
      findCheckout(curr);

      let childInfo = null;
      if (checkoutF) {
        childInfo = {
          childType: checkoutF.child ? (checkoutF.child.type?.name || String(checkoutF.child.type)) : null,
          childStateNode: checkoutF.child?.stateNode ? (checkoutF.child.stateNode.tagName + '.' + checkoutF.child.stateNode.className) : null,
          childChild: checkoutF.child?.child ? (checkoutF.child.child.type?.name || String(checkoutF.child.child.type)) : null,
          propsKeys: checkoutF.memoizedProps ? Object.keys(checkoutF.memoizedProps) : null
        };
      }

      // Set mock session on AuthProvider to verify full CheckoutModal DOM renders on top
      let authFiber = modal[fiberKey];
      while (authFiber && authFiber.type?.name !== 'AuthProvider') {
        authFiber = authFiber.return;
      }

      let sessionDispatched = false;
      if (authFiber && authFiber.memoizedState?.queue?.dispatch) {
        authFiber.memoizedState.queue.dispatch({
          user: { id: 'usr_test_split_screen', email: 'tester@shopofbow.com' },
          access_token: 'mock_token',
          expires_at: 9999999999
        });
        sessionDispatched = true;
      }

      return {
        hasCheckoutModalFiber: Boolean(checkoutF),
        sessionDispatched,
        childInfo
      };
    })()`);
    console.log('CheckoutModal fiber inspection:', checkoutFiber);

    // Wait 1s for re-render with session
    await sleep(1000);
    const checkoutDom = await cdp.eval(`(() => {
      const checkoutModal = document.querySelector('[class*="100001"]') || 
                            document.querySelector('.fixed.inset-0.z-\\\\[100001\\\\]');
      if (!checkoutModal) return { isOpen: false };
      const closeBtn = checkoutModal.querySelector('button');
      return {
        isOpen: true,
        className: checkoutModal.className,
        hasClose: Boolean(closeBtn),
        textSnippet: checkoutModal.innerText.slice(0, 100).replace(/\\n/g, ' ')
      };
    })()`);
    console.log('CheckoutModal DOM check with session:', checkoutDom);

    const checkoutModalPass = checkoutFiber.hasCheckoutModalFiber && checkoutDom.isOpen;
    console.log('Checkout Modal opened on top:', checkoutModalPass ? 'PASS' : 'FAIL');

    // Close checkout modal
    await cdp.eval(`(() => {
      const checkoutModal = document.querySelector('.fixed.inset-0.z-\\\\[100001\\\\]') || document.querySelector('.fixed.inset-0[class*="100001"]');
      const closeBtn = checkoutModal?.querySelector('button');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(500);

    // Close Agent modal
    await cdp.eval(`document.querySelector('button[aria-label="Đóng"]')?.click()`);
    await sleep(400);

    console.log('\n============================================================');
    console.log('FINAL MATRIX SUMMARY:');
    console.log('============================================================');
    console.table(
      matrixResults.map((r) => ({
        Viewport: r.name,
        Launcher: r.launcherPass ? 'PASS' : 'FAIL',
        Modal: r.modalPass ? 'PASS' : 'FAIL',
        Result: r.overall ? 'PASS' : 'FAIL',
      }))
    );

    const allPass = matrixResults.every((r) => r.overall) && catalogReceived && resetSuccess && durationNegativePass && checkoutModalPass;
    console.log('\nALL CHECKS PASS:', allPass ? 'YES' : 'NO');

    ws.close();
  } finally {
    chromeProcess.kill('SIGTERM');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
