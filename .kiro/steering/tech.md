# Technology Stack

## Build System & Package Management
- **Package Manager**: pnpm (v9.15.1+)
- **Build Tool**: Turbo (monorepo orchestration) + Vite (bundling)
- **Node.js**: v22.12.0 or higher
- **TypeScript**: v5.5.4

## Core Technologies
- **Frontend Framework**: React 18.3.1 with TypeScript
- **Styling**: Tailwind CSS v3.4.17
- **Chrome Extension**: Manifest V3
- **AI/LLM Integration**: LangChain with multiple provider support
  - @langchain/anthropic, @langchain/openai, @langchain/google-genai
  - @langchain/groq, @langchain/ollama, @langchain/cerebras, @langchain/xai, @langchain/aws
- **Browser Automation**: Puppeteer Core v24.10.1
- **Schema Validation**: Zod v3.25.76

## Development Tools
- **Linting**: ESLint with Airbnb TypeScript config
- **Formatting**: Prettier
- **Git Hooks**: Husky with lint-staged
- **Testing**: Vitest

## Common Commands

### Development
```bash
# Install dependencies
pnpm install

# Start development mode (watch mode with HMR)
pnpm dev

# Build for production
pnpm build

# Create distribution zip
pnpm zip
```

### Code Quality
```bash
# Run linting with auto-fix
pnpm lint

# Format code with Prettier
pnpm prettier

# Type checking
pnpm type-check
```

### Cleaning
```bash
# Clean build artifacts
pnpm clean:bundle

# Clean node_modules
pnpm clean:node_modules

# Full clean (includes turbo cache)
pnpm clean
```

## Monorepo Structure
- **Workspace Configuration**: pnpm-workspace.yaml
- **Build Orchestration**: turbo.json with task dependencies
- **Package Naming**: @extension/* for internal packages