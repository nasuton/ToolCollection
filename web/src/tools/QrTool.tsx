import { useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { QrReaderTool } from './QrReaderTool';

const SIZES = [128, 256, 512, 1024];

export function QrTool() {
  const { status, tools } = useWasm();
  const [text, setText] = useState('https://nasuton.github.io/');
  const [size, setSize] = useState(256);
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  function generate() {
    if (!tools) return;
    const res = tools.makeQR(text, size);
    if (res.ok) {
      setDataUrl(res.data);
      setError('');
    } else {
      setDataUrl('');
      setError(res.error);
    }
  }

  const disabled = status !== 'ready';

  return (
    <div className="tool">
      <h2>QR コードを生成する</h2>
      <p className="lead">
        URL やテキストを QR コードに変換します。生成した PNG はそのまま保存できます。
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
      >
        <div className="field">
          <label htmlFor="qr-text">変換する内容</label>
          <textarea
            id="qr-text"
            rows={3}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://example.com"
          />
          <p className="hint">
            Wi-Fi 設定なら <code>WIFI:S:SSID;T:WPA;P:パスワード;;</code> の形式も使えます。
          </p>
        </div>

        <div className="field">
          <label htmlFor="qr-size">サイズ</label>
          <select
            id="qr-size"
            value={size}
            disabled={disabled}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} × {s} px
              </option>
            ))}
          </select>
        </div>

        <div className="actions">
          <button type="submit" className="btn" disabled={disabled}>
            生成する
          </button>
          {dataUrl && (
            <a className="btn secondary" href={dataUrl} download="qrcode.png">
              PNG をダウンロード
            </a>
          )}
        </div>
      </form>

      <div className="output" aria-live="polite">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          dataUrl && (
            <img
              className="qr-image"
              src={dataUrl}
              width={size}
              height={size}
              alt={`「${text}」を表す QR コード`}
            />
          )
        )}
      </div>
      <QrReaderTool />
    </div>
  );
}
