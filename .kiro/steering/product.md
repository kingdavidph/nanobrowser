# Product Overview

Nanobrowser is an open-source AI web automation tool that runs as a Chrome browser extension. It provides a free alternative to OpenAI Operator with flexible LLM options and a multi-agent system.

## Key Features
- **Multi-agent System**: Specialized AI agents (Planner, Navigator) collaborate to accomplish complex web workflows
- **Interactive Side Panel**: Intuitive chat interface with real-time status updates
- **Task Automation**: Seamlessly automate repetitive web tasks across websites
- **Multiple LLM Support**: Connect to OpenAI, Anthropic, Gemini, Ollama, Groq, Cerebras, Llama, AWS Bedrock, and custom OpenAI-compatible providers
- **Privacy-Focused**: Everything runs locally in the browser, credentials stay with the user
- **100% Free**: No subscription fees, users only pay for their own API usage

## Target Platforms
- **Primary**: Chrome and Edge (full support)
- **Not Supported**: Firefox, Safari, and other Chromium variants

## Architecture
The extension uses a multi-agent architecture with:
- **Planner Agent**: Handles reasoning and planning capabilities
- **Navigator Agent**: Executes web navigation tasks
- **Side Panel UI**: Main user interface for interaction
- **Background Service**: Core extension logic and API communication