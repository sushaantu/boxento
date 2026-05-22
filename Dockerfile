# Stage 1: Base with Bun and Curl
FROM oven/bun:1 AS base
# Install curl for healthcheck in later stages
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies from the committed lockfile
RUN bun install --frozen-lockfile

# Stage 3: Builder
FROM deps AS builder
WORKDIR /app

# Copy source code and dependencies
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Build-time variables for Firebase configuration
ARG VITE_FIREBASE_API_KEY="demo-api-key"
ARG VITE_FIREBASE_AUTH_DOMAIN="demo.firebaseapp.com"
ARG VITE_FIREBASE_PROJECT_ID="demo-project"
ARG VITE_FIREBASE_STORAGE_BUCKET="demo-bucket"
ARG VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
ARG VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Base URL for local services (e.g., "http://localhost" or "https://mini.tailf2415.ts.net")
ARG VITE_SERVICES_BASE_URL="http://localhost"

# SQLite backend URL for self-hosted mode (e.g., "http://mini:3001/api")
ARG VITE_SQLITE_API_URL=""

# Build version shown in the footer. Pass `--build-arg VITE_BUILD_HASH=$(git rev-parse --short HEAD)`.
ARG VITE_BUILD_HASH="docker"

# Create .env file for build time using heredoc for readability
RUN <<EOF cat > .env
VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
VITE_SERVICES_BASE_URL=$VITE_SERVICES_BASE_URL
VITE_SQLITE_API_URL=$VITE_SQLITE_API_URL
VITE_BUILD_HASH=$VITE_BUILD_HASH
EOF

# Build the application
ENV NODE_ENV=production
RUN bun run build

# Stage 4: Runner (Production)
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy necessary files from builder stage
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
# Copy Vite config to ensure preview server uses allowedHosts etc.
COPY --from=builder --chown=bun:bun /app/vite.config.ts ./vite.config.ts
# Copy tsconfig if needed by Vite/plugins during preview
COPY --from=builder --chown=bun:bun /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=bun:bun /app/tsconfig.node.json ./tsconfig.node.json

# Don't run as root
USER bun

# Expose the port Vite preview will run on
EXPOSE 5173

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5173 || exit 1

# Start the application using Vite's preview server
CMD ["bunx", "--bun", "vite", "preview", "--host", "--port", "5173"]

# Note: For a pure development setup without building,
# use docker-compose.yml which mounts the source code
# and runs `bun run dev`.
