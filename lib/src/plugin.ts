import type { Compiler } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { resolve } from 'node:path';

export class ClientAttrPlugin {
  private virtualModules: VirtualModulesPlugin;
  private generatedFiles: Map<string, string>;

  constructor() {
    this.virtualModules = new VirtualModulesPlugin();
    this.generatedFiles = new Map();
  }

  apply(compiler: Compiler) {
    this.virtualModules.apply(compiler);

    compiler.options.module.rules.unshift({
      test: /\.[jt]sx?$/,
      enforce: 'pre',
      exclude: /node_modules/,
      use: {
        loader: resolve(__dirname, 'loader.js'),
        options: {
          virtualModules: this.virtualModules,
          generatedFiles: this.generatedFiles,
        },
      },
    });
  }
}
