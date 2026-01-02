FROM --platform=linux/amd64 rust:1.89 as builder

WORKDIR /app

# Copy source code first to leverage Docker cache
COPY . .

# Install RISC Zero toolchain matching risc0-zkvm 3.0.4
# Use specific version that matches dependencies without GitHub API calls
RUN rustup toolchain install 1.81.0 && \
    rustup default 1.81.0 && \
    rustup target add riscv32im-risc0-zkvm-elf --toolchain 1.81.0

# Build the host binary in release mode
RUN cargo build --release -p host

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
