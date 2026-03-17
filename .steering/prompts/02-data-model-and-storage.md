# Prompt 02 — Data Model & Storage Layer

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. The project scaffolding is already in place (Vite + React + TS + Manifest V3). Now you need to implement the data model, storage service, and state management layer that all UI components will consume.

## Reference Architecture

- **Storage**: `chrome.storage.local` under key `"edgespaces_data"`
- **State**: Zustand store with typed actions
- **Data structure**: Flat maps with ID references (not nested trees)

## Task

Implement the TypeScript interfaces, `StorageService` class, and Zustand store in the `src/shared/` directory.

## Requirements

### 1. TypeScript Interfaces — `src/shared/types.ts`

```typescript
export type SpaceColor = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'pink' | 'gray';

export type TreeItemType = 'folder' | 'bookmark';

export interface PinnedSite {
  id: string;
  title: string;
  url: string;
  faviconUrl: string;
  position: number;
}

export interface Space {
  id: string;
  name: string;
  color: SpaceColor;
  pinnedSites: PinnedSite[];
  rootFolderIds: string[];  // Ordered IDs of top-level folders in this space
}

export interface Folder {
  id: string;
  type: 'folder';
  spaceId: string;
  parentId: string | null;   // null = root-level folder
  name: string;
  childIds: string[];        // Ordered IDs of child folders and bookmarks
  expanded: boolean;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  type: 'bookmark';
  spaceId: string;
  parentId: string;          // Parent folder ID (bookmarks always in a folder)
  title: string;
  url: string;
  faviconUrl?: string;
  createdAt: number;
}

export type TreeItem = Folder | Bookmark;

export interface AppState {
  spaces: Space[];
  folders: Record<string, Folder>;
  bookmarks: Record<string, Bookmark>;
  activeSpaceId: string;
  searchQuery: string;
  version: number;
}

export interface StorageData {
  spaces: Space[];
  folders: Record<string, Folder>;
  bookmarks: Record<string, Bookmark>;
  activeSpaceId: string;
  version: number;
}
```

### 2. Storage Service — `src/shared/storage.ts`

Implement a `StorageService` singleton class:

```typescript
class StorageService {
  // Load all data from chrome.storage.local
  async load(): Promise<StorageData | null>

  // Persist full state to chrome.storage.local (debounced externally)
  async save(data: StorageData): Promise<void>

  // Create default initial state (one "Work" space, empty)
  getDefaultState(): StorageData

  // Listen for external storage changes (e.g., from background script)
  onChange(callback: (data: StorageData) => void): () => void
}
```

Key implementation details:
- Use `STORAGE_KEY` from constants
- `getDefaultState()` creates one space named "Work" with color "green", no folders, no bookmarks
- `save()` writes the full `StorageData` object under the storage key
- `onChange()` wraps `chrome.storage.onChanged` and returns an unsubscribe function
- All methods handle the case where `chrome.storage` is undefined (for dev/testing)

### 3. Zustand Store — `src/shared/store.ts`

Implement the Zustand store with these actions:

```typescript
interface AppActions {
  // Initialization
  hydrate(): Promise<void>;                    // Load from storage into Zustand

  // Spaces
  setActiveSpace(spaceId: string): void;
  addSpace(name: string, color: SpaceColor): void;
  renameSpace(spaceId: string, name: string): void;
  deleteSpace(spaceId: string): void;
  setSpaceColor(spaceId: string, color: SpaceColor): void;

  // Pinned Sites
  addPinnedSite(spaceId: string, site: Omit<PinnedSite, 'id' | 'position'>): void;
  removePinnedSite(spaceId: string, siteId: string): void;
  reorderPinnedSites(spaceId: string, siteIds: string[]): void;

  // Folders
  addFolder(spaceId: string, parentId: string | null, name: string): void;
  renameFolder(folderId: string, name: string): void;
  deleteFolder(folderId: string): void;
  toggleFolder(folderId: string): void;

  // Bookmarks
  addBookmark(spaceId: string, parentId: string, title: string, url: string): void;
  updateBookmark(bookmarkId: string, updates: Partial<Pick<Bookmark, 'title' | 'url'>>): void;
  deleteBookmark(bookmarkId: string): void;

  // Tree operations
  moveItem(itemId: string, itemType: TreeItemType, newParentId: string | null, newSpaceId: string, newIndex: number): void;

  // Search
  setSearchQuery(query: string): void;

  // Import
  importData(data: Partial<StorageData>, mode: 'merge' | 'replace'): void;
}

type AppStore = AppState & AppActions;
```

Key implementation details:
- `hydrate()` calls `StorageService.load()`, falls back to `getDefaultState()` if null
- Every mutation action updates Zustand state immediately, then calls a debounced `persist()` function
- `persist()` extracts `StorageData` from state and calls `StorageService.save()`
- Use `debounce` utility (implement a simple one, no lodash) with `PERSIST_DEBOUNCE_MS` (300ms)
- `deleteFolder()` recursively deletes all child folders and bookmarks
- `moveItem()` removes item from old parent's `childIds`, adds to new parent's `childIds` at the specified index, updates `parentId` and `spaceId`
- `addSpace()` generates a new UUID, creates the space, and switches to it
- `deleteSpace()` prevents deleting the last space; deletes all contained folders/bookmarks

### 4. Helper Utilities

**`src/shared/favicon.ts`**:
```typescript
export function getFaviconUrl(url: string, size: 16 | 32 = 16): string {
  // Extract domain from URL, return Google favicon API URL
  // Fallback to empty string if URL is invalid
}
```

**Debounce utility** (inline in `store.ts` or in a `utils.ts`):
```typescript
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T
```

## Constraints

- Do NOT use `eval()`, `innerHTML`, or `new Function()`
- Validate URLs before storing (must match `https?://` pattern)
- Use `crypto.randomUUID()` for all ID generation
- Handle chrome API undefined gracefully (for unit testing outside extension context)

## Expected Output Files

- `src/shared/types.ts` — All interfaces and types
- `src/shared/storage.ts` — `StorageService` singleton
- `src/shared/store.ts` — Zustand store with all actions
- `src/shared/favicon.ts` — Favicon URL helper
- `src/shared/constants.ts` — Updated if needed (should already exist from Prompt 01)

## Acceptance Criteria

- [ ] All TypeScript interfaces compile with `strict: true`
- [ ] `StorageService.load()` returns `null` when no data exists, `StorageData` when it does
- [ ] `StorageService.save()` writes to `chrome.storage.local` under `"edgespaces_data"`
- [ ] `StorageService.getDefaultState()` returns a valid state with one "Work" space
- [ ] Zustand `hydrate()` populates the store from storage on first load
- [ ] All CRUD actions update Zustand state immediately and trigger debounced persistence
- [ ] `deleteFolder()` recursively removes all descendants
- [ ] `moveItem()` correctly updates both old and new parent's `childIds`
- [ ] `deleteSpace()` refuses to delete the last remaining space
- [ ] `getFaviconUrl("https://github.com")` returns `"https://www.google.com/s2/favicons?domain=github.com&sz=16"`
- [ ] URL validation rejects non-http(s) URLs
- [ ] No runtime errors when `chrome.storage` is undefined
