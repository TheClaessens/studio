// Feedback: one markdown file per item in the manifest's `feedback` folder (default `feedback/`).
// The Studio writes only here (and into `out` folders). Agents edit these files directly via the feedback skill.
//
//   GET  /__studio/feedback                     every item, with `resolved` per Pin
//   POST /__studio/feedback                     { remark, pin, attachments? } → 201 item
//   POST /__studio/feedback/<name>/close        addressed → closed
//   POST /__studio/feedback/<name>/reopen       { remark }: addressed|closed → open, remark appended
//   GET  /__studio/feedback/<file>              an item or attachment file
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { send, serveFile } from './static.ts';
import { globFiles } from './globs.ts';
import { headingAnchors } from './slug.ts';
import type { Studio } from './app.ts';

/** What an item points at. `path` is relative to the Game Project, `id` a catalogue id; never a Studio URL.
 *  Kinds add their own anchor fields (`t`, `region`, …) and attachment references (`screenshot`, `snapshot`). */
export type Pin = { kind: string; label: string; path?: string; id?: string; anchor?: string; [field: string]: unknown };
export type Status = 'open' | 'addressed' | 'closed';
export type Item = { name: string; status: Status; pin: Pin; author: string; created: string; body: string; resolved: boolean };

/** Per Pin kind: does the Pin still point at something? A kind with no resolver never resolves. Later Pin kinds add theirs. */
export const resolvers: Record<string, (pin: Pin, studio: Studio) => boolean> = {
  doc: (pin, { root, manifest }) =>
    !!pin.path &&
    globFiles(root, manifest.docs).includes(pin.path) &&
    (!pin.anchor || headingAnchors(readFileSync(join(root, pin.path), 'utf8')).includes(pin.anchor)),
  media: (pin, { root, manifest }) => !!pin.path && globFiles(root, manifest.media).includes(pin.path),
};

const attachmentTypes: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/json': 'json',
};

const folder = ({ root, manifest }: Studio) => resolve(root, manifest.feedback ?? 'feedback');
const json = (res: ServerResponse, status: number, body: unknown) => send(res, status, JSON.stringify(body, null, 2), 'application/json; charset=utf-8');

export async function feedbackRoute(req: IncomingMessage, res: ServerResponse, rest: string, studio: Studio) {
  const dir = folder(studio);
  if (!rest || rest === '/') {
    if (req.method === 'POST') return createItem(req, res, dir, studio);
    return json(res, 200, listItems(dir, studio));
  }
  const parts = rest.slice(1).split('/');
  if (req.method === 'GET' && parts.length === 1) return serveFile(res, dir, rest);
  const [name, action] = parts;
  if (req.method !== 'POST' || parts.length !== 2 || !/^\w[\w.-]*$/.test(name)) return send(res, 404, 'Not found');
  let text: string;
  try {
    text = readFileSync(join(dir, `${name}.md`), 'utf8');
  } catch {
    return send(res, 404, 'Not found');
  }
  const { status } = parse(text);
  if (action === 'close') {
    if (status !== 'addressed') return send(res, 409, `Only an addressed item can be closed; this one is ${status}.`);
    text = setStatus(text, 'closed');
  } else if (action === 'reopen') {
    const body = await readJson(req).catch(() => undefined);
    const remark = typeof body?.remark === 'string' ? body.remark.trim() : '';
    if (!remark) return send(res, 400, 'Reopening needs a new remark.');
    if (status !== 'addressed' && status !== 'closed') return send(res, 409, `Only an addressed or closed item can be reopened; this one is ${status}.`);
    text = setStatus(text, 'open').replace(/\s*$/, `\n\n---\n\n${remark}\n`);
  } else return send(res, 404, 'Not found');
  writeFileSync(join(dir, `${name}.md`), text);
  json(res, 200, toItem(name, text, studio));
}

function listItems(dir: string, studio: Studio): Item[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
  return files.map((f) => toItem(f.slice(0, -3), readFileSync(join(dir, f), 'utf8'), studio));
}

function toItem(name: string, text: string, studio: Studio): Item {
  const { status, pin, author, created, body } = parse(text);
  let resolved = false;
  try {
    resolved = Object.hasOwn(resolvers, pin.kind) && resolvers[pin.kind](pin, studio);
  } catch {}
  return { name, status, pin, author, created, body, resolved };
}

async function createItem(req: IncomingMessage, res: ServerResponse, dir: string, studio: Studio) {
  const body = await readJson(req).catch(() => undefined);
  const error = invalid(body);
  if (error) return send(res, 400, error);
  const { remark, pin, attachments = {} } = body;
  const files: [field: string, ext: string, data: Buffer][] = [];
  for (const [field, url] of Object.entries(attachments)) {
    const m = typeof url === 'string' && url.match(/^data:([\w/+.-]+);base64,(.*)$/s);
    const ext = m && attachmentTypes[m[1]];
    if (!/^\w+$/.test(field) || !ext || files.some((f) => f[1] === ext)) return send(res, 400, `Attachment "${field}" must be a data: URL of a png, jpeg, webp, gif or json, one per type.`);
    files.push([field, ext, Buffer.from(m[2], 'base64')]);
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const words = remark.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 5).join('-');
  const base = `${stamp}-${words || 'feedback'}`;
  const author = gitAuthor(studio.root);
  mkdirSync(dir, { recursive: true });
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base}-${n}`;
    const item = { ...pin };
    for (const [field, ext] of files) item[field] = `${name}.${ext}`;
    const text = `---\nstatus: open\npin:\n${Object.entries(item).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}\n`).join('')}author: ${JSON.stringify(author)}\ncreated: ${JSON.stringify(now.toISOString())}\n---\n\n${remark.trim()}\n`;
    try {
      writeFileSync(join(dir, `${name}.md`), text, { flag: 'wx' }); // claims the name; a same-minute twin takes the next one
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
    for (const [, ext, data] of files) writeFileSync(join(dir, `${name}.${ext}`), data);
    return json(res, 201, toItem(name, text, studio));
  }
}

function invalid(body: any) {
  if (!body || typeof body !== 'object') return 'Expected a JSON object { remark, pin, attachments? }.';
  if (typeof body.remark !== 'string' || !body.remark.trim()) return 'A remark is required.';
  const pin = body.pin;
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return 'A pin is required.';
  if (typeof pin.kind !== 'string' || !pin.kind || typeof pin.label !== 'string') return 'A pin needs a kind and a quoted label.';
  if (Object.keys(pin).some((k) => !/^\w+$/.test(k))) return 'Pin fields are plain words.';
  if (typeof pin.path !== 'string' && typeof pin.id !== 'string') return 'A pin needs a path or an id.';
  if (pin.path !== undefined && (typeof pin.path !== 'string' || /^[/\\]|^[a-z]:|\\/i.test(pin.path) || pin.path.split('/').includes('..')))
    return 'A pin path is relative to the Game Project, without "..".';
  if (body.attachments !== undefined && (typeof body.attachments !== 'object' || Array.isArray(body.attachments))) return 'Attachments are { field: dataUrl }.';
}

/** Reads the frontmatter this module writes: flat `key: value` lines plus the indented `pin:` map.
 *  Values are JSON (which is valid YAML), or plain YAML scalars as an agent may write them. */
// ponytail: not a YAML parser; enough for the documented format. Add the `yaml` package if agents write richer YAML.
function parse(text: string) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta: Record<string, any> = {};
  let map: Record<string, unknown> | undefined;
  for (const line of (m?.[1] ?? '').split(/\r?\n/)) {
    const kv = line.match(/^(\s*)([\w-]+):\s*(.*?)\s*$/);
    if (!kv) continue;
    const [, indent, key, raw] = kv;
    if (indent && map) map[key] = scalar(raw);
    else if (!raw) map = meta[key] = {};
    else (map = undefined), (meta[key] = scalar(raw));
  }
  return { status: meta.status, pin: meta.pin ?? {}, author: meta.author, created: meta.created, body: (m?.[2] ?? text).replace(/^\r?\n/, '') };
}

function scalar(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.match(/^'(.*)'$/)?.[1].replace(/''/g, "'") ?? raw;
  }
}

const setStatus = (text: string, status: Status) => text.replace(/^(---\r?\n[\s\S]*?)^status:.*$/m, `$1status: ${status}`);

function gitAuthor(root: string) {
  const git = (key: string) => {
    try {
      return execFileSync('git', ['config', key], { cwd: root, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const name = git('user.name');
  const email = git('user.email');
  return [name, email && `<${email}>`].filter(Boolean).join(' ') || 'unknown';
}

const limit = 32 * 1024 * 1024; // screenshots ride along as base64
async function readJson(req: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if ((size += chunk.length) > limit) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
