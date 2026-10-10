// Serves files from a folder, never outside it.
import { createReadStream, statSync } from 'node:fs';
import { join, resolve, sep, extname } from 'node:path';
import type { ServerResponse } from 'node:http';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
};

export function send(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type }).end(body);
}

/** `urlPath` is the decoded path below `dir`; `..` escapes and missing files are a 404. */
export function serveFile(res: ServerResponse, dir: string, urlPath: string) {
  const base = resolve(dir);
  let file = resolve(join(base, urlPath));
  if (file !== base && !file.startsWith(base + sep)) return send(res, 404, 'Not found');
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const { size } = statSync(file);
    res.writeHead(200, {
      'content-type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': size,
    });
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}
