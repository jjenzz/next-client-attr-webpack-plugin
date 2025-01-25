#!/usr/bin/env node

import ts from 'typescript';
import { ClientAttrPlugin } from '../ts-plugin';

function check() {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
  let hasErrors = false;

  if (!configPath) {
    console.error('Could not find a valid tsconfig.json.');
    process.exit(1);
  }

  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);

  if (error) {
    console.error('Error reading tsconfig.json:', error.messageText);
    process.exit(1);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const checker = program.getTypeChecker();
  const plugin = new ClientAttrPlugin(ts, checker);
  const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }

    const diagnostics = plugin.getSemanticDiagnostics(sourceFile);
    if (diagnostics.length > 0) {
      console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
      hasErrors = true;
    }
  }

  if (hasErrors) process.exit(1);
  process.exit(0);
}

check();
