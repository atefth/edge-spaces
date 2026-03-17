# Prompt 07 — Arc Import

## Context

You are working on **Edge Spaces**, a Chromium browser extension with an Arc-style sidebar. All core features are implemented (Prompts 01–06). Now you need to build the Arc Browser bookmark import feature, which parses Arc's HTML export file and maps it to the extension's data model.

## Reference

- **Import format**: Arc Browser exports bookmarks in **Netscape Bookmark HTML** format (same as Chrome/Firefox). See `arc-bookmarks.html` in the project root for a real example.
- **Data model**: `Space`, `Folder`, `Bookmark`, `PinnedSite` in `src/shared/types.ts`
- **Store action**: `importData(data, mode: 'merge' | 'replace')` in `src/shared/store.ts`

## Arc Bookmark HTML Format

The Arc export uses this structure:

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<HTML>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<Title>Arc Bookmarks</Title>

<!-- Top-level section: pinned apps -->
<DT><H3>Top Apps</H3>
<DL><p>
  <DT><A HREF="https://spotify.com">Spotify</A></DT>
  <DT><A HREF="https://youtube.com">YouTube</A></DT>
</DL><p>

<!-- Spaces are identified by " - Space" suffix in H3 -->
<DT><H3>Work - Space</H3>
<DL><p>
  <DT><H3>Pinned bookmarks</H3>   <!-- Special: "Pinned bookmarks" = root level -->
  <DL><p>
    <DT><H3>Development</H3>       <!-- Folder -->
    <DL><p>
      <DT><A HREF="https://...">Link</A></DT>   <!-- Bookmark -->
    </DL><p>
    <DT><H3>Work</H3>              <!-- Another folder -->
    <DL><p>
      <DT><H3>Docs</H3>            <!-- Nested subfolder -->
      <DL><p>
        <DT><A HREF="...">...</A></DT>
      </DL><p>
    </DL><p>
  </DL><p>
</DL><p>

<DT><H3>Personal - Space</H3>
<DL><p>...</DL><p>
</HTML>
```

### Key mapping rules:

| Arc HTML Element | Maps To |
|-----------------|---------|
| `<H3>` ending with " - Space" | `Space` (strip " - Space" suffix for name) |
| `<H3>Top Apps</H3>` section | `PinnedSite[]` for the first/default space |
| `<H3>Pinned bookmarks</H3>` | Ignored as folder name — its children become root-level items |
| Any other `<H3>` | `Folder` |
| `<A HREF="...">Title</A>` | `Bookmark` |
| Nested `<DL>` under an `<H3>` | Children of that folder |

## Task

Build the Arc bookmark import parser and the import wizard UI.

## Requirements

### 1. `ArcImportParser` — `src/shared/arc-import-parser.ts`

```typescript
interface ParseResult {
  spaces: ParsedSpace[];
  totalFolders: number;
  totalBookmarks: number;
  totalPinnedSites: number;
  warnings: string[];       // e.g., "Skipped invalid URL: ..."
}

interface ParsedSpace {
  name: string;
  color: SpaceColor;        // Assign colors in order: green, blue, purple, ...
  pinnedSites: Omit<PinnedSite, 'id'>[];
  rootFolders: ParsedFolder[];
}

interface ParsedFolder {
  name: string;
  children: (ParsedFolder | ParsedBookmark)[];
}

interface ParsedBookmark {
  title: string;
  url: string;
}

class ArcImportParser {
  parse(html: string): ParseResult
}
```

**Implementation details**:

1. Use `DOMParser` to parse the HTML string (safe, sandboxed, no `innerHTML`)
2. Traverse the DOM tree recursively:
   - Find all `<DT>` elements at the top level
   - For each `<DT>` containing an `<H3>`:
     - If the H3 text ends with " - Space", create a new space
     - If the H3 text is "Top Apps", parse children as pinned sites
     - If the H3 text is "Pinned bookmarks", skip as a folder and promote children to root level
     - Otherwise, create a folder
   - For each `<DT>` containing an `<A>`, create a bookmark
3. Assign space colors in rotation: `['green', 'blue', 'purple', 'orange', 'red', 'pink']`
4. If no " - Space" sections found, create a single "Imported" space with all content
5. Validate URLs:
   - Must start with `http://` or `https://`
   - Skip invalid URLs and add to `warnings[]`
6. Handle edge cases:
   - Empty folders
   - Deeply nested structures (flatten if exceeding `MAX_FOLDER_DEPTH`)
   - Missing titles (use URL as fallback title)
   - Duplicate URLs within same folder (keep first, warn about duplicates)

### 2. `<ImportWizard>` — `src/sidepanel/components/ImportWizard.tsx`

A modal overlay with a multi-step import flow:

**Step 1: File Selection**
```
┌──────────────────────────────────┐
│  Import from Arc Browser         │
│                                  │
│  Select your Arc bookmarks       │
│  export file (.html)             │
│                                  │
│  [Choose File]                   │
│                                  │
│  How to export from Arc:         │
│  1. Open Arc → Settings          │
│  2. Click "Export Arc Browser    │
│     Bookmarks"                   │
│  3. Save the .html file          │
│                                  │
│              [Cancel]            │
└──────────────────────────────────┘
```

- File input accepts `.html` files only
- Reads file content via `FileReader.readAsText()`
- On file load, parse with `ArcImportParser` and advance to Step 2

**Step 2: Preview**
```
┌──────────────────────────────────┐
│  Import Preview                  │
│                                  │
│  Found:                          │
│  • 2 spaces (Work, Personal)     │
│  • 12 folders                    │
│  • 47 bookmarks                  │
│  • 8 pinned sites                │
│                                  │
│  ⚠ 2 warnings:                   │
│  - Skipped invalid URL: ...      │
│  - Duplicate URL skipped: ...    │
│                                  │
│  Preview:                        │
│  ▶ Work                          │
│    ▶ Development (3)             │
│    ▶ KIP (12)                    │
│  ▶ Personal                      │
│                                  │
│  Import mode:                    │
│  ○ Merge with existing data      │
│  ● Replace all existing data     │
│                                  │
│  [Cancel]  [Import]              │
└──────────────────────────────────┘
```

- Shows summary statistics from `ParseResult`
- Displays warnings if any
- Shows a collapsible tree preview of the parsed structure
- Radio buttons for import mode: "Merge" or "Replace"
- "Replace" shows a warning: "This will delete all existing spaces, folders, and bookmarks"

**Step 3: Success**
```
┌──────────────────────────────────┐
│  ✓ Import Complete!              │
│                                  │
│  Imported:                       │
│  • 2 spaces                      │
│  • 12 folders                    │
│  • 47 bookmarks                  │
│  • 8 pinned sites                │
│                                  │
│              [Done]              │
└──────────────────────────────────┘
```

- On "Import" click: call `convertToStorageData(parseResult)` to convert `ParseResult` → `Partial<StorageData>`, then call `store.importData(data, mode)`
- On "Done": close the wizard

### 3. Conversion Function — `src/shared/arc-import-parser.ts`

```typescript
function convertToStorageData(result: ParseResult): Partial<StorageData> {
  // Convert ParsedSpace/ParsedFolder/ParsedBookmark to Space/Folder/Bookmark
  // Generate UUIDs for all items
  // Build the flat maps (folders, bookmarks) with proper parentId/childIds references
  // Generate faviconUrls via getFaviconUrl()
  // Return Partial<StorageData> ready for store.importData()
}
```

### 4. Import Entry Point

Add an "Import from Arc" button in:
- The empty space state in `<SpaceContent>` (already has a placeholder from Prompt 03)
- A settings/menu accessible from the sidebar (e.g., a gear icon in the `<SpaceBar>` or a "⋯" menu)

Clicking either opens `<ImportWizard>` as a modal.

## Expected Output Files

- `src/shared/arc-import-parser.ts` — `ArcImportParser` class + `convertToStorageData()` function
- `src/sidepanel/components/ImportWizard.tsx` + `ImportWizard.module.css`
- Updated `src/sidepanel/components/SpaceContent.tsx` (import button in empty state)
- Updated `src/sidepanel/components/SpaceBar.tsx` or `Sidebar.tsx` (settings menu with import option)

## Acceptance Criteria

- [ ] `ArcImportParser.parse()` correctly parses the provided `arc-bookmarks.html` file
- [ ] Spaces detected from H3 elements ending with " - Space"
- [ ] "Top Apps" section maps to pinned sites of the first space
- [ ] "Pinned bookmarks" H3 is skipped — its children become root-level folders
- [ ] Nested folders map correctly up to `MAX_FOLDER_DEPTH`
- [ ] Invalid URLs are skipped with warnings
- [ ] Duplicate URLs within same folder are skipped with warnings
- [ ] Missing titles fall back to URL as title
- [ ] If no spaces detected, a single "Imported" space is created
- [ ] `convertToStorageData()` produces valid `StorageData` with proper UUIDs and references
- [ ] Import wizard opens as a modal overlay
- [ ] Step 1: file picker accepts only `.html` files
- [ ] Step 2: shows accurate summary, warnings, tree preview, and mode selection
- [ ] Step 3: shows success summary
- [ ] Merge mode adds imported data alongside existing data
- [ ] Replace mode clears all existing data before importing
- [ ] "Import from Arc" accessible from empty state and settings menu
- [ ] No use of `innerHTML`, `eval()`, or `document.write()` — only `DOMParser`
- [ ] Parser handles malformed HTML gracefully (no crash, returns partial results + warnings)
