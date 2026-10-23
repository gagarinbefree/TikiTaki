import { useRef, useState } from 'react';
import type { Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_LABELS } from '../config';
import { controls, hasNavigationTarget, initialGrid, INITIAL_POSITION, NAVIGATION_TARGET_POSITION } from '../shared';
import { Context, metrics } from './context';
import EngineView from './EngineView';
import CellMap from './CellMap';

/** Coordinate demo controls, live data, and the engine's mount lifecycle. */
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
          <aside className={DEMO_TEXT.controls}>
            <div className={DEMO_TEXT.panel}>
              <h3>{DEMO_TEXT.controlsTitle}</h3>
              <p>
                <output className={DEMO_TEXT.positionLabel} data-position="">
                  {DEMO_LABELS.coordinates(position)}
                </output>
              </p>
              {controls.map(({ direction, label }) => (
                <p key={direction}>
                  <button
                    className={DEMO_TEXT.buttonDefault}
                    data-navigate={direction}
                    disabled={!visible}
                    onClick={() => {
                      void engineRef.current?.navigate(direction).catch(metrics.error);
                    }}
                  >
                    {label}
                  </button>
                </p>
              ))}
              <p>
                <button
                  data-action={DEMO_TEXT.goto}
                  className={DEMO_TEXT.buttonPrimary}
                  disabled={!visible || !hasNavigationTarget(grid)}
                  onClick={() => {
                    void engineRef.current?.goTo(NAVIGATION_TARGET_POSITION).catch(metrics.error);
                  }}
                >
                  {DEMO_TEXT.goToTargetLabel}
                </button>
              </p>
              <p>
                <button
                  data-action={DEMO_TEXT.update}
                  className={DEMO_TEXT.buttonSuccess}
                  disabled={!visible}
                  onClick={() => {
                    setGrid((previous) => previous.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix)));
                  }}
                >
                  {DEMO_TEXT.updateLabel}
                </button>
              </p>
              <p>
                <button
                  data-action={DEMO_TEXT.shrink}
                  className={DEMO_TEXT.buttonWarning}
                  disabled={!visible}
                  onClick={() => {
                    setGrid([[DEMO_TEXT.only]]);
                  }}
                >
                  {DEMO_TEXT.shrinkLabel}
                </button>
              </p>
              <p>
                <button
                  className={visible ? DEMO_TEXT.buttonDanger : DEMO_TEXT.buttonSuccess}
                  data-action={DEMO_TEXT.toggle}
                  onClick={remount}
                >
                  {visible ? DEMO_TEXT.destroyLabel : DEMO_TEXT.remountLabel}
                </button>
              </p>
              <p className={DEMO_TEXT.hint}>{DEMO_TEXT.counterHint}</p>
            </div>
          </aside>
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
