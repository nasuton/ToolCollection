import { useRef, useState, type KeyboardEvent } from 'react';
import { WasmProvider, useWasm } from './wasm/WasmProvider';
import { PasswordTool } from './tools/PasswordTool';
import { UuidTool } from './tools/UuidTool';
import { HashTool } from './tools/HashTool';
import { JwtTool } from './tools/JwtTool';
import { ConvertTool } from './tools/ConvertTool';
import { RegexTool } from './tools/RegexTool';
import { QrTool } from './tools/QrTool';
import './App.css';

// Set this URL after creating the source repository.
const SOURCE_CODE_URL: string = '';

const TABS = [
  { id: 'password', label: 'パスワード / UUID 生成（crypto/rand）' },
  { id: 'hash', label: 'ハッシュ計算 SHA-256・bcrypt（crypto/*）' },
  { id: 'jwt', label: 'JWT のデコードと署名検証' },
  { id: 'convert', label: 'JSON ⇄ YAML 相互変換' },
  { id: 'regex', label: '正規表現テスター' },
  { id: 'qr', label: 'QR コード' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function StatusBanner() {
  const { status, error } = useWasm();

  if (status === 'loading') {
    return (
      <p className="banner loading" role="status">
        <span className="spinner" aria-hidden="true" />
        WebAssembly モジュールを読み込んでいます…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="banner error" role="alert">
        読み込みに失敗しました: {error}
      </p>
    );
  }
  return null;
}

function Tools() {
  const [active, setActive] = useState<TabId>('password');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TABS.findIndex((t) => t.id === active);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;

    e.preventDefault();
    const id = TABS[next].id;
    setActive(id);
    tabRefs.current[id]?.focus();
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="ツールの切り替え" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className={active === t.id ? 'tab active' : 'tab'}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels stay mounted so switching tabs preserves each tool's state. */}
      <div role="tabpanel" id="panel-password" aria-labelledby="tab-password" hidden={active !== 'password'}>
        <PasswordTool />
        <UuidTool />
      </div>
      <div role="tabpanel" id="panel-hash" aria-labelledby="tab-hash" hidden={active !== 'hash'}>
        <HashTool />
      </div>
      <div role="tabpanel" id="panel-jwt" aria-labelledby="tab-jwt" hidden={active !== 'jwt'}>
        <JwtTool />
      </div>
      <div role="tabpanel" id="panel-convert" aria-labelledby="tab-convert" hidden={active !== 'convert'}>
        <ConvertTool />
      </div>
      <div role="tabpanel" id="panel-regex" aria-labelledby="tab-regex" hidden={active !== 'regex'}>
        <RegexTool />
      </div>
      <div role="tabpanel" id="panel-qr" aria-labelledby="tab-qr" hidden={active !== 'qr'}>
        <QrTool />
      </div>
    </>
  );
}

export default function App() {
  return (
    <WasmProvider>
      <header className="site-header">
        <h1>Go × WebAssembly Tools</h1>
        <p className="tagline">
          Go で書いたロジックをブラウザ上で直接実行しています。入力内容がサーバーに送信されることはありません。
        </p>
      </header>

      <main>
        <StatusBanner />
        <Tools />
      </main>

      <footer className="site-footer">
        <a href="https://nasuton.net/blog/" target="_blank" rel="noopener noreferrer">ナストンのまとめ(技術ブログ)</a>
        <span aria-hidden="true">/</span>
        <a href="https://nasuton.github.io/" target="_blank" rel="noopener noreferrer">About Me</a>
        <span aria-hidden="true">/</span>
        {SOURCE_CODE_URL ? (
          <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">ソースコード</a>
        ) : (
          <span className="footer-pending" title="リポジトリ作成後にリンクを設定します">ソースコード</span>
        )}
      </footer>
    </WasmProvider>
  );
}
