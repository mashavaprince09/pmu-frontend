# Multi-stage build: compile the Angular app, serve the static bundle with nginx.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --include=dev: on the deploy server, `npm ci` was silently skipping devDependencies
# (where @angular/cli lives), causing "ng: not found" — something in that host's
# environment behaves like NODE_ENV=production even though the base image itself doesn't
# set it. Force dev deps explicitly rather than depend on ambient config.
RUN npm ci --include=dev

COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/pmu-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
