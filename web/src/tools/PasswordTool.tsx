import { useCallback, useEffect, useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import { CopyButton } from '../components/CopyButton';

// Pool sizes mirror the character sets in internal/password/password.go.
const POOL = { lower: 25, upper: 24, digits: 8, symbols: 13 };

function entropyBits(length: number, upper: boolean, digits: boolean, symbols: boolean) {
  let size = POOL.lower;
  if (upper) size += POOL.upper;
  if (digits) size += POOL.digits;
  if (symbols) size += POOL.symbols;
  return Math.floor(length * Math.log2(size));
}

function strengthOf(bits: number) {
  if (bits < 50) return { label: '弱い', level: 1 };
  if (bits < 80) return { label: '普通', level: 2 };
  if (bits < 120) return { label: '強い', level: 3 };
  return { label: '非常に強い', level: 4 };
}

export function PasswordTool() {
  const { status, tools } = useWasm();
  const [length, setLength] = useState(20);
  const [useUpper, setUseUpper] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const generate = useCallback(() => {
    if (!tools) return;
    const res = tools.generatePassword({ length, useUpper, useDigits, useSymbols });
    if (res.ok) {
      setPassword(res.data);
      setError('');
    } else {
      setPassword('');
      setError(res.error);
    }
  }, [tools, length, useUpper, useDigits, useSymbols]);

  useEffect(() => {
    if (status === 'ready') generate();
  }, [status, generate]);

  const bits = entropyBits(length, useUpper, useDigits, useSymbols);
  const strength = strengthOf(bits);
  const disabled = status !== 'ready';

  return (
    <div className="tool">
      <p className="lead">
        <code>crypto/rand</code> による暗号論的乱数で生成します。通信は一切発生せず、すべてブラウザ内で完結します。
      </p>

      <div className="field">
        <label htmlFor="pw-length">
          長さ: <strong>{length}</strong> 文字
        </label>
        <input
          id="pw-length"
          type="range"
          min={4}
          max={128}
          value={length}
          disabled={disabled}
          onChange={(e) => setLength(Number(e.target.value))}
        />
      </div>

      <fieldset className="field">
        <legend>使用する文字種</legend>
        <label className="check">
          <input type="checkbox" checked={useUpper} disabled={disabled} onChange={(e) => setUseUpper(e.target.checked)} />
          大文字 (A-Z)
        </label>
        <label className="check">
          <input type="checkbox" checked={useDigits} disabled={disabled} onChange={(e) => setUseDigits(e.target.checked)} />
          数字 (2-9)
        </label>
        <label className="check">
          <input type="checkbox" checked={useSymbols} disabled={disabled} onChange={(e) => setUseSymbols(e.target.checked)} />
          記号 (!@#$...)
        </label>
        <p className="hint">
          誤読しやすい文字 (l, 1, I, 0, O) は除外されます。
        </p>
      </fieldset>

      <div className="actions">
        <button type="button" className="btn" onClick={generate} disabled={disabled}>
          生成する
        </button>
        <CopyButton value={password} label="コピー" />
      </div>

      <div className="output" aria-live="polite">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          password && (
            <>
              <output className="mono result">{password}</output>
              <p className="meta">
                強度: <strong>{strength.label}</strong>（約 {bits} ビット）
              </p>
              <div
                className="meter"
                role="meter"
                aria-valuenow={strength.level}
                aria-valuemin={1}
                aria-valuemax={4}
                aria-label={`パスワード強度: ${strength.label}`}
              >
                <span className={`meter-bar level-${strength.level}`} />
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
