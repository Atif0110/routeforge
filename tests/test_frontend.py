import json
from pathlib import Path

ROOT = Path(__file__).parents[1]


def test_frontend_assets_are_present_and_wired() -> None:
    html = (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "frontend" / "app.js").read_text(encoding="utf-8")
    assert "fetch(`${API}/v1/route`" in js
    assert "selected_model" in js
    assert "policy.selection_mode" in js
    assert "/frontend/app.js" in html


def test_browser_extension_targets_both_providers() -> None:
    manifest_path = ROOT / "browser_extension" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    matches = manifest["content_scripts"][0]["matches"]
    assert "https://chatgpt.com/*" in matches
    assert "https://claude.ai/*" in matches
