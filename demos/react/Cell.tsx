import { useEffect } from 'react';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { cellAppearance } from '../shared';
import { metrics } from './context';

/** Render a cell label and track its component lifecycle. */
export default function Cell({ item, position }: { readonly item: string; readonly position: Position }) {
  useEffect(() => {
    metrics.mount();
    return metrics.unmount;
  }, []);
  return (
    <article className={cellAppearance(position)} style={DEMO_GEOMETRY.cell} data-item={item} data-row={position.row}>
      <h1 className={DEMO_TEXT.cellTitle}>{item}</h1>
    </article>
  );
}
