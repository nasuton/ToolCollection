import { useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { CopyButton } from '../components/CopyButton';

export function UuidTool() {
  const { status, tools } = useWasm();
  const [count, setCount] = useState(1);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  function generate() {
    if (!tools) return;
    const res = tools.generateUUID(count);
    setOutput(res.ok ? res.data.join('\n') : '');
    setError(res.ok ? '' : res.error);
  }

  return (
    <section className="tool-section" aria-labelledby="uuid-heading">
      <h2 id="uuid-heading">UUID v4 生成</h2>
      <p className="lead"><code>crypto/rand</code> を使い、一度に 1〜100 個生成します。</p>
      <form onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <div className="field">
          <label htmlFor="uuid-count">生成数</label>
          <input id="uuid-count" type="number" min={1} max={100} step={1} required value={count} disabled={status !== 'ready'} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <div className="actions">
          <button className="btn" type="submit" disabled={status !== 'ready'}>UUID を生成</button>
          <CopyButton value={output} label="UUID をコピー" />
        </div>
      </form>
      <div className="output" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {output && <pre className="mono result">{output}</pre>}
      </div>
    </section>
  );
}
