import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { DEPLOYMENT_CONFIG, SERVER_CONFIG } from './tooling.config.mjs';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ command }) => {
  const config = {
    base: command === 'build' ? DEPLOYMENT_CONFIG.basePath : DEPLOYMENT_CONFIG.developmentBasePath,
    server: { host: SERVER_CONFIG.host },
    preview: { host: SERVER_CONFIG.host },
    root: path('./demos/'),
    resolve: {
      alias: {
        'tikitaki/dom': path('./src/dom.ts'),
        tikitaki: path('./src/index.ts'),
        '@tikitaki/react': path('./packages/react/src/index.ts'),
        '@tikitaki/vue': path('./packages/vue/src/index.ts'),
      },
    },
    define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
    build: {
      outDir: 'dist',
      rolldownOptions: {
        input: { home: path('./demos/index.html'), react: path('./demos/react/index.html'), vue: path('./demos/vue/index.html') },
      },
    },
  };

  return config;

});
