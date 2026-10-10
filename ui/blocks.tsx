// Studio blocks: the playtest skills' conventions turned into components (docs/design/ui-redesign.md, Markdown).
// A TanStack Markdown extension rewrites recognised nodes into component nodes (`studio-*` tags); the React
// `components` map below renders them. Which rules apply is chosen by the file's frontmatter `kind`.
import { useState, type ReactNode } from 'react';
import type { BlockNode, ComponentNode, InlineComponentNode, InlineNode, MarkdownExtension, TableCellNode, TableNode } from '@tanstack/markdown';
import { FilterPill, HandsMeter, Meter, Portrait, Segmented, SeverityBadge, Sigil, Tag, VerdictTag, isSeverity, type Hands, type Verdict } from './design/atoms.tsx';
import { lookOf, personaName, personaOf } from './design/personas.ts';
import { routeHref } from './hash.ts';
import type { FileRefs } from './refs.ts';

const isHands = (h: string): h is Hands => ['casual', 'average', 'expert'].includes(h);

export type Meta = Record<string, string>;

/** A leading `---` block of flat `key: value` lines, as the skills write it. */
export function readFrontmatter(text: string): Meta {
  const m = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  const meta: Meta = {};
  for (const line of m?.[1].split(/\r?\n/) ?? []) {
    const kv = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return meta;
}

const inline = (name: string, properties: Record<string, string>, children: InlineNode[] = []): InlineComponentNode =>
  ({ type: 'inlineComponent', name, attributes: {}, tagName: `studio-${name}`, properties, children });
const block = (name: string, properties: Record<string, string>, children: BlockNode[] = []): ComponentNode =>
  ({ type: 'component', name, attributes: {}, tagName: `studio-${name}`, properties, children });

export const plain = (nodes: InlineNode[]): string =>
  nodes.map((n) => ('value' in n && n.type !== 'inlineHtml' ? n.value : 'children' in n ? plain(n.children) : '')).join('');
const cell = (c: TableCellNode | undefined) => plain(c?.children ?? []).trim();

/** `Severity: major` anywhere in running text becomes a severity badge. */
function severities(nodes: InlineNode[]): InlineNode[] {
  return nodes.flatMap((n) => {
    if (n.type !== 'text') return [n];
    const out: InlineNode[] = [];
    let rest = n.value;
    for (let m; (m = rest.match(/Severity:\s*(blocker|major|minor|polish)\b/i)); ) {
      if (m.index) out.push({ type: 'text', value: rest.slice(0, m.index).replace(/[\s·—-]+$/, ' ') });
      out.push(inline('severity', { level: m[1].toLowerCase() }));
      rest = rest.slice(m.index! + m[0].length);
    }
    if (rest) out.push({ type: 'text', value: rest });
    return out;
  });
}

const verdicts: [RegExp, Verdict][] = [[/real[ -]bug/, 'real-bug'], [/design[ -]flaw/, 'design-flaw'], [/harness(?:[ -]artefact)?/, 'harness-artefact'], [/bot[ -]limit(?:ation)?/, 'bot-limitation'], [/unverified/, 'unverified']];
/** The verdict at the start of the cell (after bold markers); the rest of the cell stays as text. */
const verdictOf = (text: string): { verdict: Verdict; rest: string } | undefined => {
  const s = text.replace(/^\**\s*/, '');
  for (const [re, verdict] of verdicts) {
    const m = s.toLowerCase().match(re);
    if (m?.index === 0) return { verdict, rest: s.slice(m[0].length) };
  }
};
/** A scorecard's persona cell, `Mila`, `**mila** (cozy)` or `01 Mila · cozy casual`, as a persona id. */
const personaIdOf = (text: string) => text.replace(/\*/g, '').trim().replace(/^\d+\s+/, '').split(/[\s(—·-]/)[0].toLowerCase();
const score = (text: string) => text.match(/^\**\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?\s*\**$/)?.[1];

/** Table columns the skills' templates name: severity, verdict, who raised it, persona and 0–10 scores. */
function decorateTable(table: TableNode, scorecard: boolean): TableNode {
  const heads = table.header.map((c) => cell(c).toLowerCase());
  const col = (test: (h: string) => boolean) => heads.findIndex(test);
  const sev = col((h) => h.startsWith('sev'));
  const verdict = col((h) => h.startsWith('verdict'));
  const raised = col((h) => h.startsWith('raised by'));
  const persona = scorecard ? col((h) => h === 'persona') : -1;
  const scores = scorecard ? heads.flatMap((h, i) => (/^(fun|domain)/.test(h) ? [i] : [])) : [];
  const isMean = (row: TableCellNode[]) => /^\**mean\**$/i.test(cell(row[persona] ?? row[0]));
  // An empty Mean cell under a score column is the mean of the rows above it.
  const meanOf = (i: number) => {
    const vs = table.rows.filter((r) => !isMean(r)).map((r) => Number(score(cell(r[i])))).filter((v) => !Number.isNaN(v));
    return vs.length ? String(Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10) : undefined;
  };
  const rows = table.rows.map((row) => {
    const mean = isMean(row);
    return row.map((c, i): TableCellNode => {
      const t = mean && scores.includes(i) && !cell(c) ? (meanOf(i) ?? '') : cell(c);
      if (i === sev && isSeverity(t.toLowerCase())) return { type: 'tableCell', children: [inline('severity', { level: t.toLowerCase() })] };
      const v = i === verdict ? verdictOf(t) : undefined;
      if (v) {
        const rest = v.rest.replace(/^[\s*:—–-]+|\**$/g, '');
        return { type: 'tableCell', children: [inline('verdict', { verdict: v.verdict }), ...(rest ? [{ type: 'text', value: ` — ${rest}` } as InlineNode] : [])] };
      }
      if (i === raised && t) {
        // Each part leads with a persona id (`dex (3/7)`); parts that don't (`all 7`, `5/7 personas`) stay text.
        const people: string[] = [];
        const extra: string[] = [];
        for (const part of t.split(/[,;]|\band\b/).map((s) => s.trim()).filter(Boolean)) {
          const m = part.match(/^([a-z][\w-]*)(?![\w/])\s*(.*)$/i);
          if (m && !/^(all|everyone|none|most)$/i.test(m[1])) (people.push(m[1]), m[2] && extra.push(m[2]));
          else extra.push(part);
        }
        if (!people.length) return c;
        const rest = extra.join(', ');
        return { type: 'tableCell', children: [inline('raised', { ids: people.join(', ') }), ...(rest ? [{ type: 'text', value: ` ${rest}` } as InlineNode] : [])] };
      }
      if (i === persona && t && !mean) return { type: 'tableCell', children: [inline('persona', { id: personaIdOf(t) })] };
      if (scores.includes(i) && score(t) && mean && !cell(c)) return { type: 'tableCell', children: [inline('score', { value: score(t)!, persona: '', computed: '1' })] };
      if (scores.includes(i) && score(t)) return { type: 'tableCell', children: [inline('score', { value: score(t)!, persona: mean ? '' : personaIdOf(cell(row[persona])) })] };
      return c;
    });
  });
  return { ...table, rows };
}

/** A `Side A` / `Side B` table: one card per tension. Its rows never start with a number, so no finding moves. */
function tensions(table: TableNode): ComponentNode | undefined {
  const heads = table.header.map((c) => cell(c).toLowerCase());
  const a = heads.findIndex((h) => h.startsWith('side a'));
  const b = heads.findIndex((h) => h.startsWith('side b'));
  if (a < 0 || b < 0 || table.rows.some((r) => /^\d+$/.test(cell(r[0])))) return undefined;
  const res = heads.findIndex((h) => h.includes('resolution'));
  return block('tensions', {}, table.rows.map((r) =>
    block('tension', { title: cell(r[0]), a: cell(r[a]), b: cell(r[b]), resolution: res >= 0 ? cell(r[res]) : '' })));
}

/** `- **Now** …` / `**Next**` / `**Later**` items under a backlog heading: three lanes. */
function lanes(list: BlockNode): ComponentNode | undefined {
  if (list.type !== 'list' || list.ordered) return undefined;
  const lead = (item: (typeof list.items)[number]) => {
    const p = item.children[0];
    const first = p?.type === 'paragraph' ? p.children[0] : undefined;
    return first?.type === 'strong' ? plain(first.children).trim() : '';
  };
  if (!list.items.length || !list.items.every((i) => /^(now|next|later)$/i.test(lead(i)))) return undefined;
  return block('lanes', {}, list.items.map((item) => {
    const [p, ...rest] = item.children;
    // The lane names its own hint, so drop the template's "(bugs/blockers, small):" after the bold lead.
    const after = p?.type === 'paragraph' ? p.children.slice(1) : [];
    if (after[0]?.type === 'text') after[0] = { type: 'text', value: after[0].value.replace(/^\s*(\([^)]*\))?\s*:?\s*/, '') };
    const body = p?.type === 'paragraph' ? [{ ...p, children: after } as BlockNode, ...rest] : item.children;
    return block('lane', { lane: lead(item).toLowerCase() }, body);
  }));
}

/** The persona report's verdict line under its title: `**…** Fun: x/10 · Would play again tomorrow: … · Domain score: x/10`. */
function verdictLine(p: BlockNode, persona: string): ComponentNode | undefined {
  if (p.type !== 'paragraph') return undefined;
  const text = plain(p.children);
  const fun = text.match(/Fun:\s*([\d.]+)\s*\/\s*10/i)?.[1];
  if (!fun) return undefined;
  // The bold lead is the verdict, unless it only labels it (`**Verdict (in character).** It is gorgeous…`).
  const strong = p.children[0]?.type === 'strong' ? plain(p.children[0].children) : '';
  const lead = strong && !/^verdict\b/i.test(strong.trim()) ? strong : (strong ? text.slice(strong.length) : text).split(/Fun:/i)[0];
  return block('scores', {
    persona,
    verdict: lead.trim(),
    fun,
    again: text.match(/again tomorrow\??:\s*([\w/-]+)/i)?.[1] ?? '',
    // `Domain score (epic feel / intensity): 6.5/10` names its domain; the score is what follows.
    domain: text.match(/Domain score[^:]*:\s*([\w.]+)\s*\/\s*10/i)?.[1] ?? '',
  });
}

/** The synthesis header's `**Testers:** N AI personas (…), ~X hand-drafted runs + Y batch runs, Z screenshots`: a
 *  stat strip with the panel's sigils (from the scorecard). The paragraph stays inside it. */
function testers(p: BlockNode, panel: string[]): ComponentNode | undefined {
  if (p.type !== 'paragraph') return undefined;
  const text = plain(p.children);
  const line = text.match(/Testers:\s*([^\n]*)/i)?.[1];
  if (!line) return undefined;
  const n = (re: RegExp) => line.match(re)?.[1] ?? '';
  return block('stats', {
    personas: n(/(\d+)\s+(?:AI\s+)?personas?/i), humans: n(/(\d+)\s+humans?/i), runs: n(/~?(\d+)\s+hand[- ]drafted runs?/i),
    batch: n(/(\d+)\s+batch runs?/i), shots: n(/(\d+)\s+screenshots?/i), panel: panel.join(','),
  }, [p]);
}

/** The scorecard's persona ids, for the stat strip above it. */
const panelOf = (children: BlockNode[]) => {
  let heading = '';
  for (const b of children) {
    if (b.type === 'heading') heading = plain(b.children).toLowerCase();
    if (b.type === 'table' && heading.includes('scorecard')) {
      const col = b.header.findIndex((c) => cell(c).toLowerCase() === 'persona');
      if (col >= 0) return b.rows.map((r) => personaIdOf(cell(r[col]))).filter((id) => id && id !== 'mean');
    }
  }
  return [];
};

/** The machine-readable findings fence: `[{ area, type, severity, finding, … }]`. */
function findingsFence(b: BlockNode): ComponentNode | undefined {
  if (b.type !== 'code' || b.lang !== 'json') return undefined;
  try {
    const data = JSON.parse(b.value);
    if (Array.isArray(data) && data.length && data.every((d) => d && typeof d.finding === 'string')) return block('findings', { json: b.value });
  } catch {}
  return undefined;
}

/** Links to the Game Project's docs and reports go to their Surface; shot references become thumbnails (K2, K4). */
export function refsExtension(refs: FileRefs): MarkdownExtension {
  const walk = (nodes: InlineNode[]): InlineNode[] =>
    nodes.map((n) => {
      if (n.type === 'link' && refs.links.has(n.href)) return { ...n, href: refs.links.get(n.href)!, children: walk(n.children) };
      const shot = n.type === 'inlineCode' ? refs.shots.get(n.value) : undefined;
      if (shot) return inline('shot', { file: shot.file, caption: shot.caption ?? '', at: shot.at?.join(',') ?? '' });
      return 'children' in n && n.type !== 'inlineComponent' ? ({ ...n, children: walk(n.children) } as InlineNode) : n;
    });
  return { name: 'studio-refs', transformInline: walk };
}

/** PERSONAS.md: each persona's `persona` fence (server/personas.ts reads the same fences) becomes its card. */
const personaCards: MarkdownExtension = {
  name: 'studio-personas',
  transformDocument: (doc) => ({
    ...doc,
    children: doc.children.map((b) => (b.type === 'code' && b.lang === 'persona' && /^id:\s*\S/m.test(b.value) ? block('persona-card', { id: b.value.match(/^id:\s*(\S+)/m)![1].toLowerCase() }) : b)),
  }),
};

/** The design spec's conventions (skills/game-design/references/spec-template.md): pillar cards, the run-structure
 *  act timeline, formula chips in the scaling table, the class comparison table and the difficulty-tier scale. Each
 *  wraps or replaces one block in place, so anchors don't move; tables stay tables. */
const designSpec: MarkdownExtension = {
  name: 'studio-design-spec',
  transformDocument(doc) {
    let heading = '';
    const children = doc.children.map((b): BlockNode => {
      if (b.type === 'heading') heading = plain(b.children).toLowerCase();
      if (/pillars/.test(heading) && b.type === 'list' && b.ordered) return block('pillars', {}, b.items.map((item) => block('pillar', {}, item.children)));
      if (b.type === 'table') {
        const heads = b.header.map((c) => cell(c).toLowerCase());
        if (/run structure/.test(heading) && (heads[0] === 'stage' || heads[0] === 'act')) {
          const boss = heads.indexOf('boss');
          const stages = b.rows.map((r) => ({ name: cell(r[0]), boss: boss >= 0 ? cell(r[boss]) : '' }));
          return block('acts', { stages: JSON.stringify(stages) }, [b]);
        }
        const formula = heads.indexOf('formula');
        if (formula >= 0) return { ...b, rows: b.rows.map((r) => r.map((c, i) => (i === formula ? { ...c, children: c.children.map((n) => (n.type === 'inlineCode' ? inline('formula', { value: n.value }) : n)) } : c))) };
        if (/class/.test(heading) && heads[0] === '' && heads.length > 2) return block('compare', {}, [b]);
      }
      return tiers(b) ?? b;
    });
    return { ...doc, children };
  },
};

/** `**Rift Tier** 0–5 …` (a paragraph, or an item of a list): a stepped scale above the line. */
function tiers(b: BlockNode): BlockNode | undefined {
  const scale = (p: BlockNode) => {
    if (p.type !== 'paragraph' || p.children[0]?.type !== 'strong') return undefined;
    const m = plain(p.children).match(/^([^\n]*?\btiers?)\b\**\s*(\d+)\s*[–-]\s*(\d+)/i);
    return m && Number(m[3]) > Number(m[2]) && Number(m[3]) - Number(m[2]) <= 20 ? block('tiers', { from: m[2], to: m[3] }, [p]) : undefined;
  };
  if (b.type === 'paragraph') return scale(b);
  if (b.type !== 'list' || !b.items.some((i) => i.children[0] && scale(i.children[0]))) return undefined;
  return { ...b, items: b.items.map((i) => ({ ...i, children: i.children.map((c, j) => (j === 0 ? (scale(c) ?? c) : c)) })) };
}

/** The extension for one file: `kind` picks the rules, `persona` names a persona report's author. */
export function studioBlocks(meta: Meta, persona?: string): MarkdownExtension | undefined {
  const kind = meta.kind;
  if (kind === 'personas') return personaCards;
  if (kind === 'design-spec') return designSpec;
  if (kind !== 'playtest-report' && kind !== 'persona-report' && kind !== 'human-session') return undefined;
  const who = meta.persona ?? persona ?? '';
  return {
    name: 'studio-blocks',
    transformInline: severities,
    transformDocument(doc) {
      let heading = '';
      let titled = false;
      const panel = kind === 'playtest-report' ? panelOf(doc.children) : [];
      const children = doc.children.map((b, i): BlockNode => {
        if (b.type === 'heading') heading = plain(b.children).toLowerCase();
        if (kind === 'playtest-report' && !heading.match(/^\d/)) { const s = testers(b, panel); if (s) return s; }
        if (b.type === 'table') return tensions(b) ?? decorateTable(b, heading.includes('scorecard'));
        if (/backlog/.test(heading)) { const l = lanes(b); if (l) return l; }
        const f = findingsFence(b);
        if (f) return f;
        if (kind !== 'playtest-report' && !titled && doc.children[i - 1]?.type === 'heading') {
          titled = true;
          return verdictLine(b, who) ?? b;
        }
        return b;
      });
      return { ...doc, children };
    },
  };
}

// --- Components for the `studio-*` tags ---------------------------------------------------------------------------

const ids = (list: string) => list.split(/[,;]|\band\b/).map((s) => s.trim().toLowerCase().split(/\s/)[0]).filter(Boolean);

function Raised({ ids: list }: { ids: string }) {
  const people = ids(list);
  return (
    <span className="raised" title={people.map(personaName).join(', ')}>
      {people.map((id) => <Sigil key={id} look={lookOf(id)} size={20} label={personaName(id)} />)}
    </span>
  );
}

function Persona({ id }: { id: string }) {
  return <span className="persona-inline"><Sigil look={lookOf(id)} size={20} />{personaName(id)}</span>;
}

function Score({ value, persona, computed }: { value: string; persona?: string; computed?: string }) {
  const v = Number(value);
  return (
    <span className="score" title={computed ? 'Mean computed by the Studio' : undefined}>
      <Meter value={v} label={`${value} of 10`} color={persona ? lookOf(persona).color : 'var(--ink)'} />
      <span>{value}</span>
    </span>
  );
}

function PersonaCard({ id }: { id: string }) {
  const look = lookOf(id);
  const p = personaOf(id);
  return (
    <div className="persona-card">
      <Portrait look={look} size={64} label={personaName(id)} />
      <div>
        <strong>{personaName(id)}{p?.archetype && <span className="dim"> · {p.archetype}</span>}</strong>
        {p?.quote && <p className={voiceClass(id)} style={{ color: look.ink }}>“{p.quote.replace(/^[“"]|[”"]$/g, '')}”</p>}
        <span className="persona-card__tags">
          {p?.hands && isHands(p.hands) && <Tag><HandsMeter hands={p.hands} color={look.color} /> {p.hands} hands</Tag>}
          {p?.save && <Tag>{p.save} save</Tag>}
          {p?.model && <Tag>{p.model}</Tag>}
        </span>
      </div>
    </div>
  );
}

/** A shot a report refers to, opening in Media; with a caption it is a captioned shot, `at` marking the spot. */
function Shot({ file, caption, at }: Record<'file' | 'caption' | 'at', string>) {
  const src = `/__studio/media/${encodeURI(file)}`;
  const [x, y] = at.split(',').map(Number);
  const video = /\.(mp4|webm|mov|m4v)$/i.test(file);
  const thumb = video ? <video src={`${src}#t=0.1`} preload="metadata" muted /> : <img src={src} alt="" loading="lazy" />;
  if (!caption) return <a className="shot" href={routeHref('Media', file)} title={file}>{thumb}<span>{file.slice(file.lastIndexOf('/') + 1)}</span></a>;
  return (
    <a className="shot shot--captioned" href={routeHref('Media', file)} title={file}>
      <span className="shot__frame">{thumb}{at && <span className="shot__at" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden="true" />}</span>
      <span className="shot__caption">{caption}</span>
    </a>
  );
}

function Stats({ personas, humans, runs, batch, shots, panel, children }: Record<'personas' | 'humans' | 'runs' | 'batch' | 'shots' | 'panel', string> & { children?: ReactNode }) {
  const tiles = ([['AI personas', personas], ['Humans', humans], ['Runs', runs], ['Batch runs', batch], ['Screenshots', shots]] as const).filter(([, v]) => v);
  const ids = panel.split(',').filter(Boolean);
  return (
    <section className="stats">
      {ids.length > 0 && <span className="stats__panel">{ids.map((id) => <Portrait key={id} look={lookOf(id)} size={32} label={personaName(id)} />)}</span>}
      {tiles.length > 0 && <div className="stats__tiles">{tiles.map(([label, v]) => <div key={label} className="tile"><span className="label">{label}</span><span className="tile__value">{v}</span></div>)}</div>}
      <div className="stats__line">{children}</div>
    </section>
  );
}

const roman = (n: number) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n);
function Pillars({ children }: { children?: ReactNode }) {
  return <ol className="pillars">{[children].flat(2).map((c, i) => <li key={i}><span className="pillars__n" aria-hidden="true">{roman(i + 1)}</span>{c}</li>)}</ol>;
}

function Acts({ stages, children }: { stages: string; children?: ReactNode }) {
  const list: { name: string; boss: string }[] = JSON.parse(stages);
  return (
    <div className="acts">
      <ol className="acts__line" aria-label="Run structure">
        {list.map((s, i) => (
          <li key={i} className={s.boss && s.boss !== '—' && s.boss !== '-' ? 'acts__stage acts__stage--boss' : 'acts__stage'}>
            <span className="acts__bar" aria-hidden="true" />
            <strong>{s.name}</strong>
            {s.boss && s.boss !== '—' && s.boss !== '-' && <span className="dim">Boss · {s.boss}</span>}
          </li>
        ))}
      </ol>
      <div className="table-scroll">{children}</div>
    </div>
  );
}

function Tiers({ from, to, children }: { from: string; to: string; children?: ReactNode }) {
  const steps = Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) => Number(from) + i);
  return (
    <div className="tiers">
      <div className="tiers__scale" role="img" aria-label={`Tiers ${from} to ${to}`}>{steps.map((n, i) => <span key={n} style={{ height: 14 + i * 8 }}>{n}</span>)}</div>
      {children}
    </div>
  );
}

const voiceClass = (persona: string) => `voice voice--${lookOf(persona).voice ?? 'soft'}`;

function Scores({ persona, verdict, fun, again, domain }: Record<'persona' | 'verdict' | 'fun' | 'again' | 'domain', string>) {
  const look = lookOf(persona || 'unknown');
  return (
    <section className="scores">
      {verdict && <p className={voiceClass(persona)} style={{ color: look.ink ?? 'var(--ink-2)' }}>“{verdict.replace(/^[“"]|[”"]$/g, '')}”</p>}
      <div className="scores__tiles">
        <div className="tile"><span className="label">Fun</span><span className="tile__value">{fun}<small>/10</small></span><Meter value={Number(fun)} label={`Fun ${fun} of 10`} color={look.color} /></div>
        {again && <div className="tile"><span className="label">Again tomorrow?</span><span className="tile__value">{again[0].toUpperCase() + again.slice(1)}</span></div>}
        {domain && <div className="tile"><span className="label">Domain score</span><span className="tile__value">{domain}<small>/10</small></span>{!Number.isNaN(Number(domain)) && <Meter value={Number(domain)} label={`Domain ${domain} of 10`} color={look.color} />}</div>}
      </div>
    </section>
  );
}

function Tension({ title, a, b, resolution }: Record<'title' | 'a' | 'b' | 'resolution', string>) {
  // Side text often names its personas in brackets: "fewer deaths (mila)".
  const side = (text: string, label: string) => {
    const who = text.match(/\(([^)]+)\)\s*$/)?.[1];
    return (
      <div className="tension__side">
        <span className="label">{label}{who && <> · <Raised ids={who} /></>}</span>
        <span>{who ? text.replace(/\s*\([^)]+\)\s*$/, '') : text}</span>
      </div>
    );
  };
  return (
    <div className="tension">
      <strong className="tension__title">{title}</strong>
      <div className="tension__sides">{side(a, 'Side A')}<span className="tension__vs">vs</span>{side(b, 'Side B')}</div>
      {resolution && <p className="tension__res"><span className="label">Resolution</span>{resolution}</p>}
    </div>
  );
}

const laneHint: Record<string, string> = { now: 'bugs, blockers', next: 'clarity, balance', later: 'retention, larger' };
function Lane({ lane, children }: { lane: string; children?: ReactNode }) {
  return (
    <div className={`lane lane--${lane}`}>
      <span className="label">{lane[0].toUpperCase() + lane.slice(1)} · {laneHint[lane]}</span>
      <div>{children}</div>
    </div>
  );
}

type Finding = { area?: string; type?: string; severity?: string; finding: string; evidence?: string; recommendation?: string };
function Findings({ json }: { json: string }) {
  const all: Finding[] = JSON.parse(json);
  const types = [...new Set(all.map((f) => f.type).filter(Boolean))] as string[];
  const [type, setType] = useState<string>();
  const [view, setView] = useState<'table' | 'raw'>('table');
  const shown = all.filter((f) => !type || f.type === type);
  return (
    <section className="findings">
      <div className="findings__bar">
        <div className="findings__types" role="group" aria-label="Type">
          <FilterPill on={!type} onClick={() => setType(undefined)}>All {all.length}</FilterPill>
          {types.map((t) => <FilterPill key={t} on={type === t} onClick={() => setType(t)}>{t} {all.filter((f) => f.type === t).length}</FilterPill>)}
        </div>
        <Segmented label="View" value={view} onChange={setView} options={[{ value: 'table', label: 'Table' }, { value: 'raw', label: 'JSON' }]} />
      </div>
      {view === 'raw' ? <pre>{json}</pre> : (
        <div className="rows">
          {shown.map((f, i) => (
            <div key={i} className="row findings__row">
              <span className="findings__area">{f.area}</span>
              <span className="row__text"><span>{f.finding}</span>{f.recommendation && <span className="dim">→ {f.recommendation}</span>}</span>
              {f.severity && isSeverity(f.severity) && <SeverityBadge level={f.severity} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The React side of the Studio blocks, passed as TanStack Markdown's `components`. */
export const blockComponents = {
  'studio-severity': ({ level }: { level: string }) => (isSeverity(level) ? <SeverityBadge level={level} /> : <>{level}</>),
  'studio-verdict': ({ verdict }: { verdict: Verdict }) => <VerdictTag verdict={verdict} />,
  'studio-raised': Raised,
  'studio-persona': Persona,
  'studio-score': Score,
  'studio-scores': Scores,
  'studio-tensions': ({ children }: { children?: ReactNode }) => <div className="tensions">{children}</div>,
  'studio-tension': Tension,
  'studio-lanes': ({ children }: { children?: ReactNode }) => <div className="lanes">{children}</div>,
  'studio-lane': Lane,
  'studio-findings': Findings,
  'studio-persona-card': PersonaCard,
  'studio-shot': Shot,
  'studio-stats': Stats,
  'studio-pillars': Pillars,
  'studio-pillar': ({ children }: { children?: ReactNode }) => <>{children}</>,
  'studio-acts': Acts,
  'studio-formula': ({ value }: { value: string }) => <code className="formula">{value}</code>,
  'studio-compare': ({ children }: { children?: ReactNode }) => <div className="table-scroll compare">{children}</div>,
  'studio-tiers': Tiers,
};
