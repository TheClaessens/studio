// Seam-1 harness: run `studio <dir>` as a child process and talk to it over HTTP.
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/studio.js', import.meta.url));
export const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Starts the Studio on a free port and resolves once it prints its URL. Call `stop()` when done. */
export function startStudio(dir: string, ...args: string[]) {
  const child = spawn(process.execPath, [bin, dir, '--port', '0', ...args]);
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));
  return new Promise<{ url: string; stdout: () => string; stderr: () => string; stop: () => void }>((resolve, reject) => {
    child.stdout.on('data', (d) => {
      stdout += d;
      const m = stdout.match(/http:\/\/localhost:\d+/);
      if (m) resolve({ url: m[0], stdout: () => stdout, stderr: () => stderr, stop: () => child.kill() });
    });
    child.on('exit', (code) => reject(new Error(`studio exited (${code}) before printing a URL:\n${stderr}`)));
  });
}

/** Runs the Studio expecting it to exit on its own (e.g. a bad manifest). */
export function runStudio(dir: string) {
  const child = spawn(process.execPath, [bin, dir, '--port', '0']);
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const timer = setTimeout(() => child.kill(), 5000);
  return new Promise<{ code: number | null; output: string }>((resolve) =>
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, output: out });
    }),
  );
}

/** Writes a throwaway Game Project: `{ 'studio.json': {...}, 'docs/a.md': '# A' }`. */
export function tempProject(files: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'studio-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}

/** POSTs JSON as the Studio UI does. A string body is sent as-is (for malformed-JSON cases). */
export const postJson = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

/** A raw HTTP request, so tests can send the headers a browser would (Host, Origin) that fetch won't let you set. */
export function rawRequest(url: string, { method = 'GET', headers = {}, body }: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new Promise<number>((resolve, reject) => {
    const req = httpRequest(url, { method, headers }, (res) => (res.resume(), resolve(res.statusCode!)));
    req.on('error', reject);
    req.end(body);
  });
}
