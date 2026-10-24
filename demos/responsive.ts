import { MOBILE_LAYOUT } from './config';

/** Switch shared demo geometry at the Bootstrap md breakpoint and restore owned changes on cleanup. */
export function startResponsiveLayout(): () => void {
  const media = window.matchMedia(MOBILE_LAYOUT.query);
  const root = document.documentElement;
  const previousOverflow = document.body.style.overflow;
  const previousGutter = root.style.scrollbarGutter;
  const previous = new Map(Object.keys(MOBILE_LAYOUT.variables).map((name) => [name, root.style.getPropertyValue(name)]));
  /** Apply geometry without replacing framework-owned nodes or interrupting the engine lifecycle. */
  function update(): void {
    for (const [name, value] of Object.entries(MOBILE_LAYOUT.variables)) {
      if (media.matches) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    }
    document.body.style.overflow = media.matches ? 'hidden' : previousOverflow;
    root.style.scrollbarGutter = media.matches ? 'auto' : previousGutter;
  }
  /** Release the media subscription and restore the document styles owned by this demo. */
  function destroy(): void {
    media.removeEventListener('change', update);
    for (const [name, value] of previous) {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    }
    document.body.style.overflow = previousOverflow;
    root.style.scrollbarGutter = previousGutter;
  }
  update();
  media.addEventListener('change', update);
  return destroy;
}
