# Prompt 08 — Theming, Keyboard Shortcuts & Polish

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. All features are implemented (Prompts 01–07). Now you need to add visual theming, keyboard shortcuts, animations, and accessibility improvements for a polished release.

## Reference

- **CSS variables**: Defined in `src/sidepanel/styles/variables.css`
- **Background script**: `src/background/service-worker.ts`
- **Manifest commands**: `_execute_action` (Ctrl+B) and `focus_search` (Ctrl+K) in `manifest.json`
- **Space colors**: `SpaceColor = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'pink' | 'gray'`

## Task

### Part A: Arc-Inspired Theming & Dark Mode
### Part B: Keyboard Shortcuts
### Part C: Animations & Transitions
### Part D: Accessibility (a11y)

---

## Part A: Theming

### 1. Light Theme (Default)

Update `src/sidepanel/styles/variables.css` with a complete Arc-inspired palette:

```css
:root {
  /* Backgrounds */
  --bg-primary: #f5f5f0;          /* Main sidebar background (warm off-white) */
  --bg-secondary: #eceee8;        /* Section backgrounds, inputs */
  --bg-hover: #e2e5dc;            /* Hover states */
  --bg-active: #d8dbd2;           /* Active/pressed states */
  --bg-overlay: rgba(0, 0, 0, 0.4); /* Modal backdrop */

  /* Text */
  --text-primary: #1a1a1a;        /* Main text */
  --text-secondary: #6b6b6b;      /* Muted text, breadcrumbs */
  --text-tertiary: #999999;       /* Placeholder text */
  --text-inverse: #ffffff;        /* Text on colored backgrounds */

  /* Borders */
  --border-color: #d4d6cf;
  --border-focus: #4a9960;        /* Focus ring color */

  /* Space accent colors */
  --space-green: #4a9960;
  --space-blue: #4a7fb5;
  --space-purple: #8b5fbf;
  --space-orange: #c48530;
  --space-red: #c45050;
  --space-pink: #bf5f8b;
  --space-gray: #808080;

  /* Semantic colors */
  --color-danger: #d94444;
  --color-success: #4a9960;
  --color-warning: #c48530;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);

  /* Transitions */
  --transition-fast: 100ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

### 2. Dark Theme

Add a dark theme via `prefers-color-scheme`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1e1e1c;
    --bg-secondary: #2a2a28;
    --bg-hover: #353533;
    --bg-active: #404040;
    --bg-overlay: rgba(0, 0, 0, 0.6);
    --text-primary: #e8e8e3;
    --text-secondary: #999990;
    --text-tertiary: #6b6b65;
    --border-color: #3a3a38;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
}
```

### 3. Manual Theme Toggle

Add a `theme` state to the store (`'auto' | 'light' | 'dark'`):
- Default: `'auto'` (follows system preference)
- Add a toggle in the sidebar's settings menu (gear icon)
- When set to `'light'` or `'dark'`, override via a `data-theme="light|dark"` attribute on `<html>`
- Persist the theme preference in `chrome.storage.local` (separate from bookmark data, e.g., key `"edgespaces_prefs"`)

```css
[data-theme="light"] { /* light overrides */ }
[data-theme="dark"] { /* dark overrides */ }
```

### 4. Space Accent Color Application

Each space has a `color` property. Apply it as:
- Active space tab underline color
- Pinned grid "+" button accent
- Folder tree selection/focus accent
- Sidebar subtle tint (optional: very subtle background gradient using the accent)

Use `data-space-color` attribute or CSS custom property override:
```css
.sidebar[data-accent="green"] {
  --accent-current: var(--space-green);
}
```

---

## Part B: Keyboard Shortcuts

### 1. Global Shortcuts (via `chrome.commands`)

**Background script** (`src/background/service-worker.ts`):

- `_execute_action` (Ctrl+B / Cmd+B) — already handled: toggles the side panel
- `focus_search` (Ctrl+K / Cmd+K) — send a message to the side panel to focus the search bar:

```typescript
chrome.commands.onCommand.addListener((command) => {
  if (command === 'focus_search') {
    // Send message to side panel
    chrome.runtime.sendMessage({ type: 'FOCUS_SEARCH' });
  }
});
```

**Side panel** (`src/sidepanel/App.tsx` or `SearchBar.tsx`):
```typescript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FOCUS_SEARCH') {
    // Focus the search input
    searchInputRef.current?.focus();
  }
});
```

### 2. Local Shortcuts (within the side panel)

Add keyboard event listeners to the sidebar:

| Key | Context | Action |
|-----|---------|--------|
| `Ctrl+K` / `Cmd+K` | Anywhere in panel | Focus search bar |
| `Escape` | Search active | Clear search, return to tree |
| `Escape` | Context menu open | Close context menu |
| `Escape` | Modal open | Close modal |
| `ArrowUp` / `ArrowDown` | Tree focused | Navigate between visible tree items |
| `Enter` | Tree item focused | Open bookmark / toggle folder |
| `ArrowRight` | Folder focused | Expand folder |
| `ArrowLeft` | Folder focused (expanded) | Collapse folder |
| `ArrowLeft` | Item focused | Move focus to parent folder |
| `Delete` / `Backspace` | Tree item focused | Delete with confirmation |
| `F2` | Tree item focused | Enter rename mode |
| `Ctrl+N` / `Cmd+N` | Tree focused | New bookmark in current folder |

### 3. Implementation

Use a `useKeyboardNavigation` custom hook:
- Maintains a `focusedItemId` state
- Computes visible item list from the tree (expanded folders only)
- Handles ArrowUp/Down to move focus index
- Handles Enter, ArrowLeft/Right, Delete, F2 with appropriate actions
- Applies `tabIndex`, `aria-selected`, and visual focus ring to the focused item

---

## Part C: Animations & Transitions

### 1. Folder Expand/Collapse

- Chevron rotation: 0° (collapsed) → 90° (expanded), `var(--transition-fast)`
- Children height: animate with `max-height` or use `<details>`/CSS grid trick:
  ```css
  .children {
    display: grid;
    grid-template-rows: 0fr; /* collapsed */
    transition: grid-template-rows var(--transition-normal);
  }
  .children.expanded {
    grid-template-rows: 1fr;
  }
  .children > .inner {
    overflow: hidden;
  }
  ```

### 2. Hover Effects

- All interactive items: background transition `var(--transition-fast)`
- Context menu items: subtle background fade on hover

### 3. Drag & Drop

- Dragged item: slight scale up (1.02) + elevation shadow
- Drop indicator line: fade in with `var(--transition-fast)`

### 4. Modal Transitions

- Import wizard / confirm dialog:
  - Backdrop: fade in opacity 0→1, `var(--transition-normal)`
  - Dialog: slide up + fade in, `var(--transition-normal)`

### 5. Search

- Search results: stagger in with subtle fade + slide up (50ms delay between items, max 10)
- Clear transition when switching between tree view and search results

---

## Part D: Accessibility

### 1. ARIA Attributes

| Component | ARIA |
|-----------|------|
| `<SpaceBar>` | `role="tablist"`, each tab: `role="tab"`, `aria-selected` |
| `<SpaceContent>` | `role="tabpanel"`, `aria-labelledby={activeTabId}` |
| `<FolderTree>` | `role="tree"` |
| `<TreeNode>` (folder) | `role="treeitem"`, `aria-expanded` |
| `<TreeNode>` (bookmark) | `role="treeitem"` |
| `<TreeNode>` children | `role="group"` |
| `<SearchBar>` input | `role="searchbox"`, `aria-label="Search bookmarks"` |
| `<ContextMenu>` | `role="menu"`, items: `role="menuitem"` |
| `<ConfirmDialog>` | `role="alertdialog"`, `aria-labelledby`, `aria-describedby` |
| `<ImportWizard>` | `role="dialog"`, `aria-labelledby` |

### 2. Focus Management

- Modals trap focus (Tab cycles within the dialog)
- When a modal closes, return focus to the element that triggered it
- When a tree item is deleted, focus moves to the next sibling (or parent)
- `<InlineEdit>` returns focus to the item when editing completes

### 3. Screen Reader Support

- Use `aria-live="polite"` region for announcements:
  - "Bookmark added to {folder}"
  - "Folder deleted"
  - "Moved to {folder}"
  - "Import complete: {n} bookmarks imported"
- All icon buttons have `aria-label`
- Avoid icon-only buttons without labels

### 4. Color Contrast

- Ensure all text meets WCAG 2.1 AA contrast (4.5:1 for body text, 3:1 for large text)
- Focus rings are visible in both light and dark themes
- Don't rely solely on color to convey information (use icons + text)

---

## Expected Output Files

- Updated `src/sidepanel/styles/variables.css` (complete theme variables)
- New `src/sidepanel/styles/animations.css` (shared animation classes)
- Updated `src/background/service-worker.ts` (command handlers, messaging)
- New `src/sidepanel/hooks/useKeyboardNavigation.ts`
- New `src/sidepanel/hooks/useTheme.ts` (theme toggle logic)
- Updated components with ARIA attributes, transitions, keyboard support:
  - `SpaceBar.tsx`, `SpaceContent.tsx`, `FolderTree.tsx`, `TreeNode.tsx`
  - `FolderItem.tsx`, `BookmarkItem.tsx`, `SearchBar.tsx`
  - `ContextMenu.tsx`, `ConfirmDialog.tsx`, `ImportWizard.tsx`
- Updated `src/shared/store.ts` (theme state + persistence)
- Updated `src/sidepanel/App.tsx` (message listener, theme provider)

## Acceptance Criteria

### Theming
- [ ] Light theme renders with warm off-white Arc-inspired palette
- [ ] Dark theme activates automatically via `prefers-color-scheme: dark`
- [ ] Manual theme toggle persists across panel reopens
- [ ] Space accent colors apply to tab underlines, selection states, and accents
- [ ] All colors use CSS custom properties (no hardcoded hex in components)
- [ ] Color contrast meets WCAG 2.1 AA in both themes

### Keyboard Shortcuts
- [ ] `Ctrl+B` / `Cmd+B` toggles the sidebar panel
- [ ] `Ctrl+K` / `Cmd+K` focuses the search bar
- [ ] Arrow keys navigate the tree
- [ ] `Enter` opens bookmark / toggles folder
- [ ] `Delete` deletes with confirmation
- [ ] `F2` enters rename mode
- [ ] `Escape` closes search/menus/modals

### Animations
- [ ] Folder chevron rotates smoothly on expand/collapse
- [ ] Folder children animate open/close (no layout jump)
- [ ] Hover backgrounds transition smoothly
- [ ] Modals fade in with backdrop
- [ ] Search results appear with subtle animation
- [ ] Drag overlay has elevation shadow

### Accessibility
- [ ] All ARIA roles and attributes applied per the table above
- [ ] Focus is trapped in modals
- [ ] Focus returns to trigger element when dialog closes
- [ ] `aria-live` region announces key actions
- [ ] All icon buttons have `aria-label`
- [ ] Extension is fully usable with keyboard only (no mouse required)
- [ ] Extension is navigable with screen reader (VoiceOver/NVDA tested)
