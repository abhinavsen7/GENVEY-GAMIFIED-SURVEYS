# Multi-Stage Production Dockerfile for Gamified Survey Engine
# Stage 1: Build React Single-Page Application
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python 3.11 Slim Runtime
FROM python:3.11-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PORT=8000

# Install curl for container health checks and graphic libraries for opencv/trimesh
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend, asset packs, cartridges, and godot kernel
COPY backend/ ./backend/
COPY custom_asset_packs/ ./custom_asset_packs/
COPY game_templates/ ./game_templates/
COPY godot_kernel/ ./godot_kernel/

# Copy pre-compiled frontend bundle from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
