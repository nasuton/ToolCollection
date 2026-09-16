import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const GOROOT = process.argv[2];
const WASM = process.argv[3];

// wasm_exec.js is an IIFE that assigns globalThis.Go
(0, eval)(readFileSync(`${GOROOT}/lib/wasm/wasm_exec.js`, "utf8"));

const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(readFileSync(WASM), go.importObject);
go.run(instance); // intentionally not awaited: main() blocks on select{}
await new Promise((r) => setImmediate(r));

const t = globalThis.goTools;
if (!t) throw new Error("goTools was not registered on globalThis");

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) failures++;
};

// 1. password: happy path
const p = t.generatePassword({ length: 20, useUpper: true, useDigits: true, useSymbols: true });
check("password ok=true", p.ok === true);
check("password length=20", p.data?.length === 20, `-> ${p.data}`);

// 2. password: charset respected when all options off
const plain = t.generatePassword({ length: 16, useUpper: false, useDigits: false, useSymbols: false });
check("password lowercase-only", /^[a-z]+$/.test(plain.data), `-> ${plain.data}`);

// 3. password: validation error is surfaced, not thrown
const bad = t.generatePassword({ length: 2, useUpper: true, useDigits: true, useSymbols: true });
check("password rejects length<4", bad.ok === false, `-> ${bad.error}`);

// 4. password: randomness (no duplicates across 200 draws)
const seen = new Set();
for (let i = 0; i < 200; i++) {
  seen.add(t.generatePassword({ length: 24, useUpper: true, useDigits: true, useSymbols: true }).data);
}
check("password 200 unique draws", seen.size === 200, `-> ${seen.size}/200`);

// 5. QR: produces a real PNG data URL
const q = t.makeQR("https://nasuton.github.io/", 256);
check("qr ok=true", q.ok === true, q.ok ? "" : `-> ${q.error}`);
const b64 = q.data?.split(",")[1] ?? "";
const png = Buffer.from(b64, "base64");
check("qr data URL prefix", q.data?.startsWith("data:image/png;base64,") === true);
check("qr PNG magic bytes", png.subarray(1, 4).toString() === "PNG", `-> ${png.length} bytes`);
const width = png.readUInt32BE(16);
check("qr IHDR width=256", width === 256, `-> ${width}px`);

// 6. QR: validation errors
check("qr rejects empty text", t.makeQR("", 256).ok === false);
check("qr rejects size<64", t.makeQR("hello", 8).ok === false);
check("qr reads URL from PNG bytes", t.readQR(new Uint8Array(png)).data === "https://nasuton.github.io/");
check("qr rejects empty image", t.readQR(new Uint8Array()).ok === false);
check("qr rejects invalid image", t.readQR(new Uint8Array([1, 2, 3])).ok === false);
check("qr rejects wrong argument type", t.readQR("not bytes").ok === false);
check("qr rejects missing argument", t.readQR().ok === false);

// Exercise each new export through the actual Go/JavaScript WASM boundary.
const uuids = t.generateUUID(3);
check("uuid array crosses WASM bridge", uuids.ok && uuids.data.length === 3 && uuids.data.every((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)));
check("uuid rejects invalid count", !t.generateUUID(0).ok);
check("sha256 known vector", t.sha256("abc").data === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
const hashed = t.bcrypt("test password", 4);
check("bcrypt generation", hashed.ok && hashed.data.startsWith("$2a$04$"));
check("bcrypt match", t.compareBcrypt("test password", hashed.data).data === true);
check("bcrypt mismatch", t.compareBcrypt("wrong", hashed.data).data === false);
check("bcrypt input error", !t.bcrypt("あ".repeat(25), 4).ok);

const message = Buffer.from('{"alg":"HS256"}').toString("base64url") + "." + Buffer.from('{"sub":"test","large":9007199254740993}').toString("base64url");
const token = message + "." + createHmac("sha256", "secret").update(message).digest("base64url");
const decoded = t.decodeJWT(token);
check("jwt preserves numeric claims", decoded.ok && decoded.data.payload.includes("9007199254740993"));
check("jwt valid signature", t.verifyJWT(token, "secret", "HS256").data === true);
check("jwt invalid signature", !t.verifyJWT(token, "wrong", "HS256").ok);
check("jwt algorithm mismatch", !t.verifyJWT(token, "secret", "RS256").ok);
check("jwt malformed input", !t.decodeJWT("invalid").ok);

const yaml = t.jsonToYAML('{"name":"日本語","list":[true,null,2],"large":9007199254740993}');
check("json to yaml", yaml.ok && yaml.data.includes("日本語"));
const json = t.yamlToJSON(yaml.data);
check("yaml to json", json.ok && json.data.includes("9007199254740993") && JSON.parse(json.data).list[0] === true);
check("invalid yaml surfaced", !t.yamlToJSON("a: [").ok);
const matches = t.testRegex({ pattern: "(?P<word>猫)(x)?", text: "a猫b", flags: "" });
check("regex matches and capture objects", matches.ok && matches.data.matches[0].start === 1 && matches.data.matches[0].end === 4 && matches.data.matches[0].groups[1].start === -1);
check("regex empty result array", t.testRegex({ pattern: "z", text: "abc", flags: "" }).data.matches.length === 0);
check("regex syntax error surfaced", !t.testRegex({ pattern: "[", text: "abc", flags: "" }).ok);
check("WASM remains alive after validation errors", t.sha256("").ok);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
