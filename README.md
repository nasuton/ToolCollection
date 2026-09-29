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

# WebAssembly のサイズについて

`main.wasm` は 1 ファイルに全ツールを含めています。ビルドには `-trimpath -ldflags="-s -w"` を付けています（`Makefile` / `build.ps1`）。

## 計測結果（Go 1.26.3、`GOOS=js GOARCH=wasm`、gzip は最高圧縮）

| ビルド | raw | gzip |
|---|---:|---:|
| `-s -w` なし（以前の設定） | 9,178,362 B (9.18 MB) | 2,705,659 B (2.71 MB) |
| `-trimpath -ldflags="-s -w"`（現在の設定） | 8,984,752 B (8.98 MB) | 2,661,210 B (2.66 MB) |
| 上記から QR 読み取り（`internal/qr/decode.go` と `readQR`）を完全に除外 | 7,558,504 B (7.56 MB) | 2,110,541 B (2.11 MB) |
| 参考: `syscall/js` + `encoding/json` だけの最小 wasm | 3,102,767 B (3.10 MB) | — |

QR 読み取り（gozxing + `image/jpeg`・`image/gif` + `golang.org/x/text/encoding` の文字コード表）を別 wasm に分割して遅延ロードしても、削減は **raw 17.6% / gzip 22.0%** にとどまるため、ランタイムを 2 つ持つ複雑さに見合わないと判断して分割は見送りました。再計測する場合は `readQR` の登録を外すだけでなく `decode.go` をパッケージから外す必要があります（同一パッケージに残すと `image/*` の `init` 登録経由でリンクされ、差が正しく出ません）。

## パッケージ別の概算

wasm バイナリは `go tool nm` に対応していないため、同じ `internal/*` を呼ぶネイティブビルド（windows/amd64）を `go tool nm -size` で集計した概算です（BSS と rodata の別名を除外。`runtime` には pclntab 約 1.4 MB を含む）。wasm の絶対値とは一致しませんが比率の目安になります。

| 領域 | 概算 | 割合 | 備考 |
|---|---:|---:|---|
| runtime + internal/*（GC・スケジューラ・pclntab） | 2,493 KB | 43% | 削れない固定費 |
| その他データ（型情報・文字列など） | 849 KB | 15% | |
| `golang.org/x/text/encoding`（日中韓の文字コード表） | 691 KB | 12% | gozxing が QR の文字コード判定用に取り込む |
| `crypto/x509` + `rsa` + `ecdsa` + `asn1` | 531 KB | 9% | JWT の RS256 / ES256 に必要 |
| 標準ライブラリその他（`fmt`, `strconv`, `unicode`, `compress/zlib` …） | 366 KB | 6% | |
| `gopkg.in/yaml.v3` | 198 KB | 3% | JSON ⇄ YAML |
| `github.com/makiuchi-d/gozxing` | 135 KB | 2% | QR 読み取り本体 |
| `regexp` | 95 KB | 2% | |
| `image/*`（png / jpeg / gif） | 94 KB | 2% | |
| `encoding/json` / `reflect` | 153 KB | 3% | |
| `github.com/skip2/go-qrcode` / bcrypt / このリポジトリ | 68 KB | 1% | |

## 今後の選択肢（未実装）

- gozxing が引き込む `golang.org/x/text/encoding`（約 0.7 MB）は QR 内の Shift_JIS 等の判定用で、gozxing 側の実装に依存するため fork なしでは外せない。
- `crypto/x509` 系（約 0.5 MB）は JWT の RS256 / ES256 の PEM 公開鍵解析に使っており、HS256 のみに絞らない限り外せない。
- ランタイム約 3 MB は Go の wasm 固定費で、TinyGo への移行以外に大きく削る手段がない（`syscall/js` 互換や `reflect` 依存の `encoding/json`・yaml の挙動差を確認する必要がある）。
