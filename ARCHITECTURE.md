# Архитектура TikiTaki

Текущая реализация функциональная: createNavigationModel/createGestureEngine/
createDOMRenderer/createSwipeEngine возвращают readonly интерфейсы операций.
Состояние ядра и адаптеров изолировано в замыканиях, классов и this в них нет.
Angular demo использует стандартные standalone component classes; это локальное
исключение, которое не распространяется на ядро или другие адаптеры.
События и API-функции сохраняют владение состоянием при отдельном вызове.
Публичные фабрики и операции документированы английским JSDoc.

Значения по умолчанию, протокольные строки, DOM-атрибуты и сообщения находятся
в src/config.ts; demos/config.ts содержит данные/подписи demos, tooling.config.mjs —
форматирование и браузерные/серверные настройки. Source imports без .js проверяются
ESLint; build-time TypeScript transformers формируют корректные runtime ESM и .d.ts.
Форматирование выполняет стандартный Prettier 3.9.10 без дополнительных преобразований.
Прежние правила оформления return, if, импортов и сигнатур отменены.

Статус: реализованы этапы 1–5 — модель, Gesture Engine, DOM Renderer, SwipeEngine
и изолированные React/Vue адаптеры с demos.
Обязательная спецификация —
[AGENTS.md](./AGENTS.md); этот документ её дополняет.

## Слои и зависимости

1. **Navigation Model**: данные ragged grid, валидация, текущая позиция,
   допустимые соседи, синхронные переходы, атомарное обновление сетки.
   Не использует DOM, время, события, RAF или фреймворки.
2. **Gesture Engine**: автомат `idle → tracking → dragging → settling → idle`.
   Получает координаты, pointer ID и монотонные timestamps; фиксирует ось после
   dead zone, оценивает расстояние и скорость с учётом смены направления.
   Отдаёт намерение перехода и смещение. DOM-подписки — на границе системы.
3. **DOM Renderer**: владеет контейнером, внешними оболочками ячеек, геометрией,
   RAF и `translate3d`. Текущая ячейка и максимум четыре существующих соседа.
   Вертикальные соседи всегда указывают на столбец 0. ResizeObserver обновляет
   геометрию; чтения размеров отделены от записей transforms.
4. **SwipeEngine**: связывает модель, жесты и renderer; управляет транзакцией
   анимации, callback, `updateGrid`, отменой и идемпотентным `destroy`.
5. **Framework adapters**: отдельные необязательные пакеты/entry points с peer
   dependencies. Ядро не импортирует React/Vue.

Зависимости направлены от оркестратора к независимым слоям. Singleton нет:
каждый экземпляр владеет своим состоянием и ресурсами.

## Владение содержимым

Результат этапа 5: отдельные пакеты @tikitaki_gagarinbefree/react и @tikitaki_gagarinbefree/vue. Адаптер хранит
только снимок текущих hosts и CellAdapter handles; содержимое рендерится
родительским React root через portals либо родительским Vue-приложением через
Teleport. Общий контракт mount/update/unmount не требует root на каждую ячейку.
Factory создаётся один раз на экземпляр UI; engine создаётся в effect/onMounted,
cleanup вызывает destroy. Изменение grid проходит через updateGrid.
Lifecycle-тесты написаны и запущены до реализации (23 failed, 261 passed),
затем GREEN и REFACTOR (284 passed).
Framework reconciliation асинхронна: после core Promise нужен framework tick,
если вызывающему требуется уже обновлённое содержимое компонентов.

Реализованный контракт CellAdapter: `mount(host, item, position) → handle`,
`handle.update(item, position)`, `handle.unmount()`. Renderer управляет только
оболочкой `host`; дочерним деревом управляет адаптер. `createDOMAdapter(renderCell)` —
упрощённый адаптер для обычного DOM. Контракт и lifecycle закреплены тестами.

React: useSyncExternalStore подписывается на immutable snapshot. ReactCellPortals
создаёт portals с устойчивыми ключами в существующие hosts; родительский context
и component state сохраняются. Vue: shallowRef хранит immutable snapshot без
proxy DOM/items, VueCellPortals рендерит Teleport с сохранением provide/inject.
Связь содержимого с родительским деревом описана в официальной документации
[React portals](https://react.dev/reference/react-dom/createPortal) и
[Vue Teleport](https://vuejs.org/guide/built-ins/teleport.html).
Один bridge относится к одному engine view и одному компоненту Portals.
Surviving hosts сохраняют ключ; после unmount повторный mount получает новый.
Unmount идемпотентен, stale update не восстанавливает удалённый компонент.

Cleanup парно освобождает каждый mount. StrictMode проверяется unit-тестами и
реальным Chrome с development React через Vite: setup → cleanup → setup оставляет
один engine. При production build React development replay отсутствует.
Framework render/effect errors принадлежат ErrorBoundary/Vue errorHandler,
а не синхронному adapter.mount: ядро не запускает reconciliation фреймворка.
После удаления shell framework завершает unmount своего дерева на следующем tick.

## Зафиксированные решения модели

- Сетка непустая, строки непустые, массивы без пропусков. Значение `undefined`
  допустимо как содержимое при соответствующем `T`.
- Модель копирует и замораживает массивы и позиции. Содержимое `T` не клонирует
  и не замораживает: его жизненным циклом владеет вызывающая сторона.
- Один `navigate` меняет ровно одну координатную пару. Успешный вертикальный
  переход всегда устанавливает `col = 0`; неуспешный сохраняет всю позицию.
- `getNeighbor` только вычисляет соседа. Возвращает `null` на границе.
- `goTo` синхронно устанавливает валидную позицию, без анимации; та же позиция
  возвращает `false`. Невалидный ввод вызывает исключение до изменения состояния.
- `updateGrid` сначала валидирует и копирует все данные. Затем сохраняет позицию,
  если возможно, иначе ограничивает row последней строкой, col последним
  столбцом выбранной строки. Это коррекция данных, а не вертикальный свайп.

## Зафиксированные решения Gesture Engine

`GestureEngine` принимает снимок размеров viewport и доступности соседей, а не
ссылку на NavigationModel. Методы принимают нормализованные pointer samples
(`pointerId`, `x`, `y`, `time`). DOM, PointerEvent, capture, RAF и таймеров в этом
слое нет. SwipeEngine привязывает мышь, touch и перо через Pointer Events.

- Состояние вычисляется из активного жеста, зафиксированной оси и плана settling.
  Второе касание не заменяет первое. При settling все pointer-события игнорируются.
- Dead zone задаётся в CSS px по максимуму модулей dx/dy. После достижения порога
  фиксируется преобладающая ось. При точном равенстве движок остаётся в tracking.
  Позднейшие диагонали не меняют ось. Учитываются и финальные координаты pointerup.
- Для доступного соседа смещение ограничивается одним размером viewport.
  На границе используется непрерывное насыщающееся сопротивление:
  `sign(delta) * extent * edgeResistance * abs(delta) / (extent + abs(delta))`.
- Скорость считается по текущему отрезку движения за последние 80 мс с линейной
  интерполяцией границы окна. Разворот или возобновление движения после неподвижного
  sample начинает новый отрезок от предыдущего sample. Хранятся разреженные по
  времени точки (интервал около 2 мс), максимум 64. Пауза перед отпусканием гасит
  скорость; равные timestamps не приводят к делению на ноль, старые игнорируются.
- Переход возможен по расстоянию или скорости. Быстрая скорость против итогового
  смещения отменяет переход по расстоянию. После пересечения начала жеста возможен
  переход в обратную сторону; при нулевом итоговом смещении перехода нет.
- Завершение dragging выдаёт замороженный план `{ direction, from, to, duration }`.
  `direction: null` означает возврат. Модель сетки не меняется. Snapshot во время
  settling хранит начальное смещение плана, а не прогресс будущего renderer.
- Сам объект плана — токен: `finishSettling(plan)` принимает только текущий объект
  исходного экземпляра и только один раз. Ни копия, ни старый план, ни план другого
  экземпляра не подходят. Это предотвращает завершение новой анимации старым callback.
- `pointercancel` и `lostpointercapture` возвращают dragging к началу через settling;
  tracking завершается сразу. Потеря capture после pointerup не отменяет готовый план.
- Валидный `updateContext` сбрасывает жест/settling и инвалидирует токен; невалидный
  сохраняет всё состояние. Владелец должен согласованно отменить визуальную транзакцию
  и capture при замене сетки или геометрии. Resize/анимации проверяются на этапе renderer.
- `destroy` терминален и идемпотентен: очищает историю и план, дальнейшие операции
  ввода игнорируются. Для повторной инициализации создаётся новый экземпляр.

Параметры и точный контракт описаны в [API.md](./API.md). Константы defaults
заморожены; общее изменяемое состояние отсутствует. Все внешние структуры копируются,
движок не хранит пользовательских callbacks или framework-объектов.

## Зафиксированные решения DOM Renderer

Отдельный entry point `tikitaki/dom` экспортирует renderer и общий адаптер.
Headless entry point не ссылается на DOM declarations и импортируется в Node без
DOM globals. Оба entry points остаются без runtime dependencies.

- Read-only `NavigationSource` содержит getPosition/getNeighbor/getItem.
  Renderer не вызывает navigate/updateGrid. Владелец изменяет модель и вызывает sync.
- Окно keyed по `(row, col)`: текущая ячейка и до четырёх валидных соседей.
  Уходящие клетки unmount до новых mount, выжившие hosts сохраняются, содержимое
  получает update даже при прежней идентичности item. Вертикальные соседи — col 0.
- Renderer владеет одной локальной viewport-оболочкой и внешними cell hosts.
  Он меняет их transforms, role/inert/aria-hidden; потомки принадлежат адаптеру.
  Новый role и inert устанавливаются до вызова update. Framework DOM не трогается.
- Initial paint, sync и forced reset выполняются синхронно. Следование указателю
  коалесцируется в один RAF; settling интерполирует translate3d с cubic ease-out.
  RAF имеет epoch: отменённый callback не может изменить следующую анимацию.
- animate возвращает true после последнего кадра. Занятость, отсутствие соседа,
  нулевой viewport, resize, reset, sync и destroy дают false. Невалидный план
  отклоняет Promise. setOffset/animate блокируются внутри lifecycle адаптера.
- Размеры clientWidth/clientHeight читаются при создании и в одном RAF после
  ResizeObserver; pointer updates и кадры анимации не читают layout. Resize
  сбрасывает визуальный offset, отменяет анимацию, затем вызывает onResize.
  Скрытый viewport (0 × 0) поддерживается и активируется после положительного resize.
- Статическое/непозиционированное содержимое получает position: relative;
  overflow: hidden и touch-action: none ставятся только на контейнере. Исходные
  inline значения/приоритеты восстанавливаются, если владелец их не изменил.
  Чужие дочерние элементы контейнера сохраняются. Один контейнер — один renderer.
- Ошибка adapter mount/update/unmount прерывает работу и очищает окно; destroy
  пытается выполнить весь cleanup даже после исключений и собирает AggregateError.
  Pending Promise завершается до cleanup. Ссылки на source/adapter/DOM/callback
  освобождаются. У adapter.mount есть обязанность откатить собственные ресурсы,
  если он бросил исключение до возврата handle.

Проверки: jsdom с управляемыми RAF/ResizeObserver и настоящий Google Chrome
Desktop/touch emulation. Отдельные browser fixtures проверяют renderer с тестовой
обвязкой и опубликованный SwipeEngine. Framework lifecycle дополнительно
проверяется на этапе 5 в unit/integration и Chrome demos.

## Зафиксированные решения SwipeEngine

- `navigate/goTo: Promise<boolean>`: `true` только после завершённого перехода;
  `false` для границы, той же позиции, занятости, отмены или уничтоженного движка.
  Невалидные аргументы отклоняют Promise; скрытой очереди команд нет.
- `navigate` анимирует одного соседа, `goTo` мгновенно показывает произвольную
  допустимую позицию. Последний работает и в скрытом контейнере; ввод и navigate
  при нулевом viewport приостановлены. Размеры жестов обновляются после resize.
- Во время tracking/dragging/settling и структурного обновления новые жесты и
  программные переходы получают занятость. Очереди нет.
- У транзакции собственный Promise и identity token. Отмена завершает Promise
  сразу с false; поздний результат renderer не может завершить новую транзакцию.
- Позиция фиксируется после успешного завершения анимации и sync DOM. Callback
  вызывается после снятия блокировки и может начать следующую операцию. Его ошибка
  отклоняет только исходный Promise после commit, не отменяя следующую транзакцию.
  Ошибки adapter lifecycle приводят к cleanup; сохраняется последняя успешная позиция.
- `updateGrid` валидирует данные до отмены текущей анимации; после успешной
  валидации отменяет транзакцию с `false`, корректирует позицию и обновляет DOM.
- `destroy` отменяет RAF, observer, pointer capture и listeners, размонтирует
  содержимое, завершает все pending Promise с `false`, восстанавливает стили.
- Захват ставится на исходный Element из composedPath: обычные taps сохраняют
  нативный click на кнопке. После drag подавляется pointer click, keyboard click
  сохраняется. Вложенный движок владеет своими событиями; общий singleton отсутствует.
- Window capture listeners проверяют pointer capture даже вне контейнера. Удаление
  исходного элемента до gotpointercapture может не дать lostpointercapture в Chrome;
  дополнительная проверка соединения и hasPointerCapture отменяет такой жест.
- Ошибки асинхронной pointer-операции передаются в onError, по умолчанию reportError.
  Ошибки программных команд возвращаются вызывающему через Promise.

## Этапы и TDD

Каждый этап — отдельное обозримое изменение. До реализации поведения:
тесты → фактически наблюдаемый RED → минимальный GREEN → REFACTOR → повторная
проверка. Нельзя считать отсутствие модуля достаточным доказательством
поведенческого RED: при необходимости используется временная заглушка контракта.

1. **Готово:** структура, инструменты, модель навигации, unit и интеграционный
   сценарий, ESM + declarations, проверка потребления пакета.
2. **Готово:** Gesture Engine, пороги, скорость, axis lock, сопротивление, отмены,
   повторные pointer samples; единицы, диапазоны и defaults закреплены тестами.
3. **Готово:** DOM Renderer: ограниченное окно ячеек, адаптер mount/update/unmount,
   RAF-анимации, resize, возврат и cleanup.
4. **Готово:** публичный SwipeEngine: Pointer Events, capture, Promise semantics,
   updateGrid, несколько экземпляров, destroy и повторная инициализация.
5. **Готово:** Vue 3 и React: изолированные адаптеры, рабочие Vite demos,
   lifecycle, сохранение context/state и StrictMode.
6. Playwright с `channel: 'chrome'`: mouse/touch, реальные transforms и
   анимации, отмены и быстрые жесты, demos, console errors; полный build и аудит
   пакета. Физический Android — отдельная ручная проверка.

Chrome E2E включает production demos и проверку development lifecycle.
Физический Android не проверен и пока отложен по решению пользователя.
Пакеты остаются private alpha; фактические проверки и ограничения — в TESTING.md.

## Svelte and Angular ownership

Svelte cells subscribe to immutable store snapshots and remain keyed descendants
of one parent application. A portal action moves only their owned wrappers.
Angular cells are embedded template views attached through the parent
ViewContainerRef; the adapter updates view context and destroys each view once.
Both preserve framework context and component state, and neither creates a root
per cell. Optional peer dependencies are isolated in their adapter packages.
The Angular demo is AOT compiled with ngc and its libraries use the official linker.
