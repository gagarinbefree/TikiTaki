import { useContext, useEffect, useState } from 'react';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { Context, metrics } from './context';

/** Render a cell whose component state survives updates under the parent context. */
export default function Cell({ item, position }: { readonly item: string; readonly position: Position }) {
  const context = useContext(Context);
  const [count, setCount] = useState(0);
  useEffect(() => {
    metrics.mount();
    return metrics.unmount;
  }, []);
  return (
    <article className={DEMO_TEXT.cell} style={DEMO_GEOMETRY.cell} data-item={item} data-row={position.row}>
      <small>{context}</small>
      <h1 className={DEMO_TEXT.cellTitle}>{item}</h1>
      <p>{DEMO_TEXT.swipeHint}</p>
      <button
        data-action={DEMO_TEXT.count}
        className={DEMO_TEXT.buttonPrimary}
        onClick={() => {
          setCount((value) => value + 1);
        }}
      >
        {DEMO_LABELS.counter(count)}
      </button>
    </article>
  );
}
