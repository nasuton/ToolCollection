import { useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { CopyButton } from '../components/CopyButton';

export function ConvertTool() {
  const { status, tools } = useWasm();
  const [direction, setDirection] = useState('json-yaml');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const toYAML = direction === 'json-yaml';
  const disabled = status !== 'ready';

  function convert() {
    if (!tools) return;
    const res = toYAML ? tools.jsonToYAML(input) : tools.yamlToJSON(input);
    setOutput(res.ok ? res.data : '');
    setError(res.ok ? '' : res.error);
  }

  return (
    <div className="tool">
      <p className="lead">JSON と YAML を相互変換します。入力上限は 1 MiB、1 文書です。</p>
      <div className="field">
        <label htmlFor="convert-direction">変換方向</label>
        <select id="convert-direction" value={direction} disabled={disabled} onChange={(e) => { setDirection(e.target.value); setOutput(''); setError(''); }}>
          <option value="json-yaml">JSON → YAML</option><option value="yaml-json">YAML → JSON</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="convert-input">入力 {toYAML ? 'JSON' : 'YAML'}</label>
        <textarea id="convert-input" className="mono" rows={10} value={input} disabled={disabled} spellCheck={false} onChange={(e) => { setInput(e.target.value); setOutput(''); setError(''); }} />
        <p className="hint">YAML のコメントは JSON に引き継がれません。JSON のキーにできない値や非有限数はエラーになります。</p>
      </div>
      <div className="actions">
        <button className="btn" type="button" disabled={disabled || !input.trim()} onClick={convert}>変換する</button>
        <CopyButton value={output} label="結果をコピー" />
        <button className="btn secondary" type="button" disabled={disabled || !output} onClick={() => { setInput(output); setDirection(toYAML ? 'yaml-json' : 'json-yaml'); setOutput(''); setError(''); }}>結果を入力にして逆変換</button>
      </div>
      <div className="output" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {output && <><h2>出力 {toYAML ? 'YAML' : 'JSON'}</h2><pre className="mono result">{output}</pre></>}
      </div>
    </div>
  );
}
