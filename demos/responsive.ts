import { MOBILE_LAYOUT, DEMO_GEOMETRY, DEMO_TEXT } from './config';
const media = window.matchMedia(MOBILE_LAYOUT.query);
/**
 * isFullscreenDemo
 *
 * Report mobile portrait mode for touch devices of any width and narrow portrait windows.
 * @returns Whether the operation succeeded or the condition holds.
 */
export function isFullscreenDemo(): boolean {
  return media.matches;
}
/**
 * subscribeDemoLayout
 *
 * Subscribe framework state to device and orientation changes without owning its DOM.
 * @param listener The listener to register.
 * @returns The callback or factory created by this function.
 */
export function subscribeDemoLayout(listener: () => void): () => void {
  media.addEventListener('change', listener);
  return () => {
    media.removeEventListener('change', listener);
  };
}
/**
 * startResponsiveLayout
 *
 * Apply Bootstrap visibility and overflow utilities only to the static page chrome.
 * @returns The callback or factory created by this function.
 */
export function startResponsiveLayout(): () => void {
  const chrome = [...document.querySelectorAll<HTMLElement>('body > header, body > nav, body > footer')];
  const overflow = document.body.classList.contains('overflow-hidden');
  const classes = chrome.map((element) => element.className);
  /**
   * update
   */
  function update(): void {
    document.body.classList.toggle('overflow-hidden', media.matches || overflow);
    for (const element of chrome) element.classList.toggle('d-none', media.matches);
  }
  update();
  const stop = subscribeDemoLayout(update);
  return () => {
    stop();
    document.body.classList.toggle('overflow-hidden', overflow);
    chrome.forEach((element, index) => {
      element.className = classes[index] ?? '';
    });
  };
}

/**
 * applyDOMDemoLayout
 *
 * Apply the Bootstrap layout to the DOM owned Vanilla JS and Lit demo shells.
 * @param viewport The viewport argument.
 * @param map The map argument.
 * @param rows The rows argument.
 * @param fullscreen Whether mobile portrait mode is active.
 */
export function applyDOMDemoLayout(viewport: HTMLElement | null, map: HTMLElement, rows: HTMLElement, fullscreen: boolean): void {
  if (viewport) {
    viewport.className = fullscreen ? MOBILE_LAYOUT.viewport : DEMO_TEXT.viewport;
    viewport.style.width = fullscreen ? '' : DEMO_GEOMETRY.viewport.width;
    viewport.style.aspectRatio = fullscreen ? '' : DEMO_GEOMETRY.viewport.aspectRatio;
  }
  map.className = fullscreen ? MOBILE_LAYOUT.map : DEMO_TEXT.gridMap;
  rows.className = fullscreen ? MOBILE_LAYOUT.rows : DEMO_TEXT.gridMapScroll;
  for (const [name, value] of Object.entries(MOBILE_LAYOUT.mapGeometry)) {
    if (!name.startsWith('--')) continue;
    if (fullscreen) map.style.setProperty(name, value);
    else map.style.removeProperty(name);
  }
  map.style.paddingBottom = fullscreen ? MOBILE_LAYOUT.mapGeometry.paddingBottom : '';
  for (const element of map.querySelectorAll<HTMLElement>(':scope > div:first-child, :scope > p')) {
    element.classList.toggle('d-none', fullscreen);
  }
}
