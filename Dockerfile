# Build stage
FROM --platform=linux/amd64 node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY tsup.config.js ./
COPY src ./src
RUN npm install
RUN npm run build

# Production stage
FROM --platform=linux/amd64 node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm install --production
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Start the application
CMD ["npm", "start"]