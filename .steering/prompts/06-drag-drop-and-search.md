# Prompt 06 — Drag & Drop + Search

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. The sidebar, spaces, pinned grid, and folder tree are all implemented (Prompts 01–05). Now you need to add drag-and-drop reordering and a search feature.

## Reference

- **Libraries**: `@dnd-kit/core` and `@dnd-kit/sortable` (already installed in Prompt 01)
- **Store action**: `moveItem(itemId, itemType, newParentId, newSpaceId, newIndex)` in `src/shared/store.ts`
- **Store action**: `reorderPinnedSites(spaceId, siteIds[])` in `src/shared/store.ts`
- **Store action**: `setSearchQuery(query)` in `src/shared/store.ts`
- **Constants**: `SEARCH_DEBOUNCE_MS = 200`, `DND_AUTO_EXPAND_MS = 500`
- **Existing components**: `<FolderTree>`, `<TreeNode>`, `<FolderItem>`, `<BookmarkItem>`, `<PinnedGrid>`, `<SpaceBar>`

## Task

### Part A: Drag & Drop

Implement drag-and-drop for the folder tree (reorder bookmarks, move between folders, move between spaces) and for pinned sites (reorder within the grid).

### Part B: Search

Implement a search bar that filters bookmarks across all spaces with highlighted results.

---

## Part A: Drag & Drop Requirements

### 1. Tree DnD Setup

Wrap `<FolderTree>` with `@dnd-kit`'s `<DndContext>` and `<SortableContext>`:

- Each `<TreeNode>` becomes a sortable/draggable item via `useSortable` hook
- Drag handle: the full row is the drag handle (or a specific grip icon if preferred)
- Both folders and bookmarks are draggable

### 2. Drop Behavior

Define three types of drops:

**a) Reorder within a folder**: Dropping a sibling above/below another sibling → reorder within the parent's `childIds` array.

**b) Move into a folder**: Dropping onto a folder row → insert the item as the last child of that folder. Visual indicator: the folder row highlights with a colored border.

**c) Reorder root-level folders**: Dropping at the root level → reorder the space's `rootFolderIds`.

### 3. Visual Indicators

- **Drag overlay**: A semi-transparent clone of the dragged row follows the cursor
- **Drop line**: A horizontal colored line (2px, accent color) appears between items at the drop position
- **Folder highlight**: When dragging over a folder, highlight it with a subtle accent border to indicate "drop inside"
- **Auto-expand**: When hovering a collapsed folder for `DND_AUTO_EXPAND_MS` (500ms), auto-expand it

### 4. Cross-Space Drag

- When dragging an item and hovering over a space tab in `<SpaceBar>`:
  - After 500ms, switch to that space
  - Dropping the item then places it at the root level (or into a specific folder) of the target space
  - Item's `spaceId` is updated accordingly
  - Recursively update `spaceId` for all children if dragging a folder

### 5. Pinned Grid DnD

- Wrap `<PinnedGrid>` with its own `<DndContext>` + `<SortableContext>`
- Pinned icons can be reordered by dragging within the grid
- On drop, call `reorderPinnedSites(spaceId, newOrder)` to persist the new order

### 6. Constraints

- Cannot drop a folder into itself or its own descendants (cycle prevention)
- Cannot exceed `MAX_FOLDER_DEPTH` when dropping a folder into another folder
- Bookmark items cannot become root-level (must always be inside a folder)

### 7. Accessibility

- `@dnd-kit` provides keyboard DnD out of the box — ensure it's enabled
- Use `aria-describedby` for drag instructions
- Announce reorder results via `aria-live` region

---

## Part B: Search Requirements

### 1. `<SearchBar>` — `src/sidepanel/components/SearchBar.tsx`

**Layout**:
```
┌─────────────────────────────────────┐
│  🔍  Search bookmarks...      [×]  │
└─────────────────────────────────────┘
```

- Rendered between `<SpaceBar>` (or `<PinnedGrid>`) and `<FolderTree>` in `<SpaceContent>`
- Always visible (not hidden behind a toggle)
- Search icon on the left, clear button on the right (visible when query is non-empty)
- Input is debounced at `SEARCH_DEBOUNCE_MS` (200ms) — calls `setSearchQuery(query)` on the store

### 2. Search Logic

Implement a search function that:
- Searches across **all spaces** (not just the active one)
- Matches against bookmark `title` and `url` (case-insensitive substring match)
- Also matches folder names
- Returns results grouped by space, with breadcrumb path (Space > Folder > Subfolder)

```typescript
interface SearchResult {
  item: Bookmark | Folder;
  space: Space;
  breadcrumb: string;         // e.g., "Work > KIP > Sprints"
  matchField: 'title' | 'url' | 'name';
  matchIndices: [number, number][];  // Start/end indices for highlighting
}
```

### 3. Search Results UI

When a search query is active:
- Replace the `<FolderTree>` with a flat `<SearchResults>` list
- Each result row shows:
  - Favicon (for bookmarks) or folder icon
  - Title/Name with matched text **highlighted** (bold or colored background)
  - URL snippet (for bookmarks) with matched text highlighted
  - Breadcrumb path in muted text: "Work > KIP > Sprints"
- Clicking a bookmark result → opens the URL
- Clicking a folder result → clears search, switches to that space, scrolls to and expands that folder
- If no results → show "No results for '{query}'"

### 4. Keyboard Integration

- `Ctrl+K` / `Cmd+K` focuses the search bar (handled via `chrome.commands` in background script, forwarded to side panel via messaging)
- `Escape` clears the search and returns focus to the tree
- `Arrow Down` from the search input moves focus to the first result
- `Arrow Up/Down` navigates results
- `Enter` on a result opens it

### 5. Wire into `<SpaceContent>`

Update `<SpaceContent>` to:
- Render `<SearchBar>` between the pinned grid and folder tree
- Conditionally render `<SearchResults>` instead of `<FolderTree>` when `searchQuery` is non-empty

## Expected Output Files

- `src/sidepanel/components/SearchBar.tsx` + `SearchBar.module.css`
- `src/sidepanel/components/SearchResults.tsx` + `SearchResults.module.css`
- Updated `src/sidepanel/components/FolderTree.tsx` (wrapped with DnD context)
- Updated `src/sidepanel/components/TreeNode.tsx` (made sortable/draggable)
- Updated `src/sidepanel/components/PinnedGrid.tsx` (DnD for reordering)
- Updated `src/sidepanel/components/SpaceBar.tsx` (cross-space drop target)
- Updated `src/sidepanel/components/SpaceContent.tsx` (search integration)
- New utility: `src/shared/search.ts` (search logic and result types)

## Acceptance Criteria

### Drag & Drop
- [ ] Bookmarks can be reordered within a folder by dragging
- [ ] Bookmarks/folders can be dragged into a different folder
- [ ] Root-level folders can be reordered by dragging
- [ ] Dragging over a collapsed folder auto-expands it after 500ms
- [ ] Dragging over a space tab switches to that space after 500ms
- [ ] Dropping in a new space moves the item (updates `spaceId`)
- [ ] Pinned sites can be reordered by dragging within the grid
- [ ] Visual drag overlay follows the cursor
- [ ] Drop line indicator shows between items at drop position
- [ ] Folder highlight shows when hovering a folder during drag
- [ ] Cannot create cycles (folder into itself or descendants)
- [ ] Cannot exceed `MAX_FOLDER_DEPTH` (drag is rejected with visual feedback)
- [ ] Bookmarks cannot be dropped at root level (must be in a folder)
- [ ] Keyboard DnD works (Space to pick up, Arrow keys to move, Space to drop)
- [ ] All DnD operations persist to storage

### Search
- [ ] Search bar renders between pinned grid and folder tree
- [ ] Typing filters bookmarks across all spaces (debounced 200ms)
- [ ] Results show favicon, title with highlighted match, URL, breadcrumb
- [ ] Clicking a bookmark result opens the URL
- [ ] Clicking a folder result navigates to that folder in the tree
- [ ] `Ctrl+K` / `Cmd+K` focuses the search bar
- [ ] `Escape` clears search
- [ ] Arrow keys navigate results, Enter opens
- [ ] "No results" message when query has no matches
- [ ] Clear button (×) visible when query is non-empty
