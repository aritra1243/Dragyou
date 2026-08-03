# Stage 1: Build C++ Nova Engine
FROM alpine:3.19 AS cpp-builder
RUN apk add --no-cache build-base cmake zlib-dev
WORKDIR /app
COPY backend/ /app/
RUN mkdir -p build && cd build && cmake .. && make -j$(nproc)

# Stage 2: Build Go API Server
FROM golang:1.22-alpine AS go-builder
WORKDIR /app
COPY backend/server/ /app/
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Stage 3: Minimal Production Image
FROM alpine:3.19
RUN apk add --no-cache ca-certificates zlib libstdc++ libgcc
WORKDIR /app
COPY --from=cpp-builder /app/build/bin/nova /app/nova
COPY --from=go-builder /app/server /app/server
RUN mkdir -p /app/repos

ENV NOVA_BIN=/app/nova
ENV REPO_STORAGE_ROOT=/app/repos
ENV PORT=8080

EXPOSE 8080
CMD ["/app/server"]
