import type ts from 'typescript/lib/tsserverlibrary';

const builtins = new Set([
  'Array',
  'Set',
  'Map',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
]);

/* -------------------------------------------------------------------------------------------------
 * createTSPlugin
 * -----------------------------------------------------------------------------------------------*/

function createTSPlugin({ typescript }: { typescript: typeof ts }) {
  function create(info: ts.server.PluginCreateInfo) {
    const proxy: ts.LanguageService = Object.create(null);
    const ls = info.languageService;

    for (const k of Object.keys(ls) as Array<keyof ts.LanguageService>) {
      proxy[k] = (...args: Array<any>) => (ls[k] as any).apply(ls, args);
    }

    log(info, `NEXT_CLIENT_ATTR_WEBPACK_PLUGIN: READY`);

    proxy.getSemanticDiagnostics = (fileName: string) => {
      const prior = ls.getSemanticDiagnostics(fileName);
      const sourceFile = ls.getProgram()?.getSourceFile(fileName);
      if (!sourceFile) return prior;
      return [...prior, ...getClientBoundaryDiagnostics(sourceFile, info)];
    };

    return proxy;
  }

  function getClientBoundaryDiagnostics(
    sourceFile: ts.SourceFile,
    info: ts.server.PluginCreateInfo,
  ): ts.Diagnostic[] {
    const diagnostics: ts.Diagnostic[] = [];
    const checker = info.languageService.getProgram()?.getTypeChecker();
    if (!checker) return diagnostics;

    const clientImports = findClientImports(sourceFile);

    for (const importDecl of clientImports) {
      const componentUsages = findComponentUsages(importDecl, sourceFile);
      for (const usage of componentUsages) {
        const propDiagnostics = validateProps(usage, checker);
        diagnostics.push(...propDiagnostics);
      }
    }

    return diagnostics;
  }

  function findClientImports(sourceFile: ts.SourceFile): ts.ImportDeclaration[] {
    let imports: ts.ImportDeclaration[] = [];

    function visit(node: ts.Node) {
      if (typescript.isImportDeclaration(node)) {
        const isClientImport = /use:(\s*)("|')client("|')/.test(node.getText());
        if (isClientImport) imports.push(node);
      }
      typescript.forEachChild(node, visit);
    }

    visit(sourceFile);
    return imports;
  }

  function findComponentUsages(
    importDecl: ts.ImportDeclaration,
    sourceFile: ts.SourceFile,
  ): Array<ts.JsxElement | ts.JsxSelfClosingElement> {
    const usages: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
    const importedNames = new Set<string>();
    const namespaceImport = new Set<string>();

    if (importDecl.importClause) {
      const namedBindings = importDecl.importClause.namedBindings;
      if (importDecl.importClause.name) importedNames.add(importDecl.importClause.name.text);
      if (namedBindings) {
        if (typescript.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => importedNames.add(element.name.text));
        } else if (typescript.isNamespaceImport(namedBindings)) {
          namespaceImport.add(namedBindings.name.text);
        }
      }
    }

    function visit(node: ts.Node) {
      if (typescript.isJsxElement(node) || typescript.isJsxSelfClosingElement(node)) {
        const tagName = typescript.isJsxElement(node)
          ? node.openingElement.tagName.getText()
          : node.tagName.getText();
        const isNamespaced = [...namespaceImport].some((ns) => tagName.startsWith(ns + '.'));
        if (importedNames.has(tagName) || isNamespaced) usages.push(node);
      }

      typescript.forEachChild(node, visit);
    }

    visit(sourceFile);
    return usages;
  }

  function validateProps(
    jsxElement: ts.JsxElement | ts.JsxSelfClosingElement,
    checker: ts.TypeChecker,
  ): ts.Diagnostic[] {
    const diagnostics: ts.Diagnostic[] = [];
    const props = typescript.isJsxElement(jsxElement)
      ? jsxElement.openingElement.attributes.properties
      : jsxElement.attributes.properties;

    for (const prop of props) {
      if (!typescript.isJsxAttribute(prop)) continue;
      const initializer = prop.initializer;

      if (initializer && typescript.isJsxExpression(initializer)) {
        const expression = initializer.expression;
        if (!expression) continue;
        const type = checker.getTypeAtLocation(expression);
        const propName = prop.name.getText();

        if (!isSerializableType(propName, type, expression.getText())) {
          const diagnostic = createDiagnostic(prop, type, checker);
          diagnostics.push(diagnostic);
        }
      }
    }

    return diagnostics;
  }

  function createDiagnostic(
    prop: ts.JsxAttribute,
    type: ts.Type,
    checker: ts.TypeChecker,
  ): ts.Diagnostic {
    const propName = prop.name.getText();
    const propType = checker.typeToString(type);
    const isFunction = type.getCallSignatures().length;
    return {
      file: prop.getSourceFile(),
      start: prop.getStart(),
      length: prop.getWidth(),
      category: typescript.DiagnosticCategory.Error,
      code: 100001,
      messageText: `Non-serializable prop '${propName}' of type '${propType}'.${isFunction ? ' Did you forget to suffix a server action prop with "Action"?' : ''}\n\nLearn more: https://react.dev/reference/rsc/use-client#serializable-types`,
    };
  }

  function isSerializableType(propName: string, type: ts.Type, text?: string): boolean {
    if (type.getCallSignatures().length) return isServerAction(propName);
    return (
      isPrimitive(type) ||
      isSerializableIterable(type) ||
      isPlainObject(type) ||
      isJsxElement(type) ||
      isPromise(type) ||
      isRegisteredSymbol(type, text)
    );
  }

  function isPrimitive(type: ts.Type): boolean {
    return Boolean(
      type.flags &
        (typescript.TypeFlags.String |
          typescript.TypeFlags.Number |
          typescript.TypeFlags.BigInt |
          typescript.TypeFlags.Boolean |
          typescript.TypeFlags.Undefined |
          typescript.TypeFlags.Null),
    );
  }

  function isSerializableIterable(type: ts.Type): boolean {
    return Boolean(type.symbol && builtins.has(type.symbol.name));
  }

  function isPlainObject(type: ts.Type): boolean {
    if (!(type.flags & typescript.TypeFlags.Object)) return false;
    const symbol = type.getSymbol();
    if (!symbol) return true;
    return symbol.name === 'Object' || symbol.name === '__object';
  }

  function isRegisteredSymbol(type: ts.Type, text?: string): boolean {
    if (!(type.flags & typescript.TypeFlags.ESSymbol)) return false;
    return text?.includes('Symbol.for') ?? true;
  }

  function isServerAction(propName: string): boolean {
    return propName.endsWith('Action');
  }

  function isJsxElement(type: ts.Type): boolean {
    return Boolean(type.flags & typescript.TypeFlags.Object) && type.symbol?.name === 'JSXElement';
  }

  function isPromise(type: ts.Type): boolean {
    return Boolean(type.symbol && type.symbol.name === 'Promise');
  }

  function log(info: ts.server.PluginCreateInfo, message: string) {
    info.project.projectService.logger.info(message);
  }

  return { create };
}

/* ---------------------------------------------------------------------------------------------- */

export { createTSPlugin };
