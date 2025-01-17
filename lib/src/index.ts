import { ClientAttrPlugin } from './plugin.js';
import { createTSPlugin } from './ts-plugin.js';

const plugin = (options?: Parameters<typeof createTSPlugin>[0]) => {
  if (options && 'typescript' in options) return createTSPlugin(options);
  return new ClientAttrPlugin();
};

export default plugin;
module.exports = plugin;
