import js from '@eslint/js';
import tseslint from 'typescript-eslint';
/** Enforce the functional source contract without adding runtime dependencies. */
const functionalStyle = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      receiver: 'Use closure-backed functions instead of classes or this.',
      extension: 'Use extensionless relative imports in source modules.',
    },
  },
  create(context) {
    function receiver(node) {
      context.report({ node, messageId: 'receiver' });
    }
    const visitors = {
      ClassDeclaration: receiver,
      ClassExpression: receiver,
      ThisExpression: receiver,
      ImportDeclaration(node) {
        if (/^\..*\.js$/.test(node.source.value)) {
          context.report({ node, messageId: 'extension' });
        }
      },
    };

    return visitors;
  },
};
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'packages/*/dist/**',
      'demos/dist/**',
      'node_modules/**',
      '.artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    plugins: { local: { rules: { functional: functionalStyle } } },
    rules: { 'local/functional': 'error' },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
);
