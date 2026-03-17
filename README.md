# Edge Spaces

An **Arc-style sidebar bookmark manager for Microsoft Edge**. 

Edge Spaces brings the powerful sidebar experience of the Arc browser to Microsoft Edge, allowing you to manage your bookmarks, spaces, and active tabs with ease from a sleek side panel.

## Features

- **Arc-style Navigation**: A vertical sidebar for managing bookmarks, folders, and tabs.
- **Spaces**: Organize your work into distinct contexts (e.g., Work, Personal, Side Projects).
- **Pinned Sites**: Keep your most-used websites just a click away at the top of the sidebar.
- **Nested Folders**: Organize bookmarks with deep nesting support.
- **Arc Import**: Seamlessly import your data from the Arc browser.
- **Quick Search**: Fast, responsive search across all your bookmarks and spaces.
- **Keyboard Shortcuts**: 
  - `Ctrl+B` (or `Cmd+B` on Mac) to toggle the sidebar.
  - `Ctrl+K` (or `Cmd+K` on Mac) to focus search.
- **Customizable Themes**: Support for Light, Dark, and System themes.
- **Drag-and-Drop**: Effortlessly reorder bookmarks, folders, and pinned sites.

## Tech Stack

- **React 18**
- **Vite** (with `@crxjs/vite-plugin`)
- **TypeScript**
- **Zustand** (State Management)
- **@dnd-kit** (Drag and Drop)
- **Vanilla CSS** (Modular and flexible styling)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/atefth/edge-spaces.git
   cd edge-spaces
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm run build
   ```

### Loading the Extension in Edge

1. Open Microsoft Edge and navigate to `edge://extensions`.
2. Enable **Developer mode** in the bottom left corner.
3. Click on **Load unpacked**.
4. Select the `dist` folder generated after running the build command.

## Development

To run the development server with hot module replacement:

```bash
pnpm run dev
```

Then follow the steps above to load the extension, but point it to the `dist` folder produced by the dev command.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
