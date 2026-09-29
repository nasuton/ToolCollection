# 本プロジェクトで作成するツール
- パスワード / UUID 生成（`crypto/rand`）
- ハッシュ計算 SHA-256・bcrypt（`crypto/*`）
- JWT のデコードと署名検証
- JSON ⇄ YAML 相互変換
- 正規表現テスター（Go の RE2 は JS 正規表現と挙動が違うので、比較できると面白い）
- 画像から QR を読み取るデコーダ & QR コード生成
# 開発環境
- Go 1.26.3（`go.mod` に準拠）
- wasm
- React

## 実装済みツール

Web のタブは次の順です。各処理は `internal` のパッケージに実装し、`cmd/wasm` から React に公開しています。

1. パスワード / UUID 生成: `internal/password`・`internal/uuid`。`crypto/rand` を使用し、UUID v4 を最大 100 個生成できます。
2. ハッシュ計算 SHA-256・bcrypt: `internal/hash`。SHA-256 は `crypto/sha256`、bcrypt は `golang.org/x/crypto/bcrypt` を使用。bcrypt は生成・照合に対応し、入力 72 バイト、コスト 4〜12 の範囲です。
3. JWT のデコードと署名検証: `internal/jwt`。HS256（UTF-8 シークレット）、RS256（RSA 2048 ビット以上）、ES256（P-256）に対応。公開鍵は PEM 形式の公開鍵または証明書です。署名検証は `exp`・`nbf`・`iss`・`aud` の判定を含みません。未署名の JWT は検証成功になりません。
4. JSON ⇄ YAML 相互変換: `internal/convert`。入力は 1 MiB・1 文書まで。YAML のコメントは引き継がず、文字列以外のキー・非有限数・重複キーは JSON への変換時に拒否します。
5. 正規表現テスター: `internal/regex`。Go の RE2 による一致箇所・名前付きキャプチャ・`i`/`m`/`s` フラグに対応。位置は 0 始まりの UTF-8 バイト単位（終了位置は含まない）。先頭 1000 件まで表示します。JavaScript エンジンとの比較機能は含みません。
6. QR コード生成・画像読み取り: `internal/qr`。画像を選択して QR コードの URL やテキストを読み取り、コピーできます。HTTP(S) URL は明示的にクリックして開けます。読み取りには `github.com/makiuchi-d/gozxing` を使用し、画像はブラウザ内で処理します。PNG・JPEG・GIF、10 MiB・1600 万画素まで対応。GIF は先頭フレーム、画像内の QR コードは 1 個を読み取ります。

検証コマンド:

```powershell
go vet ./...
go test ./...
$env:GOOS='js'; $env:GOARCH='wasm'; go vet ./cmd/...; Remove-Item Env:GOOS, Env:GOARCH
.\build.ps1 wasm
node verify.mjs (go env GOROOT) web/public/main.wasm
cd web
npm run build
npm run lint
```

# 実行方法
Go のロジックを WebAssembly にビルドし、Go ツールチェーンに含まれる `wasm_exec.js` を `web/public/` に配置してから、Vite でフロントエンドをビルド・起動します。
`wasm_exec.js` / `main.wasm` はリポジトリに含まれない生成物のため、`npm run build` や `vite preview` を直接実行すると
`Failed to load /go-wasm-tools/wasm_exec.js` エラーになります。必ず以下のいずれかの手順で Go 側のビルドを先に行ってください。

## 前提
- Go と Node.js (npm) が PATH に入っていること

## Windows (PowerShell)
プロジェクトルートの `build.ps1` を使用します。

```powershell
.\build.ps1 wasm     # main.wasm と wasm_exec.js を web/public/ に生成（デフォルト）
.\build.ps1 dev      # wasm + npm install + npm run dev（開発サーバー起動）
.\build.ps1 build    # wasm + npm ci + npm run build
.\build.ps1 preview  # build + npm run preview
.\build.ps1 test     # go vet ./... + go test ./... + GOOS=js GOARCH=wasm go vet ./cmd/...
.\build.ps1 clean    # 生成物（main.wasm, wasm_exec.js, web/dist）を削除
```

実行ポリシーでブロックされる場合は次のように実行してください。

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1 preview
```

## macOS / Linux / Git Bash (make)
```bash
make wasm    # main.wasm と wasm_exec.js を web/public/ に生成
make dev     # wasm + npm install + npm run dev
make build   # wasm + npm ci + npm run build
make test    # go vet ./... + go test ./... + GOOS=js GOARCH=wasm go vet ./cmd/...
make clean   # 生成物を削除
```

ビルド後にプレビューする場合:

```bash
cd web && npm run preview
```

## アクセス URL
`vite.config.ts` で `base: '/go-wasm-tools/'` を設定しているため、サブパス付きの URL で開いてください。

- 開発サーバー: `http://localhost:5173/go-wasm-tools/`
- プレビュー: `http://localhost:4173/go-wasm-tools/`
