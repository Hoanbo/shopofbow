// src/shims/fsShim.ts
// Browser-safe fs shim for client bundles
export function existsSync(_p: string): boolean {
  return false;
}

export function readFileSync(_p: string, _encoding?: string): string {
  return '{}';
}

export function mkdirSync(_p: string, _opts?: any): void {}
export function writeFileSync(_p: string, _data: any): void {}
export function readdirSync(_p: string): string[] {
  return [];
}

const fsShim = { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync };
export default fsShim;
