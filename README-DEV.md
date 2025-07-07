# BAML Development Setup Guide

This guide will help you get the BAML monorepo up and running on your local machine.

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/boundaryml/baml.git
cd baml

# 2. Run the setup script
./scripts/setup-dev.sh

# 3. Install dependencies
pnpm install

# 4. Run development servers with Infisical
infisical run --env=development -- pnpm dev
```

## 📋 Prerequisites

- **Node.js** 18+ (for TypeScript/JavaScript development)
- **macOS** or **Linux** (Windows users should use WSL2)
- **Infisical CLI** for environment variable management

## 🛠️ Detailed Setup

### 1. Install Infisical CLI

BAML uses Infisical for secure environment variable management instead of `.env` files.

```bash
# macOS
brew install infisical/get-cli/infisical

# Linux/WSL
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
sudo apt-get update && sudo apt-get install infisical

# Login to Infisical
infisical login
```

### 2. Run the Setup Script

The setup script installs all required development tools:

```bash
./scripts/setup-dev.sh
```

This script installs:
- **Rust** (1.85.0) and cargo-watch for Rust hot reloading
- **Go** (1.23) with protoc-gen-go and goimports
- **Python** tooling (uv package manager and ruff formatter)
- **pnpm** for Node.js package management
- **wasm-pack** for building Rust WASM packages
- **cross-rs** for cross-compilation

#### Setup Script Options

You can skip certain installations if you already have them:

```bash
./scripts/setup-dev.sh --help              # Show all options
./scripts/setup-dev.sh --skip-rust         # Skip Rust installation
./scripts/setup-dev.sh --skip-go           # Skip Go installation
./scripts/setup-dev.sh --skip-python       # Skip Python tooling
./scripts/setup-dev.sh --skip-pnpm         # Skip pnpm installation
./scripts/setup-dev.sh --skip-cargo-watch  # Skip cargo-watch installation
```

### 3. Install Project Dependencies

```bash
# Install all Node.js dependencies
pnpm install

# The setup script already handles Python dependencies via uv
# Go dependencies are managed automatically by go.mod
```

## 🏃 Running the Development Environment

### Basic Development Commands

```bash
# Run all development servers (TypeScript + Rust)
infisical run --env=development -- pnpm dev

# Run with Turborepo watch mode (recommended for Rust development)
infisical run --env=development -- pnpm turbo watch dev

# Run specific workspaces
infisical run --env=development -- pnpm dev:playground   # Just the playground
infisical run --env=development -- pnpm dev:vscode       # VSCode extension (builds playground first)

# Other useful commands
pnpm setup-dev        # Run the setup script
pnpm generate         # Generate BAML clients
pnpm typecheck        # Type check all packages
pnpm format:fix       # Format code with Biome
pnpm test            # Run tests
pnpm build           # Build all packages
pnpm clean           # Clean all build artifacts
```

### Working with Different Languages

#### TypeScript/JavaScript Development

```bash
# Run TypeScript apps with hot reloading
infisical run --env=development -- pnpm dev

# Type checking
pnpm typecheck

# Build production bundles
infisical run --env=production -- pnpm build
```

#### Rust Development

The Rust code in the `engine` directory has special configuration for proper hot reloading:

```bash
# Option 1: Use Turborepo watch (recommended)
infisical run --env=development -- pnpm turbo watch dev

# Option 2: Direct cargo watch in engine directory
cd engine
cargo watch -x 'check --workspace' -x 'test --workspace --lib'
```

The `engine/turbo.json` only needs to specify `interruptible: true` - all other settings (env, cache, etc.) are inherited from the root configuration.

#### Python Development

```bash
# Run Python tests
cd integ-tests/python
uv run pytest

# Format Python code
uv run ruff format .

# Lint Python code
uv run ruff check .
```

#### Go Development

```bash
# Run Go tests
cd integ-tests/go
go test ./...

# Format Go code
goimports -w .
```

## 🔧 Common Development Workflows

### 1. Making Changes to BAML Language

```bash
# 1. Edit .baml files in integ-tests/baml_src
# 2. Generate clients
infisical run --env=development -- pnpm generate

# 3. Run tests to verify
infisical run --env=development -- pnpm test
```

### 2. Working on the VSCode Extension

```bash
# 1. Start the extension development server
infisical run --env=development -- pnpm dev:vscode

# 2. In VSCode, press F5 to launch Extension Development Host
# 3. The extension will hot reload on changes
```

### 3. Testing Cross-Language Integration

```bash
# Run all integration tests
infisical run --env=development -- ./integ-tests/run-tests.sh

# Run specific language tests
cd integ-tests/typescript && pnpm test
cd integ-tests/python && uv run pytest
cd integ-tests/go && go test ./...
cd integ-tests/ruby && bundle exec ruby test_*
```

## 📁 Project Structure

```
baml/
├── engine/              # Rust implementation (compiler, runtime, LSP)
│   ├── baml-lib/       # Core BAML libraries
│   ├── language_server/ # LSP implementation
│   └── turbo.json      # Rust-specific Turborepo config
├── typescript/          # TypeScript packages
│   ├── apps/           # Applications (playground, docs)
│   └── packages/       # Shared packages
├── integ-tests/        # Cross-language integration tests
│   ├── baml_src/       # BAML source files for testing
│   ├── python/         # Python tests
│   ├── typescript/     # TypeScript tests
│   ├── go/            # Go tests
│   └── ruby/          # Ruby tests
├── fern/              # Documentation
└── turbo.json         # Root Turborepo configuration
```

## 🔍 Debugging Tips

### Environment Variables

```bash
# Check which environment you're using
infisical export --env=development

# Run with specific project/path
infisical run --projectId=xxx --path=/apps/web --env=development -- pnpm dev
```

### Turborepo Cache

```bash
# See what would run without cache
pnpm turbo build --dry

# Run with cache analysis
pnpm turbo build --summarize

# Clear cache if needed
pnpm turbo clean
```

### Rust Development

```bash
# Check Rust compilation errors
cd engine && cargo check --workspace

# Run Rust tests
cd engine && cargo test --workspace

# See detailed Rust logs
RUST_LOG=debug infisical run --env=development -- pnpm dev
```

## 🚨 Troubleshooting

### Common Issues

1. **"command not found" after setup**
   - Restart your terminal or run `source ~/.bashrc` (or `~/.zshrc`)

2. **Infisical authentication issues**
   - Run `infisical logout` then `infisical login` again
   - Ensure you have access to the correct project

3. **Rust compilation errors**
   - Ensure you have Rust 1.85.0: `rustup update`
   - Clear cargo cache: `cargo clean`

4. **Port already in use**
   - Kill existing processes: `lsof -ti:3000 | xargs kill -9`
   - Or change the port in the respective package.json

### Getting Help

- Check the [documentation](https://docs.boundaryml.com)
- Join our [Discord community](https://discord.gg/boundaryml)
- Open an issue on [GitHub](https://github.com/boundaryml/baml/issues)

## 📝 Next Steps

1. Explore the [BAML examples](./integ-tests/baml_src/fiddle-examples/)
2. Read the [contribution guidelines](./CONTRIBUTING.md) for testing details and architecture information
3. Review the [Turborepo inputs/outputs guide](./TURBOREPO_INPUTS_OUTPUTS_GUIDE.md) for cache configuration
4. Try building a simple BAML function in the playground
5. Join our [Discord community](https://discord.gg/BTNBeXGuaS) and introduce yourself in #contributing

---

Happy coding! 🎉