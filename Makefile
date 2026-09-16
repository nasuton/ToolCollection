GOROOT := $(shell go env GOROOT)
WASM_OUT := web/public/main.wasm

.PHONY: wasm build dev test clean

## Compile the Go logic to WebAssembly and stage the runtime shim.
wasm:
	GOOS=js GOARCH=wasm go build -o $(WASM_OUT) ./cmd/wasm
	cp "$(GOROOT)/lib/wasm/wasm_exec.js" web/public/

## Go tests run on the host: internal/ has no js/wasm build tags.
test:
	go test ./internal/...

dev: wasm
	cd web && npm install && npm run dev

build: wasm
	cd web && npm ci && npm run build

clean:
	rm -f $(WASM_OUT) web/public/wasm_exec.js
	rm -rf web/dist
