#!/bin/bash
set -x
set -e

# Set locale to avoid warnings
export LC_ALL=C
export LANG=C

# Install mise if not present
if ! command -v mise &> /dev/null; then
    echo "Installing mise..."
    # For dnf-based systems (like Amazon Linux), use the official repo method
    dnf install -y dnf-plugins-core
    dnf config-manager --add-repo https://mise.jdx.dev/rpm/mise.repo
    dnf install -y mise

    # If mise is installed in /usr/bin, we don't need to modify PATH
    # But if it's in ~/.local/bin, add it to PATH
    if [ -f "$HOME/.local/bin/mise" ]; then
        export PATH="$HOME/.local/bin:$PATH"
    fi
fi

# Navigate to the root directory where mise.toml is located
cd ../../../

# Install system dependencies before running mise install
echo "Installing system dependencies..."
# Install dependencies for Ruby compilation
dnf install -y gcc make readline-devel zlib-devel openssl-devel libyaml-devel
# Install dependencies for Rust/WASM compilation
dnf install -y llvm clang
# Install additional dependencies that might be needed
dnf install -y git curl wget tar gzip bzip2 xz

# Install all tools defined in mise.toml
echo "Installing tools with mise..."
mise install

# Activate mise environment
# Check if mise is in PATH first
if command -v mise &> /dev/null; then
    eval "$(mise activate bash)"
elif [ -f "$HOME/.local/bin/mise" ]; then
    eval "$($HOME/.local/bin/mise activate bash)"
else
    echo "Error: mise not found after installation"
    exit 1
fi

# Verify installations
echo "Go version: $(go version)"
echo "Rust version: $(rustc --version)"

# The tools should already be installed via mise, but ensure cargo tools are available
which wasm-pack || mise run cargo install wasm-pack --version 0.13.1
which cross || mise run cargo install cross

# Ensure mise environment is properly activated and paths are set
# Check for both possible mise shim locations
if [ -d "$HOME/.local/share/mise/shims" ]; then
    export PATH="$HOME/.local/share/mise/shims:$PATH"
elif [ -d "/usr/share/mise/shims" ]; then
    export PATH="/usr/share/mise/shims:$PATH"
fi

# mise should handle all the path setup for us, but let's ensure cargo is in PATH
if [ -d "$HOME/.cargo/bin" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Now navigate to the baml-schema-wasm directory for building
cd engine/baml-schema-wasm
export OPENSSL_NO_VENDOR=1

# Add wasm target using mise's rust
if command -v mise &> /dev/null; then
    mise exec -- rustup target add wasm32-unknown-unknown
else
    echo "Error: mise not found in PATH"
    exit 1
fi

# Go back to root directory
cd ../../

# Run the build
if command -v mise &> /dev/null; then
    mise exec -- pnpm build:fiddle-web-app
else
    echo "Error: mise not found in PATH"
    exit 1
fi

ls -l
ls -l /vercel/output