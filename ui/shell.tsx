// The app shell: the ink top bar every Surface sits under, and the "not set up" state (U4, U12).
import type { ReactNode } from 'react';
import { Palette } from './palette.tsx';

export type Surface = { name: string; section: string; setUp: boolean; value?: unknown; example?: unknown };

/** Game-facing Surfaces first, then reading, then the Feedback inbox. */
const order = ['Play', 'Assets', 'Playtests', 'Media', 'Docs', 'Feedback'];
const rank = (s: Surface) => (order.includes(s.name) ? order.indexOf(s.name) : order.length);

export function TopBar({ project, surfaces, current, waiting }: { project?: string; surfaces: Surface[]; current?: Surface; waiting: number }) {
  return (
    <header className="topbar">
      <div className="topbar__project">
        <span className="topbar__mark" aria-hidden="true">{(project ?? 'S').slice(0, 1)}</span>
        <span>{project ?? 'Studio'}</span>
      </div>
      <nav aria-label="Surfaces" className="topbar__surfaces">
        {[...surfaces].sort((a, b) => rank(a) - rank(b)).map((s) => (
          <a key={s.name} href={`#${s.name}`} aria-current={s === current ? 'page' : undefined} className={s.setUp || s.name === 'Feedback' ? '' : 'off'}
            title={s.setUp || s.name === 'Feedback' ? undefined : `Not set up: add a ${s.section} section to studio.json`}>
            {s.name}
            {s.name === 'Feedback' && waiting > 0 && <span className="topbar__count" aria-label={`${waiting} waiting for you`}>{waiting}</span>}
          </a>
        ))}
      </nav>
      <Palette surfaces={surfaces} />
    </header>
  );
}

/** An absent Project Manifest section: how to turn the Surface on, with the schema's example. */
export function NotSetUp({ surface }: { surface: Surface }) {
  return (
    <section className="not-set-up">
      <span className="kicker">Not set up</span>
      <h1>{surface.name}</h1>
      <p>
        Add a <code>{surface.section}</code> section to <code>studio.json</code> to turn this Surface on, for example:
      </p>
      <pre>{JSON.stringify({ [surface.section]: surface.example }, null, 2)}</pre>
    </section>
  );
}

export function Shell({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  return (
    <div className="studio">
      {bar}
      <main className="surface">{children}</main>
    </div>
  );
}
