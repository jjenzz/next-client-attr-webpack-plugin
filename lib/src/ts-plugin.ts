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

type JSXElementType = ts.JsxElement | ts.JsxSelfClosingElement;

/* -------------------------------------------------------------------------------------------------
 * ClientAttrPlugin
 * -----------------------------------------------------------------------------------------------*/

class ClientAttrPlugin {
  #typescript: typeof ts;
  #checker: ts.TypeChecker;

  constructor(typescript: typeof ts, checker: ts.TypeChecker) {
    this.#typescript = typescript;
    this.#checker = checker;
  }

  public getSemanticDiagnostics(sourceFile: ts.SourceFile): ts.Diagnostic[] {
    const diagnostics: ts.Diagnostic[] = [];
    const clientImports = this.#findClientImports(sourceFile);

    for (const importDecl of clientImports) {
      const componentUsages = this.#findComponentUsages(importDecl, sourceFile);
      for (const usage of componentUsages) {
        const propDiagnostics = this.#validateProps(usage);
        diagnostics.push(...propDiagnostics);
      }
    }

    return diagnostics;
  }

  #findClientImports(sourceFile: ts.SourceFile): ts.ImportDeclaration[] {
    const imports: ts.ImportDeclaration[] = [];

    const visit = (node: ts.Node) => {
      if (this.#typescript.isImportDeclaration(node)) {
        const isClientImport = /use:(\s*)("|')client("|')/.test(node.getText());
        if (isClientImport) imports.push(node);
      }
      this.#typescript.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  #findComponentUsages(
    importDecl: ts.ImportDeclaration,
    sourceFile: ts.SourceFile,
  ): Array<JSXElementType> {
    const usages: Array<JSXElementType> = [];
    const importedNames = new Set<string>();
    const namespaceImport = new Set<string>();

    if (importDecl.importClause) {
      const namedBindings = importDecl.importClause.namedBindings;
      if (importDecl.importClause.name) importedNames.add(importDecl.importClause.name.text);
      if (namedBindings) {
        if (this.#typescript.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => importedNames.add(element.name.text));
        } else if (this.#typescript.isNamespaceImport(namedBindings)) {
          namespaceImport.add(namedBindings.name.text);
        }
      }
    }

    const visit = (node: ts.Node) => {
      if (this.#typescript.isJsxElement(node) || this.#typescript.isJsxSelfClosingElement(node)) {
        const tagName = this.#typescript.isJsxElement(node)
          ? node.openingElement.tagName.getText()
          : node.tagName.getText();
        const isNamespaced = [...namespaceImport].some((ns) => tagName.startsWith(ns + '.'));
        if (importedNames.has(tagName) || isNamespaced) usages.push(node);
      }
      this.#typescript.forEachChild(node, visit);
    };

    visit(sourceFile);
    return usages;
  }

  #validateProps(jsxElement: JSXElementType): ts.Diagnostic[] {
    const diagnostics: ts.Diagnostic[] = [];
    const props = this.#typescript.isJsxElement(jsxElement)
      ? jsxElement.openingElement.attributes.properties
      : jsxElement.attributes.properties;

    for (const prop of props) {
      if (!this.#typescript.isJsxAttribute(prop)) continue;
      const initializer = prop.initializer;

      if (initializer && this.#typescript.isJsxExpression(initializer)) {
        const expression = initializer.expression;
        if (!expression) continue;
        const type = this.#checker.getTypeAtLocation(expression);
        const propName = prop.name.getText();

        if (!this.#isSerializableType(propName, type, expression.getText())) {
          diagnostics.push(this.#createDiagnostic(prop, type));
        }
      }
    }

    return diagnostics;
  }

  #createDiagnostic(prop: ts.JsxAttribute, type: ts.Type): ts.Diagnostic {
    const propName = prop.name.getText();
    const propType = this.#checker.typeToString(type);
    const isFunction = type.getCallSignatures().length;

    return {
      file: prop.getSourceFile(),
      start: prop.getStart(),
      length: prop.getWidth(),
      category: this.#typescript.DiagnosticCategory.Error,
      code: 100001,
      messageText: `Non-serializable prop '${propName}' of type '${propType}'.${
        isFunction ? ' Did you forget to suffix a server action prop with "Action"?' : ''
      }\n\nLearn more: https://react.dev/reference/rsc/use-client#serializable-types`,
    };
  }

  #isSerializableType(propName: string, type: ts.Type, text?: string): boolean {
    if (type.getCallSignatures().length) return this.#isServerAction(propName);
    return (
      this.#isPrimitive(type) ||
      this.#isSerializableIterable(type) ||
      this.#isPlainObject(type) ||
      this.#isJsxElement(type) ||
      this.#isPromise(type) ||
      this.#isRegisteredSymbol(type, text)
    );
  }

  #isPrimitive(type: ts.Type): boolean {
    return Boolean(
      type.flags &
        (this.#typescript.TypeFlags.String |
          this.#typescript.TypeFlags.Number |
          this.#typescript.TypeFlags.BigInt |
          this.#typescript.TypeFlags.Boolean |
          this.#typescript.TypeFlags.Undefined |
          this.#typescript.TypeFlags.Null),
    );
  }

  #isSerializableIterable(type: ts.Type): boolean {
    return Boolean(type.symbol && builtins.has(type.symbol.name));
  }

  #isPlainObject(type: ts.Type): boolean {
    if (!(type.flags & this.#typescript.TypeFlags.Object)) return false;
    const symbol = type.getSymbol();
    if (!symbol) return true;
    return symbol.name === 'Object' || symbol.name === '__object';
  }

  #isRegisteredSymbol(type: ts.Type, text?: string): boolean {
    if (!(type.flags & this.#typescript.TypeFlags.ESSymbol)) return false;
    return text?.includes('Symbol.for') ?? true;
  }

  #isServerAction(propName: string): boolean {
    return propName === 'action' || propName.endsWith('Action');
  }

  #isJsxElement(type: ts.Type): boolean {
    const isObject = Boolean(type.flags & this.#typescript.TypeFlags.Object);
    return isObject && type.symbol?.name === 'JSXElement';
  }

  #isPromise(type: ts.Type): boolean {
    return Boolean(type.symbol && type.symbol.name === 'Promise');
  }
}

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

    const checker = info.languageService.getProgram()?.getTypeChecker()!;
    const plugin = new ClientAttrPlugin(typescript, checker);

    proxy.getSemanticDiagnostics = (fileName: string) => {
      const prior = ls.getSemanticDiagnostics(fileName);
      const sourceFile = ls.getProgram()?.getSourceFile(fileName);
      if (!sourceFile) return prior;
      return [...prior, ...plugin.getSemanticDiagnostics(sourceFile)];
    };

    info.project.projectService.logger.info('NEXT_CLIENT_ATTR_WEBPACK_PLUGIN: READY');
    return proxy;
  }

  return { create };
}

/* ---------------------------------------------------------------------------------------------- */

export { ClientAttrPlugin, createTSPlugin };
