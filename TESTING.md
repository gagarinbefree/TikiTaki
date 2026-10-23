# Проверки и TDD

## Правило работы

Перед реализацией каждого модуля писать тесты, фактически наблюдать RED,
реализовывать минимальный GREEN, выполнять REFACTOR и повторять проверки.
Импорт отсутствующего файла не считается достаточным поведенческим RED.
Результаты непрогнанных тестов нельзя объявлять успешными.

## Команды проверки

| Команда                | Назначение                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `npm ci`               | Воспроизводимая установка devDependencies из lockfile      |
| `npm test`             | Vitest: unit и сценарий взаимодействия методов модели      |
| `npm run typecheck`    | Все TS-файлы, strict и дополнительные флаги спецификации   |
| `npm run lint`         | ESLint с strict type-aware правилами и projectService      |
| `npm run format:check` | Prettier; обязательный AGENTS.md исключён из перезаписи    |
| `npm run build`        | Production ESM и `.d.ts` через TypeScript                  |
| `npm run test:package` | Build, npm pack, установка tarball и отдельный TS consumer |
| `npm run test:browser` | Build и Playwright: Google Chrome desktop/touch            |
| `npm run check`        | Все перечисленные проверки, кроме установки                |

Vitest загружает TypeScript-конфигурацию через `--configLoader native` на Node 24.
При полном прогоне стандартный bundler конфигурации Vite получил `spawn EPERM`
при попытке вызвать Windows `net use`. Нативная загрузка не требует этого шага;
с ней все 84 теста прошли. В watch-режиме после изменения конфигурации нужно
перезапустить Vitest.

Проверка пакета создаёт отдельный проект в `.artifacts/package-*/consumer`,
устанавливает tarball offline и компилирует с `types: []`, без paths aliases.
Проверяет реальный ESM import, readonly-контракты и отсутствие runtime/peer
dependencies. В consumer node_modules должен оказаться только TikiTaki.
Дополнительно проверяет specifiers статических ESM imports production-модулей
и отсутствие динамических imports/require. Это проверка текущей простой ESM
сборки; финальный bundle потребует повторного аудита на последнем этапе.

## Фактический цикл модели, 21 октября 2026

Среда: Windows, Node.js `24.15.0`, npm `11.12.1`.

1. Написаны unit-тесты и сценарий `A10 → B1 → C1 → C2 → B1 → A1`.
2. **RED:** временный контракт класса бросал `Error`; импорт работал, тесты
   выполнялись. Команда ниже завершилась с exit code 1: **84 failed, 0 passed**.
3. **GREEN:** после реализации та же команда с green filename завершилась
   с exit code 0: **84 passed**.
4. **REFACTOR:** расчёт соседа выделен в чистую функцию, runtime validation
   принимает `unknown` внутри реализации. Повторный запуск: **84 passed**.

```sh
npm test -- --reporter=json --outputFile=.artifacts/tdd-navigation-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-navigation-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-navigation-refactor.json
```

JSON-отчёты сохраняются локально в `.artifacts/`; они не входят в пакет.
При первом запуске дополнительных проверок обнаружены и исправлены ошибки
типов в тестах и замечания ESLint.

Покрыты четыре направления, вертикальные переходы из каждого столбца,
все границы, одиночные строки и сетка, прямые переходы, чтение ячеек,
валидация формы и координат, защита структуры от внешних мутаций,
immutable позиции, независимость экземпляров и атомарный updateGrid с clamp.
Интеграционный сценарий этого этапа относится только к модели.

## Итог проверок первого этапа

| Фактически выполненная проверка              | Результат                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `npm test`                                   | PASS, 2 файла, 84 теста                                                |
| `npm run typecheck`                          | PASS                                                                   |
| `npm run lint`                               | PASS, 0 warnings                                                       |
| `npm run format:check`                       | PASS                                                                   |
| `npm run build`                              | PASS, ESM и declarations                                               |
| `npm pack --ignore-scripts`                  | PASS, без bundled dependencies                                         |
| Offline install tarball в отдельный consumer | PASS, установлен только TikiTaki                                       |
| TypeScript consumer и runtime ESM import     | PASS; readonly и Direction проверены через `@ts-expect-error`          |
| `npm run check`                              | Не завершился: `spawn EPERM` при запуске дочерних процессов Vitest     |
| `npm run test:package` целиком               | Не завершился: `spawnSync node.exe EPERM` при запуске npm pack из Node |

Составные команды не объявляются прошедшими. В этой среде запуск дочерних
процессов ограничен; самостоятельный `npm test` проходит. Проверка пакета
фактически выполнена по шагам, включая компиляцию consumer, исполнение ESM и
аудит зависимостей. Для воспроизведения из корня проекта:

```sh
npm run build
node scripts/check-package.mjs prepare
npm pack --ignore-scripts --pack-destination .artifacts --cache .artifacts/npm-cache
cd .artifacts/package-manual/consumer
npm install ../../tikitaki-0.1.0-alpha.0.tgz --offline --ignore-scripts --no-audit --no-fund --cache ../../npm-cache
cd ../../..
node node_modules/typescript/bin/tsc -p .artifacts/package-manual/consumer/tsconfig.json
node node_modules/typescript/bin/tsc -p .artifacts/package-manual/consumer/tsconfig.dom.json
node scripts/check-package.mjs verify
```

Здесь filename соответствует текущей версии `0.1.0-alpha.0`. Режим `prepare`
создаёт fixture; режим `verify` требует предварительно установить пакет и
скомпилировать fixture. Полный режим `npm run test:package` автоматизирует те же
шаги в новой временной директории, когда среда разрешает дочерние процессы.
Его успешный запуск целиком в текущей среде не подтверждён.

## TDD Gesture Engine, этап 2

Добавлены 86 тестов: unit для автомата жестов и интеграционные сценарии с
NavigationModel. До реализации создана временная заглушка с реальными типами и
методами, бросающими Error. Импорты работали, все тесты выполнялись.

| Фаза                          | Фактически наблюдаемый результат                                |
| ----------------------------- | --------------------------------------------------------------- |
| RED                           | Exit 1; 86 новых failed, 84 прежних passed                      |
| Первый запуск реализации      | 169 passed, 1 failed: отрицательный ноль при edgeResistance = 0 |
| GREEN после нормализации нуля | Exit 0; 170 passed                                              |
| REFACTOR                      | Exit 0; 170 passed                                              |

```sh
npm test -- --reporter=json --outputFile=.artifacts/tdd-gesture-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-gesture-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-gesture-refactor.json
```

При рефакторинге обработка истории движения и расчёт смещения выделены в
функции; состояние автомата стало вычисляемым из активного жеста/плана, чтобы
исключить рассинхронизацию дублирующего поля. Сценарии интеграции используют
публичные экспорты из index. Новые runtime-зависимости не добавлены.

Проверяются idle/tracking/dragging/settling, dead zone, точная диагональ,
axis lock, четыре направления, финальные координаты pointerup, tap,
медленный длинный и быстрый короткий свайп, включительные пороги, пауза,
равные и старые timestamps, быстрый/медленный разворот, пересечение начала,
упругое сопротивление, нулевые параметры, максимум один viewport,
события других pointers, повторные down/up, блокировка settling, cancel,
lost capture до/после pointerup, неизменяемость snapshots/plans, токены других
экземпляров и устаревшие завершения, 100 повторных жестов, destroy в трёх
состояниях, повторная инициализация, валидация и атомарная замена контекста.

Один и тот же линейный flick проверяется при 2, 16, 256 и 4096 samples.
Интеграция проверяет `A10 → B1 → C1 → C2 → B1 → A1`, сохранение столбца
на вертикальной границе, ограничения B1, один отложенный commit даже при
огромном смещении, обновление сетки во время settling и отмену старого токена.
Это тесты нормализованных samples, не реальные DOM Pointer Events.

| Проверка этапа 2                         | Результат                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Vitest после REFACTOR                    | PASS, 4 файла, 170 тестов (84 прежних + 86 новых)                        |
| `npm run typecheck`                      | PASS                                                                     |
| `npm run lint`                           | PASS, 0 warnings                                                         |
| `npm run format:check`                   | PASS                                                                     |
| `npm run build`                          | PASS, ESM и `.d.ts`, включая Gesture Engine                              |
| `npm run test:package` целиком           | Exit 1: `spawnSync node.exe EPERM` при запуске npm pack                  |
| Проверка пакета по шагам из раздела выше | PASS: pack, offline install, strict TS, ESM runtime и аудит зависимостей |

Consumer дополнен GestureEngine, типами контекста/параметров/плана и defaults:
он выполняет свайп, проверяет target и токен завершения, вызывает destroy.
Через `@ts-expect-error` дополнительно проверяется readonly параметров и target.
В установленном пакете отсутствуют runtime/peer dependencies; в consumer
node_modules установлен только TikiTaki. Составной `npm run check` на этапе 2
повторно не запускался; отдельные проверки выполнены, ограничение среды первого
этапа не объявляется исправленным. Chrome и физический Android на этапе 2 не запускались.

## DOM Renderer: TDD, этап 3

Добавлено 45 unit/integration-тестов с jsdom и управляемыми RAF/ResizeObserver.
До реализации написаны 43 теста и временный исполняемый контракт renderer и
DOM-адаптера. Зафиксирован поведенческий RED (не ошибка импорта).

| Фаза                         | Фактический результат                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| RED                          | Exit 1; 43 новых failed, 170 прежних passed                                 |
| GREEN                        | Exit 0; 213 passed                                                          |
| REFACTOR                     | Exit 0; 213 passed; DOM-адаптер и проверка HTMLElement выделены из renderer |
| Дополнительный lifecycle RED | Exit 1; 2 failed, 213 passed                                                |
| Lifecycle GREEN              | Exit 0; 215 passed                                                          |
| Lifecycle REFACTOR           | Exit 0; 215 passed; общий guard движения вынесен в getter                   |

```sh
npm test -- --reporter=json --outputFile=.artifacts/tdd-renderer-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-renderer-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-renderer-refactor.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-renderer-lifecycle-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-renderer-lifecycle-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-renderer-lifecycle-refactor.json
```

Дополнительные тесты перед исправлением показали: update адаптера видел старый
role/inert, а вызовы setOffset/animate из lifecycle могли запустить конфликтующее
движение. Теперь метаданные shell обновляются до update, reentrant движение блокируется.

Покрыты окно A10/A9/B1, col 0 вертикальных соседей, максимум пять hosts на
сетке 100×100, переиспользование target, update прежних item identities,
mount/update/unmount, сохранение framework-потомков и чужих детей контейнера,
inert, восстановление styles/priorities, повторная инициализация, RAF coalescing
без layout reads на drag, промежуточные кадры cubic easing, четыре направления,
возврат, duration 0, busy, отмена Promise при reset/sync/resize/destroy,
старые callback epochs, несколько экземпляров, скрытый viewport,
валидация, ошибки mount/update/unmount и завершение всего cleanup.

### Google Chrome

`npm run test:browser` собирает пакет и запускает Playwright с `channel: 'chrome'`
на установленном Google Chrome. `playwright.config.ts` содержит desktop и touch
emulation; исторический отчёт этапа 3 сохранён в `.artifacts/renderer-chrome.json`,
текущий browser JSON report — `.artifacts/chrome.json`;
версия запущенного Chrome записывается в annotations тестов. Chromium не подменяет Chrome.

Browser fixture — только тестовая обвязка NavigationModel/GestureEngine/renderer,
не опубликованный SwipeEngine. Статический сервер слушает только 127.0.0.1:4177
и отдаёт fixture и dist-модули. Это dev-инструмент для тестов.

Проверки сравнивают реальные bounds/transforms и конечную позицию: A10 → B1 → A1,
сохранение DOM target, промежуточные монотонные RAF-кадры, отсутствие скачка при
commit, возврат, конфликтующие переходы, resize/cancel, offscreen focus,
destroy во время settling и парность mount/unmount. Мышь проверяется через
Playwright mouse, touch — через Chrome CDP Input.dispatchTouchEvent, включая
touchCancel. Горизонтальная граница B1 проверяется реальным drag с сопротивлением.
Для мыши pointercancel отправляется синтетическим PointerEvent. В каждом тесте
проверяется отсутствие pageerror, console errors и ошибок тестовой обвязки.

| Проверка этапа 3                     | Фактический результат                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Vitest после последнего REFACTOR     | PASS, 5 файлов, 215 тестов (170 прежних + 45 новых)                               |
| `npm run typecheck`                  | PASS                                                                              |
| `npm run lint`                       | PASS, 0 warnings                                                                  |
| `npm run format:check`               | PASS                                                                              |
| `npm run build`                      | PASS, ESM и `.d.ts` обоих entry points                                            |
| `npm run test:browser`               | PASS, 16/16, 0 skipped/flaky; Google Chrome 155.0.8059.40                         |
| `npm run test:package` целиком       | Exit 1: `spawnSync node.exe EPERM` при npm pack                                   |
| Pack/install/compile/verify по шагам | PASS, headless и DOM consumers, import-safe ESM, readonly, 0 runtime dependencies |

Финальный Chrome-прогон проверяет движение до pointerup через реальные bounding
boxes, а не только строковое представление CSS matrix. Составной npm run check
на этапе 3 не запускался целиком; независимые команды выполнены, ограничение
подпроцессов среды не объявляется исправленным.

Проверка пакета сохраняет отдельный headless `tsconfig.json` с lib ES2022 и types [],
а `tsconfig.dom.json` добавляет DOM libraries только для импорта `tikitaki/dom`.
Оба проекта компилируются независимо; verify исполняет headless fixture и
импортирует DOM fixture в Node без DOM globals. Монтаж DOM в Node не вызывается.
Пакет установлен offline из свежего tarball; consumer node_modules содержит
только TikiTaki. Новые jsdom и Playwright остаются исключительно devDependencies.

## SwipeEngine: TDD, этап 4

До реализации публичного оркестратора написаны 44 новых unit/integration-теста
и исполняемая заглушка его контракта. Это поведенческий RED, не ошибка импорта.

| Фаза                   | Фактический результат                                           |
| ---------------------- | --------------------------------------------------------------- |
| RED                    | Exit 1; 44 failed, 215 прежних passed                           |
| GREEN                  | Exit 0; 259 passed                                              |
| REFACTOR               | Exit 0; 259 passed; общий путь pointerup/cancel выделен в метод |
| Регрессия capture: RED | Exit 1; 2 failed, 259 passed                                    |
| Capture: GREEN         | Exit 0; 261 passed                                              |
| Capture: REFACTOR      | Exit 0; 261 passed; общий путь потери capture выделен в метод   |

```sh
npm test -- --reporter=json --outputFile=.artifacts/tdd-swipe-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-swipe-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-swipe-refactor.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-swipe-capture-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-swipe-capture-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-swipe-capture-refactor.json
```

Покрыты четыре направления, границы и col 0, commit после последнего кадра,
занятость без очереди, мгновенный goTo, duration 0, невалидные команды при
активной анимации, callback после согласованного DOM, исключения и повторные
команды из callback, destroy из callback, mouse/touch/pen, primary input,
pointercancel/lostpointercapture, taps и keyboard click, подавление drag click,
native drag/selection, ошибки pointer callbacks через onError, updateGrid и
clamp, атомарная невалидная замена, resize/скрытый контейнер, устаревшие
завершения, несколько и вложенные экземпляры, парность подписок и cleanup,
повторная инициализация, ошибки adapter lifecycle и частичного конструктора.

### Chrome публичного движка

Новая fixture `/swipe` импортирует опубликованный SwipeEngine из dist без
тестовой координации модели/жестов/renderer. Добавлено 9 сценариев в двух
проектах Chrome: 18 новых проверок плюс 16 прежних renderer.

Первый прогон: 32 passed, 2 failed. Удаление исходной кнопки сразу после
pointerdown оставляло pending capture без lostpointercapture; последующий
pointerup мог ошибочно совершить переход. Перед исправлением добавлены два
падающих unit-теста (первое событие после удаления — move или up). Window
capture listeners теперь проверяют соединение исходного элемента и фактический
hasPointerCapture перед обработкой жеста. Повторный Chrome-прогон: **34 passed,
0 failed/skipped/flaky**, Google Chrome `155.0.8059.40`.

Проверяются конечные координаты и DOM bounds, A10 → B1 → A1, горизонтальный
предел B1, программные команды при занятости, нативные taps/keyboard clicks,
touchCancel через CDP, внешняя потеря mouse capture, обновление сетки при
анимации, resize/скрытие, удаление capture target, destroy при активном drag,
повторный mount, отсутствие pageerror/console errors/onError. Физический Android
этим прогоном не покрывается.

Typecheck, ESLint и production build выполнены успешно. Полная команда
`npm run test:package` повторно завершилась с exit 1: `spawnSync node.exe EPERM`
при запуске npm pack из Node; build внутри команды прошёл. Составной
`npm run check` не объявляется прошедшим. Поэтапная проверка tarball описана выше;
consumer расширен SwipeEngine, Promise<boolean>, readonly и взаимоисключающими
renderCell/adapter, обязательностью стратегии рендеринга и допустимыми направлениями.

| Проверка этапа 4                     | Фактический результат                                                      |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Vitest после последнего REFACTOR     | PASS, 6 файлов, 261 тест (215 прежних + 46 новых)                          |
| `npm run typecheck`                  | PASS                                                                       |
| `npm run lint`                       | PASS, 0 warnings                                                           |
| `npm run format:check`               | PASS                                                                       |
| `npm run build`                      | PASS, ESM и `.d.ts`, включая SwipeEngine                                   |
| `npm run test:browser`               | PASS, 34/34, desktop и touch emulation установленного Google Chrome        |
| `npm run test:package` целиком       | Exit 1, `spawnSync node.exe EPERM`                                         |
| Pack/install/compile/verify по шагам | PASS, свежий tarball, оба TS consumer, ESM import и 0 runtime dependencies |

Headless consumer компилируется только с ES2022, без DOM types. DOM consumer
проверяет SwipeEngine и оба способа рендеринга, но не вызывает mount в Node.
Установлены только TikiTaki и служебный lockfile; Vue/React отсутствуют как в
manifest зависимостей, так и в production ESM imports.

## React/Vue адаптеры и demos: этап 5

Среда: React/ReactDOM `19.3.1`, Vue `3.5.44`, Vite `8.3.5`, TypeScript `5.9.3`.
Версии devDependencies зафиксированы package-lock. Пакеты @tikitaki/react и
@tikitaki/vue изолированы, каждый имеет exports/types/sideEffects и свои peers;
core manifest остаётся без runtime/peer dependencies.

До реализации написаны 23 теста и исполняемые заглушки контрактов. RED относится
к поведению adapter.mount, snapshot и реальному lifecycle, не к импорту файла.

| Фаза     | Фактический результат                                                   |
| -------- | ----------------------------------------------------------------------- |
| RED      | Exit 1; 23 новых failed, 261 прежний passed                             |
| GREEN    | Exit 0; 284 passed                                                      |
| REFACTOR | Exit 0; 284 passed; создание immutable записи вынесено в чистую функцию |

```sh
npm test -- --reporter=json --outputFile=.artifacts/tdd-framework-red.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-framework-green.json
npm test -- --reporter=json --outputFile=.artifacts/tdd-framework-refactor.json
```

Unit/integration используют настоящие createRoot и createApp в jsdom. Проверены
родительский context/provide/inject, интерактивный state, props после updateGrid,
сохранение incoming host, A10 → B1 → A1, ограничения B1, парность component
mount/unmount и observer cleanup, parent unmount при анимации, отмена Promise,
идемпотентность destroy, повторная инициализация, React StrictMode replay,
20 циклов Vue updateGrid, readonly снимки, copied positions, отсутствие proxy
items, независимые bridges, повторный host и stale update после unmount.
В React assert выполняется после async act, в Vue — после nextTick.

### Demos и Chrome

`npm run demo` запускает Vite на loopback; маршруты /react/ и /vue/.
`npm run demo:build` собирает production demos в demos/dist, `demo:preview`
показывает этот build. Демо используют реальные компоненты и отдельные адаптеры,
не преобразуют компоненты в HTMLElement. Старт — A10, доступны навигация,
goTo, замена/сокращение сетки, destroy и повторный mount.

Playwright запускает два локальных сервера: статический на 127.0.0.1:4177
отдаёт renderer/engine fixtures и production demos (/demos/react/, /demos/vue/),
Vite на 127.0.0.1:4178 проверяет development lifecycle. `channel: 'chrome'`
использует установленный Google Chrome `155.0.8059.40`; оба проекта выполняют
desktop mouse и touch emulation. Физический Android не подменяется emulation.

Первый расширенный прогон: 50 passed, 4 failed. Все четыре ошибки — console 404
от отсутствующей favicon на Vite dev server; сами lifecycle assertions прошли.
Добавлена inline favicon в HTML, ошибки console не фильтровались. Повторный
прогон: 54 passed, 0 skipped/flaky. Проверены DOM bounds и позиция, реальные
drag/return/commit, touchCancel через CDP, mouse pointercancel, быстрый повтор
команды без очереди, context/state после обновления, clamp, повторный mount,
destroy при settling и парность lifecycle. В Chrome development StrictMode
проверено именно два setup, один промежуточный cleanup и один активный engine.

Дополнительный TDD demos: после shrink кнопка goTo(A10) оставалась доступной.
До изменения UI добавлен Chrome-сценарий для обоих фреймворков и обоих проектов.
`npm run test:browser -- --grep unavailable` дал поведенческий RED: 4 failed
на toBeDisabled. Отчёт сохранён в .artifacts/tdd-demos-controls-red.json.
Исправление блокирует отсутствующую A10 и команды уничтоженного engine view.
GREEN этой команды: 4 passed; отчёт .artifacts/tdd-demos-controls-green.json.
При REFACTOR начальная позиция и проверка существования её ячейки вынесены
в общие INITIAL_POSITION/hasInitialCell обеих demos; итог проверяется полным прогоном.
Полный REFACTOR-прогон: **58 passed, 0 failed/skipped/flaky** (34 прежних +
24 framework/demo проверки). Итоговые отчёты: .artifacts/chrome.json и
.artifacts/tdd-demos-controls-refactor.json.

### Проверка отдельных пакетов

Свежие tarballs всех трёх пакетов созданы через npm pack, offline установлены
в .artifacts/framework-package-manual/consumer. Framework consumer компилирует
React/Vue компоненты и engine с CellAdapter под strict без paths aliases.
Проверяет readonly Vue ref/React snapshot, совпадение item types и Position.
Node импортирует оба adapter entry points без DOM globals, не вызывая mount.
Аудит подтверждает отсутствие per-cell createRoot/createApp и посторонних
runtime imports. Core отдельно установлен в headless/DOM consumer: 0 runtime
dependencies, 0 peers и ни одного framework import в production modules.

```sh
node scripts/check-adapter-packages.mjs prepare
npm pack --ignore-scripts --pack-destination .artifacts --cache .artifacts/npm-cache
cd packages/react
npm pack --ignore-scripts --pack-destination ../../.artifacts --cache ../../.artifacts/npm-cache
cd ../vue
npm pack --ignore-scripts --pack-destination ../../.artifacts --cache ../../.artifacts/npm-cache
cd ../../.artifacts/framework-package-manual/consumer
npm install ../../tikitaki-0.1.0-alpha.0.tgz ../../tikitaki-react-0.1.0-alpha.0.tgz ../../tikitaki-vue-0.1.0-alpha.0.tgz react@19.3.1 react-dom@19.3.1 vue@3.5.44 @types/react@19.3.0 @types/react-dom@19.3.0 --offline --ignore-scripts --no-audit --no-fund --cache ../../npm-cache
cd ../../..
node node_modules/typescript/bin/tsc -p .artifacts/framework-package-manual/consumer/tsconfig.json
node scripts/check-adapter-packages.mjs verify
```

Для offline воспроизведения npm cache должен содержать framework devDependencies
(в этой сессии npm install выполнялся с --cache .artifacts/npm-cache).
Проверка core воспроизводится командами первого этапа. Это реальные проверки
установленных пакетов, без подмены imports исходниками.

Typecheck, type-aware ESLint и сборка core/обоих адаптеров на этапе 5 прошли.
`npm run test:package` повторно выполнена: build прошёл, затем exit 1 с
`spawnSync node.exe EPERM` при запуске npm pack из Node. Поэтому составной
`npm run check` не объявляется прошедшим. Проверки core и обоих адаптеров по
отдельным командам pack/install/compile/verify выполнены успешно.

| Проверка этапа 5                                 | Фактический результат                                               |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| Vitest после REFACTOR                            | PASS, 9 файлов, 284 теста (261 прежний + 23 новых)                  |
| `npm run typecheck`                              | PASS, strict + дополнительные флаги спецификации                    |
| `npm run lint`                                   | PASS, 0 warnings, type-aware rules                                  |
| `npm run format:check`                           | PASS, AGENTS.md не изменён                                          |
| `npm run build`                                  | PASS, core и оба adapter ESM + declarations                         |
| `npm run demo:build`                             | PASS, React и Vue production demos                                  |
| `npm run test:browser` после последнего REFACTOR | PASS, 58/58, Google Chrome desktop/touch, production/dev demos      |
| Core tarball: pack/install/compile/verify        | PASS, headless без DOM types, DOM consumer и 0 runtime dependencies |
| React/Vue tarballs: pack/install/compile/verify  | PASS, independent TS consumer, readonly, ESM import, isolated peers |
| `npm run test:package` целиком                   | Exit 1, `spawnSync node.exe EPERM`; составляющие проверены отдельно |

Все три пакета остаются private alpha; публикация не выполнялась.

## Интерактивная карта demos, 22 октября 2026

Под React/Vue demos добавлена карта строк с кнопками ячеек. Выбор вызывает
goTo, текущая ячейка выделяется цветом и aria-current; после destroy кнопки
недоступны и активной ячейки нет. Изменение/сокращение grid обновляет карту,
повторный mount возвращает A10. Карта — только навигационные кнопки, содержимое
ячеек по-прежнему монтируется ограниченным окном renderer.

До реализации добавлен один Chrome-сценарий для каждого framework/project:
`npm run test:browser -- --grep cell-map` дал RED — 4 failed, карта отсутствовала.
GREEN — 4 passed. REFACTOR вынес вычисление координат/подсветки в общий cellMapRows;
полный Chrome-прогон — 62 passed (58 прежних + 4 новых), без skipped/flaky.
Отчёты: .artifacts/tdd-cell-map-red.json, tdd-cell-map-green.json и
tdd-cell-map-refactor.json. Проверены длины строк 10/1/3/5, расположение под
demo, реальный CSS-цвет активной кнопки, мышь/tap, клавиатура Enter, навигация,
обновление, clamp, destroy и повторный mount.

Unit/integration — 284 passed; typecheck и ESLint прошли. Production build core,
адаптеров и demos выполнен в browser-команде. Снимки карты сохраняются в
.artifacts/cell-map-{react,vue}-{desktop,touch}.png для визуальной проверки.

Визуальная проверка обнаружила, что на ширине 390 px начальная A10 скрывалась
за горизонтальной прокруткой. До изменения CSS добавлено требование видимости
активной кнопки: RED — 2 desktop passed, 2 touch failed (viewport ratio 0),
отчёт .artifacts/tdd-cell-map-mobile-red.json. Для узких экранов уменьшены
отступы и ширина кнопок; высота интерактивных элементов сохранена 44 px.
Финальная проверка требует полного попадания текущей A10 в viewport (ratio 1).
После исправления полный GREEN — 62/62 Chrome E2E, 0 failed/skipped/flaky;
отчёт .artifacts/tdd-cell-map-mobile-green.json. Снимки desktop/touch просмотрены:
активная A10 полностью видна на обоих размерах. Итоговые typecheck, ESLint,
Prettier, production build прошли; unit/integration — 284/284.

## Functional source refactor, 22 October 2026

The runtime now uses createNavigationModel/createGestureEngine/createDOMRenderer/
createSwipeEngine factories with isolated closure state. The former class names
are readonly operation interfaces, and DOMRenderer is a nongeneric handle.
Detached operation calls are explicitly covered. Classes and this were also
removed from test-owned ResizeObserver mocks; browser platform constructors
remain browser APIs.

| TDD phase              | Observed result                                             |
| ---------------------- | ----------------------------------------------------------- |
| Factory API RED        | 4 new failures, 284 existing passes; factories absent       |
| Factory API GREEN      | 288 passes, including detached operations                   |
| Source formatter RED   | 3 failures, 289 passes; one idempotence test already passed |
| Source formatter GREEN | 292 passes                                                  |
| Functional REFACTOR    | 292 passes with the original behavioral tests retained      |

Reports: .artifacts/tdd-functional-red.json, tdd-functional-green.json,
tdd-source-style-red.json, tdd-source-style-green.json, and
tdd-functional-refactor.json. Source formatting tests verify variable-only
return values, guard blocks and blank return spacing, single-line imports and
signatures, literal whitespace preservation, contextual object types, and
idempotence.

Configuration is centralized in src/config.ts, demos/config.ts, adapter config
modules, and tooling.config.mjs. English JSDoc documents factory operations,
ownership, units, and validation. All three README files are English. AGENTS.md
was preserved. ESLint rejects classes, this, expression returns, multiline
imports, and relative .js source imports. The project formatter combines Prettier
with the requested explicit source layout, including executable documentation
and browser fixture examples.

Source modules use extensionless imports. The build uses TypeScript compiler
transformers for emitted ESM and declarations; runtime .js specifiers remain
explicit for native Node ESM and NodeNext consumers. Core remains independent
of DOM types at its headless entry point and has no runtime or peer dependencies.

Google Chrome desktop/touch E2E: 62/62 passed after the final runtime changes,
including both framework demos, StrictMode, cell maps, pointer cancellation,
real animations, grid updates, and cleanup. Typecheck and type-aware ESLint pass;
project formatting is idempotent. Core/adapters and Vite production demos build.

Fresh tarballs were installed offline into independent headless, DOM, and
React/Vue consumers. All three strict NodeNext projects compiled, and Node
imported the installed factory APIs without DOM globals. The audit confirmed
zero core runtime/peer dependencies, relative-only core runtime imports, and
isolated framework peers. Declaration output includes English operation JSDoc.

| Final verification                  | Observed result                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `npm test`                          | PASS, 11 files, 292 tests                                                     |
| `npm run typecheck`                 | PASS                                                                          |
| `npm run lint`                      | PASS, type-aware and functional source rules                                  |
| `npm run format:check`              | PASS, canonical and idempotent                                                |
| `npm run build`                     | PASS, ESM, declarations, and source maps for all packages                     |
| `npm run demo:build`                | PASS                                                                          |
| `npm run test:browser`              | PASS, 62/62 installed Google Chrome desktop/touch tests                       |
| Core pack/install/compile/verify    | PASS, headless and DOM consumers                                              |
| Adapter pack/install/compile/verify | PASS, React/Vue consumer and isolated peers                                   |
| `npm run test:package` aggregate    | Exit 1, nested `spawnSync node.exe EPERM`; equivalent individual steps passed |

The aggregate `npm run check` is not reported as passing because it includes the
blocked nested package runner. No packages were published.

## GitHub Pages and guarded-return formatting (2026-10-22)

The Pages regression test was written before changing the build and test server.
RED: both desktop framework cases failed on the `/TikiTaki/` HTTP 404 response.
GREEN: all four desktop/touch cases passed after configuring the production base
path and serving the production tree under that prefix. These tests open the home
page, follow each framework link, verify rendered geometry and pointer styles,
select a cell, check its current highlight, and return home without console errors.

Two formatter regressions failed before implementing the revised guard convention.
The six formatter cases then passed, including comment preservation and idempotence.
A single `if` body containing a return now omits braces, puts the return directly
below the condition, and leaves an empty line afterwards. Multi-statement branches
keep their braces. The same formatter handles source files and documentation
examples; GitHub workflow YAML is included in formatting checks.

Final local checks: `npm test` passed all **294 tests in 11 files**;
`npm run test:browser` built all packages and demos and passed **66/66 Google Chrome
desktop/touch tests**. Typecheck, ESLint, and formatting checks passed. The aggregate
package runner still encounters the documented nested `spawnSync node.exe EPERM`
restriction in this local sandbox; this is not reported as a passing command.
Fresh packing, offline installation, both strict NodeNext consumer compilations,
and `node scripts/check-package.mjs verify` passed when run as individual commands.

`.github/workflows/ci-pages.yml` runs verification on pull requests, `main` pushes,
and manual dispatch. Its deployment job requires successful verification on `main`
and deploys the exact production demo directory exercised by Chrome. Pull requests
cannot deploy. Remote Actions execution and the live Pages site remain unverified
until repository write access and the initial Pages configuration are available;
local browser coverage is not a claim that GitHub has deployed the site.

## Status badges and deployment versions (2026-10-22)

The deployment-version module started with a failing suite import because the
module did not exist. GREEN passed nine cases covering unique run/attempt pairs,
stable and prerelease package versions, invalid identifiers, and commit validation.
The UI started with two failing desktop Pages cases because no version output
existed. GREEN passed six desktop/touch Pages cases, including published metadata
on the home, React, and Vue entry points.

The full unit/integration run passed **303 tests in 12 files**. The full Chrome run
passed **66 cases**, followed by all **6 focused Pages/version cases** after adding
the two published-version cases. Typecheck, ESLint, formatting, library/adapter
builds, and the production demo build passed. A separate execution of the actual
stamping script produced `0.1.0-alpha.0.deploy.7.1` and then
`0.1.0-alpha.0.deploy.7.2` for a retry, with the tested commit recorded in JSON.

README badges now report the independent `Tests` and `Build and Pages` workflows;
the version badge includes GitHub prereleases. After successful Pages deployment,
the workflow tags the tested commit and creates a matching GitHub Release with
the demo link and metadata attached. Failed deployments cannot reach this step.
Successful main-branch tests
transfer their exact demo artifact to the build/deploy workflow. Only deployment
metadata is stamped afterwards. Each deployment attempt uses a distinct Pages
artifact name, so a deploy-only retry can publish a new version without rebuilding
or replacing the application assets. The npm package version is unchanged.
Both workflows use the same repository/branch concurrency group. New commits
cancel older test and build/deploy runs; cancelled or stale upstream completions
are isolated and cannot cancel the replacement pipeline.

## AvaWeather workflow structure (2026-10-22)

Inspected `gagarinbefree/AvaWeather` at its current HEAD, including the complete
`.github/workflows/dotnet-tests.yml`. TikiTaki now uses the same single-workflow
structure: test/build, prepare release, publish Pages, create GitHub Release, and
update the marked README version with a `[skip ci]` bot commit. A single
repository/branch concurrency group cancels the whole older pipeline.

The README updater started with two failing tests for the missing export, then
passed marker replacement, idempotence, and missing/duplicate marker checks.
An invalid-version assertion failed before adding input validation. Existing
deployment version generation and deploy-only retry semantics are retained.
Final local verification passed all **305 unit/integration tests in 12 files**,
typecheck, ESLint, and canonical formatting.
Release downloads include the tested demo ZIP and version metadata. Pull requests
stop after verification; the README bot checks that the branch has not advanced.

Previous GitHub tests and builds passed; Pages publication stopped at
`Configure Pages`. As in AvaWeather, initial Pages enablement is a repository
setting and cannot be replaced by the standard workflow token. A successful live
Pages deployment and GitHub Release are not claimed until that step succeeds.

## Release visibility (2026-10-23)

The first deployment created a published, non-draft prerelease with the demo ZIP
and metadata attached. GitHub did not mark it Latest. The workflow now publishes
regular releases with `--latest` and promotes an existing release on an idempotent
retry. The README badge links to `releases/latest` and no longer selects prereleases.
This changes GitHub release visibility, while retaining the alpha version string.

## A1 demo start and repository-owned release badge (2026-10-23)

RED: both new desktop demo cases failed while expecting A1 at startup. The demos
now start and remount at A1, while their A10 command uses a separate configured
target. Existing boundary tests explicitly select A10 before exercising the
original nonzero-column scenarios. GREEN: all **72 Chrome desktop/touch E2E cases**
passed, including the four new startup/remount cases. Typecheck and ESLint passed.

The external release badge showed `no releases or repo not found` while GitHub
reported an existing published, regular Latest release. A failing badge-rendering
test preceded the repository-owned SVG implementation. The release updater now
writes README and `docs/badges/release.svg` together; the bot stages both files.
The CI badge keeps its working GitHub endpoint. The local release image is seeded
with the verified published version, not a fabricated status.
Final checks passed all **306 unit/integration tests**, typecheck, ESLint, and
formatting. A Google Chrome screenshot confirmed that the generated SVG displays
the release label and complete version without clipping.

## Twitter Bootstrap 2.0.2 demo (2026-10-23)

RED: both new desktop presentation cases failed because the Bootstrap navbar and
responsive columns were absent. GREEN passed the four desktop/touch presentation
cases. After refining the navigation layout, the full Chrome suite passed
**76/76 cases**. Unit/integration tests passed **307/307 in 12 files**; typecheck,
ESLint, and library/adapter/demo production builds passed.

The home, React, and Vue pages now use Bootstrap's navbar, pills, fluid grid,
hero-unit, wells, buttons, labels, and icon sprites. The former demo stylesheet
was removed. Only viewport dimensions and cell box sizing remain as local geometry.
Bootstrap CSS, responsive CSS, and both icon sprites were byte-compared with the
official `v2.0.2` tag and match. Vendor files are excluded from formatting. CSS
minification is disabled to preserve upstream legacy IE declarations without
modern minifier parse failures. No Bootstrap JS or jQuery was added.

Desktop and narrow-screen React/Vue screenshots verified layout and current-cell
highlighting. Browser checks cover no horizontal page overflow, loaded image
assets, A1 startup, cell-map selection, real gestures, updates, and remount.
An additional failing unit assertion preceded version-specific release-image
URLs, preventing a browser from reusing an older badge URL after a new release.

## Standard Prettier migration (2026-10-23)

Prettier 3.9.10 is installed with an exact development dependency. The format
and format:check scripts now invoke the standard Prettier CLI directly. The
previous formatting conventions described above are historical and have been
superseded: there is no custom return layout, one-line import/signature rule,
or formatting postprocessor. Six tests of the removed formatter were removed;
behavioral engine and adapter tests remain unchanged.

The initial formatting pass encountered a locked Visual Studio index file;
.vs/ is now excluded from formatting and version control. The subsequent write
and check passes succeeded. Typecheck, ESLint, and production builds passed.
All 76 Google Chrome desktop/touch E2E tests passed after formatting.
The default local Vitest fork pool could not spawn workers (EPERM); this is an
environment failure before tests execute, rather than a failing assertion.

## JSX, Vue templates, and Bootstrap 6 (2026-10-23)

React markup now lives in separate App, EngineView, Cell, and CellMap TSX
components. Vue uses matching single-file components with script setup and
compiled templates; Teleports render cells inside the parent application.
Existing Chrome lifecycle checks cover context, counter state, updateGrid,
destroy, remount, and React StrictMode without per-cell roots.

The Bootstrap 6 presentation assertion first failed against the previous navbar
(RED). After replacing Bootstrap 2 markup and CSS, all four framework/viewport
presentation cases passed (GREEN). Bootstrap 6.0.0-alpha.1 CSS, its source map,
and MIT license come from official tag commit
780627306eb517ca210310a24e10f8186003c127. The CSS remains unmodified; Vite bundles
and minifies it for production. No Bootstrap JavaScript or optional peers are
needed. Native Bootstrap utilities and themes supply the responsive layout.

vue-tsc checks TS, TSX, and Vue scripts/templates; type-aware ESLint checks TS
and TSX. Prettier 3.9.10 formats all three file types. The local unit run using
the supported thread pool passed all 301 tests in 11 files. The previous
Prettier-only commit also completed the full GitHub Actions pipeline.

The first full Bootstrap 6 Chrome run had 73 passes and three failures: two
mobile A10 visibility assertions and one artifact write failure from a full
disk. Compact map buttons fixed A10 visibility; disk space was freed. The
subsequent 32 framework/presentation cases passed, including light/dark color
adaptation, RTL, gestures, state preservation, and cleanup in both viewport modes.

Final verification: **301/301 unit/integration tests and 76/76 Chrome E2E passed**.
Typecheck, ESLint, Prettier, core/adapter builds, and the demo production build
passed. The vendored CSS SHA-256 matches the official tag checkout.

## Portrait demo without a control panel (2026-10-23)

RED: the new presentation assertion failed against the existing React aside.
Both demos now omit the control panel and center a 9:16 swipe viewport. Shared
geometry caps its width at 360px and height at 70svh while preserving the ratio
on narrow screens. The interactive map remains below the field.

Chrome assertions check the absence of the panel/navigation controls, portrait
geometry, initial A1, map selection, gestures, and no horizontal page overflow.
Lifecycle and grid-update coverage uses the existing browser diagnostics bridge
instead of visible buttons. Reload coverage verifies the public demo resets to
A1. The engine and adapters are unchanged.

GREEN: all **76 Chrome desktop/touch E2E cases passed**. Typecheck, ESLint,
Prettier, library/adapter builds, and the production demo build passed. Desktop
and mobile screenshots confirmed the portrait field and absence of the panel.

## Swipe field and map alignment (2026-10-23)

RED: the desktop geometry assertion failed against the centered field and map
below it. React and Vue now place the portrait field and map in one Bootstrap
responsive flex row. The field keeps its phone width at the left edge; the map
fills the remaining container width and stretches to the same height. The map
can scroll internally. Narrow screens stack the two sections.

Browser assertions compare the left edge, top alignment, equal heights, and
right edge of the map against the layout container, alongside existing gesture,
selection, lifecycle, and overflow checks.

GREEN: all 76 Chrome desktop/touch E2E cases passed. Typecheck, ESLint,
Prettier, library/adapter builds, and the demo production build passed.
A desktop screenshot confirmed that the map fills the space beside the field.

## Mouse wheel navigation (2026-10-23)

RED: three new wheel assertions failed before implementation (48 existing and
non-navigation cases passed). GREEN: the controller now consumes vertical wheel
events over its owned viewport, reuses animated navigation, and groups inertia
with a 160ms quiet interval. Tests cover successful row resets, top and bottom
boundaries, burst suppression after settling, pointer conflicts, nested engines,
zoom/horizontal/cancelled input, outside input, and listener cleanup on destroy.

Real Chrome wheel input in both framework demos checks A10 to B1 to A1, map
highlighting, stable page scroll while hovering a cell, and native page scroll
outside the viewport. The tests run in desktop and touch-emulated Chrome projects.

Final wheel verification: 80/80 Chrome E2E passed. The full unit run passed
306 tests before the final bottom-boundary case; the expanded controller suite
then passed all 52 cases. Typecheck, ESLint, Prettier, and production builds passed.

## Deferred device verification

Физический Android с Chrome пока **не проверялся** и отложен по прямому решению
пользователя. При возвращении к нему проверить плавность, pointer capture/cancel,
смену ориентации и размеров на устройстве. Chrome touch emulation выполнена.
