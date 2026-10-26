import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { initialGrid, INITIAL_POSITION } from '../shared';
import { metrics } from './context';
import EngineView from './EngineView';
import CellMap from './CellMap';
import { isFullscreenDemo, subscribeDemoLayout } from '../responsive';

/**
 * App
 *
 * Render a portrait swipe view and its interactive cell map.
 * @returns The rendered demo view.
 */
export default function App() {
  const fullscreen = useSyncExternalStore(subscribeDemoLayout, isFullscreenDemo);
  const [grid, setGrid] = useState(initialGrid);
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState<Position>(INITIAL_POSITION);
  const engineRef = useRef<SwipeEngine<string> | null>(null);
  /**
   * remount
   *
   * Restore initial data before mounting a fresh engine.
   */
  function remount() {
    if (!visible) {
      setGrid(initialGrid);
      setPosition(INITIAL_POSITION);
    }
    setVisible(!visible);
  }
  useEffect(() => {
    window.tikitakiDemo.commands = {
      /**
       * navigate
       * @param direction The requested navigation direction.
       */
      navigate: (direction) => {
        void engineRef.current?.navigate(direction).catch(metrics.error);
      },
      /**
       * goTo
       * @param target The requested target.
       */
      goTo: (target) => {
        void engineRef.current?.goTo(target).catch(metrics.error);
      },
      /**
       * update
       */
      update: () => {
        setGrid((previous) => previous.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix)));
      },
      /**
       * shrink
       */
      shrink: () => {
        setGrid([[DEMO_TEXT.only]]);
      },
      toggle: remount,
    };
    return () => {
      window.tikitakiDemo.commands = null;
    };
  });
  return (
    <main className={DEMO_TEXT.container}>
      <div className={DEMO_TEXT.layout} data-demo-layout="">
        <div className={DEMO_TEXT.viewportColumn} style={DEMO_GEOMETRY.phoneColumn}>
          {visible ? (
            <EngineView fullscreen={fullscreen} grid={grid} engineRef={engineRef} onPosition={setPosition} />
          ) : (
            <p data-unmounted="">{DEMO_TEXT.destroyedMessage}</p>
          )}
        </div>
        <CellMap
          fullscreen={fullscreen}
          grid={grid}
          position={position}
          enabled={visible}
          onSelect={(target) => {
            void engineRef.current?.goTo(target).catch(metrics.error);
          }}
        />
      </div>
    </main>
  );
}
