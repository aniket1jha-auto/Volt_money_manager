import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Tiny async wrapper for the mock API. Tracks loading, error, and a
 * cancelled flag so unmounted re-renders don't clobber state. `refetch`
 * re-runs the loader on demand (used to back the ErrorState retry button).
 *
 * The loader's reference must be stable across renders for the dependency
 * array to work — wrap it in useCallback at the call site.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown> = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const tickRef = useRef(0);

  const run = useCallback(() => {
    const myTick = ++tickRef.current;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    loader()
      .then((data) => {
        if (myTick !== tickRef.current) return;
        setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (myTick !== tickRef.current) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      // bump tick so any in-flight loader's resolution is ignored
      tickRef.current++;
    };
  }, [run]);

  return { ...state, refetch: run };
}
