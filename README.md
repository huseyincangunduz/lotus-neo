# lotus-neo

A Vite-based monorepo for building multiple frontend applications with shared libraries, powered by [Neolit](https://github.com/ubs-platform/neolit).

## Project Structure

```
lotus-neo/
├── apps/
│   ├── admin/          # Admin application
│   └── main/           # Main application
├── libs/
│   ├── ui/
│   │   └── button/     # Button component library
│   └── keltos-kel/     # Another shared library
├── libs-map.js         # Auto-discovers libs and maps @libs/* aliases
├── vite-config-global.js
└── tsconfig.json
```

## Running Applications

All commands are run from the **root** of the monorepo.

```bash
# Start dev server for an app
npm run dev admin
npm run dev main

# Build an app for production
npm run build admin
npm run build main

# Preview the production build
npm run preview admin
npm run preview main
```

> The scripts use `$1` to forward the app name, so always pass the app folder name as the first argument.

## Creating a New Library

1. Create the folder under `libs/`, e.g. `libs/my-lib/src/`.
2. Add an entry point at `libs/my-lib/src/index.ts` that exports everything:
   ```ts
   export * from "./_index";
   ```
3. Create your component / module file, e.g. `libs/my-lib/src/_index.tsx`.
4. That's it — `libs-map.js` auto-discovers the library and maps it to `@libs/my-lib`.

> **Nested libraries** are also supported. For example `libs/ui/button/src/index.ts` is mapped to `@libs/ui/button`. The discovery is recursive.

### Using a Library in an App

```tsx
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
```

Also add the path alias to `tsconfig.json` so TypeScript resolves it:

```json
"paths": {
  "@libs/*": ["./libs/*/src/index.ts"]
}
```

> The root `tsconfig.json` already covers `@libs/*` with a wildcard, so new libraries are picked up automatically.

## Using Neolit

[Neolit](https://github.com/ubs-platform/neolit) is the UI framework this monorepo is built on. Components extend `NeolitComponent` and return JSX from a `render()` method.

### Basic Component

```tsx
import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export class MyComponent extends NeolitComponent {
  render(): NeolitNode | null {
    return <div>Hello from Neolit!</div>;
  }
}
```

### Component with Props

```tsx
export interface MyProps {
  title: string;
}

export class MyComponent extends NeolitComponent {
  title: string;

  constructor({ title }: MyProps) {
    super();
    this.title = title;
  }

  render(): NeolitNode | null {
    return <h1>{this.title}</h1>;
  }
}
```

### JSX Configuration

Neolit's JSX factory is configured globally via `vite-config-global.js` and `tsconfig.json`. No per-file pragma is needed:

```json
// tsconfig.json
"jsx": "react-jsx",
"jsxImportSource": "@ubs-platform/neolit"
```

### Updating Neolit

```bash
npm install @ubs-platform/neolit@latest
```

Check the [Neolit repository](https://github.com/ubs-platform/neolit) for changelogs and migration notes before upgrading.
