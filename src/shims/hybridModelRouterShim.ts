// src/shims/hybridModelRouterShim.ts
// BOW CON V4.0 — PRODUCTION BROWSER-SAFE HYBRID DUAL-BRAIN ROUTER
//
// Complies with strict Content Security Policy (CSP):
// - In any browser environment: NEVER makes direct browser calls to http://localhost:11434
// - Communicates with server-side Hybrid Brain boundary via same-origin /api/brain-status
// - Fully preserves Dual-Brain routing, Cloud Gemini, Local Ollama, and Deterministic Fallback

export type BrainMode = 'auto' | 'cloud_preferred' | 'local_preferred' | 'local_only' | 'deterministic_only';

export interface BrainProviderStatus {
  cloudGeminiOnline: boolean;
  localOllamaOnline: boolean;
  activeMode: BrainMode;
  lastRoutingDecision: 'cloud_gemini' | 'local_ollama' | 'deterministic_engine';
  totalCloudCalls: number;
  totalLocalCalls: number;
  totalFallbackEvents: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

export class HybridModelRouter {
  private mode: BrainMode = 'auto';
  private localEndpoint: string = 'http://localhost:11434';
  private localModel: string = 'qwen2.5:14b';
  private stats: BrainProviderStatus = {
    cloudGeminiOnline: true,
    localOllamaOnline: false,
    activeMode: 'auto',
    lastRoutingDecision: 'cloud_gemini',
    totalCloudCalls: 0,
    totalLocalCalls: 0,
    totalFallbackEvents: 0,
  };

  constructor() {
    // In browser, NEVER probe localhost directly at startup (avoids CSP violation and never probes end-user machine)
    if (!isBrowser()) {
      this.checkLocalOllamaHealth().catch(() => {});
    }
  }

  public setMode(newMode: BrainMode): void {
    this.mode = newMode;
    this.stats.activeMode = newMode;
    console.log(`[HybridModelRouter] Switched brain mode to: ${newMode}`);
  }

  public getStatus(): BrainProviderStatus {
    return { ...this.stats };
  }

  /**
   * Health check for Local Ollama / Private Open-Weights Brain:
   * - In browser: Always probes via secure same-origin serverless boundary (/api/brain-status)
   * - In Node/server: Probes local endpoint
   */
  public async checkLocalOllamaHealth(): Promise<boolean> {
    if (isBrowser()) {
      // Browser: Use server-side boundary (Zero CSP violation, Zero direct localhost calls)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/brain-status', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          this.stats.localOllamaOnline = Boolean(data?.status?.localOllamaOnline);
          this.stats.cloudGeminiOnline = Boolean(data?.status?.cloudGeminiOnline ?? true);
          return this.stats.localOllamaOnline;
        }
      } catch {
        this.stats.localOllamaOnline = false;
        return false;
      }
      this.stats.localOllamaOnline = false;
      return false;
    }

    // Node.js server runtime
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${this.localEndpoint}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      this.stats.localOllamaOnline = res.ok;
      return res.ok;
    } catch {
      this.stats.localOllamaOnline = false;
      return false;
    }
  }

  /**
   * Intelligent Dual-Brain Router: Cloud Gemini -> Local Ollama -> Deterministic Engine
   */
  public async routeMessage(
    userText: string,
    context: any,
    cloudCaller: (text: string, ctx: any) => Promise<any>,
    deterministicCaller: (text: string, ctx: any) => Promise<any>
  ): Promise<any> {
    if (this.mode === 'deterministic_only') {
      this.stats.lastRoutingDecision = 'deterministic_engine';
      return deterministicCaller(userText, context);
    }

    if (this.mode === 'local_only') {
      return this.executeLocalOrDeterministic(userText, context, deterministicCaller);
    }

    // Auto or Cloud Preferred
    try {
      this.stats.totalCloudCalls++;
      this.stats.lastRoutingDecision = 'cloud_gemini';
      const response = await cloudCaller(userText, context);
      this.stats.cloudGeminiOnline = true;
      return response;
    } catch (err: any) {
      console.warn(`[HybridModelRouter] Cloud Gemini call failed or overloaded (${err?.message}). Initiating instant Auto-Fallback...`);
      this.stats.cloudGeminiOnline = false;
      this.stats.totalFallbackEvents++;
      return this.executeLocalOrDeterministic(userText, context, deterministicCaller);
    }
  }

  private async executeLocalOrDeterministic(
    userText: string,
    context: any,
    deterministicCaller: (text: string, ctx: any) => Promise<any>
  ): Promise<any> {
    const hasLocal = await this.checkLocalOllamaHealth();
    if (hasLocal) {
      try {
        this.stats.totalLocalCalls++;
        this.stats.lastRoutingDecision = 'local_ollama';
        return await this.callLocalOllama(userText, context);
      } catch (err) {
        console.warn('[HybridModelRouter] Local Ollama call failed, falling back to Deterministic Engine V2:', err);
      }
    }

    // Final Zero-Failure Line of Defense: Deterministic Engine V2
    this.stats.lastRoutingDecision = 'deterministic_engine';
    return deterministicCaller(userText, context);
  }

  private async callLocalOllama(userText: string, _context: any): Promise<any> {
    // In browser, forward to server-side boundary
    if (isBrowser()) {
      const res = await fetch('/api/brain-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', userText }),
      });
      if (!res.ok) throw new Error(`Server Ollama proxy status: ${res.status}`);
      const data = await res.json();
      return {
        id: 'local_msg_' + Date.now(),
        sender: 'agent',
        content: data.response || 'Báo cáo Sếp, tôi đã nhận được thông điệp từ Sếp qua Bộ Não Cục Bộ (Local Brain)!',
        timestamp: new Date().toISOString(),
        data: { source: 'local_ollama', model: this.localModel },
        suggestions: ['📰 Đọc bản tin sáng', '⏳ Đơn nào đang chờ bàn giao?', '📈 Báo cáo doanh thu hôm nay'],
      };
    }

    // Direct call in node server
    const prompt = `Bạn là BOWCON, trợ lý cá nhân và AI Co-Founder đồng hành trung thành của Ngài. Hãy xưng là "Tôi" và gọi người dùng là "Ngài". Trả lời súc tích, chuyên nghiệp và lịch thiệp:\n\nNgài: ${userText}\nBOWCON:`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${this.localEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.localModel,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`);
    }

    const data: any = await res.json();
    return {
      id: 'local_msg_' + Date.now(),
      sender: 'agent',
      content: data.response || 'Báo cáo Sếp, tôi đã nhận được thông điệp từ Sếp qua Bộ Não Cục Bộ (Local Brain)!',
      timestamp: new Date().toISOString(),
      data: {
        source: 'local_ollama',
        model: this.localModel,
      },
      suggestions: ['📰 Đọc bản tin sáng', '⏳ Đơn nào đang chờ bàn giao?', '📈 Báo cáo doanh thu hôm nay'],
    };
  }
}

export const globalHybridRouter = new HybridModelRouter();
