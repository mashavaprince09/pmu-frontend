# Multi-stage build: compile the Angular app, serve the static bundle with nginx.
FROM node:20-alpine AS build
WORKDIR /app

# On the deploy server, `npm ci` reliably hung for ~81s and then died with npm's
# "Exit handler never called!" bug, leaving node_modules incomplete (no `ng` binary).
# Consistent ~81s timing (not random) points to a stalled network connection, not a
# real crash — Node's default DNS resolution tries IPv6 first, and if IPv6 is present
# but silently blackholed on that host (rather than cleanly refused), the connection
# hangs until a TCP timeout instead of falling back to IPv4 quickly. Forcing IPv4-first
# skips the hang.
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/pmu-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
