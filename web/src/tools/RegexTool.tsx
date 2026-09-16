import { useState } from 'react';
import { useWasm } from '../wasm/WasmProvider';
import type { RegexResult } from '../wasm/types';

export function RegexTool() {
  const { status, tools } = useWasm();
  const [pattern, setPattern] = useState('(?P<word>[A-Za-z]+)');
  const [text, setText] = useState('Hello, Go!');
  const [flags, setFlags] = useState('');
  const [result, setResult] = useState<RegexResult | null>(null);
  const [error, setError] = useState('');
  const disabled = status !== 'ready';
  function clear() { setResult(null); setError(''); }
  function test() {
    if (!tools) return;
    const res = tools.testRegex({ pattern, text, flags });
    setResult(res.ok ? res.data : null);
    setError(res.ok ? '' : res.error);
  }

  return (
    <div className="tool">
      <p className="lead">Go の正規表現エンジン（RE2）で一致箇所とキャプチャを確認します。先読み・後読み・後方参照は非対応です。</p>
      <div className="field">
        <label htmlFor="regex-pattern">正規表現（区切りの / は不要）</label>
        <textarea id="regex-pattern" className="mono" rows={2} value={pattern} disabled={disabled} spellCheck={false} onChange={(e) => { setPattern(e.target.value); clear(); }} />
      </div>
      <fieldset className="field">
        <legend>フラグ</legend>
        {[['i', '大文字・小文字を区別しない'], ['m', '^ と $ を各行に適用'], ['s', '. を改行にも一致させる']].map(([flag, label]) => (
          <label className="check" key={flag}><input type="checkbox" checked={flags.includes(flag)} disabled={disabled} onChange={(e) => { setFlags(e.target.checked ? flags + flag : flags.replace(flag, '')); clear(); }} />{flag}: {label}</label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="regex-text">テストするテキスト</label>
        <textarea id="regex-text" className="mono" rows={8} value={text} disabled={disabled} spellCheck={false} onChange={(e) => { setText(e.target.value); clear(); }} />
        <p className="hint">テキストは 1 MiB、正規表現は 16 KiB まで。位置は 0 始まりの UTF-8 バイト単位で、終了位置を含みません。</p>
      </div>
      <div className="actions"><button className="btn" type="button" disabled={disabled} onClick={test}>テストする</button></div>
      <div className="output" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {result && <>
          <p role="status">{result.matches.length} 件の一致{result.truncated ? '（先頭 1000 件のみ表示）' : ''}</p>
          {result.matches.map((match, i) => <div className="match-result" key={i}>
            <p className="meta">#{i + 1} · 位置 {match.start}〜{match.end}</p>
            <pre className="mono result">{match.text || '（空文字に一致）'}</pre>
            {match.groups.length > 0 && <ul className="capture-list">{match.groups.map((group, n) => <li key={n}>
              グループ {n + 1}{group.name ? ` (${group.name})` : ''}: <code>{group.start < 0 ? '未一致' : JSON.stringify(group.text)}</code>
              {group.start >= 0 && ` · 位置 ${group.start}〜${group.end}`}
            </li>)}</ul>}
          </div>)}
        </>}
      </div>
    </div>
  );
}
