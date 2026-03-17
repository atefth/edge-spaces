# Prompt 05 — Folder Tree & Bookmarks

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. The sidebar shell, spaces (Prompt 03), and pinned grid (Prompt 04) are implemented. Now you need to build the folder tree — the primary bookmark management interface, matching Arc Browser's hierarchical sidebar.

## Reference

- **Data model** (from `src/shared/types.ts`):
  - `Folder { id, type: 'folder', spaceId, parentId, name, childIds, expanded, createdAt }`
  - `Bookmark { id, type: 'bookmark', spaceId, parentId, title, url, faviconUrl, createdAt }`
  - `TreeItem = Folder | Bookmark`
- **Store actions** (from `src/shared/store.ts`):
  - `addFolder()`, `renameFolder()`, `deleteFolder()`, `toggleFolder()`
  - `addBookmark()`, `updateBookmark()`, `deleteBookmark()`
- **Constants**: `MAX_FOLDER_DEPTH = 5`, `FAVICON_BASE_URL`
- **Reusable components**: `<InlineEdit>`, `<ConfirmDialog>` (from Prompt 03)
- **Parent**: `<SpaceContent>` renders `<FolderTree>` below the pinned grid

## Task

Build the recursive folder tree with folder/bookmark CRUD, context menus, and inline editing. This is the most complex UI component.

## Requirements

### 1. `<FolderTree>` — `src/sidepanel/components/FolderTree.tsx`

The top-level tree container for a space:
- Reads the active space's `rootFolderIds` from the store
- For each root folder ID, renders a `<TreeNode>`
- If no folders exist, shows an empty state: "No bookmarks yet" with an "Add Folder" button
- Has a toolbar/action bar at the top with:
  - "+ New Folder" button (creates a root-level folder in this space)
  - "+ Add Current Tab" button (adds current tab as bookmark — prompts to select a folder if multiple exist, otherwise adds to the first/only folder)

### 2. `<TreeNode>` — `src/sidepanel/components/TreeNode.tsx`

A recursive component that renders either a `<FolderItem>` or a `<BookmarkItem>` based on the item type:

```tsx
interface TreeNodeProps {
  itemId: string;
  itemType: TreeItemType;
  depth: number;  // Current nesting depth (0 = root)
}
```

- Looks up the item from `store.folders[itemId]` or `store.bookmarks[itemId]`
- If it's a `Folder`:
  - Renders `<FolderItem>`
  - If `folder.expanded`, recursively renders `<TreeNode>` for each `childId`
- If it's a `Bookmark`:
  - Renders `<BookmarkItem>`
- Indentation: `paddingLeft = depth * var(--tree-indent)` (16px per level)

### 3. `<FolderItem>` — `src/sidepanel/components/FolderItem.tsx`

A single folder row in the tree:

**Layout** (single row, 28px height):
```
[▶/▼] [📁] [Folder Name                    ] [⋯]
 chevron icon   name (or InlineEdit)         actions
```

**Interactions**:
- **Click chevron** → `toggleFolder(folderId)` (expand/collapse)
- **Click name** → also toggles expand/collapse
- **Double-click name** → enter inline rename mode (via `<InlineEdit>`)
- **Right-click** → show `<ContextMenu>` with:
  - New Bookmark (inside this folder)
  - New Subfolder (if depth < `MAX_FOLDER_DEPTH`)
  - Add Current Tab (as bookmark in this folder)
  - Rename
  - Delete (shows `<ConfirmDialog>` if folder is non-empty)
- **Hover** → show subtle "⋯" action button that opens same context menu

**Visual**:
- Chevron rotates 90° when expanded (CSS transition)
- Folder icon (📁) uses a simple SVG
- Font weight: slightly bolder than bookmarks (`font-weight: 500`)
- Hover background: `var(--bg-hover)`

### 4. `<BookmarkItem>` — `src/sidepanel/components/BookmarkItem.tsx`

A single bookmark row in the tree:

**Layout** (single row, 28px height):
```
[🌐] [Bookmark Title                        ] [⋯]
favicon   title (or InlineEdit)              actions
```

**Interactions**:
- **Click** → open URL in current tab: `chrome.tabs.update(undefined, { url: bookmark.url })`
- **Middle-click** or **Ctrl+click** → open in new tab: `chrome.tabs.create({ url: bookmark.url })`
- **Double-click** → enter inline edit mode for the title
- **Right-click** → show `<ContextMenu>` with:
  - Open
  - Open in New Tab
  - Edit (opens a small edit form for title + URL)
  - Copy URL
  - Move to… (shows folder picker — can be deferred to Prompt 06)
  - Delete
- **Hover** → show subtitle with URL (truncated) and "⋯" action button

**Visual**:
- Favicon 16×16 via `getFaviconUrl(bookmark.url, 16)`, fallback to globe icon
- Title truncated with ellipsis
- URL shown on hover as a subtle subtitle below the title (or tooltip)
- Hover background: `var(--bg-hover)`

### 5. `<ContextMenu>` — `src/sidepanel/components/ContextMenu.tsx`

A custom context menu overlay (not native browser context menu):

```tsx
interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;  // Red text
  separator?: boolean;    // Render a divider line instead
  children?: ContextMenuItem[];  // Submenu
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}
```

- Renders as an absolutely positioned overlay at `{x, y}`
- Closes on click outside, Escape, or scroll
- Supports one level of submenu (for "Change Color" in SpaceBar)
- Styled with `var(--bg-primary)`, subtle border, slight box-shadow, `var(--radius-md)` corners
- Items have icon + label, hover state, disabled state
- Destructive items (Delete) have red text

### 6. Bookmark Edit Form

When the user chooses "Edit" from a bookmark's context menu, show a small inline or popover form:
- Two fields: Title (text input) and URL (url input)
- Save and Cancel buttons
- URL validation: must match `https?://` pattern
- On save, call `updateBookmark(bookmarkId, { title, url })`

### 7. Wire into `<SpaceContent>`

Replace the `<FolderTree>` placeholder in `SpaceContent.tsx` with the actual component.

## Data Flow

```
User right-clicks folder → ContextMenu renders at cursor position
User clicks "New Bookmark" → addBookmark(spaceId, folderId, "New Bookmark", "https://")
  → Zustand updates folders[folderId].childIds and bookmarks map
  → React re-renders FolderItem's children
  → New BookmarkItem appears in inline edit mode (auto-focus)
  → User types title, presses Enter → updateBookmark()
  → Debounced persist to chrome.storage.local
```

## Expected Output Files

- `src/sidepanel/components/FolderTree.tsx` + `FolderTree.module.css`
- `src/sidepanel/components/TreeNode.tsx` + `TreeNode.module.css`
- `src/sidepanel/components/FolderItem.tsx` + `FolderItem.module.css`
- `src/sidepanel/components/BookmarkItem.tsx` + `BookmarkItem.module.css`
- `src/sidepanel/components/ContextMenu.tsx` + `ContextMenu.module.css`
- Updated `src/sidepanel/components/SpaceContent.tsx`

## Acceptance Criteria

- [ ] Folder tree renders the active space's folder hierarchy recursively
- [ ] Folders expand/collapse with chevron rotation animation
- [ ] Folder expand/collapse state persists (stored in `Folder.expanded`)
- [ ] Clicking a bookmark opens its URL in the current tab
- [ ] Middle-click / Ctrl+click opens bookmark in a new tab
- [ ] Double-click on folder/bookmark name enters inline edit mode
- [ ] Context menu appears on right-click with correct items per item type
- [ ] "New Bookmark" in a folder's context menu adds a bookmark and enters edit mode
- [ ] "New Subfolder" respects `MAX_FOLDER_DEPTH` (disabled at depth 5)
- [ ] "Add Current Tab" queries `chrome.tabs` and adds as bookmark
- [ ] "Delete" on a non-empty folder shows `<ConfirmDialog>`
- [ ] "Copy URL" copies to clipboard via `navigator.clipboard.writeText()`
- [ ] Edit form validates URL format
- [ ] Indentation increases by `var(--tree-indent)` per depth level
- [ ] Empty tree shows "No bookmarks yet" with "Add Folder" action
- [ ] Custom `<ContextMenu>` supports icons, disabled items, destructive items, submenus
- [ ] Context menu closes on outside click, Escape, or scroll
- [ ] All components use CSS Modules
- [ ] Bookmark item shows favicon with error fallback
- [ ] Tree handles 200+ items without visible lag
