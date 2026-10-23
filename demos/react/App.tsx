import { useEffect, useRef, useState } from 'react';
import type { Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT } from '../config';
import { initialGrid, INITIAL_POSITION } from '../shared';
import { Context, metrics } from './context';
import EngineView from './EngineView';
import CellMap from './CellMap';

/** Render a portrait swipe view and its interactive cell map. */
export default function App() {
  const [grid, setGrid] = useState(initialGrid);
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState<Position>(INITIAL_POSITION);
  const engineRef = useRef<SwipeEngine<string> | null>(null);
  /** Restore initial data before mounting a fresh engine. */
  function remount() {
    if (!visible) {
      setGrid(initialGrid);
      setPosition(INITIAL_POSITION);
    }
    setVisible(!visible);
  }
  useEffect(() => {
    window.tikitakiDemo.commands = {
      navigate: (direction) => {
        void engineRef.current?.navigate(direction).catch(metrics.error);
      },
      goTo: (target) => {
        void engineRef.current?.goTo(target).catch(metrics.error);
      },
      update: () => {
        setGrid((previous) => previous.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix)));
      },
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
    <Context.Provider value={DEMO_TEXT.reactContextRoot}>
      <main className={DEMO_TEXT.container}>
        <a href={DEMO_TEXT.homePath}>{DEMO_TEXT.demos}</a>
        <p>
          <span className={DEMO_TEXT.badge}>{DEMO_TEXT.tikiTakiReactStrictMode}</span>
        </p>
        <div className={DEMO_TEXT.pageHeader}>
          <h1>{DEMO_TEXT.headline}</h1>
        </div>
        <p>{DEMO_TEXT.intro}</p>
        <div className={DEMO_TEXT.layout} data-demo-layout="">
          <div className={DEMO_TEXT.viewportColumn}>
            <h3>{DEMO_TEXT.liveTitle}</h3>
            {visible ? (
              <EngineView grid={grid} engineRef={engineRef} onPosition={setPosition} />
            ) : (
              <p data-unmounted="">{DEMO_TEXT.destroyedMessage}</p>
            )}
          </div>
        </div>
        <hr />
        <CellMap
          grid={grid}
          position={position}
          enabled={visible}
          onSelect={(target) => {
            void engineRef.current?.goTo(target).catch(metrics.error);
          }}
        />
      </main>
    </Context.Provider>
  );
}
