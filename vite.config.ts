import { createAngularLinker } from './scripts/angular-linker.mjs';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { DEPLOYMENT_CONFIG, SERVER_CONFIG } from './tooling.config.mjs';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ command }) => {
  const config = {
    plugins: [vue(), svelte({ configFile: false }), createAngularLinker()],
    base: command === 'build' ? DEPLOYMENT_CONFIG.basePath : DEPLOYMENT_CONFIG.developmentBasePath,
    server: { host: SERVER_CONFIG.host },
    preview: { host: SERVER_CONFIG.host },
    root: path('./demos/'),
    resolve: {
      alias: {
        'tikitaki/dom': path('./src/dom.ts'),
        tikitaki: path('./src/index.ts'),
        '@tikitaki_gagarinbefree/react': path('./packages/react/src/index.ts'),
        '@tikitaki_gagarinbefree/vue': path('./packages/vue/src/index.ts'),
        '@demo/angular': path('./.artifacts/angular/demos/angular/App.js'),
        '@tikitaki_gagarinbefree/angular': path('./packages/angular/src/index.ts'),
        '@tikitaki_gagarinbefree/svelte': path('./packages/svelte/src/index.ts'),
      },
    },
    optimizeDeps: { exclude: ['@angular/core', '@angular/common', '@angular/platform-browser'] },
    define: {
      ngDevMode: command !== 'build',
      ngJitMode: false,
      ngI18nClosureMode: false,
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
    build: {
      outDir: 'dist',
      rolldownOptions: {
        input: {
          home: path('./demos/index.html'),
          vanilla: path('./demos/vanilla/index.html'),
          react: path('./demos/react/index.html'),
          vue: path('./demos/vue/index.html'),
          svelte: path('./demos/svelte/index.html'),
          angular: path('./demos/angular/index.html'),
          lit: path('./demos/lit/index.html'),
        },
      },
    },
  };

  return config;
});
