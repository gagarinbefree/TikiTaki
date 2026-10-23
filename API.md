# API

Текущая версия использует функциональные фабрики `createNavigationModel`,
`createGestureEngine`, `createDOMRenderer` и `createSwipeEngine`. Прежние имена
обозначают интерфейсы возвращаемых операций; `DOMRenderer` больше не имеет
параметра типа. Методы используют замыкания и могут вызываться без receiver.
Настройки и строковые токены находятся в src/config.ts; исходные импорты не
содержат .js, а сборка формирует корректные ESM specifiers и declarations.

## Реализовано на этапе 1

Экспорт `tikitaki` предоставляет `NavigationModel` и типы:

```ts
interface Position {
  readonly row: number;
  readonly col: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';
type Grid<T> = readonly (readonly T[])[];
```

`NavigationModel<T>` — синхронная модель, независимая от DOM. Экспорт модели
на этапе alpha не означает готовность контрактов полного SwipeEngine.

| Вызов                                              | Результат                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `createNavigationModel<T>(grid, initialPosition?)` | Проверяет и копирует структуру сетки; по умолчанию `(0, 0)`      |
| `getPosition(): Position`                          | Замороженная текущая позиция                                     |
| `getItem(position): T`                             | Значение ячейки без перемещения                                  |
| `getNeighbor(direction): Position \| null`         | Замороженный сосед либо `null` на границе; состояние не меняется |
| `navigate(direction): boolean`                     | Один соседний переход; `false` на границе                        |
| `goTo(position): boolean`                          | Прямой переход; `false` для текущей позиции                      |
| `updateGrid(grid): void`                           | Атомарная замена сетки и коррекция позиции                       |

## Направления и границы

| Направление свайпа | Допустимая целевая позиция |
| ------------------ | -------------------------- |
| `up`               | `(row + 1, 0)`             |
| `down`             | `(row - 1, 0)`             |
| `left`             | `(row, col + 1)`           |
| `right`            | `(row, col - 1)`           |

На границе полностью сохраняется позиция, включая столбец. Вертикальный
переход не запоминает прежние столбцы. Один вызов `navigate` — максимум одна
соседняя ячейка. `goTo` допускает любой валидный адрес.

## Валидация и владение данными

- Grid — непустой массив непустых массивов, без пропусков индексов.
  `undefined`, `null` и произвольные объекты допустимы как значения `T`.
- Координаты — неотрицательные safe integers в пределах сетки.
- `TypeError`: неверная форма сетки/строки/позиции, пропуски индексов,
  ненумерические координаты или неизвестное направление.
- `RangeError`: пустая сетка/строка, дробные, отрицательные, небезопасные,
  бесконечные координаты, `NaN` или позиция вне сетки.
- Невалидный `goTo`, `getItem`, `navigate` или `updateGrid` не меняет состояние.
- Структура сетки копируется и замораживается. Объекты содержимого сохраняют
  идентичность и остаются под управлением вызывающей стороны.
- Полученную позицию нельзя изменять. Сохранённый снимок позиции не меняется
  при последующих переходах. Экземпляры независимы.

При `updateGrid` сначала валидируется весь новый ввод. После успешной проверки:

```text
row = min(previous.row, newGrid.length - 1)
col = min(previous.col, newGrid[row].length - 1)
```

Это политика коррекции при замене данных; правило `col = 0` относится к успешным
вертикальным переходам, а не к обновлению сетки.

## Gesture Engine — реализовано на этапе 2

Экспортируются `GestureEngine`, замороженный `DEFAULT_GESTURE_OPTIONS` и типы
`GestureOptions`, `GestureContext`, `PointerSample`, `GestureState`, `GestureAxis`,
`GestureOffset`, `GestureSnapshot`, `GestureSettlement`.

```ts
interface GestureContext {
  readonly width: number;
  readonly height: number;
  readonly neighbors: Readonly<Record<Direction, boolean>>;
}

interface PointerSample {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

type GestureState = 'idle' | 'tracking' | 'dragging' | 'settling';
type GestureAxis = 'x' | 'y';

interface GestureOffset {
  readonly x: number;
  readonly y: number;
}

interface GestureSnapshot {
  readonly state: GestureState;
  readonly axis: GestureAxis | null;
  readonly pointerId: number | null;
  readonly offset: GestureOffset;
  readonly destroyed: boolean;
}

interface GestureSettlement {
  readonly direction: Direction | null;
  readonly from: GestureOffset;
  readonly to: GestureOffset;
  readonly duration: number;
}
```

`neighbors` содержит все четыре флага: вычисляйте их через
`model.getNeighbor(direction) !== null`. Размеры — CSS px, конечные числа в
`(0, Number.MAX_SAFE_INTEGER]`. Пока контейнер имеет нулевой размер, владелец
не должен создавать или обновлять контекст жеста.

`x/y` — CSS px (обычно `clientX/clientY`), `time` — монотонные ms (обычно
`PointerEvent.timeStamp`). Координаты конечны и по модулю не больше
`Number.MAX_SAFE_INTEGER`; время в `[0, Number.MAX_SAFE_INTEGER]`.
`pointerId` — неотрицательный safe integer. Тип устройства не влияет на расчёт.
Новый жест может начинаться с новой временной шкалы; внутри жеста более старые
samples игнорируются. Совпадающее время допустимо и не создаёт деления на ноль.

### Параметры

Все поля `GestureOptions` — readonly числа. Конструктор принимает
`Partial<GestureOptions>`; отсутствующие поля берутся из defaults.

| Параметр            | Единицы                                            | Default | Допустимый диапазон   |
| ------------------- | -------------------------------------------------- | ------- | --------------------- |
| `distanceThreshold` | CSS px итогового смещения от начала по locked axis | 80      | Конечное число `> 0`  |
| `velocityThreshold` | CSS px/ms, модуль недавней скорости по locked axis | 0.5     | Конечное число `> 0`  |
| `axisLockThreshold` | CSS px, максимум `abs(dx), abs(dy)`                | 8       | Конечное число `> 0`  |
| `animationDuration` | ms плана завершения/возврата                       | 300     | Конечное число `>= 0` |
| `edgeResistance`    | Безразмерный коэффициент                           | 0.35    | `[0, 1]`              |

Пороги включительны: `abs(delta) >= distanceThreshold` **или**
`abs(velocity) >= velocityThreshold`, при наличии соседа. Используется физическое
смещение, а не сжатое сопротивлением. Итоговое нулевое смещение не переключает
ячейку. Если быстрая недавняя скорость направлена против итогового смещения,
переход отменяется даже при достаточном расстоянии. Медленная коррекция не
отменяет достаточное расстояние. После пересечения начала возможен обратный переход.

Ось фиксируется при достижении axisLockThreshold, когда `abs(dx) != abs(dy)`;
точная диагональ остаётся tracking. Скорость использует текущий отрезок движения
за последние 80 ms с интерполяцией границы окна. На развороте или возобновлении
после неподвижного sample отрезок начинается с предыдущего sample. Пауза перед
pointerup входит в оценку скорости и подавляет старый flick. История ограничена
64 точками и разреживается примерно через 2 ms, а не накапливается за весь жест.

Для доступного соседа drag ограничен одним размером viewport по оси.
На границе: `sign(delta) * extent * edgeResistance * abs(delta) / (extent + abs(delta))`.
Сопротивление непрерывно, симметрично, ограничено `extent * edgeResistance`;
при нуле коэффициента экран неподвижен. Граница никогда не даёт переход.

### Методы и lifecycle

| Вызов                                                      | Результат                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `createGestureEngine(context, options?)`                   | Проверяет и копирует контекст и параметры; состояние idle                                   |
| `getOptions(): Readonly<GestureOptions>`                   | Замороженные фактические параметры                                                          |
| `getSnapshot(): GestureSnapshot`                           | Замороженный снимок; offset тоже заморожен                                                  |
| `pointerDown(sample): boolean`                             | `true`, если начал tracking; при занятости/destroy — `false`                                |
| `pointerMove(sample): boolean`                             | `true`, если sample принят; чужой ID, старое время или отсутствие активного жеста — `false` |
| `pointerUp(sample): GestureSettlement \| null`             | Учитывает финальные координаты; выдаёт план из dragging, tap завершает без плана            |
| `pointerCancel(pointerId): GestureSettlement \| null`      | Для активного ID: возврат dragging через settling, tracking → idle                          |
| `lostPointerCapture(pointerId): GestureSettlement \| null` | Та же семантика, что у pointerCancel                                                        |
| `finishSettling(plan): boolean`                            | Единожды завершает только текущий исходный объект плана                                     |
| `updateContext(context): void`                             | Атомарно заменяет размеры/соседей и сбрасывает активный жест или settling                   |
| `destroy(): void`                                          | Терминальный идемпотентный сброс; освобождает историю и токен                               |

План — замороженный объект и токен завершения одновременно. `direction: null`
означает возврат в `(0, 0)`; иначе target — ровно один размер viewport в сторону
движения. Новые жесты блокируются до `finishSettling(plan)`, в том числе при
`duration: 0`: в этом случае владелец завершает план сразу после получения.
Во время settling `getSnapshot().offset` остаётся `plan.from`; анимационный
прогресс будет хранить renderer. Повторные pointerup/cancel/lost capture в
settling не создают новых планов и не отменяют переход.

`finishSettling` сравнивает объект по ссылке: копия, старый план и план другого
экземпляра возвращают `false`. После валидного updateContext/destroy старый план
тоже возвращает `false`. Уничтоженный движок игнорирует ввод и updateContext;
snapshot показывает idle и `destroyed: true`. Повторная инициализация — новый экземпляр.

`TypeError`: неверная форма объектов, неизвестный option, ненумерический параметр
или sample, отсутствующий/неboolean neighbor. `RangeError`: неконечные числа
(`NaN`, Infinity), значения вне диапазона и неверный pointerId.
Ошибка валидации не меняет состояние. Значения полей options, явно равные
`undefined`, не подменяются defaults. Заблокированный pointerDown и события
без активного жеста игнорируются до валидации; при активном жесте форма sample
валидируется до проверки ID/времени. У cancel/lost capture проверяется ID.

### Граница интеграции

Владелец нормализует Pointer Events и фильтрует неподходящие кнопки/устройства,
берёт capture при принятом pointerdown и освобождает при окончании/отмене.
GestureEngine сам не вызывает DOM APIs и не меняет NavigationModel.

После анимации проверять токен **до изменения модели**:

```ts
if (gesture.finishSettling(plan)) {
  if (plan.direction !== null) {
    model.navigate(plan.direction);
  }
  gesture.updateContext(contextFromModel(model));
}
```

`contextFromModel` — функция владельца, вычисляющая контекст после navigate.
При обновлении сетки
или геометрии владелец согласованно отменяет визуальную транзакцию и capture,
после валидного обновления передаёт новый context. Невалидный context не прерывает
текущий жест. Публичные DOM bindings остаются следующим этапом; renderer описан ниже.

## DOM Renderer — реализовано на этапе 3

Импорт из `tikitaki/dom`: `DOMRenderer`, `createDOMAdapter` и следующие типы.
Headless импорт `tikitaki` не требует DOM libraries в TypeScript consumer.

```ts
interface MountedCell<T> {
  update(item: T, position: Position): void;
  unmount(): void;
}

interface CellAdapter<T> {
  mount(host: HTMLElement, item: T, position: Position): MountedCell<T>;
}

interface NavigationSource<T> {
  getPosition(): Position;
  getNeighbor(direction: Direction): Position | null;
  getItem(position: Position): T;
}

interface RendererSize {
  readonly width: number;
  readonly height: number;
}

interface DOMRendererOptions<T> {
  readonly container: HTMLElement;
  readonly navigation: NavigationSource<T>;
  readonly adapter: CellAdapter<T>;
  readonly onResize?: (size: RendererSize) => void;
}
```

NavigationModel подходит как NavigationSource. Размеры берутся из clientWidth и
clientHeight в CSS px; контейнеру нужно задать размеры в CSS. Нулевой размер
допустим для скрытого контейнера: содержимое монтируется, viewport скрывается,
движение блокируется до положительного resize. Требуется активный документ
Google Chrome с ResizeObserver и requestAnimationFrame.

| Вызов                             | Семантика                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `createDOMRenderer<T>(options)`   | Валидирует источник, монтирует окно, выполняет initial paint, подключает ResizeObserver                  |
| `getSize(): RendererSize`         | Замороженный cached размер; не читает layout                                                             |
| `setOffset(offset): boolean`      | Принимает последнее смещение для следующего RAF; при занятости/hidden/destroy/lifecycle возвращает false |
| `animate(plan): Promise<boolean>` | true после финального кадра, false при невозможности или отмене; без очереди                             |
| `sync(): void`                    | Читает источник, отменяет анимацию, обновляет окно с offset 0 и рисует синхронно                         |
| `reset(): void`                   | Отменяет анимацию/drag, сбрасывает offset и рисует; не вызывает update содержимого                       |
| `destroy(): void`                 | Идемпотентно отменяет RAF/Promise, отключает observer, unmount всех ячеек и восстанавливает контейнер    |

### Координаты и планы

Смещение `GestureOffset` должно быть конечным, по одной оси, не дальше одного
viewport. Невалидные setOffset вызывают TypeError/RangeError до изменения offset.
Pointer moves коалесцируются в один RAF без чтения размеров. В обычных кадрах
settling также выполняются только записи transforms.

`animate` принимает GestureSettlement. Для up target `(0, -height)`, down
`(0, height)`, left `(-width, 0)`, right `(width, 0)`. Это направление движения
экрана: сосед up исходно находится снизу. Для `direction: null` target `(0, 0)`.
From/to должны лежать на одной оси, совпадать с текущей геометрией; duration —
конечное число `>= 0` ms. Отсутствующий сосед даёт false; некорректный план
отклоняет Promise, не нарушая текущий визуальный кадр.

При ненулевой duration первый RAF показывает from, затем `ease(t) = 1 - (1 - t)^3` до to. Duration 0
завершается за один RAF. Promise не меняет NavigationModel: после true владелец
проверяет токен жеста, применяет navigate и вызывает renderer.sync(). Выживший
целевой host сохраняется и оказывается в `(0, 0)` без повторного mount.

Во время анимации другой animate возвращает false, setOffset — false. Любые
reset/sync/destroy и фактический resize завершают pending Promise с false.
После true target остаётся нарисованным до sync/reset. Новые жесты до commit
должен блокировать владелец/GestureEngine. После destroy sync/reset — no-op,
движение/анимация возвращают false, getSize возвращает последний снимок.

### Окно и владение DOM

Renderer хранит максимум пять hosts keyed по координатам. Не создаёт
несуществующих соседей; вертикальные адреса всегда `(row ± 1, 0)`. Сохранившиеся
hosts получают handle.update при каждом sync, даже если item не сменил identity;
ушедшие handle.unmount вызываются перед удалением host. Mount/update/unmount
синхронны, позиции заморожены. Адаптер владеет потомками host и освобождает свои
подписки и framework-ресурсы. Renderer потомков не очищает и не стилизует.

Shell role/inert/aria-hidden выставляются до mount/update; соседние ячейки inert
и скрыты от accessibility tree. При продвижении соседа его содержимое остаётся
в том же host. Render callbacks не должны менять принадлежащие renderer
свойства shell. Вызовы setOffset/animate из lifecycle блокируются; рекурсивный
sync вызывает исключение. Destroy разрешён и остаётся идемпотентным.

`createDOMAdapter(renderCell)` — удобный адаптер для обычного HTML. Callback
возвращает отдельный HTMLElement: mount вставляет его, update заменяет результат,
unmount удаляет. Возврат того же своего элемента допустим; уже принадлежащий
другому DOM-дереву элемент отклоняется. Это не способ преобразования
Vue/React-компонентов: для них нужен отдельный CellAdapter.

Renderer добавляет одну собственную viewport-оболочку и сохраняет прочих детей
контейнера. Position меняется на relative только для static контейнера;
overflow/touch-action задаются локально. Destroy восстанавливает исходные
inline значения и priorities только если свойство всё ещё равно установленному
движком: пользовательские изменения сохраняются. Глобальные styles не меняются.
Конкурирующие renderers одного контейнера запрещены; после destroy можно создать новый.

### Resize и ошибки

ResizeObserver только планирует кадр. В нём читается размер, пересчитываются
позиции, сбрасывается offset, отменяется анимация и затем вызывается onResize
с замороженным размером. Повторные уведомления коалесцируются, неизменившийся
размер не прерывает анимацию. Владелец должен сбросить GestureEngine и capture
при изменении геометрии. При нулевом размере нужно приостановить ввод; не
передавать нулевые размеры в GestureEngine (его контекст требует положительных
значений). После появления контейнера можно обновить контекст и продолжить.

Невалидная форма options/source/adapter вызывает TypeError; неверные адреса
соседей или геометрия — RangeError. Полный снимок source читается до изменений:
ошибка чтения/валидации при sync сохраняет прежнее визуальное состояние и Promise.
Ошибки lifecycle после начала reconciliation приводят к destroy окна и пробрасываются.
Все unmount выполняются даже при исключениях, после чего cleanup может бросить
AggregateError. Если mount бросает до возврата handle, он обязан сам освободить
созданные внешние ресурсы; renderer в любом случае удаляет свою оболочку.
Исключение onResize также приводит к cleanup и пробрасывается в RAF.

Renderer не подписывается на pointer events и не управляет capture. Эти ресурсы
принадлежат SwipeEngine.

## SwipeEngine: этап 4

`import { createSwipeEngine, type SwipeEngineOptions } from 'tikitaki/dom'`.
Фабрика связывает независимые слои; `tikitaki` остаётся без DOM declarations.

```ts
interface SwipeEngineBaseOptions<T> {
  readonly container: HTMLElement;
  readonly grid: Grid<T>;
  readonly initialPosition?: Position;
  readonly gesture?: Partial<GestureOptions>;
  readonly onPositionChange?: (position: Position, previous: Position) => void;
  readonly onError?: (error: Error) => void;
}

type SwipeEngineOptions<T> = SwipeEngineBaseOptions<T> &
  (
    | { readonly renderCell: (item: T, position: Position) => HTMLElement; readonly adapter?: never }
    | { readonly adapter: CellAdapter<T>; readonly renderCell?: never }
  );
```

Нужен HTMLElement из активного документа с Pointer Events/capture, RAF и
ResizeObserver. Один контейнер принадлежит одному renderer/движку. Размеры
задаются снаружи через CSS. Нулевой размер допустим: ввод и анимированная
навигация приостановлены до положительного resize. Настройки жестов и defaults
совпадают с GestureEngine. Сетка и координаты валидируются моделью.

Передать ровно один из `renderCell` или `adapter`; это проверяется в TypeScript
и runtime. `renderCell` использует обычный DOM-адаптер, который может заменять
содержимое при sync. Для сохранения собственного состояния используйте CellAdapter.
Framework-specific компоненты требуют mount/update/unmount своего фреймворка.

| Метод                                   | Семантика                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `getPosition(): Position`               | Замороженная последняя успешно показанная позиция, доступна после destroy                    |
| `navigate(direction): Promise<boolean>` | Анимация к одному соседу; позиция меняется после последнего кадра и sync                     |
| `goTo(position): Promise<boolean>`      | Немедленный переход к любой допустимой позиции без анимации; работает и при нулевых размерах |
| `updateGrid(grid): void`                | Синхронная замена сетки и sync; сохраняет допустимые координаты, иначе ограничивает row/col  |
| `destroy(): void`                       | Терминальная идемпотентная очистка, без callback позиции                                     |

### Promise, занятость и обновление данных

`true` означает успешное изменение позиции и DOM с завершённым callback.
`false` означает границу, ту же позицию, занятость, отмену или destroy.
`navigate` также возвращает false для нулевого viewport. Новые команды не ставятся
в очередь во время tracking/dragging/settling или структурного изменения.
Невалидные аргументы живого движка отклоняют Promise даже при занятости;
проверка не прерывает текущий жест/переход.

`updateGrid` сначала полностью валидирует новую сетку. Невалидная замена бросает
исключение и сохраняет текущую транзакцию. Валидная отменяет анимацию с false,
освобождает capture, сбрасывает жесты и синхронизирует DOM. Callback вызывается
только при изменении координат; смена содержимого на прежних координатах не вызывает его.
Вызов updateGrid из adapter lifecycle запрещён и бросает исключение.

Resize отменяет текущую транзакцию с false, сбрасывает offset/capture/жест,
обновляет геометрию без перехода и callback. После destroy navigate/goTo дают
false, updateGrid ничего не делает; валидация новых аргументов уже не выполняется.
Все незавершённые Promise завершаются при отмене/destroy; поздний кадр не может
зафиксировать старый переход поверх нового.

### Callbacks и ошибки

Callbacks синхронные. onPositionChange вызывается после успешного sync DOM и
снятия блокировки: можно сразу вызвать navigate/goTo/updateGrid/destroy.
При создании движка и возврате отменённого жеста callback не вызывается.
Исключение callback не откатывает уже показанную позицию: исходный Promise
отклоняется, а следующая операция продолжает работать. Для updateGrid оно
пробрасывается синхронно. Асинхронные callbacks не ожидаются.

Ошибка adapter lifecycle во время изменения приводит к destroy с освобождением
всех доступных ресурсов и отклонению операции; getPosition сохраняет последнюю
успешную позицию. Ошибки cleanup могут объединяться в AggregateError.
Ошибка конструктора очищает уже созданные ресурсы перед исключением.
Программные navigate/goTo возвращают ошибки через Promise, updateGrid/destroy
бросают синхронно. В обработчиках Pointer Events ошибки передаются onError;
по умолчанию — window.reportError (либо ErrorEvent). Исключение самого onError
передаётся этому же стандартному механизму.

### Pointer Events и cleanup

Принимаются primary mouse/touch/pen с основной кнопкой; повторное касание
не заменяет активное. Capture ставится на исходный Element, сохраняя нативный
tap/click кнопок. В dragging подавляются случайный pointer click, выделение и
native drag; keyboard click с detail 0 сохраняется. Дочерние вложенные движки
владеют своими событиями через composedPath и локальный data-tikitaki-engine.

pointercancel/lostpointercapture запускают возврат без изменения позиции.
Window listeners дополнительно проверяют capture при move/up/cancel, включая
удаление захватившего элемента до первого движения. При destroy удаляются
контейнерные и window listeners, capture, RAF, observer, hosts и ссылки на
callbacks/adapter/модель. Локальные styles и marker восстанавливаются, если
пользователь их не изменил. После destroy можно создать новый экземпляр.

## Framework adapters: этап 5

Это отдельные необязательные пакеты: `@tikitaki/react` и `@tikitaki/vue`.
Они объявляют framework/core peer dependencies и не входят в `tikitaki` exports
или runtime/peer dependencies. ESM и declarations собираются в packages/*/dist.
Примеры и lifecycle: [React](./packages/react/README.md),
[Vue](./packages/vue/README.md); работающие demos — в demos/react и demos/vue.

| Экспорт                                                  | Контракт                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `createReactCellAdapter<T>(): ReactCellBridge<T>`        | Создаёт adapter и внешний snapshot store для одного engine view   |
| `ReactCellPortals<T>({ bridge, renderCell }): ReactNode` | useSyncExternalStore + portals в hosts, внутри родительского root |
| `createVueCellAdapter<T>(): VueCellBridge<T>`            | Создаёт adapter и readonly shallowRef cells                       |
| `VueCellPortals<T>({ bridge, renderCell }): VNodeChild`  | Функциональный Vue-компонент, который создаёт Teleport в hosts    |

React bridge имеет readonly `adapter`, `getSnapshot()` и `subscribe(listener)`.
Subscribe возвращает идемпотентный unsubscribe. Vue bridge имеет readonly
`adapter` и `cells: Readonly<ShallowRef<readonly VueCell<T>[]>>`.
Запись ячейки содержит readonly `key`, `host: HTMLElement`, `item: T`, `position`.
Массивы, записи и скопированные позиции заморожены; item сохраняет identity и
может быть изменяемым. Vue не оборачивает hosts/items в proxy.

Один bridge относится к одному экземпляру движка и одному Portals-компоненту.
Создавайте bridge один раз через useState factory или в setup. Передавайте
`bridge.adapter` в SwipeEngine вместо renderCell; framework renderCell передаётся
Portals-компоненту и возвращает ReactNode/VNodeChild. Контейнер должен быть без
framework children; framework управляет только потомками предоставленных hosts.

mount регистрирует host с новым ключом, update сохраняет ключ и component state,
unmount удаляет запись. Повторный unmount и update старого handle ничего не делают.
Повторный mount того же host после unmount получает новый ключ. Одновременный
дублирующий mount host вызывает TypeError. Исчезнувшие соседи освобождаются,
сохранившиеся координаты получают новые props без принудительного remount.

Переход и destroy синхронизируют shells и adapter snapshots синхронно, а framework
content/lifecycle — в framework commit. Для assert содержимого используйте async
act в React и nextTick в Vue после engine Promise. Promise ядра не гарантирует
завершения framework effects. Не вызывайте hooks прямо в renderCell: возвращайте
дочерний компонент. Внешний provider/контекст сохраняется через portals/Teleport.

React error boundaries и Vue errorHandler/onErrorCaptured обрабатывают ошибки
рендеринга/effects компонентов. Они не перехватываются engine.onError, поскольку
выполняются вне синхронного CellAdapter lifecycle. Владелец UI обязан вызывать
engine.destroy при cleanup; удаление одного Portals-компонента не уничтожает engine.
При обновлении props grid вызывайте updateGrid, не пересоздавайте engine на каждый
render. Vue engine храните в shallowRef, для явного владения ресурсом.
SSR не создаёт DOM engine; установка выполняется в useEffect/onMounted.

## Mouse wheel navigation

The DOM controller handles vertical wheel input only inside its owned cell viewport.
Positive deltaY navigates to the next row; negative deltaY navigates to the previous
row. Successful row changes reset col to zero; boundaries preserve the entire position.
Each wheel burst starts at most one transition. A quiet interval of 160ms separates
bursts (WHEEL_IDLE_MS in src/config.ts), and conflicting pointer gestures or settling
transitions block wheel navigation without queuing. Delta units do not affect direction.
The page does not scroll while vertical wheel input is consumed over the viewport,
including at boundaries. Outside the viewport, page and map scrolling remain native.
Horizontal gestures, Shift-wheel, Ctrl/Meta-wheel zoom, and events already cancelled
by child content are ignored. destroy() removes the non-passive wheel listener.
