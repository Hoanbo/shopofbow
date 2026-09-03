// src/shims/pathShim.ts
// Browser-safe path shim for client bundles
export function resolve(...args: string[]): string {
  return args.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function join(...args: string[]): string {
  return args.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function dirname(p: string): string {
  return p.split('/').slice(0, -1).join('/') || '.';
}

export function basename(p: string): string {
  return p.split('/').pop() || '';
}

export function extname(p: string): string {
  const base = basename(p);
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx) : '';
}

const pathShim = { resolve, join, dirname, basename, extname };
export default pathShim;
