import type { LoaderContext } from 'webpack';
import type VirtualModulesPlugin from 'webpack-virtual-modules';
import ts from 'typescript';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

const GENERATED_DIR = '.generated/boundaries';
const ATTR_NAME = 'use';
const CLIENT_ENV = 'client';

/* -------------------------------------------------------------------------------------------------
 * loader
 * -----------------------------------------------------------------------------------------------*/

type LoaderOptions = { virtualModules: VirtualModulesPlugin; generatedFiles: Map<string, string> };

function loader(this: LoaderContext<LoaderOptions>, source: string) {
  this.cacheable(false);
  const callback = this.async();
  const { virtualModules, generatedFiles } = this.getOptions();
  const resourcePath = this.resourcePath;

  try {
    const sourceFile = ts.createSourceFile(
      resourcePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    let modified = false;

    const transformer = (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
      return (rootNode: ts.SourceFile) => {
        function visit(node: ts.Node): ts.Node {
          if (!ts.isImportDeclaration(node)) return ts.visitEachChild(node, visit, context);

          const hasClientAttribute = node.attributes?.elements.some((element) => {
            const { name, value } = element;
            const isAttr = ts.isImportAttribute(element) && name.getText() === ATTR_NAME;
            const isClient = ts.isStringLiteral(value) && value.text === CLIENT_ENV;
            return isAttr && isClient;
          });

          if (!hasClientAttribute) return ts.visitEachChild(node, visit, context);

          const namedBindings = node.importClause?.namedBindings;
          const importStatement = node.getText();
          let exportStatement = importStatement;

          if (namedBindings && ts.isNamespaceImport(namedBindings)) {
            const namespace = namedBindings.name.text;
            const usedComponents = findUsedComponents(sourceFile, namespace);
            const importPath = node.moduleSpecifier.getText();
            exportStatement = `export { ${usedComponents.join(', ')} } from ${importPath};`;
          } else {
            exportStatement = exportStatement.replace(/import/, 'export');
            exportStatement = exportStatement.replace(/\s+with\s*{[^}]*}/g, '');
          }

          const projectRoot = findProjectRoot();
          const boundarySource = `'use client';\n${exportStatement}`;
          const boundaryFileName = `${generateHash(importStatement)}.js`;
          const boundaryFilePath = path.resolve(projectRoot, GENERATED_DIR, boundaryFileName);
          const existingContent = generatedFiles.get(boundaryFilePath);

          if (existingContent !== boundarySource) {
            virtualModules.writeModule(boundaryFilePath, boundarySource);
            generatedFiles.set(boundaryFilePath, boundarySource);
          }

          // replace original import path with generated boundary path
          const relativePath = path.relative(path.dirname(resourcePath), boundaryFilePath);
          const newImportPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

          modified = true;
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            ts.factory.createStringLiteral(newImportPath),
            undefined,
          );
        }

        return ts.visitNode(rootNode, visit) as ts.SourceFile;
      };
    };

    const result = ts.transform(sourceFile, [transformer]);
    if (!modified) return callback(null, source);

    const printer = ts.createPrinter();
    const output = printer.printFile(result.transformed[0]);
    callback(null, output);
  } catch (error) {
    callback(error as Error);
  }
}

/* -------------------------------------------------------------------------------------------------
 * findProjectRoot
 * -----------------------------------------------------------------------------------------------*/

function findProjectRoot() {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) return currentDir;
    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

/* -------------------------------------------------------------------------------------------------
 * findUsedComponents
 * -----------------------------------------------------------------------------------------------*/

function findUsedComponents(sourceFile: ts.SourceFile, namespace: string): string[] {
  const usedComponents = new Set<string>();

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === namespace &&
      ts.isIdentifier(node.name)
    ) {
      usedComponents.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return Array.from(usedComponents);
}

/* -------------------------------------------------------------------------------------------------
 * generateHash
 * -----------------------------------------------------------------------------------------------*/

function generateHash(input: string) {
  return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
}

export default loader;
