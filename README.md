# PMU Frontend

Angular 18 dashboard for the [PMU Backend](../pmu-backend): RMS/frequency/ROCOF
trend charts, an instantaneous voltage/current waveform viewer, a phasor
diagram, and an admin panel for managing users/devices. Talks to the backend
over REST (JSON) and Apache Arrow (binary, for the larger metrics/waveform
payloads).

## Prerequisites

- Node 20+ and npm
- The [PMU Backend](../pmu-backend) running somewhere reachable (locally on
  `:8080` by default)

## Quick start — Docker (recommended)

This repo doesn't stand alone in Docker — it's one service in the backend
repo's `docker-compose.yml`, expected to be checked out as a sibling
directory:

```
some-parent-dir/
├── pmu-backend/   (docker compose up -d --build runs from here)
└── pmu-frontend/  (this repo)
```

See the [backend README](../pmu-backend/README.md#quick-start--docker-recommended)
for the actual compose command.

## Local dev

```bash
npm install
npm start -- --proxy-config proxy.conf.json
```

`npm start` is a bare `ng serve` — **the `--proxy-config` flag matters**,
without it `/api` and `/ws` calls have nothing to talk to and will fail.
`proxy.conf.json` forwards both to `http://localhost:8080` (adjust if your
backend isn't on the default port). Dashboard is then at
`http://localhost:4200`.

## Build

```bash
npm run build                                    # dev build, dist/pmu-frontend/browser
npm run build -- --configuration production       # production build
```

## Tests

```bash
npm test                              # Karma, watches by default
npx ng test --watch=false --browsers=ChromeHeadless   # single run, CI-style
```

## Code layout

| Path | What's there |
|---|---|
| `src/app/core/api/` | Typed services for each backend endpoint group: `metrics.service.ts`, `waveform.service.ts`, `admin.service.ts`, `availability.service.ts`, plus `arrow-fetch.ts` (the shared fetch-and-error-handle wrapper) |
| `src/app/core/arrow/` | `arrow-decode.worker.ts` — decodes Arrow IPC streams **off the main thread** (via Comlink), since metrics/waveform payloads can be large; `arrow-decoder.service.ts` is the Angular-side wrapper |
| `src/app/core/auth/` | `auth.service.ts` (JWT storage/login), `auth.guard.ts`/`admin.guard.ts` (route guards), `auth.interceptor.ts` (attaches the bearer token to outgoing requests) |
| `src/app/core/state/` | `dashboard-store.ts` — the shared signal-based state (selected device/date/hour/timestamp) that the trend panel, waveform panel, and control bar all read from |
| `src/app/core/dsp/` | `phasor.service.ts` — computes phasor magnitude/angle from a raw waveform window (FFT at the fundamental bin) for the phasor diagram |
| `src/app/core/chart-colors.ts` | The single source of truth for channel→color mapping, shared by every chart so V1N/IL1/etc. are always the same color everywhere |
| `src/app/features/dashboard/trend-panel/` | RMS (dual-axis: voltage left, current right) + frequency + ROCOF charts, linked zoom/pan across all three |
| `src/app/features/dashboard/waveform-chart/` | The instantaneous waveform viewer — one uPlot chart, voltage on the left y-axis, current on the right, both sharing the time axis. Spline-interpolated rendering on top of server-side min/max envelope decimation (see backend README) |
| `src/app/features/dashboard/phasor/` | The phasor diagram (polar plot of per-channel magnitude/angle) |
| `src/app/features/dashboard/control-bar/` | Device/date/hour selection controls, including the calendar popup |
| `src/app/features/admin/` | User/device management UI (admin-only, guarded by `admin.guard.ts`) |
| `src/app/features/login/` | Login form |

## Charting

All charts use [uPlot](https://github.com/leeoniya/uPlot) — a canvas-based
(not SVG/DOM) library chosen for handling tens of thousands of points without
the per-point DOM cost that something like Chart.js/D3-with-SVG would incur.
Every chart component follows the same pattern: build/destroy a `uPlot`
instance on data load, sync zoom across linked charts via `setScale`, and use
`u.posToVal`/`setSelect` hooks for drag-to-zoom.

## Known gotchas if you touch the Dockerfile

- `npm ci` can silently install **zero** devDependencies (where `@angular/cli`
  lives) if something in the build environment behaves like
  `NODE_ENV=production` — the Dockerfile forces `npm ci --include=dev` to be
  safe regardless of ambient config.
- On at least one deploy host, `npm ci` reliably hung for ~80s and died with
  npm's own `Exit handler never called!` bug — traced to Node's IPv6-first
  DNS resolution stalling against a host where IPv6 was silently blackholed.
  The Dockerfile sets `NODE_OPTIONS=--dns-result-order=ipv4first` to route
  around it.
- `nginx.conf` resolves the `backend` upstream **lazily per-request** (via
  Docker's embedded DNS resolver + a `proxy_pass` variable) rather than once
  at config-load time — a bare hostname in `proxy_pass` makes nginx refuse to
  start at all if `backend` isn't resolvable yet when the frontend container
  boots.
