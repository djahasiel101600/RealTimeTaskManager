# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (include devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Accept build args for Vite env variables and expose them to the build
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Build the application (Vite outputs to `dist`)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage (Vite `outDir` is set to `build`)
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a non-root user to run nginx
RUN addgroup -g 1001 -S nginx-group && \
    adduser -S nginx-user -G nginx-group

# Change ownership of nginx directories
RUN chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/log/nginx && \
    chown -R nginx-user:nginx-group /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-group /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Expose nginx port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]