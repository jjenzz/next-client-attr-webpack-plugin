# Client Import Attribute Plugin for Next.js

A Webpack plugin that simplifies client/server boundaries in React Server Components using [import attributes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with). It automatically generates `'use client'` [virtual modules](https://github.com/sysgears/webpack-virtual-modules) and provides a TypeScript plugin to catch non-serializable props. When importing into non-RSC components, the import attribute is not necessary.

<video src="https://github.com/user-attachments/assets/9ca56ea8-31ac-4225-95bb-2ded326d8054" controls="controls" muted="muted" class="d-block rounded-bottom-2 border-top width-fit" style="max-height:640px; min-height: 200px"></video>

## Contents

- [Installation](#user-content-installation)
- [Example](#user-content-example)
- [Continuous Integration](#user-content-continuous-integration)
- [Why does this exist?](#user-content-why-does-this-exist)

## Installation

```bash
npm install -D next-client-attr-webpack-plugin webpack-virtual-modules
```

To enable the plugin, update your Next.js config:

```javascript
import type { NextConfig } from 'next';
import createClientAttrPlugin from 'next-client-attr-webpack-plugin';

const nextConfig: NextConfig = {
  webpack(config) {
    config.plugins.push(createClientAttrPlugin());
    return config;
  },
};

export default nextConfig;
```

Then add the TypeScript plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "next" }, { "name": "next-client-attr-webpack-plugin" }]
  }
}
```

If you're using VSCode or Cursor, remember to [enable your workspace version of TypeScript](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript).

## Example

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

Use the import attribute to establish a client/server boundary when importing the component in an RSC:

```tsx
// src/app/page.tsx
import { Counter } from '@/components/counter' with { use: 'client' };

export default function Page() {
  return <Counter />;
}
```

## Continuous Integration

Since TypeScript plugins aren't executed during `tsc` builds, you'll need to run the client attribute checks separately with `next-client-attr`. For example, add the following to your typechecking script:

```json
{
  "scripts": {
    "typecheck": "next-client-attr && tsc --noEmit"
  }
}
```

This will first validate your client attributes and then run the TypeScript compiler checks.

## Why does this exist?

A common misconception is that the `'use client'` directive must be added to any component that uses client-side features. However, from the [RFC](https://github.com/reactjs/rfcs/blob/main/text/0227-server-module-conventions.md) for React Server Components:

> [...] you shouldn't add the `"use client"` directive to all Client Components. Only the ones intended to be used directly by the Server. Because indirect ones are still allowed to have non-serializable props.

The directive exists purely to declare a boundary between server and client, and so is only _necessary_ when rendering client components within an RSC. When adding the `"use client"` directive to all client components, we're implicitly declaring that they're unable to receive [non-serializable props](https://react.dev/reference/rsc/use-client#serializable-types) (e.g. `onClick`).

By using the import attribute instead, we can:

- Declare a boundary between server and client only when being "used directly by the Server" as described
- Avoid littering `'use client'` directives throughout our codebase
- Avoid serializability concerns when _authoring_ our shared components
- Get TypeScript validation at the call site where it matters
