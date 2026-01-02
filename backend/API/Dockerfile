FROM --platform=linux/amd64 rust:1.89 as builder

WORKDIR /app

# Install the riscv32 target for the standard Rust toolchain
RUN rustup target add riscv32imac-unknown-none-elf

# Copy source code
COPY . .

# Set environment variable to skip RISC Zero toolchain check during build
# The guest code will be built with the standard Rust riscv32 target
ENV RISC0_SKIP_BUILD=1

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
