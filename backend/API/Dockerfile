FROM rust:1.89 as builder

WORKDIR /app

# Install RISC Zero toolchain
RUN curl -L https://risczero.com/install | bash
ENV PATH="/root/.risc0/bin:${PATH}"
RUN rzup install

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
