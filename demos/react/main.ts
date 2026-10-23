import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { createContext, createElement as h, Fragment, StrictMode, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactCellAdapter, ReactCellPortals } from '@tikitaki/react';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import type { Grid, Position } from 'tikitaki';
import {
  controls,
  cellMapRows,
  createMetrics,
  hasNavigationTarget,
  initialGrid,
  INITIAL_POSITION,
  NAVIGATION_TARGET_POSITION,
} from '../shared';
import '../vendor/bootstrap-2.0.2/css/bootstrap.css';
import '../vendor/bootstrap-2.0.2/css/bootstrap-responsive.css';
import type { CellMapProps } from '../shared';
import { showDeploymentVersion } from '../version';
void showDeploymentVersion();
const metrics = createMetrics();
const Context = createContext<string>(DEMO_TEXT.empty);
/**
 * Render an interactive demo cell whose local component state survives data updates.
 */
function Cell({ item, position }: { readonly item: string; readonly position: Position }) {
  const context = useContext(Context);
  const [count, setCount] = useState(0);
  useEffect(() => {
    metrics.mount();
    const result = () => {
      metrics.unmount();
    };

    return result;
  }, []);
  const result = h(
    DEMO_TEXT.article,
    { className: DEMO_TEXT.cell, style: DEMO_GEOMETRY.cell, [DEMO_TEXT.dataItem]: item, [DEMO_TEXT.dataRow]: position.row },
    h(DEMO_TEXT.small, null, context),
    h(DEMO_TEXT.h1, null, item),
    h(DEMO_TEXT.p, null, DEMO_TEXT.swipeHint),
    h(
      DEMO_TEXT.button,
      {
        [DEMO_TEXT.dataAction]: DEMO_TEXT.count,
        className: DEMO_TEXT.buttonPrimary,
        onClick: () => {
          setCount((value) => value + 1);
        },
      },
      DEMO_LABELS.counter(count),
    ),
  );

  return result;
}
/** React demo data, controller ownership ref, and committed-position notification. */
interface ViewProps {
  readonly grid: Grid<string>;
  readonly engineRef: { current: SwipeEngine<string> | null };
  /** Observe the latest committed controller coordinates. */
  readonly onPosition: (position: Position) => void;
}
/**
 * Own one controller inside the framework mount and cleanup lifecycle.
 */
function EngineView({ grid, engineRef, onPosition }: ViewProps) {
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
    const result = () => {
      engineRef.current = null;
      engine.destroy();
      metrics.destroyEngine();
    };

    return result;
  }, [bridge, engineRef, onPosition]);
  useEffect(() => {
    engineRef.current?.updateGrid(grid);
  }, [grid, engineRef]);
  const result = h(
    Fragment,
    null,
    h(DEMO_TEXT.div, {
      ref: container,
      className: DEMO_TEXT.viewport,
      style: DEMO_GEOMETRY.viewport,
      [DEMO_TEXT.dataDemoContainer]: DEMO_TEXT.empty,
      [DEMO_TEXT.ariaLabel]: DEMO_TEXT.viewportLabel,
    }),
    h(ReactCellPortals<string>, { bridge, renderCell: (item, position) => h(Cell, { item, position }) }),
  );

  return result;
}
/**
 * Render an accessible ragged-grid map with the committed position highlighted.
 */
function CellMap({ grid, position, enabled, onSelect }: CellMapProps) {
  const result = h(
    DEMO_TEXT.nav,
    { className: DEMO_TEXT.gridMap, [DEMO_TEXT.ariaLabel]: DEMO_TEXT.cellMapTitle },
    h(
      DEMO_TEXT.div,
      { className: DEMO_TEXT.gridMapHeader },
      h(DEMO_TEXT.h2, null, DEMO_TEXT.cellMapTitle),
      h(DEMO_TEXT.span, { className: DEMO_TEXT.gridMapLegend }, DEMO_TEXT.currentCellLegend),
    ),
    h(DEMO_TEXT.p, { className: DEMO_TEXT.hint }, DEMO_TEXT.cellMapHint),
    h(
      DEMO_TEXT.div,
      { className: DEMO_TEXT.gridMapScroll },
      ...cellMapRows({ grid, position, enabled }).map((cells, row) =>
        h(
          DEMO_TEXT.p,
          {
            key: row,
            className: DEMO_TEXT.gridMapRow,
            [DEMO_TEXT.dataMapRow]: row,
            role: DEMO_TEXT.group,
            [DEMO_TEXT.ariaLabel]: DEMO_LABELS.row(row),
          },
          ...cells.map((cell) =>
            h(
              DEMO_TEXT.button,
              {
                key: cell.position.col,
                type: DEMO_TEXT.button,
                className: cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell,
                disabled: !enabled,
                title: DEMO_LABELS.coordinates(cell.position),
                [DEMO_TEXT.ariaCurrent]: cell.current ? DEMO_TEXT.true : undefined,
                onClick: () => {
                  onSelect(cell.position);
                },
              },
              cell.label,
            ),
          ),
        ),
      ),
    ),
  );

  return result;
}
/**
 * Render demo controls and keep the grid, committed position, and controller lifecycle synchronized.
 */
function App() {
  const [grid, setGrid] = useState(initialGrid);
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState<Position>(INITIAL_POSITION);
  const engineRef = useRef<SwipeEngine<string> | null>(null);
  /**
   * Toggle the demo lifecycle and restore initial data before creating another controller.
   */
  function remount() {
    if (!visible) {
      setGrid(initialGrid);
      setPosition(INITIAL_POSITION);
    }
    setVisible(!visible);
  }
  const result = h(
    Context.Provider,
    { value: DEMO_TEXT.reactContextRoot },
    h(
      DEMO_TEXT.main,
      { className: DEMO_TEXT.container },
      h(DEMO_TEXT.a, { href: DEMO_TEXT.homePath }, DEMO_TEXT.demos),
      h(DEMO_TEXT.p, null, h(DEMO_TEXT.span, { className: DEMO_TEXT.badge }, DEMO_TEXT.tikiTakiReactStrictMode)),
      h(DEMO_TEXT.div, { className: DEMO_TEXT.pageHeader }, h(DEMO_TEXT.h1, null, DEMO_TEXT.headline)),
      h(DEMO_TEXT.p, null, DEMO_TEXT.intro),
      h(
        DEMO_TEXT.div,
        { className: DEMO_TEXT.layout, [DEMO_TEXT.dataDemoLayout]: DEMO_TEXT.empty },
        h(
          DEMO_TEXT.div,
          { className: DEMO_TEXT.viewportColumn },
          h(DEMO_TEXT.h3, null, DEMO_TEXT.liveTitle),
          visible
            ? h(EngineView, { grid, engineRef, onPosition: setPosition })
            : h(DEMO_TEXT.p, { [DEMO_TEXT.dataUnmounted]: DEMO_TEXT.empty }, DEMO_TEXT.destroyedMessage),
        ),
        h(
          DEMO_TEXT.aside,
          { className: DEMO_TEXT.controls },
          h(
            DEMO_TEXT.div,
            { className: DEMO_TEXT.panel },
            h(DEMO_TEXT.h3, null, DEMO_TEXT.controlsTitle),
            h(
              DEMO_TEXT.p,
              null,
              h(
                DEMO_TEXT.output,
                { className: DEMO_TEXT.positionLabel, [DEMO_TEXT.dataPosition]: DEMO_TEXT.empty },
                DEMO_LABELS.coordinates(position),
              ),
            ),
            ...controls.map(({ direction, label }) =>
              h(
                DEMO_TEXT.p,
                { key: direction },
                h(
                  DEMO_TEXT.button,
                  {
                    key: direction,
                    className: DEMO_TEXT.buttonDefault,
                    [DEMO_TEXT.dataNavigate]: direction,
                    disabled: !visible,
                    onClick: () => {
                      void engineRef.current?.navigate(direction).catch(metrics.error);
                    },
                  },
                  label,
                ),
              ),
            ),
            h(
              DEMO_TEXT.p,
              null,
              h(
                DEMO_TEXT.button,
                {
                  [DEMO_TEXT.dataAction]: DEMO_TEXT.goto,
                  className: DEMO_TEXT.buttonPrimary,
                  disabled: !visible || !hasNavigationTarget(grid),
                  onClick: () => {
                    void engineRef.current?.goTo(NAVIGATION_TARGET_POSITION).catch(metrics.error);
                  },
                },
                DEMO_TEXT.goToTargetLabel,
              ),
            ),
            h(
              DEMO_TEXT.p,
              null,
              h(
                DEMO_TEXT.button,
                {
                  [DEMO_TEXT.dataAction]: DEMO_TEXT.update,
                  className: DEMO_TEXT.buttonSuccess,
                  disabled: !visible,
                  onClick: () => {
                    setGrid((previous) => previous.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix)));
                  },
                },
                DEMO_TEXT.updateLabel,
              ),
            ),
            h(
              DEMO_TEXT.p,
              null,
              h(
                DEMO_TEXT.button,
                {
                  [DEMO_TEXT.dataAction]: DEMO_TEXT.shrink,
                  className: DEMO_TEXT.buttonWarning,
                  disabled: !visible,
                  onClick: () => {
                    setGrid([[DEMO_TEXT.only]]);
                  },
                },
                DEMO_TEXT.shrinkLabel,
              ),
            ),
            h(
              DEMO_TEXT.p,
              null,
              h(
                DEMO_TEXT.button,
                {
                  className: visible ? DEMO_TEXT.buttonDanger : DEMO_TEXT.buttonSuccess,
                  [DEMO_TEXT.dataAction]: DEMO_TEXT.toggle,
                  onClick: remount,
                },
                visible ? DEMO_TEXT.destroyLabel : DEMO_TEXT.remountLabel,
              ),
            ),
            h(DEMO_TEXT.p, { className: DEMO_TEXT.hint }, DEMO_TEXT.counterHint),
          ),
        ),
      ),
      h(DEMO_TEXT.hr),
      h(CellMap, {
        grid,
        position,
        enabled: visible,
        onSelect: (target) => {
          void engineRef.current?.goTo(target).catch(metrics.error);
        },
      }),
    ),
  );

  return result;
}
const root = document.getElementById(DEMO_TEXT.app);
if (root === null) {
  throw new Error(DEMO_TEXT.missingDemoRoot);
}
createRoot(root).render(h(StrictMode, null, h(App)));
