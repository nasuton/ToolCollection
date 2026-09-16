import { useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { CopyButton } from '../components/CopyButton';

export function JwtTool() {
  const { status, tools } = useWasm();
  const [token, setToken] = useState('');
  const [algorithm, setAlgorithm] = useState('HS256');
  const [key, setKey] = useState('');
  const [decoded, setDecoded] = useState<{ header: string; payload: string } | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const disabled = status !== 'ready';

  function run(verify: boolean) {
    if (!tools) return;
    setVerified(false);
    setError('');
    const res = tools.decodeJWT(token);
    setDecoded(res.ok ? res.data : null);
    if (!res.ok) { setError(res.error); return; }
    if (verify) {
      const signature = tools.verifyJWT(token, key, algorithm);
      if (signature.ok) setVerified(true);
      else setError(signature.error);
    }
  }

  return (
    <div className="tool">
      <p className="lead">ヘッダーとペイロードをデコードし、選択したアルゴリズムで署名を検証します。</p>
      <div className="field">
        <label htmlFor="jwt-token">JWT</label>
        <textarea id="jwt-token" className="mono" rows={5} value={token} disabled={disabled} spellCheck={false} onChange={(e) => { setToken(e.target.value); setDecoded(null); setVerified(false); setError(''); }} placeholder="eyJ… . eyJ… . …" />
      </div>
      <div className="field">
        <label htmlFor="jwt-algorithm">検証に使用するアルゴリズム</label>
        <select id="jwt-algorithm" value={algorithm} disabled={disabled} onChange={(e) => { setAlgorithm(e.target.value); setKey(''); setVerified(false); setError(''); }}>
          <option>HS256</option><option>RS256</option><option>ES256</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="jwt-key">{algorithm === 'HS256' ? '共有シークレット（UTF-8 テキスト）' : '公開鍵 / 証明書（PEM）'}</label>
        <textarea id="jwt-key" className="mono" rows={algorithm === 'HS256' ? 2 : 5} value={key} disabled={disabled} spellCheck={false} onChange={(e) => { setKey(e.target.value); setVerified(false); setError(''); }} />
        <p className="hint">RS256 は RSA 2048 ビット以上、ES256 は P-256 に対応します。</p>
      </div>
      <div className="actions">
        <button className="btn secondary" type="button" disabled={disabled || !token.trim()} onClick={() => run(false)}>デコード</button>
        <button className="btn" type="button" disabled={disabled || !token.trim() || !key} onClick={() => run(true)}>署名を検証</button>
      </div>
      <p className="hint">署名のみを検証します。有効期限（exp）、利用開始日時（nbf）、発行者（iss）、対象（aud）の判定は行いません。</p>
      <div className="output" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {decoded && <>
          <p role="status">{verified ? '署名検証に成功しました。' : '署名は未検証です（検証成功を確認していません）。'}</p>
          <h2>ヘッダー</h2><pre className="mono result">{decoded.header}</pre>
          <CopyButton value={decoded.header} label="ヘッダーをコピー" />
          <h2>ペイロード</h2><pre className="mono result">{decoded.payload}</pre>
          <CopyButton value={decoded.payload} label="ペイロードをコピー" />
        </>}
      </div>
    </div>
  );
}
