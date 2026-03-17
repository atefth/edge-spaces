# Prompt 04 — Pinned Sites Grid

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. The sidebar shell and spaces are implemented (Prompt 03). Now you need to build the Pinned Sites Grid — the row of favicon icons at the top of each space, matching Arc Browser's "Top Apps" section.

## Reference

- **Data model**: `PinnedSite { id, title, url, faviconUrl, position }` in `src/shared/types.ts`
- **Store actions**: `addPinnedSite()`, `removePinnedSite()`, `reorderPinnedSites()` in `src/shared/store.ts`
- **Favicon helper**: `getFaviconUrl(url, size)` in `src/shared/favicon.ts`
- **Constants**: `MAX_PINNED_SITES = 12` in `src/shared/constants.ts`
- **Parent**: `<SpaceContent>` renders `<PinnedGrid>` at the top

## Task

Build the `<PinnedGrid>` component that displays pinned sites as a favicon grid, with the ability to pin the current tab, remove pins, and reorder them.

## Requirements

### 1. `<PinnedGrid>` — `src/sidepanel/components/PinnedGrid.tsx`

**Layout**:
- CSS Grid with 4 columns, auto rows
- Each cell is a 48×48px clickable area containing a 32×32 favicon
- Maximum `MAX_PINNED_SITES` (12) entries = 3 rows
- If no pinned sites exist, show a single subtle "+" button with "Pin a site" tooltip
- If fewer than `MAX_PINNED_SITES`, show a "+" button in the next empty cell

**Favicon Display**:
- Use `<img>` with `src={site.faviconUrl}` (pre-computed via `getFaviconUrl`)
- `loading="lazy"` attribute
- On error, fall back to a generic globe SVG icon
- Rounded corners (`var(--radius-md)` = 8px)
- Subtle background on hover (`var(--bg-hover)`)

**Interactions**:
- **Click** a pinned site → open URL in the current tab: `chrome.tabs.update(undefined, { url: site.url })`
- **Middle-click** or **Ctrl+click** → open in new tab: `chrome.tabs.create({ url: site.url })`
- **Right-click** → show context menu:
  - Open
  - Open in New Tab
  - Remove Pin
- **Hover** → show tooltip with `site.title` (use `title` attribute or a custom tooltip)
- **Click "+"** → pin the current active tab:
  1. Query `chrome.tabs.query({ active: true, currentWindow: true })`
  2. Extract `url`, `title`, and generate `faviconUrl` via `getFaviconUrl(url, 32)`
  3. Call `addPinnedSite(activeSpaceId, { title, url, faviconUrl })`
  4. If already pinned (same URL), show a brief toast/indicator "Already pinned"

**Reordering** (simple, no external DnD library needed here):
- Pinned sites maintain their `position` order
- Reordering will be handled in Prompt 06 (drag & drop) — for now, pins display in `position` order

### 2. `<PinnedIcon>` — (inline or separate sub-component)

A single pinned site icon:
- Props: `site: PinnedSite`, `onClick`, `onContextMenu`
- Renders: favicon `<img>` with error fallback, wrapped in a button
- Accessible: `aria-label={site.title}`, `role="button"`

### 3. Fallback Globe Icon

Create a simple inline SVG globe icon component or use a data URI for the fallback when a favicon fails to load. Keep it minimal — a circle with a meridian and equator line.

### 4. Wire into `<SpaceContent>`

Replace the placeholder `<PinnedGrid>` div in `src/sidepanel/components/SpaceContent.tsx` with the actual `<PinnedGrid>` component, passing the active space's `pinnedSites` array.

## Design Specifications

**Grid with 8 pinned sites**:
```
┌────────────────────────────┐
│  🟢  📧  📧  🔴            │   ← Row 1: 4 favicons
│  ✏️  🔵  🟡  📐            │   ← Row 2: 4 favicons
│  [+]                       │   ← Row 3: add button
└────────────────────────────┘
```

**Empty state**:
```
┌────────────────────────────┐
│  [+ Pin a site]            │
└────────────────────────────┘
```

**Favicon cell**:
```
┌──────────┐
│  ┌────┐  │  48×48 cell
│  │ 🌐 │  │  32×32 favicon with 8px rounded corners
│  └────┘  │  hover: subtle bg highlight
└──────────┘
```

## Expected Output Files

- `src/sidepanel/components/PinnedGrid.tsx` + `PinnedGrid.module.css`
- Updated `src/sidepanel/components/SpaceContent.tsx`

## Acceptance Criteria

- [ ] Pinned grid displays favicons in a 4-column CSS grid
- [ ] Each favicon is 32×32 with rounded corners inside a 48×48 cell
- [ ] Clicking a favicon opens the URL in the current tab
- [ ] Middle-click / Ctrl+click opens in a new tab
- [ ] "+" button pins the current active tab (queries `chrome.tabs`)
- [ ] Duplicate pin detection (same URL) shows feedback
- [ ] Maximum 12 pinned sites enforced
- [ ] Right-click context menu with Open / Open in New Tab / Remove Pin
- [ ] Favicon error fallback to globe icon
- [ ] Hover shows tooltip with site title
- [ ] Empty state shows "+ Pin a site" prompt
- [ ] Pinned sites are stored per-space (different spaces have different pins)
- [ ] Component uses CSS Modules and CSS custom properties
