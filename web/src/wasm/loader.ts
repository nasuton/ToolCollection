import type { GoTools } from './types';

let pending: Promise<GoTools> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.dataset.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

/**
 * Loads and starts the Go WASM module exactly once.
 * Concurrent callers share the same promise, so switching tools never re-downloads.
 */
export function loadGoTools(): Promise<GoTools> {
  pending ??= (async () => {
    const base = import.meta.env.BASE_URL;
    await loadScript(`${base}wasm_exec.js`);

    const go = new window.Go();
    const wasmUrl = `${base}main.wasm`;

    let instance: WebAssembly.Instance;
    try {
      ({ instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), go.importObject));
    } catch {
      // Fallback for hosts that serve .wasm with the wrong Content-Type.
      const bytes = await (await fetch(wasmUrl)).arrayBuffer();
      ({ instance } = await WebAssembly.instantiate(bytes, go.importObject));
    }

    // Not awaited on purpose: Go's main() blocks on select{} to stay resident.
    void go.run(instance);

    // Yield once so the registration inside main() is applied.
    await new Promise((r) => setTimeout(r, 0));

    if (!window.goTools) {
      throw new Error('WASM loaded but goTools was not registered');
    }
    return window.goTools;
  })();

  return pending;
}
