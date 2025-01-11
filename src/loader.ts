import type { LoaderContext } from 'webpack';
import type VirtualModulesPlugin from 'webpack-virtual-modules';
import type { NodePath } from '@babel/traverse';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

// https://github.com/babel/babel/issues/13855#issuecomment-945123514
const traverse = _traverse.default;
const generate = _generate.default;

const GENERATED_DIR_NAME = '.generated/boundaries';
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

  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let modified = false;
    traverse(ast, {
      ImportDeclaration: (nodePath: NodePath<t.ImportDeclaration>) => {
        const attrs = nodePath.node.attributes || [];
        const envAttr = attrs.find((attr) => {
          const isAttr = 'name' in attr.key && attr.key.name === ATTR_NAME;
          const isClientEnv = attr.value.value === CLIENT_ENV;
          return attr.type === 'ImportAttribute' && isAttr && isClientEnv;
        });

        if (!envAttr) return;

        // process the client import
        const nodeWithoutAttrs = t.cloneNode(nodePath.node);
        nodeWithoutAttrs.attributes = [];
        let importStatement = generate(nodeWithoutAttrs).code;

        if (nodePath.node.specifiers.some((specifier) => t.isImportNamespaceSpecifier(specifier))) {
          // namespaced imports
          const usedComponents = findUsedComponents(ast, nodePath.node.specifiers[0].local.name);
          const sourceValue = nodePath.node.source.value;
          importStatement = `export { ${usedComponents.join(', ')} } from '${sourceValue}';`;
        } else {
          // non-namespaced imports
          const withAttr = /\s+with\s*{[^}]*}/g;
          importStatement = importStatement.replace(/import/, 'export').replace(withAttr, '');
        }

        const projectRoot = findProjectRoot();
        const boundaryCode = `'use client';\n${importStatement}`;
        const boundaryFileName = `${generateHash(importStatement)}.js`;
        const boundaryFilePath = path.resolve(projectRoot, GENERATED_DIR_NAME, boundaryFileName);
        const existingContent = generatedFiles.get(boundaryFilePath);

        if (existingContent !== boundaryCode) {
          virtualModules.writeModule(boundaryFilePath, boundaryCode);
          generatedFiles.set(boundaryFilePath, boundaryCode);
        }

        // replace original import path with generated boundary path
        const relativePath = path.relative(path.dirname(this.resourcePath), boundaryFilePath);
        const newImportPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        const newNode = t.cloneNode(nodePath.node);
        newNode.source = t.stringLiteral(newImportPath);
        newNode.attributes = [];
        nodePath.replaceWith(newNode);

        modified = true;
      },
    });

    if (!modified) return callback(null, source);

    const output = generate(ast, {}, source);
    callback(null, output.code);
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

function findUsedComponents(ast: t.File, namespace: string): string[] {
  const usedComponents = new Set<string>();

  traverse(ast, {
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object, { name: namespace }) &&
        t.isIdentifier(path.node.property)
      ) {
        usedComponents.add(path.node.property.name);
      }
    },
  });

  return Array.from(usedComponents);
}

/* -------------------------------------------------------------------------------------------------
 * generateHash
 * -----------------------------------------------------------------------------------------------*/

function generateHash(input: string) {
  return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
}

export default loader;
