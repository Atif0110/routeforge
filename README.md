# RouteForge: Intelligent Model Routing

This repository contains a prompt-routing backend. Given a prompt, it scores the configured language models and returns the model that should handle the request.

The repository includes the trained classifier artifacts, routing policy, FastAPI service, command-line interface, and tests. It does not generate an answer or call a model provider. Its job ends after it returns a model ID.

This repository packages the core S2 Sweep implementation at its savings setting, not a TrustRouter-plus-Burr integration. Everything needed to run it is included here, with no Burr or TrustRouter framework dependency at runtime.

Each request uses the S2 quality-cost winner 70% of the time and selects uniformly from the eligible models 30% of the time. The response exposes `policy.selection_mode` as `scored` or `random`, along with `random_selection_probability: 0.3`.

The offline benchmark figures in [`evidence/offline_routerbench_summary.json`](evidence/offline_routerbench_summary.json) describe the classifier-only policy before the exploration layer. They do not measure the final stochastic serving policy.

RouteForge is designed as a provider-independent routing layer that can sit between applications and multiple LLM providers. The repository includes a browser experience and a conservative ChatGPT/Claude integration prototype.

## How it works

```text
Prompt
  -> request validation
  -> prompt feature extraction
  -> per-model quality and token predictions
  -> quality/cost routing policy
  -> selected model ID and ranked candidate scores
```

The main endpoint is `POST /v1/route`. It accepts a prompt and optional routing settings, then returns a `selected_model` field. That field is the handoff point for a front end or provider integration.

The API also exposes:

- `GET /healthz` for service health
- `GET /v1/models` for the supported model IDs
- `/docs` for interactive FastAPI documentation

## Run RouteForge locally

The project requires Python 3.11 and [`uv`](https://docs.astral.sh/uv/).

LightGBM also needs an OpenMP runtime. On macOS, install it with:

```bash
brew install libomp
```

Install the project and start the API:

```bash
uv sync --dev
uv run routeforge serve --host 127.0.0.1 --port 8000
```

In another terminal, send a prompt:

```bash
curl -s http://127.0.0.1:8000/v1/route \
  -H 'content-type: application/json' \
  --data @examples/request.json
```

You can also classify a prompt without starting the server:

```bash
uv run routeforge route \
  --prompt "Write a Python LRU cache and explain its complexity" \
  --explain
```

## API request

```json
{
  "prompt": "Write a Python function that merges two sorted lists.",
  "metadata": {
    "cost_saving_preference": 50,
    "include_explanations": true,
    "request_id": "example-123"
  }
}
```

`metadata` is optional. It can also contain a `candidate_models` list to limit the models considered by the router. The response includes the selected model, routing policy details, and scores for the eligible candidates.

## Repository layout

```text
src/take_home_router/   classifier, routing policy, API, and CLI
artifacts/              trained model and calibration files
config/router.json      model catalog and routing configuration
evidence/               offline benchmark summary
examples/request.json   sample API request
tests/                  unit and integration tests
```

## Checks

Run the full test, lint, and type-check suite with:

```bash
make check
```

The backend is intentionally provider-independent. No API credentials are required to run the classifier itself.


## RouteForge Console

RouteForge includes a lightweight browser console served by the same FastAPI process.

Start the backend:

```bash
uv sync --dev
uv run routeforge serve --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/`.

The page sends each submitted prompt to `POST /v1/route`, displays `selected_model`, `policy.selection_mode`, latency, and candidate utilities. Recent routes are stored only in the browser's local storage. The backend remains select-only and never sends prompts to a model provider.

## Browser integrations: ChatGPT + Claude

`browser_extension/` contains a Chrome/Chromium Manifest V3 integration prototype for:

- `chatgpt.com`
- `chat.openai.com`
- `claude.ai`

Load the directory with the browser's extension developer mode and start the local router first. The extension adds a small **Route** button to supported pages and a `Ctrl/⌘+Shift+R` shortcut. It captures the current prompt and asks the local `/v1/route` endpoint for a decision.

The provider websites expose different model catalogs and their UI can change independently. The classifier's bundled IDs are historical RouterBench model IDs. RouteForge therefore uses an explicit compatibility layer: a model is only selected in a provider UI when a high-confidence mapping and visible model control are available. Otherwise the extension reports the routing decision and leaves the provider page untouched. A production deployment should replace UI scraping with first-party provider APIs where available, maintain versioned provider adapters, and keep a server-side model registry with health/capability metadata.

No provider API key, cookie, session token, or browser credential is stored by this project.

## Architecture

```text
Browser UI / extension
        |
        | POST /v1/route
        v
FastAPI API
        |
        v
ClassifierService
   |         |
   v         v
S2 classifier  routing policy
   |             |
   +-------> selected_model
```

The integration boundary is intentionally provider-independent. `selected_model` is a routing decision, not a generation request. This keeps the classifier testable and avoids coupling the trained artifact to unstable consumer website internals.

## Failure handling

The web UI gives explicit validation, loading, and network/API error states. The extension reports an unavailable local router or a routing error without altering the provider page. The backend continues to validate request shape and candidate IDs through the existing Pydantic contract.

## Quality verification

Run:

```bash
make check
```

For the browser prototype, load `browser_extension/` as an unpacked extension and verify that the Route button appears on ChatGPT or Claude after the local server is running.

## Browser handoff behavior

The extension now has a conservative provider-adapter layer. It separates the router's historical model ID from the label used by the provider website instead of assuming the IDs are interchangeable.

1. Install `browser_extension/` as an unpacked Chromium extension.
2. Open the extension popup and enable **Auto-select mapped provider model**.
3. Enter the exact provider model label currently shown in the provider model picker for each Router model you want to map. The extension stores mappings separately by provider.
4. Type a prompt on the provider site and click **Route** (or press `Ctrl/⌘+Shift+R`).
5. The extension calls `/v1/route`, then attempts a high-confidence DOM selection only if a mapping exists. If no mapping or no high-confidence control exists, it reports the routing decision without changing the page.
6. **Auto-submit** is optional and disabled unless explicitly enabled. If the prompt changes during routing or the send control cannot be identified safely, the extension does not submit anything.

This design makes the compatibility boundary explicit: the classifier owns routing, while a small provider adapter owns website-specific model selection. Because consumer UIs can change independently, a production version should use provider-supported APIs where available or maintain versioned adapters with end-to-end browser tests. The extension never fabricates a provider mapping and never stores credentials or session data.

## Publish RouteForge for free

RouteForge includes a Render Blueprint in `render.yaml` and a step-by-step guide in `DEPLOY_FREE.md`. Push the repository to GitHub, create a Render Blueprint from the repository, and deploy the web service on Render's Free plan.

The free deployment is intended as a public demo. Render's current Free web services can spin down after inactivity and have other resource limitations, so this should not be represented as an SLA-backed production deployment. See `DEPLOY_FREE.md` for the production scaling path.
