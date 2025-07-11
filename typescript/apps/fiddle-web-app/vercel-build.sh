#!/bin/bash
set -x
set -e

# Install Rust 1.85.0 if not present or wrong version
if ! command -v rustc &> /dev/null || [[ $(rustc --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') != "1.85.0" ]]; then
    echo "Installing Rust 1.85.0..."
    curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain 1.85.0
    source $HOME/.cargo/env
fi

# Install Go 1.23 if not present or wrong version
if ! command -v go &> /dev/null || [[ $(go version | grep -oE 'go[0-9]+\.[0-9]+') != "go1.23" ]]; then
    echo "Installing Go 1.23.11..."
    curl -LO https://go.dev/dl/go1.23.11.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.23.11.linux-amd64.tar.gz
    export PATH="/usr/local/go/bin:$PATH"
fi

# Ensure Go is in PATH
export PATH="/usr/local/go/bin:$PATH"

echo "Go version: $(go version)"
echo "Rust version: $(rustc --version)"

# Install Rust tools
cargo install wasm-pack --version 0.13.1 || true
cargo install cross || true

# Install Go tools
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"
go install golang.org/x/tools/cmd/goimports@latest
# Install protoc-gen-go (using aqua style version)
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6

# Try to source cargo environment from multiple possible locations
if [ -f "$HOME/.cargo/env" ]; then
    source $HOME/.cargo/env
elif [ -f "/vercel/.cargo/env" ]; then
    source /vercel/.cargo/env
elif [ -f "$(eval echo ~$(whoami))/.cargo/env" ]; then
    source "$(eval echo ~$(whoami))/.cargo/env"
fi

# Ensure PATH includes cargo
export PATH="$HOME/.cargo/bin:/vercel/.cargo/bin:$(eval echo ~$(whoami))/.cargo/bin:$PATH"

# Ensure rustup has a default toolchain configured
if ! rustup show active-toolchain &> /dev/null; then
    echo "Setting up default Rust toolchain..."
    rustup default stable
fi
# clang --version
#llvm-config --version
# g++ --version

# System dependencies (still needed)
dnf install -y llvm
DNF_EXIT_CODE=$?
dnf install -y clang
DNF_EXIT_CODE2=$?

cd ../../../engine/baml-schema-wasm
export OPENSSL_NO_VENDOR=1
# cargo install
rustup target add wasm32-unknown-unknown

cd ../../

pnpm build:fiddle-web-app

ls -l
ls -l /vercel/output