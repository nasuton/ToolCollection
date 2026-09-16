import { useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { CopyButton } from '../components/CopyButton';

export function HashTool() {
  const { status, tools } = useWasm();
  const [text, setText] = useState('');
  const [algorithm, setAlgorithm] = useState('sha256');
  const [cost, setCost] = useState(10);
  const [encoded, setEncoded] = useState('');
  const [output, setOutput] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const disabled = status !== 'ready';

  function clear() { setOutput(''); setMessage(''); setError(''); }
  function calculate() {
    if (!tools) return;
    clear();
    const res = algorithm === 'sha256' ? tools.sha256(text) : tools.bcrypt(text, cost);
    if (res.ok) setOutput(res.data);
    else setError(res.error);
  }
  function compare() {
    if (!tools) return;
    clear();
    const res = tools.compareBcrypt(text, encoded);
    if (res.ok) setMessage(res.data ? 'パスワードが一致しました。' : 'パスワードが一致しません。');
    else setError(res.error);
  }

  return (
    <div className="tool">
      <p className="lead">SHA-256 のハッシュ計算と、bcrypt の生成・照合を行います。入力は UTF-8 として処理します。</p>
      <div className="field">
        <label htmlFor="hash-algorithm">アルゴリズム</label>
        <select id="hash-algorithm" value={algorithm} disabled={disabled} onChange={(e) => { setAlgorithm(e.target.value); clear(); }}>
          <option value="sha256">SHA-256</option><option value="bcrypt">bcrypt</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="hash-text">{algorithm === 'bcrypt' ? 'パスワード' : '入力テキスト'}</label>
        <textarea id="hash-text" className="mono" rows={4} value={text} disabled={disabled} spellCheck={false} onChange={(e) => { setText(e.target.value); clear(); }} />
        {algorithm === 'bcrypt' && <p className="hint">上限は UTF-8 で 72 バイトです。ランダムなソルトにより、同じ入力でも生成結果は変わります。</p>}
      </div>
      {algorithm === 'bcrypt' && <div className="field">
        <label htmlFor="hash-cost">コスト（大きいほど計算に時間がかかります）</label>
        <select id="hash-cost" value={cost} disabled={disabled} onChange={(e) => { setCost(Number(e.target.value)); clear(); }}>
          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>}
      <div className="actions">
        <button className="btn" type="button" disabled={disabled} onClick={calculate}>ハッシュを計算</button>
        <CopyButton value={output} label="ハッシュをコピー" />
      </div>
      {algorithm === 'bcrypt' && <>
        <div className="field">
          <label htmlFor="hash-encoded">照合する bcrypt ハッシュ</label>
          <textarea id="hash-encoded" className="mono" rows={2} value={encoded} disabled={disabled} spellCheck={false} onChange={(e) => { setEncoded(e.target.value); setMessage(''); setError(''); }} />
        </div>
        <div className="actions"><button className="btn secondary" type="button" disabled={disabled || !encoded} onClick={compare}>パスワードを照合</button></div>
      </>}
      <div className="output" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {output && <output className="mono result">{output}</output>}
      </div>
    </div>
  );
}
