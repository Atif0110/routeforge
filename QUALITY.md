# Verification Record

This repository was iterated locally before packaging.

## Checks executed

- `PYTHONPATH=src python3 -m pytest -q` → **49 passed**.
- `python3 -m compileall -q src tests` → passed.
- `node --check` for frontend and all browser-extension JavaScript → passed.
- `python3 -m json.tool browser_extension/manifest.json` → passed.
- FastAPI live smoke tests previously executed → `/healthz` 200, classifier loaded, 11 candidates; `/v1/route` 200 with a real `selected_model`; `/` and `/frontend/app.js` 200.
- Chrome-extension CORS preflight previously executed → 200 with the extension origin allowed.
- Secret-pattern scan previously executed → no common API/private-key formats found.
- Browser handoff checks → provider adapters, provider-specific mappings, opt-in auto-selection, optional auto-submit, conservative matching, prompt-change cancellation, and safe failure paths are covered by source-level tests/checks.

## Browser integration design

The extension keeps the router's historical RouterBench IDs separate from provider-site labels. A user can configure exact labels for ChatGPT and Claude. When a mapping exists, the adapter first attempts a high-confidence visible model-control match. If it cannot verify the control, it does not guess or silently substitute another model. Auto-submit is separately opt-in and is cancelled if the prompt changes while routing.

This is the safest practical browser prototype because consumer website DOMs can change without notice. A production implementation should prefer supported provider APIs where available, or maintain versioned site adapters with end-to-end tests against each provider.

## Environment limitations

The sandbox used for final iteration did not have `ruff` or `pyright` installed, so those two commands could not be independently executed. The sandbox also could not download build dependencies such as `hatchling` because outbound package/network access was unavailable, and Docker was not installed. Therefore no claim is made that `uv build` or a Docker build was executed successfully here.
