# Prompt 03 — Sidebar Panel & Spaces

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. The project scaffolding (Prompt 01) and data model/storage layer (Prompt 02) are complete. Now you need to build the main sidebar shell and the Spaces feature.

## Reference

- **Data model**: See `src/shared/types.ts` — `Space`, `SpaceColor`, `AppState`
- **Store actions**: See `src/shared/store.ts` — `setActiveSpace()`, `addSpace()`, `renameSpace()`, `deleteSpace()`, `setSpaceColor()`
- **Styles**: CSS Modules (`.module.css` files) + CSS custom properties from `src/sidepanel/styles/variables.css`
- **Design reference**: Arc Browser's sidebar — vertical panel, horizontal space tabs at top, clean minimal aesthetic

## Task

Build the `<Sidebar>`, `<SpaceBar>`, and `<SpaceContent>` components that form the main layout of the side panel. Implement space switching, creation, renaming, deletion, and color selection.

## Requirements

### 1. `<Sidebar>` — `src/sidepanel/components/Sidebar.tsx`

The root layout component for the side panel:
- Calls `hydrate()` from the Zustand store on mount
- Shows a brief loading state while hydrating
- Renders `<SpaceBar>` at the top and `<SpaceContent>` below
- Full height of the side panel (`100vh`)
- Background color: `var(--bg-primary)`

### 2. `<SpaceBar>` — `src/sidepanel/components/SpaceBar.tsx`

A horizontal tab bar showing all spaces:

**Layout**:
- Horizontal scrollable row of space tabs
- Each tab shows the space name with an accent-colored underline/indicator when active
- A "+" button at the end to create a new space

**Interactions**:
- **Click** a tab → `setActiveSpace(spaceId)`
- **Double-click** a tab → enter inline rename mode (use `<InlineEdit>` component)
- **Right-click** a tab → show context menu with:
  - Rename
  - Change Color → submenu with color options (green, blue, purple, orange, red, pink, gray)
  - Delete (disabled if it's the last space)
- **Click "+"** → `addSpace("New Space", "green")`, then immediately enter rename mode on the new tab

**Styling**:
- Tabs have subtle rounded top corners
- Active tab has a colored bottom border (2px, using the space's accent color)
- Tab text is `var(--font-size-md)`, truncated with ellipsis if too long
- Hover state: `var(--bg-hover)` background
- "+" button is a subtle icon button

### 3. `<SpaceContent>` — `src/sidepanel/components/SpaceContent.tsx`

The main content area below the space bar:
- Displays content for the active space
- Renders (in order, top to bottom):
  1. `<PinnedGrid>` (placeholder div for now — implemented in Prompt 04)
  2. `<SearchBar>` (placeholder div for now — implemented in Prompt 06)
  3. `<FolderTree>` (placeholder div for now — implemented in Prompt 05)
- If the space has no content (no pins, no folders), show an empty state:
  - Muted icon + "This space is empty"
  - "Add a bookmark" and "Import from Arc" action buttons
- Scrollable with `overflow-y: auto`

### 4. `<InlineEdit>` — `src/sidepanel/components/InlineEdit.tsx`

A reusable inline text editing component:
- Props: `value: string`, `onSave: (newValue: string) => void`, `onCancel: () => void`
- Renders an `<input>` that auto-focuses and selects all text
- **Enter** saves the value (calls `onSave` with trimmed text)
- **Escape** cancels (calls `onCancel`)
- **Blur** saves (same as Enter)
- Validates: non-empty after trimming; reverts if empty
- Styled to look inline (no visible input border, matches surrounding text size)

### 5. `<ConfirmDialog>` — `src/sidepanel/components/ConfirmDialog.tsx`

A reusable modal confirmation dialog:
- Props: `title: string`, `message: string`, `confirmLabel: string`, `onConfirm: () => void`, `onCancel: () => void`, `destructive?: boolean`
- Renders as a centered modal with a backdrop overlay
- If `destructive`, the confirm button is red
- **Enter** confirms, **Escape** cancels
- Focus trapped within the dialog

### 6. Update `<App>` — `src/sidepanel/App.tsx`

Replace the placeholder content with:
```tsx
<Sidebar />
```

## Design Specifications

**Space Tab Bar**:
```
┌─────────────────────────────────────┐
│  Work  │  Personal  │  +            │
│  ════                               │  ← green underline on active
└─────────────────────────────────────┘
```

**Empty Space State**:
```
┌─────────────────────────────────────┐
│                                     │
│           📁                         │
│    This space is empty              │
│                                     │
│    [+ Add bookmark]  [📥 Import]    │
│                                     │
└─────────────────────────────────────┘
```

## Expected Output Files

- `src/sidepanel/components/Sidebar.tsx` + `Sidebar.module.css`
- `src/sidepanel/components/SpaceBar.tsx` + `SpaceBar.module.css`
- `src/sidepanel/components/SpaceContent.tsx` + `SpaceContent.module.css`
- `src/sidepanel/components/InlineEdit.tsx` + `InlineEdit.module.css`
- `src/sidepanel/components/ConfirmDialog.tsx` + `ConfirmDialog.module.css`
- Updated `src/sidepanel/App.tsx`

## Acceptance Criteria

- [ ] Sidebar renders full-height in the side panel
- [ ] Space bar shows all spaces as horizontal tabs
- [ ] Clicking a tab switches the active space (visible content changes)
- [ ] "+" button creates a new space and enters rename mode
- [ ] Double-clicking a tab enters inline rename mode
- [ ] Right-click shows context menu with Rename, Change Color, Delete
- [ ] Change Color submenu changes the space's accent color
- [ ] Delete shows a confirmation dialog (via `<ConfirmDialog>`)
- [ ] Cannot delete the last remaining space (button disabled)
- [ ] Active space persists across panel close/reopen (via store hydration)
- [ ] Empty space shows the empty state with action buttons
- [ ] `<InlineEdit>` saves on Enter/blur, cancels on Escape, rejects empty
- [ ] `<ConfirmDialog>` traps focus and handles Enter/Escape
- [ ] All components use CSS Modules for styling
- [ ] No hardcoded colors — all from CSS custom properties
