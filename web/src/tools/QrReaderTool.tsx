import { useEffect, useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { CopyButton } from '../components/CopyButton';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// A decoded payload is untrusted text. Only offer explicit HTTP(S) navigation.
function webURL(text: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function QrReaderTool() {
  const { status, tools } = useWasm();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [decoded, setDecoded] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(selected: File | null) {
    setDecoded(null);
    setError('');
    if (selected && (selected.size === 0 || selected.size > MAX_IMAGE_BYTES)) {
      setFile(null);
      setError('画像は空でない 10 MiB 以下のファイルを選択してください。');
      return;
    }
    setFile(selected);
  }

  async function read() {
    if (!tools || !file || reading) return;
    setReading(true);
    setDecoded(null);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Allow the browser to paint the reading status before running Go.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const result = tools.readQR(bytes);
      if (result.ok) setDecoded(result.data);
      else setError(result.error);
    } catch {
      setError('画像を読み込めませんでした。ファイルを選び直してください。');
    } finally {
      setReading(false);
    }
  }

  const disabled = status !== 'ready' || reading;
  const url = decoded === null ? null : webURL(decoded);

  return (
    <section className="tool-section" aria-labelledby="qr-reader-heading">
      <h2 id="qr-reader-heading">画像から QR コードを読み取る</h2>
      <p className="lead">画像内の QR コードから URL やテキストを取り出します。画像はサーバーへ送信されません。</p>
      <div className="field">
        <label htmlFor="qr-file">QR コードの画像</label>
        <input id="qr-file" type="file" accept="image/png,image/jpeg,image/gif,.png,.jpg,.jpeg,.gif" disabled={disabled} aria-describedby="qr-file-hint" onChange={(e) => selectFile(e.target.files?.[0] ?? null)} />
        <p className="hint" id="qr-file-hint">PNG・JPEG・GIF、10 MiB・1600 万画素まで。GIF は先頭フレーム、画像内の QR コードは 1 個を読み取ります。</p>
      </div>
      {preview && <img className="qr-image qr-upload-preview" src={preview} alt="読み取り対象の画像" />}
      <div className="actions">
        <button className="btn" type="button" disabled={disabled || !file} onClick={() => void read()}>{reading ? '読み取り中…' : '画像を読み取る'}</button>
        <CopyButton value={decoded ?? ''} label="読み取り結果をコピー" />
      </div>
      <div className="output" aria-live="polite" aria-busy={reading}>
        {error && <p className="error" role="alert">{error}</p>}
        {decoded !== null && <>
          <h3>読み取り結果</h3>
          <pre className="mono result">{decoded || '（空のテキスト）'}</pre>
          {url && <a className="btn secondary" href={url} target="_blank" rel="noopener noreferrer">URL を新しいタブで開く</a>}
        </>}
      </div>
    </section>
  );
}
