# ===== Stage 1: Build =====
FROM node:22-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source & generate Prisma + compile TypeScript
COPY tsconfig.json ./
COPY prisma/ ./prisma/
COPY src/ ./src/
RUN npx prisma generate
RUN npm run build

# ===== Stage 2: Production =====
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder /app/node_modules/@prisma/ ./node_modules/@prisma/
COPY --from=builder /app/prisma/ ./prisma/

# Copy startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p uploads logs && chown -R app:app /app
USER app

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
