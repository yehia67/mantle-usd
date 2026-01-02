FROM --platform=linux/amd64 rust:1.89 as builder

WORKDIR /app

# Install RISC Zero Rust toolchain directly from official release (no GitHub API)
# Using the exact version that works with risc0-zkvm 3.0.4
RUN curl -L https://github.com/risc0/rust/releases/download/r0.1.88.0-1/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz -o risc0-rust.tar.gz && \
    tar -xzf risc0-rust.tar.gz -C /usr/local && \
    rm risc0-rust.tar.gz && \
    rustup toolchain link risc0 /usr/local/rust-toolchain-x86_64-unknown-linux-gnu

ENV RISC0_TOOLCHAIN_VERSION=r0.1.88.0-1

# Copy source code
COPY . .

# Build the host binary in release mode using risc0 toolchain
RUN cargo +risc0 build --release -p host

# Runtime stage - use same Debian version as rust:1.89 base (Debian Bookworm)
# But we need the full bookworm, not slim, to get newer glibc
FROM --platform=linux/amd64 debian:bookworm

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled binary from builder
COPY --from=builder /app/target/release/host /app/host

# Expose port (documentation only - Render ignores this)
EXPOSE 3000

# Run the binary
CMD ["/app/host"]
