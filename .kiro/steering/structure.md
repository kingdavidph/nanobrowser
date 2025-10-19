# Project Structure

## Monorepo Organization
This is a pnpm workspace monorepo with three main workspace categories:

### Core Extension (`chrome-extension/`)
- **Purpose**: Main Chrome extension package with background service worker
- **Key Files**:
  - `manifest.js` - Dynamic manifest generation with browser-specific features
  - `src/background/` - Service worker implementation
  - `vite.config.mts` - Extension-specific Vite configuration
- **Dependencies**: LangChain providers, Puppeteer, WebExtension polyfills

### UI Pages (`pages/`)
- **`pages/content/`** - Content script injected into web pages
- **`pages/options/`** - Extension options/settings page
- **`pages/side-panel/`** - Main user interface (side panel)
- **Structure**: Each page has its own Vite config, package.json, and Tailwind config

### Shared Packages (`packages/`)
- **`@extension/shared`** - Common utilities and shared code
- **`@extension/ui`** - Reusable UI components with Tailwind
- **`@extension/storage`** - Chrome storage abstractions
- **`@extension/i18n`** - Internationalization support
- **`@extension/vite-config`** - Shared Vite configurations
- **`@extension/tsconfig`** - Shared TypeScript configurations
- **`@extension/dev-utils`** - Development utilities
- **`@extension/hmr`** - Hot module replacement for development

## Key Configuration Files
- **Root Level**: Package management, linting, formatting, git hooks
- **Workspace Level**: Each package has its own build configuration
- **Shared Configs**: TypeScript, Vite, and Tailwind configs are shared via packages

## Build Output
- **`dist/`** - Final extension build output (gitignored)
- **Distribution**: Created via `pnpm zip` for Chrome Web Store submission

## Development Patterns
- **Workspace Dependencies**: Use `workspace:*` for internal package references
- **Path Aliases**: `@root`, `@src`, `@assets` configured in Vite
- **Hot Reloading**: HMR plugin for development mode
- **Cross-Browser**: Conditional manifest generation for Chrome/Firefox/Opera