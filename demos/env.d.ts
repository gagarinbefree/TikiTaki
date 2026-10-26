/// <reference types="vite/client" />
/** Vue SFC imports are checked in full by the Vue TypeScript checker; ESLint also resolves their component type. */
declare module '*.vue' {
  const component: import('vue').DefineComponent;
  export default component;
}
