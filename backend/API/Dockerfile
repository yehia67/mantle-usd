FROM --platform=linux/amd64 rust:1.89 as builder

WORKDIR /app

# Install RISC Zero toolchain
RUN curl -L https://risczero.com/install | bash && \
    . /root/.bashrc && \
    /root/.risc0/bin/rzup install rust

ENV PATH="/root/.risc0/bin:/root/.cargo/bin:${PATH}"

# Copy source code
COPY . .

# Build the host binary in release mode
RUN cargo build --release -p host

# Runtime stage - minimal image
FROM debian:bookworm-slim

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
