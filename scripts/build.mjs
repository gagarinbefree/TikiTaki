import ts from 'typescript';
import process from 'node:process';
/** Keep source imports extensionless while emitting resolvable Node ESM imports. */
function runtimeImports(context) {
  const factory = context.factory;
  function specifier(node) {
    let result = node;
    if (node && ts.isStringLiteral(node) && node.text.startsWith('.') && !/\.[a-z]+$/i.test(node.text)) {
      result = factory.createStringLiteral(`${node.text}.js`);
      ts.setTextRange(result, node);
    }

    return result;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const result = factory.updateImportDeclaration(
        node,
        node.modifiers,
        node.importClause,
        specifier(node.moduleSpecifier),
        node.attributes,
      );

      return result;
    }
    if (ts.isExportDeclaration(node)) {
      const result = factory.updateExportDeclaration(
        node,
        node.modifiers,
        node.isTypeOnly,
        node.exportClause,
        specifier(node.moduleSpecifier),
        node.attributes,
      );

      return result;
    }
    const result = ts.visitEachChild(node, visit, context);

    return result;
  }
  const result2 = (source) => ts.visitNode(source, visit);

  return result2;
}
/** Compile an isolated package and its declaration/source maps without bundling dependencies. */
function build(configFile) {
  const file = ts.readConfigFile(configFile, ts.sys.readFile);
  if (file.error) {
    throw new Error(ts.flattenDiagnosticMessageText(file.error.messageText, '\n'));
  }
  const config = ts.parseJsonConfigFileContent(file.config, ts.sys, ts.getDirectoryPath(configFile));
  const program = ts.createProgram(config.fileNames, config.options);
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length !== 0) {
    const host = { getCanonicalFileName: (name) => name, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n' };
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  }
  const result = program.emit(undefined, undefined, undefined, undefined, {
    before: [runtimeImports],
    afterDeclarations: [runtimeImports],
  });
  if (result.emitSkipped) {
    throw new Error(`Build skipped: ${configFile}`);
  }
}
for (const configFile of process.argv.slice(2)) build(configFile);
