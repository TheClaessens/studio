import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from './assets.tsx';
import { Docs } from './docs.tsx';
import { Media } from './media.tsx';
import { Feedback } from './feedback.tsx';
import { Playtests } from './playtests.tsx';
import { Play } from './play.tsx';

type Surface = { name: string; section: string; setUp: boolean; config?: unknown; example?: unknown };

// `#<Surface>/<surface route>`
const current = () => decodeURIComponent(location.hash.slice(1));

function Studio() {
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [selected, setSelected] = useState(current);

  useEffect(() => {
    fetch('/__studio/surfaces').then((r) => r.json()).then(setSurfaces);
    const onHash = () => setSelected(current());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const surface = surfaces.find((s) => s.name === selected.split('/')[0]) ?? surfaces[0];
  return (
    <div className="studio">
      <nav>
        <h1>Studio</h1>
        {surfaces.map((s) => (
          <a key={s.name} href={`#${s.name}`} className={s === surface ? 'on' : s.setUp ? '' : 'off'}>
            {s.name}
          </a>
        ))}
      </nav>
      <main>{surface && <SurfaceView surface={surface} route={selected.split('/').slice(1).join('/')} />}</main>
    </div>
  );
}

function SurfaceView({ surface, route }: { surface: Surface; route: string }) {
  if (surface.name === 'Feedback') return <Feedback setUp={surface.setUp} />; // absent section: default `feedback/`
  if (!surface.setUp) {
    return (
      <section>
        <h2>{surface.name}: not set up</h2>
        <p>
          Add a <code>{surface.section}</code> section to <code>studio.json</code> to turn this Surface on, for example:
        </p>
        <pre>{JSON.stringify({ [surface.section]: surface.example }, null, 2)}</pre>
      </section>
    );
  }
  if (surface.name === 'Assets') return <Workbench assets={surface.config as { catalogue: string; view: string }} />;
  if (surface.name === 'Docs') return <Docs route={route} />;
  if (surface.name === 'Playtests') return <Playtests route={route} />;
  if (surface.name === 'Play') return <Play play={surface.config as { entry: string; hooks?: string }} />;
  if (surface.name === 'Media') return <Media route={route} />;
  return (
    <section>
      <h2>{surface.name}</h2>
      <pre>{JSON.stringify({ [surface.section]: surface.config }, null, 2)}</pre>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<Studio />);
