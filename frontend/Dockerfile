# ============================================================================
# React frontend — multi-stage: Vite production build, then nginx serve.
# The SPA calls the API with a relative /api base, and nginx proxies that to
# the backend service, so no build-time API URL is needed.
# ============================================================================

# ---- Stage 1: build -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first so they cache independently of source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: serve -------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
