# TypeScript Plugin Specification

## Objective

The plugin enforces that only serializable props are passed to components imported with the `with { use: 'client' }` attribute in the **current file**. It analyzes props passed to these components and raises errors for non-serializable props.

---

## Features

1. **Detect `with { use: 'client' }` Imports**

   - Identify import statements in the current file with the `with { use: 'client' }` attribute.
   - Support namespaced imports, default imports, or named imports.

2. **Analyze Component Usages**

   - Traverse the file to locate where these imported components are used in JSX/TSX.
   - Analyze props passed to the component in these usages.

3. **Validate Prop Serializability**

   - Validate each prop against React’s definition of serializability.
   - Raise an error for any non-serializable prop with clear diagnostics.

4. **Descriptive Errors**
   - Provide clear, actionable error messages for non-serializable props, including the prop name, its type, and why it isn’t serializable.

---

## Implementation Details

- The plugin should reside in the `./src/ts-plugin` folder.

### Workflow

1. **Detect Imports**

   - Hook into TypeScript’s AST to detect `import` statements with the `with { use: 'client' }` attribute.
   - Record the imported components and their identifiers in the file.

2. **Locate Component Usages**

   - Traverse the file to find where these components are used in JSX/TSX.
   - Extract props passed to each usage.

3. **Validate Props**

   - Use TypeScript’s type system to resolve the name and type of each prop.
   - Compare the resolved name (where appropriate) and type against the definition of serializable and non-serializable props.
   - Raise errors for any non-serializable props.

4. **Type-safe**

   - The plugin implementation should be type-safe, so it should specify types where necessary.

5. **Dependencies**

   - Install any necessary dependencies to the `package.json` file.

---

## React’s Definition of Serializable and Non-Serializable Props

### Serializable Props

Serializable props include:

- Primitives
  - `string`
  - `number`
  - `bigint`
  - `boolean`
  - `undefined`
  - `null`
  - `symbol` (only symbols registered in the global Symbol registry via `Symbol.for`)
- Iterables containing serializable values
  - `String`
  - `Array`
  - `Map`
  - `Set`
  - `TypedArray` and `ArrayBuffer`
- `Date`
- Plain objects (those created with object initializers, with serializable properties)
- Functions that are Server Functions (props whose name ends with "Action")
- Client or Server Component elements (JSX)
- Promises

### Non-Serializable Props

Notably, these are not supported:

- Functions that are not imported from marked modules (marked with `with { use: 'client' }` or `with { use: 'server' }`) or marked with `'use server'` in the current file.
- Classes
- Objects that are instances of any class (other than the built-ins mentioned) or objects with a null prototype
- Symbols not registered globally (e.g., `Symbol('my new symbol')`)

---

## Example Cases

### Valid Example

```tsx
import MyComponent from './MyComponent' with { use: 'client' };

const App = () => <MyComponent title="Hello" data={[1, 2, 3]} />;
```

### Invalid Example

```tsx
import MyComponent from './MyComponent' with { use: 'client' };

const App = () => {
  const customClassInstance = new MyClass();
  return <MyComponent custom={customClassInstance} />;
};
// Error: Prop 'custom' is not serializable. Classes are not supported.
```

---

## Deliverables

1. **Plugin Code**

   - Fully functional TypeScript plugin.

2. **Tests**

   - Unit tests for valid and invalid cases.

3. **Error Messages**

   - Descriptive and actionable error messages for non-serializable props.

4. **README**
   - Documentation with installation, usage instructions, and example cases.
