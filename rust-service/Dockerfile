FROM rust:1.89-bookworm AS builder

WORKDIR /app

COPY Cargo.toml rust-toolchain.toml ./
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/rust-service /app/server

ENV PORT=10000
EXPOSE 10000

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["/app/server"]
