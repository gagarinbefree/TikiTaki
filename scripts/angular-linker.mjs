import { transformAsync } from '@babel/core';
import linker from '@angular/compiler-cli/linker/babel';

/**
 * createAngularLinker
 *
 * Link Angular's partial library declarations with its official Babel linker in Vite.
 * @returns {import('vite').Plugin} The dependency transform used in development and production.
 */
export function createAngularLinker() {
  return {
    name: 'angular-library-linker',
    enforce: 'pre',
    /**
     * transform
     *
     * Transform only Angular dependencies; application components are compiled ahead of time by ngc.
     * @param code The code argument.
     * @param id The id argument.
     * @returns A promise that resolves to the operation result.
     */
    async transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!file.replaceAll('\\', '/').includes('/node_modules/@angular/') || !file.endsWith('.mjs')) return null;
      const result = await transformAsync(code, {
        filename: file,
        compact: false,
        plugins: [[linker, { linkerJitMode: false }]],
        babelrc: false,
        configFile: false,
        sourceMaps: true,
      });
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  };
}
