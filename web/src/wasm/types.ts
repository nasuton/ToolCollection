/** Mirrors the envelope returned by cmd/wasm/main.go. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PasswordOptions {
  length: number;
  useUpper: boolean;
  useDigits: boolean;
  useSymbols: boolean;
}

/** Functions Go registers on `globalThis.goTools`. */
export interface GoTools {
  generatePassword(options: PasswordOptions): Result<string>;
  generateUUID(count: number): Result<string[]>;
  sha256(text: string): Result<string>;
  bcrypt(password: string, cost: number): Result<string>;
  compareBcrypt(password: string, encoded: string): Result<boolean>;
  decodeJWT(token: string): Result<{ header: string; payload: string }>;
  verifyJWT(token: string, key: string, algorithm: string): Result<boolean>;
  jsonToYAML(text: string): Result<string>;
  yamlToJSON(text: string): Result<string>;
  testRegex(options: { pattern: string; text: string; flags: string }): Result<RegexResult>;
  makeQR(text: string, size: number): Result<string>;
  readQR(image: Uint8Array): Result<string>;
}

export interface RegexResult {
  matches: {
    text: string;
    start: number;
    end: number;
    groups: { name: string; text: string; start: number; end: number }[];
  }[];
  truncated: boolean;
}

/** The runtime class defined by Go's wasm_exec.js. */
export interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

declare global {
  interface Window {
    Go: new () => GoRuntime;
    goTools?: GoTools;
  }
}
