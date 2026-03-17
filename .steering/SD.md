# High-Level Software Design — Edge Spaces

## 1. Overview

Edge Spaces is a Chromium browser extension built with **React 18 + TypeScript**, bundled via **Vite** with `@crxjs/vite-plugin`. It uses the **chrome.sidePanel API** (Manifest V3) to render a persistent sidebar for bookmark management, and **chrome.storage.local** for data persistence.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| UI Framework | React 18 | Component-based, large ecosystem, TypeScript-first |
| Language | TypeScript 5.x | Type safety for data model, refactoring confidence |
| Bundler | Vite + `@crxjs/vite-plugin` | Fast HMR, native browser extension support |
| State Management | Zustand | Lightweight, no boilerplate, works with chrome.storage |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessible, tree-friendly DnD, React-native |
| Styling | CSS Modules + CSS Custom Properties | Scoped styles, theme variables, no runtime cost |
| Manifest | Manifest V3 | Required for modern Chromium extension APIs |
| Storage | `chrome.storage.local` | 10MB cap, no backend needed |
| IDs | `crypto.randomUUID()` | Native, no dependencies |

---

## 3. Extension Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Edge Browser                          │
│                                                          │
│  ┌────────────────────┐     ┌─────────────────────────┐  │
│  │   Side Panel        │     │   Background Script     │  │
│  │   (React App)       │◄───►│   (Service Worker)      │  │
│  │                     │     │                         │  │
│  │  ┌───────────────┐  │     │  • chrome.commands      │  │
│  │  │  <App>        │  │     │    listener             │  │
│  │  │  ├─ SpaceBar  │  │     │  • chrome.contextMenus  │  │
│  │  │  ├─ SearchBar │  │     │    registration         │  │
│  │  │  ├─ PinnedGrid│  │     │  • chrome.sidePanel     │  │
│  │  │  ├─ FolderTree│  │     │    toggle handler       │  │
│  │  │  └─ ImportWiz │  │     │  • chrome.storage       │  │
│  │  └───────────────┘  │     │    .onChanged listener  │  │
│  │         │           │     └────────────┬────────────┘  │
│  │         │ Zustand   │                  │               │
│  │         ▼           │     ┌────────────▼────────────┐  │
│  │  ┌───────────────┐  │     │  chrome.storage.local   │  │
│  │  │  AppStore     │──┼────►│                         │  │
│  │  │  (Zustand)    │◄─┼────│  Key: "edgespaces_data" │  │
│  │  └───────────────┘  │     └─────────────────────────┘  │
│  └────────────────────┘                                  │
└──────────────────────────────────────────────────────────┘
```

### Entry Points

| Entry Point | File | Purpose |
|------------|------|---------|
| Side Panel | `src/sidepanel/index.html` → `src/sidepanel/main.tsx` | React app rendered in the side panel |
| Background | `src/background/service-worker.ts` | Handles commands, context menus, panel toggle |

---

## 4. Directory Structure

```
edge-spaces/
├── .steering/                    # Project steering documents
│   ├── PRD.md
│   ├── SD.md
│   └── prompts/
│       ├── 01-project-scaffolding.md
│       ├── 02-data-model-and-storage.md
│       ├── ...
│       └── 08-theming-shortcuts-polish.md
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── src/
│   ├── background/
│   │   └── service-worker.ts       # Background script
│   ├── sidepanel/
│   │   ├── index.html              # Side panel HTML entry
│   │   ├── main.tsx                # React root mount
│   │   ├── App.tsx                 # Root component
│   │   ├── components/
│   │   │   ├── Sidebar.tsx         # Main layout shell
│   │   │   ├── SpaceBar.tsx        # Space tab bar
│   │   │   ├── SpaceContent.tsx    # Active space content area
│   │   │   ├── PinnedGrid.tsx      # Favicon grid for pinned sites
│   │   │   ├── SearchBar.tsx       # Search input + results
│   │   │   ├── FolderTree.tsx      # Tree container
│   │   │   ├── TreeNode.tsx        # Recursive tree node
│   │   │   ├── FolderItem.tsx      # Folder row UI
│   │   │   ├── BookmarkItem.tsx    # Bookmark row UI
│   │   │   ├── ContextMenu.tsx     # Custom context menu overlay
│   │   │   ├── ImportWizard.tsx    # Arc import modal/flow
│   │   │   ├── ConfirmDialog.tsx   # Reusable confirmation modal
│   │   │   └── InlineEdit.tsx      # Inline text editing component
│   │   └── styles/
│   │       ├── variables.css       # CSS custom properties (theme)
│   │       ├── global.css          # Base resets and typography
│   │       └── *.module.css        # Per-component CSS modules
│   └── shared/
│       ├── types.ts                # TypeScript interfaces
│       ├── storage.ts              # StorageService class
│       ├── store.ts                # Zustand store
│       ├── arc-import-parser.ts    # Arc HTML bookmark parser
│       ├── favicon.ts              # Favicon URL helper
│       └── constants.ts            # App-wide constants
├── manifest.json                   # Manifest V3 config (generated by crxjs)
├── vite.config.ts                  # Vite + crxjs plugin config
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## 5. Data Model

### TypeScript Interfaces

```typescript
interface Space {
  id: string;                  // crypto.randomUUID()
  name: string;                // e.g., "Work", "Personal"
  color: SpaceColor;           // Accent color enum
  pinnedSites: PinnedSite[];   // Ordered list of pinned favicons
  rootFolderIds: string[];     // Ordered IDs of top-level folders
}

interface Folder {
  id: string;
  spaceId: string;             // Parent space
  parentId: string | null;     // null = root-level folder
  name: string;
  childIds: string[];          // Ordered IDs of child folders and bookmarks
  expanded: boolean;           // UI state: is folder expanded?
  createdAt: number;           // Unix timestamp
}

interface Bookmark {
  id: string;
  spaceId: string;
  parentId: string;            // Parent folder ID
  title: string;
  url: string;
  faviconUrl?: string;
  createdAt: number;
}

interface PinnedSite {
  id: string;
  title: string;
  url: string;
  faviconUrl: string;
  position: number;            // Order in the grid
}

type SpaceColor = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'pink' | 'gray';

type TreeItem = Folder | Bookmark;

interface AppState {
  spaces: Space[];
  folders: Record<string, Folder>;    // Flat map by ID for O(1) lookup
  bookmarks: Record<string, Bookmark>; // Flat map by ID
  activeSpaceId: string;
  searchQuery: string;
}
```

### Storage Schema

All data is stored under a single key in `chrome.storage.local`:

```json
{
  "edgespaces_data": {
    "spaces": [...],
    "folders": { "uuid1": {...}, "uuid2": {...} },
    "bookmarks": { "uuid3": {...}, "uuid4": {...} },
    "activeSpaceId": "uuid1",
    "version": 1
  }
}
```

The `version` field enables future data migrations.

---

## 6. Data Flow

```
User Action (click, drag, type)
        │
        ▼
React Component (event handler)
        │
        ▼
Zustand Store Action (update in-memory state)
        │
        ├──► React re-render (immediate UI update)
        │
        └──► StorageService.persist() (async write to chrome.storage.local)
                │
                ▼
        chrome.storage.onChanged event
                │
                ▼
        Background script (if needed, e.g., badge update)
```

### Key Principles

1. **Optimistic UI**: Zustand state updates immediately; storage write is async
2. **Single source of truth**: Zustand store is the runtime source; storage is the persistence layer
3. **Flat + References**: Folders and bookmarks stored in flat maps with ID references (not deeply nested) for efficient updates
4. **Lazy hydration**: On panel open, load full state from storage into Zustand once

---

## 7. Component Interaction Diagram

```
┌─────────────────────────────────────────────┐
│ <App>                                       │
│  ├── <Sidebar>                              │
│  │    ├── <SpaceBar>                        │
│  │    │    ├── SpaceTab × N (click=switch)  │
│  │    │    └── AddSpaceButton (+)           │
│  │    │                                     │
│  │    └── <SpaceContent>                    │
│  │         ├── <PinnedGrid>                 │
│  │         │    └── PinnedIcon × M          │
│  │         ├── <SearchBar>                  │
│  │         │    └── SearchResults (overlay) │
│  │         └── <FolderTree>                 │
│  │              └── <TreeNode> (recursive)  │
│  │                   ├── <FolderItem>       │
│  │                   │    └── <TreeNode>... │
│  │                   └── <BookmarkItem>     │
│  │                                          │
│  ├── <ContextMenu> (portal, absolute pos)   │
│  ├── <ImportWizard> (modal overlay)         │
│  └── <ConfirmDialog> (modal overlay)        │
└─────────────────────────────────────────────┘
```

---

## 8. Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Edge Spaces",
  "version": "0.1.0",
  "description": "Arc-style sidebar bookmark manager for Edge",
  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "contextMenus"
  ],
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

---

## 9. Key Technical Decisions

### Why Flat Storage with ID References (not nested trees)?

Nested trees require deep cloning for immutable state updates and make it hard to move items between parents. A flat `Record<string, Folder>` + `Record<string, Bookmark>` with `childIds[]` references allows:
- O(1) lookup by ID
- Efficient move operations (update two `childIds` arrays)
- Simple serialization to `chrome.storage.local`

### Why Zustand over React Context?

- No boilerplate reducers/actions
- Built-in `subscribe` for side effects (storage persistence)
- Selector-based re-rendering (only components using changed data re-render)
- Tiny bundle (~1KB)

### Why `@dnd-kit` over `react-beautiful-dnd`?

- `react-beautiful-dnd` is deprecated (no longer maintained)
- `@dnd-kit` has first-class tree support via `@dnd-kit/sortable`
- Better accessibility (keyboard DnD built in)
- Active maintenance and smaller bundle

### Why CSS Modules over Tailwind/styled-components?

- Zero runtime cost
- Scoped by default (no class name collisions)
- CSS custom properties for theming work naturally
- No build-time CSS framework dependency

---

## 10. Security Considerations

- **No remote code execution**: All JS is bundled; CSP in manifest enforces `script-src 'self'`
- **No eval/innerHTML**: React's JSX prevents XSS; Arc import parser uses DOMParser (sandboxed)
- **Minimal permissions**: Only `sidePanel`, `storage`, `activeTab`, `contextMenus`
- **No network requests**: Except favicon fetching (Google's public API, read-only)
- **Input validation**: URL validation before storing bookmarks (must be valid `https?://` URL)
- **Storage bounds**: Total data checked against a soft limit; warning shown if approaching 10MB

---

## 11. Performance Considerations

- **Virtualized tree**: If folder tree exceeds 200 visible nodes, use `react-window` for virtual scrolling
- **Debounced persistence**: Storage writes are debounced (300ms) to batch rapid changes
- **Memoized components**: `React.memo` on `TreeNode`, `BookmarkItem`, `FolderItem` to prevent cascade re-renders
- **Lazy favicon loading**: Favicons use `loading="lazy"` on `<img>` tags
- **Indexed search**: Search filters operate on a pre-built flat array of `{id, title, url, path}` tuples, rebuilt on data change
