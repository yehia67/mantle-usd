FROM --platform=linux/amd64 rust:1.89 as builder

WORKDIR /app

# Install rzup and RISC Zero toolchain with pinned versions (CI best practice)
RUN curl -L https://risczero.com/install | bash
ENV PATH="/root/.risc0/bin:${PATH}"

# Install specific versions to avoid GitHub API rate limits and ensure reproducibility
# Using versions compatible with risc0-zkvm 3.0.4
RUN rzup install rust 1.81.0 && \
    rzup install cargo-risczero 3.0.4 && \
    rzup install r0vm 3.0.4

# Copy source code
COPY . .

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
