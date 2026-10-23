import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { createApp, defineComponent, Fragment, h, inject, onBeforeUnmount, onMounted, onUnmounted, provide, ref, shallowRef, watch } from 'vue';
import type { PropType } from 'vue';
import { createVueCellAdapter, VueCellPortals } from '@tikitaki/vue';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import type { Grid, Position } from 'tikitaki';
import { controls, cellMapRows, createMetrics, hasNavigationTarget, initialGrid, INITIAL_POSITION, NAVIGATION_TARGET_POSITION } from '../shared';
import '../vendor/bootstrap-2.0.2/css/bootstrap.css';
import '../vendor/bootstrap-2.0.2/css/bootstrap-responsive.css';
import type { CellMapProps } from '../shared';
import { showDeploymentVersion } from '../version';
void showDeploymentVersion();
const metrics = createMetrics();
const Cell = defineComponent({
  props: { item: { type: String, required: true }, position: { type: Object as PropType<Position>, required: true } },
  /**
   * Configure component reactivity and pair resource creation with framework cleanup.
   */
  setup(props) {
    const context = inject<string>(DEMO_TEXT.context, DEMO_TEXT.empty);
    const count = ref(0);
    onMounted(metrics.mount);
    onUnmounted(metrics.unmount);
    const result = () => h(
        DEMO_TEXT.article,
        { class: DEMO_TEXT.cell, style: DEMO_GEOMETRY.cell, [DEMO_TEXT.dataItem]: props.item, [DEMO_TEXT.dataRow]: props.position.row },
        [
          h(DEMO_TEXT.small, context),
          h(DEMO_TEXT.h1, props.item),
          h(DEMO_TEXT.p, DEMO_TEXT.swipeHint),
          h(
            DEMO_TEXT.button,
            {
              [DEMO_TEXT.dataAction]: DEMO_TEXT.count,
              class: DEMO_TEXT.buttonPrimary,
              onClick: () => {
                count.value++;
              },
            },
            DEMO_LABELS.counter(count.value),
          ),
        ],
      );

    return result;

  },
});
/**
 * Render an accessible ragged-grid map with the committed position highlighted.
 */
function CellMap({ grid, position, enabled, onSelect }: CellMapProps) {
  const result = h(DEMO_TEXT.nav, { class: DEMO_TEXT.gridMap, [DEMO_TEXT.ariaLabel]: DEMO_TEXT.cellMapTitle }, [
    h(DEMO_TEXT.div, { class: DEMO_TEXT.gridMapHeader }, [
      h(DEMO_TEXT.h2, DEMO_TEXT.cellMapTitle),
      h(DEMO_TEXT.span, { class: DEMO_TEXT.gridMapLegend }, DEMO_TEXT.currentCellLegend),
    ]),
    h(DEMO_TEXT.p, { class: DEMO_TEXT.hint }, DEMO_TEXT.cellMapHint),
    h(
      DEMO_TEXT.div,
      { class: DEMO_TEXT.gridMapScroll },
      cellMapRows({ grid, position, enabled }).map((cells, row) => h(
          DEMO_TEXT.p,
          {
            key: row,
            class: DEMO_TEXT.gridMapRow,
            [DEMO_TEXT.dataMapRow]: row,
            role: DEMO_TEXT.group,
            [DEMO_TEXT.ariaLabel]: DEMO_LABELS.row(row),
          },
          cells.map((cell) => h(
              DEMO_TEXT.button,
              {
                key: cell.position.col,
                type: DEMO_TEXT.button,
                class: cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell,
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
  ]);

  return result;

}
const App = defineComponent({
  /**
   * Configure component reactivity and pair resource creation with framework cleanup.
   */
  setup() {
    const grid = shallowRef<Grid<string>>(initialGrid);
    const visible = ref(true);
    const position = shallowRef<Position>(INITIAL_POSITION);
    const engine = shallowRef<SwipeEngine<string> | null>(null);
    provide(DEMO_TEXT.context, DEMO_TEXT.vueContextCompositionAPI);
    const EngineView = defineComponent({
      /**
       * Configure component reactivity and pair resource creation with framework cleanup.
       */
      setup() {
        const container = shallowRef<HTMLElement | null>(null);
        const bridge = createVueCellAdapter<string>();
        onMounted(() => {
          if (container.value === null)
            return;

          engine.value = createSwipeEngine({
            container: container.value,
            grid: grid.value,
            initialPosition: INITIAL_POSITION,
            adapter: bridge.adapter,
            onPositionChange: (next) => {
              position.value = next;
            },
            onError: metrics.error,
          });
          metrics.createEngine();
        });
        watch(grid, (next) => {
          engine.value?.updateGrid(next);
        });
        onBeforeUnmount(() => {
          engine.value?.destroy();
          engine.value = null;
          metrics.destroyEngine();
        });
        const result = () => h(Fragment, [
            h(DEMO_TEXT.div, {
              ref: container,
              class: DEMO_TEXT.viewport,
              style: DEMO_GEOMETRY.viewport,
              [DEMO_TEXT.dataDemoContainer]: DEMO_TEXT.empty,
              [DEMO_TEXT.ariaLabel]: DEMO_TEXT.viewportLabel,
            }),
            h(VueCellPortals<string>, {
              bridge,
              renderCell: (item: string, coordinates: Position) => h(Cell, { item, position: coordinates }),
            }),
          ]);

        return result;

      },
    });
    /**
     * Toggle the demo lifecycle and restore initial data before creating another controller.
     */
    function remount() {
      if (!visible.value) {
        grid.value = initialGrid;
        position.value = INITIAL_POSITION;
      }
      visible.value = !visible.value;
    }
    const result = () => h(DEMO_TEXT.main, { class: DEMO_TEXT.container }, [
        h(DEMO_TEXT.a, { href: DEMO_TEXT.homePath }, DEMO_TEXT.demos),
        h(DEMO_TEXT.p, [h(DEMO_TEXT.span, { class: DEMO_TEXT.badge }, DEMO_TEXT.tikiTakiVue3CompositionAPI)]),
        h(DEMO_TEXT.div, { class: DEMO_TEXT.pageHeader }, [h(DEMO_TEXT.h1, DEMO_TEXT.headline)]),
        h(DEMO_TEXT.p, DEMO_TEXT.intro),
        h(DEMO_TEXT.div, { class: DEMO_TEXT.layout, [DEMO_TEXT.dataDemoLayout]: DEMO_TEXT.empty }, [
          h(DEMO_TEXT.div, { class: DEMO_TEXT.viewportColumn }, [
            h(DEMO_TEXT.h3, DEMO_TEXT.liveTitle),
            visible.value ? h(EngineView) : h(DEMO_TEXT.p, { [DEMO_TEXT.dataUnmounted]: DEMO_TEXT.empty }, DEMO_TEXT.destroyedMessage),
          ]),
          h(DEMO_TEXT.aside, { class: DEMO_TEXT.controls }, [
            h(DEMO_TEXT.div, { class: DEMO_TEXT.panel }, [
              h(DEMO_TEXT.h3, DEMO_TEXT.controlsTitle),
              h(DEMO_TEXT.p, [
                h(
                  DEMO_TEXT.output,
                  { class: DEMO_TEXT.positionLabel, [DEMO_TEXT.dataPosition]: DEMO_TEXT.empty },
                  DEMO_LABELS.coordinates(position.value),
                ),
              ]),
              ...controls.map(({ direction, label }) => h(DEMO_TEXT.p, { key: direction }, [
                  h(
                    DEMO_TEXT.button,
                    {
                      key: direction,
                      class: DEMO_TEXT.buttonDefault,
                      [DEMO_TEXT.dataNavigate]: direction,
                      disabled: !visible.value,
                      onClick: () => {
                        void engine.value?.navigate(direction).catch(metrics.error);
                      },
                    },
                    label,
                  ),
                ]),
              ),
              h(DEMO_TEXT.p, [
                h(
                  DEMO_TEXT.button,
                  {
                    [DEMO_TEXT.dataAction]: DEMO_TEXT.goto,
                    class: DEMO_TEXT.buttonPrimary,
                    disabled: !visible.value || !hasNavigationTarget(grid.value),
                    onClick: () => {
                      void engine.value?.goTo(NAVIGATION_TARGET_POSITION).catch(metrics.error);
                    },
                  },
                  DEMO_TEXT.goToTargetLabel,
                ),
              ]),
              h(DEMO_TEXT.p, [
                h(
                  DEMO_TEXT.button,
                  {
                    [DEMO_TEXT.dataAction]: DEMO_TEXT.update,
                    class: DEMO_TEXT.buttonSuccess,
                    disabled: !visible.value,
                    onClick: () => {
                      grid.value = grid.value.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix));
                    },
                  },
                  DEMO_TEXT.updateLabel,
                ),
              ]),
              h(DEMO_TEXT.p, [
                h(
                  DEMO_TEXT.button,
                  {
                    [DEMO_TEXT.dataAction]: DEMO_TEXT.shrink,
                    class: DEMO_TEXT.buttonWarning,
                    disabled: !visible.value,
                    onClick: () => {
                      grid.value = [[DEMO_TEXT.only]];
                    },
                  },
                  DEMO_TEXT.shrinkLabel,
                ),
              ]),
              h(DEMO_TEXT.p, [
                h(
                  DEMO_TEXT.button,
                  {
                    class: visible.value ? DEMO_TEXT.buttonDanger : DEMO_TEXT.buttonSuccess,
                    [DEMO_TEXT.dataAction]: DEMO_TEXT.toggle,
                    onClick: remount,
                  },
                  visible.value ? DEMO_TEXT.destroyLabel : DEMO_TEXT.remountLabel,
                ),
              ]),
              h(DEMO_TEXT.p, { class: DEMO_TEXT.hint }, DEMO_TEXT.counterHint),
            ]),
          ]),
        ]),
        h(DEMO_TEXT.hr),
        h(CellMap, {
          grid: grid.value,
          position: position.value,
          enabled: visible.value,
          onSelect: (target: Position) => {
            void engine.value?.goTo(target).catch(metrics.error);
          },
        }),
      ]);

    return result;

  },
});
const app = createApp(App);
app.config.errorHandler = metrics.error;
app.mount(DEMO_TEXT.appSelector);
