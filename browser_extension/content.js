(() => {
  const ID = "trust-router-overlay";
  const BUTTON_ID = "trust-route-btn";
  let lastPrompt = "";

  function toast(text, good = true) {
    let x = document.getElementById(ID);
    if (!x) {
      x = document.createElement("div");
      x.id = ID;
      document.body.appendChild(x);
    }
    x.textContent = text;
    x.dataset.good = good ? "1" : "0";
    clearTimeout(x._t);
    x._t = setTimeout(() => x.remove(), 7000);
  }

  function getEditor() {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement || active?.isContentEditable) return active;
    return document.querySelector("textarea") || document.querySelector('[contenteditable="true"]');
  }

  function getText(el) {
    return el?.value ?? el?.innerText ?? "";
  }

  function route() {
    const el = getEditor();
    const prompt = getText(el);
    if (!prompt.trim()) {
      toast("RouteForge: enter a prompt first", false);
      return;
    }
    lastPrompt = prompt;
    toast("RouteForge: classifying…");
    chrome.runtime.sendMessage({ type: "ROUTE_PROMPT", prompt }, async (r) => {
      if (chrome.runtime.lastError || !r) {
        toast("RouteForge: local router unavailable", false);
        return;
      }
      if (!r.ok) {
        toast(`RouteForge: ${r.error || r.body?.detail || "routing failed"}`, false);
        return;
      }
      const b = r.body;
      const provider = window.TrustRouterProviders.providerForLocation();
      const settings = await chrome.storage.local.get({ autoSelect: true, autoSubmit: false, mappings: {} });
      const target = settings.mappings?.[provider]?.[b.selected_model];

      if (!target) {
        toast(`Routed to ${b.selected_model}. Configure a ${provider} model mapping to hand off automatically.`);
        window.postMessage({ source: "trust-router", selectedModel: b.selected_model, selectionMode: b.policy.selection_mode }, "*");
        return;
      }

      if (!settings.autoSelect) {
        toast(`Routed to ${b.selected_model} → ${target}. Auto-select is disabled.`);
        return;
      }

      const result = await window.TrustRouterProviders.selectModel(target);
      if (!result.ok) {
        toast(`Routed to ${b.selected_model}, but could not select “${target}”. Open the model picker manually.`, false);
        return;
      }

      toast(`RouteForge → ${b.selected_model} → ${target}`);
      window.postMessage({ source: "trust-router", selectedModel: b.selected_model, providerModel: target, selectionMode: b.policy.selection_mode }, "*");

      if (settings.autoSubmit) {
        const current = getText(getEditor());
        if (current !== lastPrompt) {
          toast("RouteForge: prompt changed, so auto-submit was cancelled.", false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
        const submit = [...document.querySelectorAll('button,[role="button"]')]
          .find((button) => /^(send|submit)$/i.test((button.innerText || button.getAttribute("aria-label") || "").trim()) && !button.disabled);
        if (submit) submit.click();
        else toast("Model selected. Send button was not found; review and send manually.");
      }
    });
  }

  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const b = document.createElement("button");
    b.id = BUTTON_ID;
    b.textContent = "Route";
    b.title = "Classify the current prompt and, if configured, select the routed provider model";
    b.addEventListener("click", route);
    document.body.appendChild(b);
  }

  addButton();
  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      route();
    }
  });
})();
