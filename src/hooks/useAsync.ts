import { useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Runs an async function on mount / when deps change.
 * `initial` is used as the starting value so components can render skeletons.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  initial?: T,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: initial,
    loading: true,
    error: null,
  });
  // keep fn stable-ish: we intentionally re-run only on deps
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (alive)
          setState({
            data: initial,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
