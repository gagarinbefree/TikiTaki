import { useEffect, useRef, useState } from 'react';
import { createReactCellAdapter, ReactCellPortals } from '@tikitaki_gagarinbefree/react';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import type { Grid, Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY, MOBILE_LAYOUT } from '../config';
import { INITIAL_POSITION } from '../shared';
import { metrics } from './context';
import Cell from './Cell';

/** Data, controller ownership, and committed-position notifications for one view. */
interface ViewProps {
  readonly fullscreen: boolean;
  readonly grid: Grid<string>;
  readonly engineRef: { current: SwipeEngine<string> | null };
  readonly onPosition: (position: Position) => void;
}

/** Pair engine ownership with StrictMode-safe effect setup and cleanup. */
export default function EngineView({ grid, engineRef, onPosition, fullscreen }: ViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const [bridge] = useState(createReactCellAdapter<string>);
  useEffect(() => {
    if (container.current === null) return;
    const engine = createSwipeEngine({
      container: container.current,
      grid,
      initialPosition: INITIAL_POSITION,
      adapter: bridge.adapter,
      onPositionChange: onPosition,
      onError: metrics.error,
    });
    engineRef.current = engine;
    metrics.createEngine();
    return () => {
      engineRef.current = null;
      engine.destroy();
      metrics.destroyEngine();
    };
  }, [bridge, engineRef, onPosition]);
  useEffect(() => {
    engineRef.current?.updateGrid(grid);
  }, [grid, engineRef]);
  return (
    <>
      <div
        ref={container}
        className={fullscreen ? MOBILE_LAYOUT.viewport : DEMO_TEXT.viewport}
        style={fullscreen ? undefined : DEMO_GEOMETRY.viewport}
        data-demo-container=""
        aria-label={DEMO_TEXT.viewportLabel}
      />
      <ReactCellPortals bridge={bridge} renderCell={(item, position) => <Cell fullscreen={fullscreen} item={item} position={position} />} />
    </>
  );
}
