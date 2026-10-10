// Screenshots of a same-origin iframe, for asset Pins (the Workbench view) and play Pins (the game).
// Default: the iframe's largest canvas, read inside requestAnimationFrame. A Game Adapter whose page renders on
// demand (so its canvas reads blank between frames) exports `capture(win) → Blob` to replace the default.

export type Capture = (win: Window) => Blob | Promise<Blob>;

/** The `capture` export of a same-origin module (`assets.capture`, `play.hooks`), or undefined without one. */
export async function loadCapture(module?: string): Promise<Capture | undefined> {
  if (!module) return undefined;
  return (await import(/* @vite-ignore */ module.startsWith('/') ? module : `/${module}`)).capture;
}

/** A screenshot of `win`: `override(win)` when given, else its largest canvas as a png. */
export function capture(win: Window, override?: Capture): Promise<Blob> {
  if (override) return Promise.resolve(override(win));
  return new Promise((resolve, reject) =>
    win.requestAnimationFrame(() => {
      const [canvas] = [...win.document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height);
      if (!canvas) return reject(new Error('Nothing to screenshot: the view has no canvas.'));
      // toBlob copies the bitmap now, inside the frame; the encoding finishes later.
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The canvas could not be read.'))), 'image/png');
    }),
  );
}

/** A Blob as the `data:` URL Feedback attachments take. */
export const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
