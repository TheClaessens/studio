import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import '@fontsource-variable/caveat/index.css';
import './design/tokens.css';
import { Workbench } from './assets.tsx';
import { Docs } from './docs.tsx';
import { Media } from './media.tsx';
import { Feedback, listFeedback } from './feedback.tsx';
import { Playtests } from './playtests.tsx';
import { Play } from './play.tsx';
import { NotSetUp, Shell, TopBar, type Surface } from './shell.tsx';

// `#<Surface>/<surface route>`; the route stays encoded for the Surface to decode (see hash.ts).
const current = () => location.hash.slice(1);

function Studio() {
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [project, setProject] = useState<string>();
  const [selected, setSelected] = useState(current);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    fetch('/__studio/surfaces').then((r) => r.json()).then(setSurfaces);
    fetch('/__studio/project').then((r) => r.json()).then((p: { name: string }) => setProject(p.name));
    const onHash = () => setSelected(current());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  // Feedback that agents addressed and that waits for the human; refreshed on every navigation.
  useEffect(() => void listFeedback().then((items) => setWaiting(items.filter((i) => i.resolved && i.status === 'addressed').length)), [selected]);
  useEffect(() => void (document.title = project ? `${project} · Studio` : 'Studio'), [project]);
  // Another Surface or file starts at the top; a route with an anchor is scrolled to it by the Surface instead.
  const place = selected.split('#')[0];
  useEffect(() => {
    if (!selected.includes('#')) document.querySelector('.surface')?.scrollTo(0, 0);
  }, [place]);

  const surface = surfaces.find((s) => s.name === selected.split('/')[0]) ?? surfaces[0];
  return (
    <Shell bar={<TopBar project={project} surfaces={surfaces} current={surface} waiting={waiting} />}>
      {surface && <SurfaceView surface={surface} route={selected.split('/').slice(1).join('/')} />}
    </Shell>
  );
}

function SurfaceView({ surface, route }: { surface: Surface; route: string }) {
  if (surface.name === 'Feedback') return <Feedback setUp={surface.setUp} />; // absent section: default `feedback/`
  if (!surface.setUp) return <NotSetUp surface={surface} />;
  if (surface.name === 'Assets') return <Workbench assets={surface.value as { catalogue: string; view: string }} />;
  if (surface.name === 'Docs') return <Docs route={route} />;
  if (surface.name === 'Playtests') return <Playtests route={route} />;
  if (surface.name === 'Play') return <Play play={surface.value as { entry: string; hooks?: string }} />;
  if (surface.name === 'Media') return <Media route={route} />;
  return (
    <section>
      <h2>{surface.name}</h2>
      <pre>{JSON.stringify({ [surface.section]: surface.value }, null, 2)}</pre>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<Studio />);
