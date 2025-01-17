## Client Import Attribute Plugin for Next.js

This Webpack plugin enables the use of an [import attribute](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with) to define client boundaries in your React Server Components.

A `'use client'` [virtual module](https://github.com/sysgears/webpack-virtual-modules) is generated for the component and the included TypeScript plugin errors when non-serializable props are passed to the client component.

<video src="https://github.com/user-attachments/assets/9ca56ea8-31ac-4225-95bb-2ded326d8054" controls="controls" muted="muted" class="d-block rounded-bottom-2 border-top width-fit" style="max-height:640px; min-height: 200px"></video>

### Installation (Coming Soon)

> [!WARNING]
> This plugin is under development and will be available soon. Once released, you can install it using your preferred package manager:

```bash
npm install -D next-client-attr-webpack-plugin webpack-virtual-modules
```

To enable the plugin, update your Next.js Webpack configuration:

```javascript
// next.config.js
const createClientAttrPlugin = require('next-client-attr-webpack-plugin');

module.exports = {
  webpack: (config) => {
    config.plugins.push(createClientAttrPlugin());
    return config;
  },
};
```

Add the typescript plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "next" }, { "name": "next-client-attr-webpack-plugin" }]
  }
}
```

If you're using VSCode or Cursor, remember to [enable your workspace version of typescript](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript).

### Example

Create a client component using a [client-only import](https://www.npmjs.com/package/client-only) when you need client features. Ensure the package is installed in your project.

```tsx
// src/components/counter.tsx
import 'client-only';
import * as React from 'react';

function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      {count}
      <button onClick={() => setCount((count) => count + 1)}>Increment</button>
    </div>
  );
}
```

Use the `use: 'client'` attribute to establish a client/server boundary when importing the component in an RSC:

```tsx
// src/app/page.tsx
import { Counter } from '@/components/counter' with { use: 'client' };

export default function Page() {
  return <Counter />;
}
```

When importing in non-RSC components, the `use: 'client'` attribute is not necessary.
