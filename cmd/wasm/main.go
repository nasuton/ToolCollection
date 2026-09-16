//go:build js && wasm

package main

import (
	"encoding/json"
	"errors"
	"syscall/js"

	"github.com/nasuton/go-wasm-tools/internal/convert"
	"github.com/nasuton/go-wasm-tools/internal/hash"
	"github.com/nasuton/go-wasm-tools/internal/jwt"
	"github.com/nasuton/go-wasm-tools/internal/password"
	"github.com/nasuton/go-wasm-tools/internal/qr"
	"github.com/nasuton/go-wasm-tools/internal/regex"
	"github.com/nasuton/go-wasm-tools/internal/uuid"
)

func ok(v any) any     { return map[string]any{"ok": true, "data": v} }
func fail(e error) any { return map[string]any{"ok": false, "error": e.Error()} }

// Marshal structured Go values into objects/arrays supported by syscall/js.
func result(value any, err error) any {
	if err != nil {
		return fail(err)
	}
	data, err := json.Marshal(value)
	if err != nil {
		return fail(err)
	}
	return ok(js.Global().Get("JSON").Call("parse", string(data)))
}

func genUUID(_ js.Value, args []js.Value) any    { return result(uuid.Generate(args[0].Int())) }
func sha256Hash(_ js.Value, args []js.Value) any { return ok(hash.SHA256(args[0].String())) }
func bcryptHash(_ js.Value, args []js.Value) any {
	return result(hash.Bcrypt(args[0].String(), args[1].Int()))
}
func bcryptCompare(_ js.Value, args []js.Value) any {
	return result(hash.CompareBcrypt(args[0].String(), args[1].String()))
}
func decodeJWT(_ js.Value, args []js.Value) any {
	decoded, err := jwt.Decode(args[0].String())
	if err != nil {
		return fail(err)
	}
	// Keep JSON as text to preserve large numeric claims in JavaScript.
	return ok(map[string]any{"header": string(decoded.Header), "payload": string(decoded.Payload)})
}
func verifyJWT(_ js.Value, args []js.Value) any {
	if err := jwt.Verify(args[0].String(), args[1].String(), args[2].String()); err != nil {
		return fail(err)
	}
	return ok(true)
}
func jsonToYAML(_ js.Value, args []js.Value) any { return result(convert.JSONToYAML(args[0].String())) }
func yamlToJSON(_ js.Value, args []js.Value) any { return result(convert.YAMLToJSON(args[0].String())) }
func testRegex(_ js.Value, args []js.Value) any {
	opt := args[0]
	return result(regex.Test(regex.Options{Pattern: opt.Get("pattern").String(), Text: opt.Get("text").String(), Flags: opt.Get("flags").String()}))
}

func genPassword(_ js.Value, args []js.Value) any {
	opt := args[0]
	s, err := password.Generate(password.Options{
		Length:     opt.Get("length").Int(),
		UseUpper:   opt.Get("useUpper").Bool(),
		UseDigits:  opt.Get("useDigits").Bool(),
		UseSymbols: opt.Get("useSymbols").Bool(),
	})
	if err != nil {
		return fail(err)
	}
	return ok(s)
}

func makeQR(_ js.Value, args []js.Value) any {
	url, err := qr.EncodePNGDataURL(args[0].String(), args[1].Int())
	if err != nil {
		return fail(err)
	}
	return ok(url)
}

func readQR(_ js.Value, args []js.Value) any {
	if len(args) != 1 || !args[0].InstanceOf(js.Global().Get("Uint8Array")) {
		return fail(errors.New("画像データは Uint8Array で指定してください"))
	}
	size := args[0].Get("byteLength").Int()
	if size == 0 || size > qr.MaxImageBytes {
		return fail(errors.New("画像は空でない 10 MiB 以下のファイルを選択してください"))
	}
	data := make([]byte, size)
	js.CopyBytesToGo(data, args[0])
	return result(qr.DecodeImage(data))
}

func main() {
	js.Global().Set("goTools", js.ValueOf(map[string]any{
		"generatePassword": js.FuncOf(genPassword),
		"generateUUID":     js.FuncOf(genUUID),
		"sha256":           js.FuncOf(sha256Hash),
		"bcrypt":           js.FuncOf(bcryptHash),
		"compareBcrypt":    js.FuncOf(bcryptCompare),
		"decodeJWT":        js.FuncOf(decodeJWT),
		"verifyJWT":        js.FuncOf(verifyJWT),
		"jsonToYAML":       js.FuncOf(jsonToYAML),
		"yamlToJSON":       js.FuncOf(yamlToJSON),
		"testRegex":        js.FuncOf(testRegex),
		"makeQR":           js.FuncOf(makeQR),
		"readQR":           js.FuncOf(readQR),
	}))
	select {}
}
