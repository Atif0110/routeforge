const API = "http://127.0.0.1:8000";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "ROUTE_PROMPT") return;
  if (typeof msg.prompt !== "string" || !msg.prompt.trim()) {
    sendResponse({ ok: false, error: "Prompt is empty." });
    return;
  }
  fetch(`${API}/v1/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: msg.prompt,
      metadata: { include_explanations: false, request_id: crypto.randomUUID() },
    }),
  })
    .then(async (r) => {
      let body;
      try { body = await r.json(); } catch { body = { detail: "Router returned invalid JSON." }; }
      return { ok: r.ok, body };
    })
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e?.message || "Unable to reach local router." }));
  return true;
});
