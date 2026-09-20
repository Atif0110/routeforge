# RouteForge - Intelligent Model Routing

RouteForge is a provider-independent prompt-routing backend. Given a prompt, it scores the configured language models and returns the model that should handle the request.

This repository packages the **core S2 Sweep implementation** at its savings setting, not a TrustRouter-plus-Burr integration. Everything needed to run it is included here, with no Burr or TrustRouter framework dependency at runtime.

The repository includes the trained classifier artifacts, routing policy, FastAPI service, command-line interface, browser console, browser integration prototype, and tests.

RouteForge does not generate an answer or call a model provider from the backend. Its job ends after it returns a model ID and the associated routing information.

---

## How RouteForge Works

```text
Prompt
  |
  v
Request validation
  |
  v
Prompt feature extraction
  |
  v
Per-model quality and token predictions
  |
  v
Quality/cost routing policy
  |
  v
Selected model ID + ranked candidate scores
```

For each request, RouteForge:

1. Validates the incoming request.
2. Extracts the features required by the bundled S2 classifier.
3. Generates per-model quality and token predictions.
4. Applies the configured quality/cost routing policy.
5. Selects a model from the eligible candidate set.
6. Returns the selected model, routing policy information, and candidate scores.

The final serving policy uses the S2 quality-cost winner 70% of the time and selects uniformly from eligible models 30% of the time.

The API exposes this through:

- `policy.selection_mode`
- `random_selection_probability`

where `selection_mode` is either `scored` or `random`, and the configured random-selection probability is `0.3`.

---

## Benchmark Scope

The offline benchmark figures in:

```text
evidence/offline_routerbench_summary.json
```

describe the classifier-only policy before the exploration layer.

They do not measure the final stochastic serving policy.

Therefore, the benchmark should be interpreted as an offline evaluation of the classifier and routing policy rather than as a production serving-performance claim.

---

## API

The main routing endpoint is:

```text
POST /v1/route
```

It accepts a prompt and optional routing settings and returns a `selected_model` field.

That field is the handoff point for a consuming application or provider integration.

### Additional endpoints

- `GET /healthz`
- `GET /v1/models`
- `GET /docs`

`/healthz` provides service health information.
`/v1/models` returns the supported model IDs.
`/docs` provides the interactive FastAPI documentation.

### Example Request

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

`metadata` is optional.

It can also contain a `candidate_models` list to restrict the models considered by the router.

The response includes the selected model, routing policy details, and scores for the eligible candidates.

---

## Running RouteForge Locally

The project requires Python 3.11 or newer and `uv`.

### Install dependencies

```bash
uv sync --dev
```

### Start the API

```bash
uv run routeforge serve --host 127.0.0.1 --port 8000
```

The API will be available at:

```text
http://127.0.0.1:8000
```

### Send a routing request

In another terminal:

```bash
curl -s http://127.0.0.1:8000/v1/route \
  -H 'content-type: application/json' \
  --data @examples/request.json
```

### Use the CLI directly

Route a prompt without starting the server:

```bash
uv run routeforge route \
  --prompt "Write a Python LRU cache and explain its complexity" \
  --explain
```

---

## LightGBM Runtime Requirement

The S2 classifier uses LightGBM.

On macOS, an OpenMP runtime may be required:

```bash
brew install libomp
```

Linux and Windows environments may require the corresponding OpenMP runtime provided by the operating system or Python environment.

---

## Repository Layout

```text
routeforge/
├── src/
│   └── take_home_router/
│       ├── classifier
│       ├── routing policy
│       ├── API
│       └── CLI
│
├── artifacts/
│   └── s2/
│       ├── trained classifier
│       └── calibration / metadata files
│
├── config/
│   └── router.json
│
├── evidence/
│   └── offline_routerbench_summary.json
│
├── examples/
│   └── request.json
│
├── browser_extension/
│   └── Chrome / Chromium integration prototype
│
├── frontend/
│   └── RouteForge browser console
│
├── tests/
│   ├── unit tests
│   ├── API tests
│   └── browser / integration tests
│
├── render.yaml
├── Dockerfile
├── Makefile
└── pyproject.toml
```

---

## RouteForge Console

RouteForge includes a lightweight browser console served by the same FastAPI process.

Start the backend:

```bash
uv sync --dev
uv run routeforge serve --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

The console sends each submitted prompt to:

```text
POST /v1/route
```

and displays:

- Selected model
- Routing selection mode
- Routing latency
- Candidate utilities
- Routing results

Recent routes are stored only in the browser's local storage.

The backend remains select-only and does not send prompts to a model provider.

---

## Browser Integrations

The `browser_extension/` directory contains a Chrome/Chromium Manifest V3 integration prototype for:

- `chatgpt.com`
- `chat.openai.com`
- `claude.ai`

Load the directory as an unpacked extension using the browser's extension developer mode.

Start the local RouteForge router first:

```bash
uv run routeforge serve --host 127.0.0.1 --port 8000
```

The extension adds a small **Route** button to supported pages and provides:

```text
Ctrl + Shift + R
```

on Windows/Linux and:

```text
Cmd + Shift + R
```

on macOS.

The extension captures the current prompt and asks the local RouteForge API for a routing decision.

---

## Provider Compatibility Layer

The provider websites expose different model catalogs and their user interfaces can change independently.

The classifier's bundled IDs are historical RouterBench model IDs. RouteForge therefore uses an explicit compatibility layer.

A model is only selected in a provider UI when:

- A high-confidence mapping exists.
- A visible model control can be identified safely.

Otherwise, the extension reports the routing decision and leaves the provider page untouched.

This separation keeps the classifier independent from unstable consumer website interfaces.

A production deployment should replace UI scraping with first-party provider APIs where available, maintain versioned provider adapters, and keep a server-side model registry with health and capability metadata.

---

## Provider Credentials

RouteForge does not store:

- Provider API keys
- Browser cookies
- Session tokens
- Browser credentials

The backend itself is provider-independent and does not require provider API credentials to perform routing.

---

## Browser Handoff Behavior

The browser extension uses a conservative provider-adapter layer.

It separates the router's historical model ID from the model label used by the provider website instead of assuming the IDs are interchangeable.

The flow is:

1. Install `browser_extension/` as an unpacked Chromium extension.
2. Open the extension popup.
3. Enable **Auto-select mapped provider model** if desired.
4. Enter the exact provider model label currently shown in the provider model picker for each Router model you want to map.
5. The extension stores mappings separately by provider.
6. Type a prompt on the provider site.
7. Click **Route** or press `Ctrl/⌘+Shift+R`.
8. The extension calls `/v1/route`.
9. If a mapping exists and a high-confidence model control is available, the extension attempts to select that provider model.
10. If no mapping or safe model control exists, it reports the routing decision without changing the page.

### Auto-submit

Auto-submit is optional and disabled unless explicitly enabled.

If the prompt changes during routing or the send control cannot be identified safely, the extension does not submit anything.

This keeps the browser handoff conservative and avoids automatically interacting with a provider page when the extension cannot confidently identify the intended control.

---

## Architecture

```text
Browser Console / Browser Extension
              |
              | POST /v1/route
              v
        FastAPI API
              |
              v
      ClassifierService
          /       \
         /         \
        v           v
 S2 classifier   Routing policy
        \           /
         \         /
          v       v
        selected_model
```

The integration boundary is intentionally provider-independent.

`selected_model` represents a routing decision, not a generation request.

This keeps the classifier testable and avoids coupling the trained artifact to unstable consumer website internals.

---

## Failure Handling

The web UI provides explicit:

- Validation states
- Loading states
- Network error states
- API error states

The browser extension reports an unavailable local router or routing error without altering the provider page.

The backend validates request shape and candidate model IDs through the existing Pydantic contract.

---

## Testing and Quality Checks

Run the complete project check with:

```bash
make check
```

This runs:

- `ruff check`
- `ruff format --check`
- `pyright`
- `pytest`

A successful check should report:

```text
All checks passed!
```

followed by successful formatting, type checking, and the complete test suite.

The repository includes tests covering the classifier, routing policy, API behavior, configuration, browser integration, and project variant identity.

---

## Variant Identity

RouteForge is intentionally the core S2 Sweep implementation at the savings setting.

It is not a TrustRouter-plus-Burr integration and does not use the Burr framework at runtime.

The repository also does not include the S2 A2 hybrid implementation or the WeightedEnsembleRouter.

The bundled configuration identifies the classifier as:

```text
s2-savings-router
```

and the S2 artifact metadata includes the expected scalar features used by the classifier.

---

## Deployment

RouteForge includes a Render Blueprint in:

```text
render.yaml
```

and deployment documentation in:

```text
DEPLOY_FREE.md
```

To deploy:

1. Push the repository to GitHub.
2. Create a Render Blueprint from the repository.
3. Deploy the web service.

The deployment is intended as a public demonstration environment.

Render Free web services can spin down after inactivity and have resource limitations. The free deployment should therefore not be represented as an SLA-backed production deployment.

For production use, deploy with appropriate resources, monitoring, provider adapters, model registry management, and operational controls.

---

## Design Principles

RouteForge follows a few deliberate design boundaries:

### Provider independence

The routing backend does not depend on a specific LLM provider.

### Select-only backend

The backend makes the routing decision and returns a model ID. It does not generate the final answer.

### Conservative browser integration

The browser extension only changes a provider's model selection when the mapping and visible UI control can be identified with sufficient confidence.

### Explicit compatibility boundary

Historical classifier model IDs are kept separate from provider-specific model labels.

### Safe fallback behavior

When a provider mapping or UI control cannot be identified safely, RouteForge reports the routing decision without changing the provider page.

### Reproducible artifacts

The trained classifier, metadata, routing configuration, evidence summary, and test suite are included in the repository.

---

## Summary

RouteForge is a provider-independent intelligent model-routing system built around the core S2 Sweep implementation.

It combines:

- An S2 classifier
- Quality and token prediction
- Quality/cost routing
- Controlled exploration
- FastAPI APIs
- A command-line interface
- A browser console
- ChatGPT and Claude browser integration
- Conservative provider model selection
- Automated tests and type checking
- Render deployment support

The system's primary responsibility is to determine which model should handle a request.

The actual generation step remains with the consuming application or provider integration.
