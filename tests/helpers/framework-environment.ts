import { vi } from 'vitest';
import { createResizeObserverMock } from './resize-observer';
export function frameworkEnvironment() {
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const Observer = createResizeObserverMock();
  const observers = Observer.instances;
  vi.stubGlobal('ResizeObserver', Observer.construct);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++id, callback);

    return id;

  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
    frames.delete(key);
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  const names = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const;
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(Element.prototype, name));
  for (const name of names) {
    Object.defineProperty(Element.prototype, name, {
      configurable: true,
      value: name === 'hasPointerCapture' ? () => false : () => undefined,
    });
  }
  const result = {
    frames,
    observers,
    async finish() {
      for (const time of [0, 300]) {
        const batch = [...frames.values()];
        frames.clear();
        for (const callback of batch) callback(time);
        await Promise.resolve();
      }
      await Promise.resolve();
    },
    restore() {
      for (const [index, name] of names.entries()) {
        const original = originals[index];
        if (original) {
          Object.defineProperty(Element.prototype, name, original);
        } else {
          Reflect.deleteProperty(Element.prototype, name);
        }
      }
      vi.unstubAllGlobals();
    },
  };

  return result;

}
