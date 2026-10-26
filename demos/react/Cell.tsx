import { useEffect } from 'react';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { cellAppearance } from '../shared';
import { metrics } from './context';

/**
 * Cell
 *
 * Render a cell label and track its component lifecycle.
 * @param options Named arguments item, position, fullscreen.
 * @returns The rendered cell content.
 */
export default function Cell({
  item,
  position,
  fullscreen,
}: {
  readonly item: string;
  readonly position: Position;
  readonly fullscreen: boolean;
}) {
  useEffect(() => {
    metrics.mount();
    return metrics.unmount;
  }, []);
  return (
    <article className={cellAppearance(position, fullscreen)} style={DEMO_GEOMETRY.cell} data-item={item} data-row={position.row}>
      <h1 className={DEMO_TEXT.cellTitle}>{item}</h1>
    </article>
  );
}
