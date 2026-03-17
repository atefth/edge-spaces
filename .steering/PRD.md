# Product Requirements Definition — Edge Spaces

## Overview

**Edge Spaces** is a Chromium browser extension that brings Arc Browser's sidebar bookmark management experience to Microsoft Edge (and other Chromium browsers). Users can organize bookmarks into **Spaces** (e.g., Work, Personal), pin frequently used sites as a favicon grid, create nested folder hierarchies, and import their existing Arc Browser bookmarks.

## Target Users

- Power users who manage 50–500+ bookmarks across multiple contexts (work, personal, projects)
- Former Arc Browser users migrating to Edge/Chrome/Brave who want to preserve their sidebar workflow
- Users who find the native bookmark manager inadequate for hierarchical, contextual organization

## Goals

1. Replicate the core Arc Browser sidebar UX within Edge's side panel
2. Enable fast, keyboard-driven bookmark navigation
3. Support importing existing Arc Browser bookmark exports
4. Zero server dependency — all data stays local in the browser

## Non-Goals

- Tab management (Arc's tab pinning/auto-archiving)
- Split view or multi-pane browsing
- Cloud sync across devices (may be added later)
- Browser history integration

---

## Feature Requirements

### F1 — Sidebar Panel (P0)

**Description**: The extension opens as a persistent side panel in Edge using the `chrome.sidePanel` API.

**User Stories**:
- As a user, I can click the extension icon to open/close the sidebar panel
- As a user, the sidebar persists across tab navigation within the same window
- As a user, the sidebar renders immediately without loading spinners

**Acceptance Criteria**:
- [ ] Extension icon in toolbar toggles the side panel open/closed
- [ ] Side panel renders the React app with the full sidebar UI
- [ ] Panel width is reasonable (300–400px) and does not obstruct page content
- [ ] Panel survives tab switches without losing state

---

### F2 — Spaces (P0)

**Description**: Spaces are top-level organizational containers (like Arc's "Work" and "Personal" spaces). Each space has its own set of pinned sites, folders, and bookmarks.

**User Stories**:
- As a user, I can create a new space with a name and optional color
- As a user, I can switch between spaces via a tab bar at the top of the sidebar
- As a user, I can rename or delete a space
- As a user, I see a confirmation dialog before deleting a space with content

**Acceptance Criteria**:
- [ ] Space tab bar displays all spaces horizontally
- [ ] Clicking a space tab switches the visible content below
- [ ] "+" button creates a new space with a default name ("New Space")
- [ ] Double-click on space tab enables inline rename
- [ ] Right-click on space tab shows context menu with Rename / Delete options
- [ ] Deleting a space with content shows a confirmation modal
- [ ] Active space ID is persisted so it restores on panel reopen
- [ ] At least one space must always exist (cannot delete the last space)

---

### F3 — Pinned Sites Grid (P0)

**Description**: At the top of each space, a grid of favicon icons represents pinned/favorite sites — matching Arc's top icon row.

**User Stories**:
- As a user, I can pin the current tab as a site icon in the grid
- As a user, I can click a pinned site icon to navigate to that URL
- As a user, I can remove a pinned site from the grid
- As a user, I see a tooltip with the site name on hover

**Acceptance Criteria**:
- [ ] Grid displays up to 12 pinned sites in a 4-column CSS grid layout
- [ ] Each cell shows a 32×32 favicon with rounded corners
- [ ] Hovering shows a tooltip with the site title
- [ ] "Pin current tab" action available via a "+" button in the grid
- [ ] Right-click on a pin shows "Remove" option
- [ ] Pinned sites are stored per-space
- [ ] Favicons are fetched via Google's favicon API (`https://www.google.com/s2/favicons?domain=...&sz=32`)

---

### F4 — Folder Tree (P0)

**Description**: Below the pinned grid, each space contains a hierarchical folder tree. Folders can be nested up to 5 levels deep and contain bookmarks.

**User Stories**:
- As a user, I can create folders and nest them within other folders
- As a user, I can expand/collapse folders by clicking the chevron
- As a user, I can see the folder hierarchy with proper indentation

**Acceptance Criteria**:
- [ ] Folders render as expandable tree nodes with a chevron icon
- [ ] Clicking the chevron toggles expand/collapse
- [ ] Folder expand/collapse state persists across panel reopens
- [ ] Indentation increases by 16px per nesting level
- [ ] Maximum nesting depth is 5 levels (UI prevents deeper nesting)
- [ ] Empty folders show a subtle "Empty folder" placeholder

---

### F5 — Bookmark CRUD (P0)

**Description**: Users can add, edit, and delete bookmarks within any folder.

**User Stories**:
- As a user, I can add the current tab as a bookmark to a specific folder
- As a user, I can manually create a bookmark with a title and URL
- As a user, I can edit a bookmark's title and URL
- As a user, I can delete a bookmark
- As a user, clicking a bookmark opens that URL in the active tab

**Acceptance Criteria**:
- [ ] Each bookmark displays a favicon + title
- [ ] Clicking a bookmark opens the URL in the current tab
- [ ] Middle-click or Ctrl+click opens in a new tab
- [ ] "Add current tab" button is available in the toolbar or via context menu
- [ ] Double-click on a bookmark title enables inline editing
- [ ] Right-click context menu offers: Edit, Delete, Open in New Tab, Copy URL
- [ ] Delete requires no confirmation (bookmarks are lightweight)

---

### F6 — Folder CRUD (P0)

**Description**: Users can create, rename, delete, and reorganize folders.

**User Stories**:
- As a user, I can create a new folder at the root level or inside another folder
- As a user, I can rename a folder by double-clicking its name
- As a user, I can delete a folder (with confirmation if it contains items)

**Acceptance Criteria**:
- [ ] "New Folder" option in the space's context menu (right-click on empty area)
- [ ] "New Subfolder" option in a folder's context menu
- [ ] Double-click on folder name enables inline rename
- [ ] Deleting a non-empty folder shows a confirmation dialog
- [ ] Deleting a folder removes all contained bookmarks and subfolders

---

### F7 — Drag & Drop (P1)

**Description**: Users can reorder bookmarks and folders, and move items between folders or spaces via drag and drop.

**User Stories**:
- As a user, I can drag a bookmark to reorder it within a folder
- As a user, I can drag a bookmark into a different folder
- As a user, I can drag a folder to reorder it among siblings
- As a user, I can drag an item to a different space (via the space tab bar)

**Acceptance Criteria**:
- [ ] Drag handle or full-row drag initiation
- [ ] Visual drop indicator (line between items or folder highlight)
- [ ] Dropping on a folder inserts the item into that folder
- [ ] Dropping between items reorders at that position
- [ ] Dragging over a collapsed folder auto-expands it after 500ms
- [ ] Dragging over a space tab switches to that space for cross-space moves
- [ ] Drag operations persist immediately to storage

---

### F8 — Search (P1)

**Description**: A search bar at the top of the sidebar filters bookmarks across all spaces.

**User Stories**:
- As a user, I can type in the search bar to filter bookmarks by title or URL
- As a user, I see matching results across all spaces with the space name indicated
- As a user, clicking a search result navigates to that bookmark and reveals it in the tree

**Acceptance Criteria**:
- [ ] Search bar is always visible below the space bar
- [ ] Input is debounced (200ms) to avoid excessive filtering
- [ ] Results show bookmark title, URL snippet, and parent space/folder path
- [ ] Matching text is highlighted in results
- [ ] Clicking a result opens the URL and scrolls/expands the tree to show the item
- [ ] Pressing Escape clears search and returns to normal tree view
- [ ] Empty state shows "No results found" message

---

### F9 — Context Menus (P1)

**Description**: Right-click context menus on bookmarks, folders, pinned sites, and empty areas provide quick actions.

**Acceptance Criteria**:
- [ ] **Bookmark context menu**: Open, Open in New Tab, Edit, Copy URL, Move to…, Delete
- [ ] **Folder context menu**: New Bookmark, New Subfolder, Rename, Delete
- [ ] **Pinned site context menu**: Open, Open in New Tab, Remove Pin
- [ ] **Empty area context menu**: New Folder, New Bookmark, Paste URL
- [ ] **Space tab context menu**: Rename, Change Color, Delete
- [ ] Context menus are custom-rendered (not native) for consistent styling

---

### F10 — Arc Import (P1)

**Description**: Import bookmarks from an Arc Browser HTML export file, mapping Arc's structure to Edge Spaces' data model.

**User Stories**:
- As a former Arc user, I can import my `arc-bookmarks.html` file
- As a user, I can preview the import before confirming
- As a user, I can choose to merge with existing data or replace

**Acceptance Criteria**:
- [ ] "Import from Arc" button in the sidebar settings/menu
- [ ] File picker accepts `.html` files
- [ ] Parser correctly identifies Arc's space structure (top-level "Work - Space", "Personal - Space")
- [ ] Nested `<DL>/<DT>/<H3>/<A>` structure maps to folders and bookmarks
- [ ] "Top Apps" section maps to pinned sites
- [ ] Preview shows the parsed tree before import
- [ ] User can choose "Merge" (add alongside existing) or "Replace" (clear and import)
- [ ] Duplicate bookmarks (same URL) are detected and skipped or flagged
- [ ] Import summary shows count of spaces, folders, and bookmarks imported

---

### F11 — Theming (P2)

**Description**: The sidebar uses an Arc-inspired visual theme with light/dark mode support.

**Acceptance Criteria**:
- [ ] Default theme uses a muted, pastel color palette inspired by Arc's sidebar
- [ ] Each space can have an accent color (green, blue, purple, orange, red, pink)
- [ ] Dark mode activates automatically via `prefers-color-scheme: dark`
- [ ] Manual light/dark toggle available in settings
- [ ] All colors defined via CSS custom properties for easy theming
- [ ] UI uses system font stack for clean, native feel

---

### F12 — Keyboard Shortcuts (P2)

**Description**: Power users can control the sidebar via keyboard shortcuts.

**Acceptance Criteria**:
- [ ] `Ctrl+B` / `Cmd+B` toggles the sidebar panel
- [ ] `Ctrl+K` / `Cmd+K` focuses the search bar
- [ ] `Arrow Up/Down` navigates the tree
- [ ] `Enter` opens the selected bookmark
- [ ] `Escape` closes search or deselects
- [ ] Shortcuts registered via `chrome.commands` API in manifest

---

### F13 — Favicon Fetching (P1)

**Description**: All bookmarks and pinned sites display their website's favicon.

**Acceptance Criteria**:
- [ ] Favicons fetched via `https://www.google.com/s2/favicons?domain={domain}&sz=32`
- [ ] Fallback to a generic globe icon if favicon fails to load
- [ ] Favicons are cached in the component (no re-fetching on every render)
- [ ] Pinned sites use 32×32 size, bookmark list items use 16×16 size

---

## Technical Constraints

- **Manifest V3** — required for modern Chromium extensions
- **chrome.sidePanel API** — requires Edge 114+ or Chrome 114+
- **chrome.storage.local** — 10MB storage limit, no cross-device sync
- **No remote code** — all JS must be bundled in the extension (CSP requirement)
- **Permissions**: `sidePanel`, `storage`, `activeTab`, `contextMenus`

## Success Metrics

- Extension loads sidebar in under 200ms
- Sidebar renders 500+ bookmarks without noticeable lag
- Arc import correctly parses 95%+ of exported bookmark files
- All P0 features functional in Edge, Chrome, and Brave
