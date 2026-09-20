# RouteForge - Intelligent Model Routing

RouteForge is a provider-independent prompt-routing backend. Given a prompt and optional routing preferences, it scores the configured language models and returns the model that should handle the request.

The repository includes the trained classifier artifacts, routing policy, FastAPI service, command-line interface, browser console, Chromium browser integration prototype, deployment configuration, and tests.

RouteForge does not generate answers or call a model provider from the backend. Its core job ends after it returns a routing decision and selected model ID.

**Implementation note:** The browser extension is a separate integration layer. It can optionally map the selected historical RouterBench model ID to a visible model in ChatGPT or Claude and, when explicitly enabled by the user, submit the prompt. The backend itself remains provider-independent.

---

## What RouteForge Does

RouteForge combines a trained S2 classifier with a quality/cost routing policy.

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
Per-model quality + token predictions
  |
  v
Quality/cost routing policy
  |
  +----------------------------+
  |                            |
  v                            v
Scored selection          Random exploration
  |                            |
  +-------------+--------------+
                |
                v
        Selected model ID
        + candidate scores
        + routing metadata
```

Each request uses the S2 quality/cost winner 70% of the time and selects uniformly from the eligible models 30% of the time.

The response exposes:

- `policy.selection_mode`: `scored` or `random`
- `random_selection_probability`: `0.3`
- `selected_model`
- candidate routing scores
- optional explanations
- request ID and latency information

The random exploration layer is intentionally separated from the offline classifier benchmark.

---

## Benchmark Scope

The offline benchmark figures in:

```text
evidence/offline_routerbench_summary.json
```

describe the classifier-only policy before the exploration layer.

They do not measure the final stochastic serving policy and should not be interpreted as live production performance.

---

## Provider Independence

RouteForge is designed to sit between an application and multiple LLM providers.

The backend does not require provider API credentials and does not send prompts to OpenAI, Anthropic, or another model provider.

The routing boundary is:

```text
Application / Browser
        |
        | POST /v1/route
        v
RouteForge
        |
        v
selected_model
```

The returned `selected_model` is a routing decision, not a generation request.

---

## How to Run RouteForge

### Requirements

- Python 3.11+
- `uv`

LightGBM requires an OpenMP runtime.

On macOS:

```bash
brew install libomp
```

On other platforms, install the appropriate OpenMP runtime for your operating system if it is not already available.

### Install

From the repository root:

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

FastAPI interactive documentation:

```text
http://127.0.0.1:8000/docs
```

---

## API

### `POST /v1/route`

Submit a prompt to the router.

Example:

```bash
curl -s http://127.0.0.1:8000/v1/route \
  -H 'content-type: application/json' \
  --data @examples/request.json
```

Example request:

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

It can also contain:

```json
{
  "candidate_models": [
    "model-id-1",
    "model-id-2"
  ]
}
```

This limits routing to the requested eligible models.

The response contains the selected model, routing policy information, and scores for eligible candidates.

### `GET /healthz`

Returns the service health status.

Use this endpoint for local checks and deployment health checks.

### `GET /v1/models`

Returns the supported model IDs configured by RouteForge.

---

## Command-Line Interface

RouteForge can also be used without starting the HTTP server.

Example:

```bash
uv run routeforge route \
  --prompt "Write a Python LRU cache and explain its complexity" \
  --explain
```

To start the API through the CLI:

```bash
uv run routeforge serve --host 127.0.0.1 --port 8000
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

The console:

- Accepts a prompt.
- Sends it to `POST /v1/route`.
- Displays the selected model.
- Displays the routing selection mode.
- Displays latency.
- Displays candidate utilities/scores.
- Stores recent route history only in browser local storage.

The backend remains select-only and does not send the prompt to a model provider.

---

## Browser Integration: ChatGPT + Claude

The repository contains a Chrome/Chromium Manifest V3 browser integration prototype under:

```text
browser_extension/
```

It supports:

- `chatgpt.com`
- `chat.openai.com`
- `claude.ai`

The extension communicates with the local RouteForge API.

### Basic setup

1. Start RouteForge locally.
2. Open the browser's extension developer mode.
3. Load `browser_extension/` as an unpacked extension.
4. Open a supported provider website.
5. Use the Route button or:

```text
Ctrl + Shift + R
```

On macOS:

```text
Cmd + Shift + R
```

The extension captures the current prompt and requests a routing decision from:

```text
POST /v1/route
```

---

## Provider Model Compatibility

The classifier's bundled model IDs are historical RouterBench model IDs.

Those IDs are not automatically assumed to be identical to the model labels currently displayed by ChatGPT or Claude.

RouteForge therefore uses an explicit provider compatibility layer.

A model is only selected in the provider UI when:

- A provider-specific mapping exists.
- The mapped provider model is visible.
- The adapter has sufficient confidence in the UI control.

Otherwise, the extension reports the routing decision without modifying the provider page.

This separation is intentional:

```text
Historical RouterBench ID
          |
          v
RouteForge routing decision
          |
          v
Provider adapter
          |
          v
Current provider UI model label
```

For production use, provider integrations should preferably use first-party provider APIs where available. If browser automation remains necessary, provider adapters should be versioned and covered by end-to-end browser tests because consumer websites can change independently.

---

## Browser Handoff Behavior

The browser extension uses a conservative provider-adapter layer.

### Configure mappings

1. Install `browser_extension/` as an unpacked Chromium extension.
2. Open the extension popup.
3. Enable **Auto-select mapped provider model** if you want automatic model selection.
4. Enter the exact provider model label currently shown in the provider model picker for each Router model you want to map.
5. Mappings are stored separately by provider.

### Route a prompt

1. Type a prompt on ChatGPT or Claude.
2. Click **Route** or press `Ctrl/Cmd + Shift + R`.
3. The extension calls `/v1/route`.
4. If a mapping exists and a high-confidence model control is found, the adapter attempts to select the mapped provider model.
5. If no mapping or no safe model control exists, the extension reports the routing decision and leaves the page unchanged.

### Auto-submit

Auto-submit is optional and disabled by default.

When enabled, the extension still performs safety checks before submission. If the prompt changes during routing or the send control cannot be identified safely, the extension does not submit the prompt.

The extension does not fabricate provider mappings and does not store provider credentials or session tokens.

---

## Architecture

```text
                         +----------------------+
                         | Browser Console      |
                         +----------+-----------+
                                    |
                         +----------v-----------+
                         | Browser Extension    |
                         | ChatGPT / Claude     |
                         +----------+-----------+
                                    |
                                    | POST /v1/route
                                    v
                         +----------------------+
                         | FastAPI API          |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         | ClassifierService    |
                         +----------+-----------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
             +-------------+                 +-------------+
             | S2 Classifier|                 | Routing     |
             |              |                 | Policy      |
             +------+------+                 +------+------+
                    |                               |
                    +---------------+---------------+
                                    |
                                    v
                            selected_model
```

The integration boundary is intentionally provider-independent.

`selected_model` represents a routing decision rather than a generation request.

---

## Failure Handling

RouteForge validates requests and candidate model IDs through its Pydantic API contracts.

The web console provides explicit:

- validation states
- loading states
- API/network error states

The browser extension reports:

- an unavailable local router
- routing failures
- missing provider mappings
- unavailable or ambiguous provider controls

without modifying the provider page when it cannot safely complete the handoff.

---

## Repository Layout

```text
src/take_home_router/
    classifier, routing policy, API, and CLI

artifacts/
    trained model and calibration files

config/
    router configuration and model catalog

evidence/
    offline benchmark summary

examples/
    sample API request

frontend/
    RouteForge browser console

browser_extension/
    Chrome/Chromium provider integration prototype

tests/
    unit, API, frontend, and browser-extension tests

render.yaml
    Render deployment configuration

DEPLOY_FREE.md
    Render deployment guide
```

---

## Quality Verification

Run the complete verification suite with:

```bash
make check
```

This runs the repository's configured tests, linting, and type checking.

You can also run the test suite directly:

```bash
uv run pytest
```

The backend is intentionally provider-independent, so no model-provider API credentials are required to run the classifier and routing service.

---

## Deployment

RouteForge includes a Render Blueprint:

```text
render.yaml
```

A free public demo can be deployed through Render using the repository.

High-level deployment flow:

1. Push the repository to GitHub.
2. Create a Render Blueprint from the repository.
3. Deploy the configured web service.
4. Use `/healthz` as the service health endpoint.

The repository also contains:

```text
DEPLOY_FREE.md
```

with the deployment instructions and production scaling guidance.

Render's free web services can spin down after inactivity and have resource limitations. A free deployment should therefore be treated as a public demo rather than an SLA-backed production service.

---

## Security and Credentials

RouteForge does not require provider credentials for its core routing functionality.

The browser extension does not store:

- provider API keys
- browser cookies
- session tokens
- browser credentials

The backend does not call model providers.

Provider-specific website interaction is isolated inside the browser integration layer.

---

## Design Principles

RouteForge intentionally separates four concerns:

### 1. Model intelligence

The S2 classifier predicts model quality and token-related characteristics.

### 2. Routing policy

The policy converts those predictions into a quality/cost-aware routing decision and applies the configured exploration probability.

### 3. Provider-independent API

The FastAPI service exposes a stable routing contract without coupling the classifier to a specific LLM provider.

### 4. Provider integration

The browser extension handles provider-specific model labels and UI controls separately from the routing logic.

This keeps the core router testable while isolating unstable provider website behavior.

---

## Current Scope

RouteForge currently provides:

- S2-based model routing
- quality/cost-aware model selection
- 70/30 scored-vs-random selection policy
- candidate model filtering
- FastAPI service
- CLI
- browser console
- ChatGPT/Claude browser integration prototype
- conservative provider model mapping
- optional browser auto-submit
- offline benchmark evidence
- automated tests
- Render deployment configuration

The project is intentionally not a full LLM gateway or inference service. It makes the routing decision and exposes the selected model to the consuming application or integration layer.
