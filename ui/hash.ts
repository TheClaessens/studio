// Surface routes live in the location hash: `#<Surface>/<path>#<anchor>`. Each part is percent-encoded once here and
// decoded once in `splitRoute`, so paths and anchors may hold `#`, `%`, `&` or non-ASCII. (Assets reads its own
// `id=&anchor=&t=` route with URLSearchParams.)
const encode = (s: string) => encodeURI(s).replaceAll('#', '%23');
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // a hand-typed malformed escape
  }
};

export const routeHref = (surface: string, path: string, anchor?: string) => `#${surface}/${encode(path)}${anchor ? `#${encode(anchor)}` : ''}`;

/** The raw (still encoded) route after `<Surface>/` → its decoded path and anchor. */
export function splitRoute(route: string): [path: string, anchor?: string] {
  const i = route.indexOf('#');
  return i < 0 ? [decode(route)] : [decode(route.slice(0, i)), decode(route.slice(i + 1))];
}
