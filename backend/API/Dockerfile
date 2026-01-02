FROM --platform=linux/amd64 rust:1.89 as builder

WORKDIR /app

# Install rzup and RISC Zero toolchain with pinned versions (CI best practice)
RUN curl -L https://risczero.com/install | bash
ENV PATH="/root/.risc0/bin:${PATH}"

# Install specific versions to avoid GitHub API rate limits and ensure reproducibility
# Using versions compatible with risc0-zkvm 3.0.4
RUN rzup install rust 1.88.0 && \
    rzup install cargo-risczero 3.0.3 && \
    rzup install r0vm 3.0.3

# Copy source code
COPY . .

# Build the host binary in release mode
RUN cargo build --release -p host

# Runtime stage - use same rust:1.89 base to match glibc version from builder
FROM --platform=linux/amd64 rust:1.89

# Runtime dependencies are already included in rust:1.89 base image

WORKDIR /app

# Create directories that boundless-market might need for caching/storage
RUN mkdir -p /app/.cache /app/.local /tmp && \
    chmod -R 777 /app/.cache /app/.local /tmp

# Copy the compiled binary from builder
COPY --from=builder /app/target/release/host /app/host

# Expose port (documentation only - Render ignores this)
EXPOSE 3000

# Run the binary
CMD ["/app/host"]
