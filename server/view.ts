// How the Studio drives an asset view: by URL only. Shared by the Workbench (ui/assets.tsx) and `studio check`.
export type ViewPose = { asset: { id: string; group: string; set?: string; file?: string }; anchor?: { name: string }; t: number; playing: boolean };

/** The view's URL template; `"gltf"` is the Studio's own view page, driven by the same parameters (hash, so no reload). */
export const viewTemplate = (view: string, asset: ViewPose['asset']) =>
  view === 'gltf' ? `/__studio/gltf.html#file=${encodeURIComponent(asset.file ?? '')}&anchor={anchor}&t={t}&play={play}` : view;

/** Fills `{group} {id} {anchor} {t} {play}`; an entry's own `set` stands in for its group.
 *  Without an anchor, `{anchor}` and `{t}` are both empty. */
export function viewUrl(template: string, { asset, anchor, t, playing }: ViewPose) {
  const values: Record<string, string> = {
    group: asset.set ?? asset.group,
    id: asset.id,
    anchor: anchor?.name ?? '',
    t: anchor ? String(+t.toFixed(2)) : '',
    play: playing ? '1' : '0',
  };
  const url = template.replace(/\{(group|id|anchor|t|play)\}/g, (_, k) => encodeURIComponent(values[k]));
  return url.startsWith('/') ? url : `/${url}`;
}
