import { vi, type Mock } from 'vitest';

export interface MockResizeObserver extends ResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly observe: Mock<(target: Element) => void>;
  readonly disconnect: Mock<() => void>;
  readonly unobserve: Mock<(target: Element) => void>;
  /**
   * notify
   */
  notify(): void;
}

/**
 * createResizeObserverMock
 *
 * Create a constructible browser API mock without classes or shared instance state.
 * @returns The observer constructor and the list of created mock instances.
 */
export function createResizeObserverMock() {
  const instances: MockResizeObserver[] = [];
  /**
   * construct
   * @param callback The callback invoked by this operation.
   * @returns A mock resize observer that invokes the supplied callback.
   */
  function construct(callback: ResizeObserverCallback): MockResizeObserver {
    const observer: MockResizeObserver = {
      callback,
      observe: vi.fn<(target: Element) => void>(),
      disconnect: vi.fn<() => void>(),
      unobserve: vi.fn<(target: Element) => void>(),
      /**
       * notify
       */
      notify() {
        callback([], observer);
      },
    };
    harness.instances.push(observer);

    return observer;
  }
  const harness = { instances, construct };

  return harness;
}
