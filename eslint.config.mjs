import js from '@eslint/js';
import tseslint from 'typescript-eslint';
/** Enforce the functional source contract without adding runtime dependencies. */
const functionalStyle = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      receiver: 'Use closure-backed functions instead of classes or this.',
      returnValue: 'Assign the return expression to a variable before returning it.',
      importLayout: 'Keep each import on one line.',
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
      ReturnStatement(node) {
        if (node.argument && node.argument.type !== 'Identifier') {
          context.report({ node, messageId: 'returnValue' });
        }
      },
      ImportDeclaration(node) {
        if (node.loc.start.line !== node.loc.end.line) {
          context.report({ node, messageId: 'importLayout' });
        }
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
    files: ['**/*.ts', '**/*.mjs'],
    plugins: { local: { rules: { functional: functionalStyle } } },
    rules: { 'local/functional': 'error' },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
);
