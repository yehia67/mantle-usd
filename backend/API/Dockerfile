FROM rust:1.89 as builder

WORKDIR /app

# Install RISC Zero toolchain - use cargo-risczero directly to avoid GitHub API
RUN cargo install cargo-risczero --version 1.2.0
RUN cargo risczero install

# Copy source code
COPY . .

# Build the host binary in release mode
RUN cargo build --release -p host

# Runtime stage - minimal image
FROM debian:bookworm-slim

WORKDIR /app

# Copy the compiled binary from builder
COPY --from=builder /app/target/release/host /app/host

# Expose port (documentation only - Render ignores this)
EXPOSE 3000

# Run the binary
CMD ["/app/host"]
