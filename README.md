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

## Applications in Separate Repositories

An application can be kept in its own repository and included under `apps/` as a Git submodule. For example, to add a private xdraw repository:

```bash
# From the lotus-neo root directory
git submodule add git@github.com:<user>/xdraw.git apps/xdraw
git add .gitmodules apps/xdraw
git commit -m "Add xdraw as submodule"
git push
```

For a private repository, every contributor needs access to the GitHub repository and SSH or HTTPS authentication configured.

Clone the monorepo together with its submodules:

```bash
git clone --recurse-submodules git@github.com:<user>/lotus-neo.git
```

Initialize submodules in an existing clone:

```bash
git submodule update --init --recursive
```

After publishing a new xdraw commit, update the commit referenced by `lotus-neo`:

```bash
cd apps/xdraw
git pull origin main
cd ../..
git add apps/xdraw
git commit -m "Update xdraw submodule"
git push
```

The main repository tracks only a specific xdraw commit. Updating `lotus-neo` therefore does not automatically move xdraw to its latest commit.

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

### Component with States

```tsx
import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";


export class AppComponent extends NeolitComponent {
  readonly name = state("Neolit");
  render() {
    return (
      <>
        <div>
          <h1>Welcome, {this.name}!</h1>
          <Button label="Click!" onClick={() => 
            {
              const newName = prompt("Type your name:");
              if (newName) {
                this.name.set(newName);
              }
            }
          } />
        </div>
      </>
    );
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
