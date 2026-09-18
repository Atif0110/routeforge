# RouteForge — free public demo

## Recommended host: Render

RouteForge is packaged as a Docker web service and includes `render.yaml`, so it can be deployed as a public free web service on Render.

### Deploy

1. Push the `RouteForge` folder to a GitHub repository.
2. Open Render and choose **New → Blueprint**.
3. Connect the repository.
4. Render detects `render.yaml` and creates the `routeforge` web service.
5. Deploy with the **Free** compute plan.
6. Open the generated `onrender.com` URL.

The service exposes:

- `/` — RouteForge console
- `/healthz` — health check
- `/docs` — API reference
- `POST /v1/route` — routing endpoint
- `GET /v1/models` — model catalog

### Important free-tier behavior

The free Render service sleeps after a period of inactivity and can take about a minute to wake on the next request. Its filesystem is ephemeral. This is suitable for a public demo and hobby deployment, but not for an SLA-backed production service.

### Scaling path

For real production traffic, move the same container to a paid service and add:

- authentication/API keys
- persistent distributed rate limiting
- structured telemetry with prompt redaction
- provider adapters and current model IDs
- Redis or equivalent shared state
- request budgets and quotas
- circuit breakers and provider fallbacks
- horizontal replicas
- domain/TLS and monitoring

No provider API key is required by the current RouteForge router because it is select-only.
