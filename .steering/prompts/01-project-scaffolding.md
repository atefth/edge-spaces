# Prompt 01 — Project Scaffolding

## Context

You are building **Edge Spaces**, a Chromium browser extension that provides an Arc Browser-style sidebar bookmark manager. This is the first task: set up the project foundation.

## Tech Stack

- **React 18** + **TypeScript 5.x**
- **Vite** with `@crxjs/vite-plugin` for browser extension bundling
- **Manifest V3** with `chrome.sidePanel` API
- **CSS Modules** for component styling
- **Zustand** for state management (installed now, used in Prompt 02)
- **`@dnd-kit/core`** + **`@dnd-kit/sortable`** (installed now, used in Prompt 06)

## Task

Initialize the full project structure, configure the build pipeline, and create the Manifest V3 configuration so the extension can be loaded in Edge/Chrome and open a side panel.

## Requirements

### 1. Initialize the project

```bash
# Expected commands (do not run — implement the equivalent config)
pnpm create vite@latest . --template react-ts
pnpm add @crxjs/vite-plugin@beta zustand @dnd-kit/core @dnd-kit/sortable
```

### 2. Configure Vite for browser extension

Create `vite.config.ts`:
- Import and configure `@crxjs/vite-plugin` with the manifest
- Set `build.outDir` to `dist`
- Set `build.target` to `esnext`

### 3. Create `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Edge Spaces",
  "version": "0.1.0",
  "description": "Arc-style sidebar bookmark manager for Edge",
  "permissions": ["sidePanel", "storage", "activeTab", "contextMenus"],
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "background": {
    "service_worker": "src/background/service-worker.ts"
  },
  "action": {
    "default_icon": {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png"
    },
    "default_title": "Toggle Edge Spaces"
  },
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Ctrl+B", "mac": "Command+B" },
      "description": "Toggle sidebar"
    },
    "focus_search": {
      "suggested_key": { "default": "Ctrl+K", "mac": "Command+K" },
      "description": "Focus search bar"
    }
  },
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  }
}
```

### 4. Create the directory structure

```
edge-spaces/
├── public/
│   └── icons/           # Placeholder PNGs (can be simple colored squares)
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/    # Empty dir, populated in later prompts
│   │   └── styles/
│   │       ├── variables.css
│   │       └── global.css
│   └── shared/
│       ├── types.ts       # Empty file, populated in Prompt 02
│       ├── storage.ts     # Empty file, populated in Prompt 02
│       ├── store.ts       # Empty file, populated in Prompt 02
│       └── constants.ts
├── manifest.json
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .gitignore
```

### 5. Side Panel Entry Point

**`src/sidepanel/index.html`**:
- Standard HTML5 document
- Links to `main.tsx` via `<script type="module">`
- Includes `global.css` and `variables.css`

**`src/sidepanel/main.tsx`**:
- Mounts `<App />` to `#root`

**`src/sidepanel/App.tsx`**:
- Renders a placeholder: `<div className="sidebar"><h1>Edge Spaces</h1><p>Sidebar loading...</p></div>`
- This will be replaced in Prompt 03

### 6. Background Service Worker

**`src/background/service-worker.ts`**:
- On `chrome.action.onClicked`: toggle the side panel via `chrome.sidePanel.open()`
- Register an empty context menu placeholder (populated later)
- Log "Edge Spaces service worker started" on install

### 7. Base Styles

**`src/sidepanel/styles/variables.css`**:
```css
:root {
  /* Arc-inspired color palette */
  --bg-primary: #f5f5f0;
  --bg-secondary: #eceee8;
  --bg-hover: #e2e5dc;
  --text-primary: #1a1a1a;
  --text-secondary: #6b6b6b;
  --accent-green: #4a9960;
  --accent-blue: #4a7fb5;
  --accent-purple: #8b5fbf;
  --border-color: #d4d6cf;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-lg: 15px;
  --sidebar-width: 100%;
  --tree-indent: 16px;
}
```

**`src/sidepanel/styles/global.css`**:
- CSS reset (box-sizing, margin/padding reset)
- Body styles using CSS variables
- Scrollbar styling (thin, matching theme)

### 8. Constants

**`src/shared/constants.ts`**:
```typescript
export const STORAGE_KEY = 'edgespaces_data';
export const STORAGE_VERSION = 1;
export const MAX_FOLDER_DEPTH = 5;
export const MAX_PINNED_SITES = 12;
export const FAVICON_BASE_URL = 'https://www.google.com/s2/favicons';
export const SEARCH_DEBOUNCE_MS = 200;
export const PERSIST_DEBOUNCE_MS = 300;
export const DND_AUTO_EXPAND_MS = 500;
```

### 9. Configuration Files

**`tsconfig.json`**:
- `target: ESNext`, `module: ESNext`, `jsx: react-jsx`
- `strict: true`
- Path alias: `@/` → `src/`

**`.gitignore`**:
- `node_modules/`, `dist/`, `.DS_Store`, `*.crx`, `*.pem`

## Expected Output

After this task, the developer should be able to:
1. Run `pnpm install`
2. Run `pnpm dev` to start Vite dev server
3. Run `pnpm build` to produce a `dist/` folder
4. Load `dist/` as an unpacked extension in Edge
5. Click the extension icon and see the side panel open with "Edge Spaces" placeholder text

## Acceptance Criteria

- [ ] `pnpm build` succeeds without errors
- [ ] Extension loads in `edge://extensions` with Developer Mode on
- [ ] Clicking the extension icon opens the side panel
- [ ] Side panel shows the placeholder React app
- [ ] Background service worker logs "Edge Spaces service worker started" on install
- [ ] No CSP violations in the console
- [ ] TypeScript compiles with `strict: true` and no errors
