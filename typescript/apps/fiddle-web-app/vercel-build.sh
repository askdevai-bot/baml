#!/bin/bash
set -x
set -e

# Install mise if not present
if ! command -v mise &> /dev/null; then
    echo "Installing mise..."
    curl https://mise.run | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Navigate to the root directory where mise.toml is located
cd ../../../

# Install all tools defined in mise.toml
echo "Installing tools with mise..."
mise install

# Activate mise environment
eval "$(mise activate bash)"

# Verify installations
echo "Go version: $(go version)"
echo "Rust version: $(rustc --version)"

# The tools should already be installed via mise, but ensure cargo tools are available
which wasm-pack || mise run cargo install wasm-pack --version 0.13.1
which cross || mise run cargo install cross

# Ensure mise environment is properly activated and paths are set
export PATH="$HOME/.local/share/mise/shims:$PATH"

# mise should handle all the path setup for us, but let's ensure cargo is in PATH
if [ -d "$HOME/.cargo/bin" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# System dependencies (still needed)
dnf install -y llvm
DNF_EXIT_CODE=$?
dnf install -y clang
DNF_EXIT_CODE2=$?

# Now navigate to the baml-schema-wasm directory for building
cd engine/baml-schema-wasm
export OPENSSL_NO_VENDOR=1

# Add wasm target using mise's rust
mise exec -- rustup target add wasm32-unknown-unknown

# Go back to root directory
cd ../../

# Run the build
mise exec -- pnpm build:fiddle-web-app

ls -l
ls -l /vercel/output