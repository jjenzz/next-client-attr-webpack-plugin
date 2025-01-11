## Client Import Attribute Plugin for Next.js

This Webpack plugin enables the use of an [import attribute](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with) to define client boundaries in your React Server Components.

```tsx
// src/app/page.tsx
import { Counter } from '@/components/counter' with { use: 'client' };

export default function Page() {
  return <Counter />;
}
```

A `'use client'` [virtual module](https://github.com/sysgears/webpack-virtual-modules) is generated for the component. This module is added to your bundle, replacing the original import path with the virtual module path.

### Installation (Coming Soon)

> [!WARNING]
> This plugin is under development and will be available soon. Once released, you can install it using your preferred package manager:

```bash
npm install -D next-client-attr-webpack-plugin webpack-virtual-modules
```

To enable the plugin, update your Next.js Webpack configuration:

```javascript
// next.config.js
const NextClientAttrWebpackPlugin = require('next-client-attr-webpack-plugin');

module.exports = {
  webpack: (config) => {
    config.plugins.push(new NextClientAttrWebpackPlugin());
    return config;
  },
};
```

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

Use the `use: 'client'` attribute to establish a client/server boundary when importing the component in an RSC (usually your routes):

```tsx
// src/app/page.tsx
import { Counter } from '@/components/counter' with { use: 'client' };

export default function Page() {
  return <Counter />;
}
```

When importing in non-RSC components, the `use: 'client'` attribute is not necessary.
