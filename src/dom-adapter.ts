import { CORE_TEXT } from './config';
import type { Position } from './navigation';
import type { CellAdapter, MountedCell } from './dom-renderer';
import { isHTMLElement } from './dom-element';
/** Plain DOM convenience adapter. Framework adapters own their content themselves. */
export function createDOMAdapter<T>(renderCell: (item: T, position: Position) => HTMLElement): CellAdapter<T> {
  if (typeof renderCell !== 'function') {
    throw new TypeError(CORE_TEXT.renderCellMustBeAFunction);
  }
  const render = (item: T, position: Position, current: HTMLElement | null): HTMLElement => {
    const element = renderCell(item, position);
    if (!isHTMLElement(element)) {
      throw new TypeError(CORE_TEXT.renderCellMustReturnAnHTMLElement);
    }
    if (element !== current && element.parentNode !== null) {
      throw new Error(CORE_TEXT.renderCellMustReturnAnUnownedElement);
    }

    return element;

  };
  const result: CellAdapter<T> = {
    /**
     * Register one owned host and return its isolated update and cleanup operations.
     */
    mount(host: HTMLElement, item: T, position: Position): MountedCell<T> {
      let current: HTMLElement | null = render(item, position, null);
      host.append(current);
      const result: MountedCell<T> = {
        /**
         * Update a live host while retaining its identity and component state.
         */
        update(nextItem, nextPosition) {
          if (current === null)
            return;

          const next = render(nextItem, nextPosition, current);
          if (next !== current) {
            current.replaceWith(next);
            current = next;
          }
        },
        /**
         * Release one mounted host exactly once and ignore stale updates.
         */
        unmount() {
          current?.remove();
          current = null;
        },
      };

      return result;

    },
  };

  return result;

}
