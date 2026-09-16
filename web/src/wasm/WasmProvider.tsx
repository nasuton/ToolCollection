import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadGoTools } from './loader';
import type { GoTools } from './types';

type WasmState =
  | { status: 'loading'; tools: null; error: null }
  | { status: 'ready'; tools: GoTools; error: null }
  | { status: 'error'; tools: null; error: string };

const WasmContext = createContext<WasmState | null>(null);

export function WasmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WasmState>({
    status: 'loading',
    tools: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    loadGoTools()
      .then((tools) => {
        if (alive) setState({ status: 'ready', tools, error: null });
      })
      .catch((e: unknown) => {
        if (alive) {
          setState({
            status: 'error',
            tools: null,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return <WasmContext value={state}>{children}</WasmContext>;
}

export function useWasm(): WasmState {
  const ctx = useContext(WasmContext);
  if (!ctx) throw new Error('useWasm must be used inside <WasmProvider>');
  return ctx;
}
