(() => {
  const PROVIDERS = {
    chatgpt: {
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      name: "ChatGPT",
      aliases: ["ChatGPT", "GPT"],
    },
    claude: {
      host: /(^|\.)claude\.ai$/,
      name: "Claude",
      aliases: ["Claude"],
    },
  };

  function providerForLocation(hostname = location.hostname) {
    return Object.entries(PROVIDERS).find(([, value]) => value.host.test(hostname))?.[0] ?? null;
  }

  function visibleText(el) {
    if (!el || !(el instanceof HTMLElement)) return "";
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return "";
    return (el.innerText || el.getAttribute("aria-label") || el.textContent || "").trim();
  }

  function candidates() {
    return [...document.querySelectorAll('button,[role="button"],[role="menuitem"]')]
      .map((el) => ({ el, text: visibleText(el) }))
      .filter((item) => item.text.length > 0);
  }

  function normalize(text) {
    return text.toLowerCase().replace(/[\s._:/-]+/g, " ").trim();
  }

  function scoreMatch(text, target) {
    const haystack = normalize(text);
    const needle = normalize(target);
    if (!haystack || !needle) return 0;
    if (haystack === needle) return 100;
    if (haystack.includes(needle)) return 90;
    const words = needle.split(" ").filter(Boolean);
    const hits = words.filter((word) => haystack.includes(word)).length;
    return words.length ? Math.round((hits / words.length) * 70) : 0;
  }

  async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function clickModel(targetLabel) {
    const ranked = candidates()
      .map((item) => ({ ...item, score: scoreMatch(item.text, targetLabel) }))
      .filter((item) => item.score >= 70)
      .sort((a, b) => b.score - a.score);

    if (ranked[0]) {
      ranked[0].el.click();
      return { ok: true, matchedText: ranked[0].text, score: ranked[0].score };
    }

    // Model pickers are often opened by a button whose label contains the current model.
    // The adapter only clicks a high-confidence exact/substring match; it never guesses.
    return { ok: false, reason: `No visible model control matched “${targetLabel}”.` };
  }

  async function selectModel(targetLabel) {
    const before = candidates();
    const direct = await clickModel(targetLabel);
    if (direct.ok) return direct;

    // First open a likely model picker, then search again. This is deliberately conservative.
    const picker = before
      .map((item) => ({ ...item, score: /model|gpt|claude|opus|sonnet|haiku|o[0-9]/i.test(item.text) ? 80 : 0 }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!picker) return direct;
    picker.el.click();
    await wait(250);
    return clickModel(targetLabel);
  }

  function setPrompt(el, text) {
    if (!el) return false;
    if ("value" in el) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter && el instanceof HTMLTextAreaElement) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return true;
    }
    return false;
  }

  window.TrustRouterProviders = { providerForLocation, selectModel, setPrompt };
})();
