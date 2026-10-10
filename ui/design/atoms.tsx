// Atoms: the smallest pieces of the Studio's UI (docs/design/ui-redesign.md, Components). Molecules and Surfaces
// compose these; they hold no Studio data of their own.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { sigils, type PersonaLook } from './personas.ts';
import './atoms.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' };
export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return <button className={cx('btn', `btn--${variant}`, className)} {...rest} />;
}

const pinPath = 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z';

/** The map-pin glyph used wherever Feedback can be pinned. */
export function PinGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={pinPath} />
    </svg>
  );
}

/** Pins Feedback to what it sits beside; with `count`, shows how many open items are already there. */
export function PinButton({ count = 0, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { count?: number; label: string }) {
  return (
    <button className={cx('pin-btn', count > 0 && 'pin-btn--has')} aria-label={count ? `${label}: ${count} open` : label} {...rest}>
      <PinGlyph />
      {count > 0 && count}
    </button>
  );
}

/** One choice out of a few (Rendered / Source, a pin scope). */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterPill({ on, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return <button type="button" className="pill" aria-pressed={on} {...rest} />;
}

export type Severity = 'blocker' | 'major' | 'minor' | 'polish';
const weight: Record<Severity, number> = { blocker: 4, major: 3, minor: 2, polish: 1 };
export const isSeverity = (s: string): s is Severity => Object.hasOwn(weight, s);

/** Severity carries 1–4 bars as well as colour, so it never relies on colour alone. */
export function SeverityBadge({ level }: { level: Severity }) {
  return (
    <span className={`sev sev--${level}`}>
      <span className="sev__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <i key={n} className={n <= weight[level] ? 'on' : ''} />)}
      </span>
      {level[0].toUpperCase() + level.slice(1)}
    </span>
  );
}

export type Verdict = 'real-bug' | 'design-flaw' | 'harness-artefact' | 'bot-limitation' | 'unverified';
const verdicts: Record<Verdict, { label: string; shape: ReactNode }> = {
  'real-bug': { label: 'Real bug', shape: <circle cx="5" cy="5" r="4" fill="currentColor" /> },
  'design-flaw': { label: 'Design flaw', shape: <path d="M5 1l4 8H1z" fill="currentColor" /> },
  'harness-artefact': { label: 'Harness artefact', shape: <rect x="1" y="1" width="8" height="8" fill="currentColor" /> },
  'bot-limitation': { label: 'Bot limitation', shape: <rect x="1" y="4" width="8" height="2" fill="currentColor" /> },
  unverified: { label: 'Unverified', shape: <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /> },
};

/** The playtest protocol's five verdicts; each has a shape as well as a colour. */
export function VerdictTag({ verdict }: { verdict: Verdict }) {
  const v = verdicts[verdict];
  return (
    <span className={`verdict verdict--${verdict}`}>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">{v.shape}</svg>
      {v.label}
    </span>
  );
}

export type FeedbackStatus = 'open' | 'addressed' | 'closed' | 'missing';
const statusLabel: Record<FeedbackStatus, string> = { open: 'Open', addressed: 'Waiting for you', closed: 'Closed', missing: 'Pin not found' };
export function StatusChip({ status }: { status: FeedbackStatus }) {
  return <span className={`status status--${status}`}>{statusLabel[status]}</span>;
}

/** Evidence, domain and meta tags. `tone` colours a domain tag in a persona's tint. */
export function Tag({ kind = 'meta', children, tone }: { kind?: 'evidence' | 'domain' | 'meta'; children: ReactNode; tone?: PersonaLook }) {
  const style = tone ? ({ '--tag-bg': tone.tint, '--tag-fg': tone.color } as CSSProperties) : undefined;
  return <span className={`tag tag--${kind}`} style={style}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** A persona's sigil on its tint; the identity under 32 px, and the fallback when there is no portrait. */
export function Sigil({ look, size = 20, label }: { look: PersonaLook; size?: number; label?: string }) {
  return (
    <span className="sigil" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: look.tint, color: look.color }}>
      <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={sigils[look.sigil]} />
      </svg>
    </span>
  );
}

/** Stepped corners, one source pixel per step, for a 32 × 32 portrait shown at `scale`. */
const stepped = (s: number) =>
  `polygon(${2 * s}px 0, calc(100% - ${2 * s}px) 0, calc(100% - ${2 * s}px) ${s}px, calc(100% - ${s}px) ${s}px, calc(100% - ${s}px) ${2 * s}px, 100% ${2 * s}px, 100% calc(100% - ${2 * s}px), calc(100% - ${s}px) calc(100% - ${2 * s}px), calc(100% - ${s}px) calc(100% - ${s}px), calc(100% - ${2 * s}px) calc(100% - ${s}px), calc(100% - ${2 * s}px) 100%, ${2 * s}px 100%, ${2 * s}px calc(100% - ${s}px), ${s}px calc(100% - ${s}px), ${s}px calc(100% - ${2 * s}px), 0 calc(100% - ${2 * s}px), 0 ${2 * s}px, ${s}px ${2 * s}px, ${s}px ${s}px, ${2 * s}px ${s}px)`;

/** A persona's generated 32 × 32 pixel-art portrait at a whole multiple (D7), ringed in its colour.
 *  `src` defaults to the look's portrait; without one it shows the sigil in the same frame. Below 32 px use `Sigil` instead. */
export function Portrait({ look, src = look.portrait, size = 32, label }: { look: PersonaLook; src?: string; size?: 32 | 64 | 128; label: string }) {
  const scale = size / 32;
  const ring = scale;
  const clip = stepped(scale);
  return (
    <span className="portrait" role="img" aria-label={label} style={{ width: size + 2 * ring, height: size + 2 * ring, padding: ring, background: look.color, clipPath: clip }}>
      {src ? (
        <img src={src} alt="" width={size} height={size} style={{ clipPath: clip, background: look.tint }} />
      ) : (
        <span className="portrait__fallback" style={{ width: size, height: size, clipPath: clip, background: look.tint, color: look.color }}>
          <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 32 ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={sigils[look.sigil]} />
          </svg>
        </span>
      )}
    </span>
  );
}

/** A 0–`max` score as a bar; `value` undefined draws the empty track. */
export function Meter({ value, max = 10, color = 'var(--ink)', label }: { value?: number; max?: number; color?: string; label: string }) {
  const pct = value === undefined ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <span className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

export type Hands = 'casual' | 'average' | 'expert';
const handsLevel: Record<Hands, number> = { casual: 1, average: 2, expert: 3 };
export function HandsMeter({ hands, color }: { hands: Hands; color: string }) {
  return (
    <span className="hands" role="img" aria-label={`Hands: ${hands}`}>
      {[1, 2, 3].map((n) => <span key={n} style={{ background: n <= handsLevel[hands] ? color : undefined }} />)}
    </span>
  );
}

/** Work that is still running somewhere (a playtest round, a check). Not used for portraits (D9). */
export function Pending({ label }: { label: string }) {
  return <span className="pending" role="progressbar" aria-label={label} />;
}
