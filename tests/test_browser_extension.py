from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
EXT = ROOT / "browser_extension"


def test_manifest_loads_provider_adapter_and_storage_permission() -> None:
    manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    scripts = manifest["content_scripts"][0]["js"]
    assert scripts == ["provider_adapters.js", "content.js"]
    assert "storage" in manifest["permissions"]
    assert manifest["version"] == "0.2.0"


def test_provider_adapter_is_conservative_and_supports_both_sites() -> None:
    js = (EXT / "provider_adapters.js").read_text(encoding="utf-8")
    assert "chatgpt\\.com" in js
    assert "claude\\.ai" in js
    assert "score >= 70" in js
    assert "No visible model control matched" in js
    assert "window.TrustRouterProviders" in js


def test_extension_has_opt_in_handoff_and_safe_failure() -> None:
    js = (EXT / "content.js").read_text(encoding="utf-8")
    popup = (EXT / "popup.html").read_text(encoding="utf-8")
    assert "autoSelect" in js
    assert "autoSubmit" in js
    assert "Model selected. Send button was not found" in js
    assert "exact label visible in each provider's model picker" in popup
    assert "data-provider=\"chatgpt\"" in popup
    assert "data-provider=\"claude\"" in popup
    assert "gpt-4-1106-preview" in popup
    assert "claude-v2" in popup
