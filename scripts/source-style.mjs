import ts from 'typescript';
import { format, resolveConfig } from 'prettier';
import { SOURCE_STYLE_CONFIG } from '../tooling.config.mjs';
/** Collapse trivia without changing string/template literal contents. */
function compact(source) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  let result = '',
    pending = false;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.WhitespaceTrivia || token === ts.SyntaxKind.NewLineTrivia) {
      pending = true;
    } else {
      if (pending && result.length !== 0) {
        result += ' ';
      }
      result += scanner.getTokenText();
      pending = false;
    }
  }

  return result;

}
/** Replace expression returns with local bindings and normalize branches before layout. */
function namedReturns(source, filePath) {
  const tree = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const scopes = new WeakMap();
  const factory = ts.factory;
  let changed = false;
  function resultName(node) {
    let scope = node.parent;
    while (scope && !ts.isBlock(scope) && !ts.isCaseClause(scope) && !ts.isIfStatement(scope)) scope = scope.parent;
    scope ??= tree;
    if (!scopes.has(scope)) {
      const names = new Set();
      function collect(child) {
        if (ts.isIdentifier(child)) {
          names.add(child.text);
        }
        ts.forEachChild(child, collect);
      }
      collect(scope);
      scopes.set(scope, names);
    }
    const names = scopes.get(scope);
    let name = SOURCE_STYLE_CONFIG.returnBindingName,
      suffix = SOURCE_STYLE_CONFIG.firstDuplicateSuffix;
    while (names.has(name)) name = `${SOURCE_STYLE_CONFIG.returnBindingName}${suffix++}`;
    names.add(name);

    return name;

  }
  const transformed = ts.transform(tree, [
    (context) => {
      function visit(node) {
        if (ts.isIfStatement(node)) {
          const body = ts.isBlock(node.thenStatement) ? node.thenStatement : factory.createBlock([node.thenStatement], true);
          let alternative = node.elseStatement;
          if (alternative && !ts.isBlock(alternative) && !ts.isIfStatement(alternative)) {
            alternative = factory.createBlock([alternative], true);
          }
          changed ||= body !== node.thenStatement || alternative !== node.elseStatement;
          const result = factory.updateIfStatement(node, node.expression, body, alternative);
          const result2 = ts.visitEachChild(result, visit, context);

          return result2;

        }
        if (ts.isReturnStatement(node) && node.expression && !ts.isIdentifier(node.expression)) {
          changed = true;
          const name = resultName(node);
          let owner = node.parent;
          while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
          const objectReturn = ts.isObjectLiteralExpression(node.expression) || ts.isArrayLiteralExpression(node.expression);
          const type = objectReturn && owner?.type && !ts.isTypePredicateNode(owner.type) ? owner.type : undefined;
          const declaration = factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [factory.createVariableDeclaration(name, undefined, type, ts.visitNode(node.expression, visit))],
              ts.NodeFlags.Const,
            ),
          );
          const result = [declaration, factory.createReturnStatement(factory.createIdentifier(name))];

          return result;

        }
        const result2 = ts.visitEachChild(node, visit, context);

        return result2;

      }
      const result2 = (node) => ts.visitNode(node, visit);

      return result2;

    },
  ]);
  const result = changed ? ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]) : source;
  transformed.dispose();

  return result;

}
/** Apply the explicitly requested line layout after Prettier's syntax formatting. */
function sourceLayout(source, filePath, lineWidth) {
  const tree = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const edits = [];
  function inspect(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      edits.push({ start: node.getStart(tree), end: node.end, text: compact(node.getText(tree)).replace(/,\s*}/g, ' }') });

      return;

    }
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
      if (node.body) {
        edits.push({
          start: node.getStart(tree),
          end: node.body.getStart(tree),
          text: compact(source.slice(node.getStart(tree), node.body.getStart(tree))) + ' ',
        });
        inspect(node.body);

        return;

      }
    }
    if (ts.isMethodSignature(node) || ts.isCallSignatureDeclaration(node)) {
      edits.push({ start: node.getStart(tree), end: node.end, text: compact(node.getText(tree)) });

      return;

    }
    if (ts.isIfStatement(node)) {
      const expression = compact(node.expression.getText(tree));
      const lineStart = source.lastIndexOf('\n', node.getStart(tree)) + 1;
      const width = node.getStart(tree) - lineStart + expression.length + 7;
      const body = node.thenStatement;
      const guardedReturn = ts.isBlock(body) && body.statements.length === 1 && ts.isReturnStatement(body.statements[0]);
      if (guardedReturn) {
        const indentation = source.slice(lineStart, node.getStart(tree)).match(/^\s*/)[0];
        const statement = body.statements[0];
        const prefix = source.slice(body.getStart(tree) + 1, statement.getStart(tree)).trim();
        const suffix = source.slice(statement.end, body.end - 1).trim();
        const contents = [prefix, statement.getText(tree), suffix].filter(Boolean).join('\n');
        const lines = contents
          .split('\n')
          .map((line) => `${indentation}  ${line.trim()}`)
          .join('\n');
        const condition = width <= lineWidth ? `if (${expression})` : source.slice(node.getStart(tree), body.getStart(tree)).trimEnd();
        edits.push({ start: node.getStart(tree), end: body.end, text: `${condition}\n${lines}` });
        if (node.elseStatement) {
          inspect(node.elseStatement);
        }

        return;

      }
      if (width <= lineWidth) {
        edits.push({ start: node.getStart(tree), end: node.thenStatement.getStart(tree), text: `if (${expression}) ` });
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(tree);
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  // Returns are now a single identifier or a void exit, so line-based spacing is unambiguous.
  result = result.replace(/\n[\t ]*\n(?=[\t ]*return\b)/g, '\n');
  result = result.replace(/\n([\t ]*return(?: [A-Za-z_$][\w$]*)?;)[\t ]*\n(?:[\t ]*\n)*/g, '\n\n$1\n\n');
  const guards = ts.createSourceFile(filePath, result, ts.ScriptTarget.Latest, true);
  const gaps = [];
  /** Keep the return directly below its guard, including any explanatory comments. */
  function guardSpacing(node) {
    if (ts.isIfStatement(node) && ts.isReturnStatement(node.thenStatement)) {
      const start = node.expression.end + 1;
      const end = node.thenStatement.getStart(guards);
      const trivia = result.slice(start, end);
      gaps.push({ start, end, text: trivia.replace(/\n[\t ]*\n/g, '\n') });
    }
    ts.forEachChild(node, guardSpacing);
  }
  guardSpacing(guards);
  for (const gap of gaps.sort((a, b) => b.start - a.start)) result = result.slice(0, gap.start) + gap.text + result.slice(gap.end);

  return result;

}
/**
 * Format a source module with named returns, compact signatures, and explicit return spacing.
 * @param {string} source Original TypeScript or JavaScript source.
 * @param {string} [filePath] File path used for parser and Prettier configuration lookup.
 * @returns {Promise<string>} Canonical source text.
 */
export async function formatSource(source, filePath = SOURCE_STYLE_CONFIG.defaultPath) {
  const options = (await resolveConfig(filePath)) ?? {};
  const normalized = namedReturns(source, filePath);
  const pretty = await format(normalized, { ...options, filepath: filePath });
  const result = sourceLayout(pretty, filePath, options.printWidth ?? SOURCE_STYLE_CONFIG.lineWidth);

  return result;

}
