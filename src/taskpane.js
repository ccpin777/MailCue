/* global Office */
const byId = (id) => document.getElementById(id);
const DEFAULT_TRANSLATION_LANGUAGE = "Traditional Chinese (Taiwan)";
const state = { mailbox: "", allowed: false, connected: false, connecting: false, busy: false, followupController: null, modelsLoaded: false, provider: "chatgpt", apiKeyConfigured: false, mode: "email", conversationActive: false, context: null, thread: [], translationLanguage: DEFAULT_TRANSLATION_LANGUAGE };

function setStatus(message, isError = false) {
  const node = byId("status");
  node.textContent = message;
  node.classList.toggle("error", isError);
}

async function request(path, body) {
  const timeoutMs = path === "/api/transform" ? 240000 : 45000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = document.querySelector('meta[name="mailcue-api-token"]')?.content;
    if (!token) throw new Error("MailCue local session is missing. Reload the task pane.");
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { "X-MailCue-Token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Local bridge returned ${response.status}.`);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("MailCue did not respond in time. Check the menu bar service and try again.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestStream(path, body, onDelta, externalSignal = null) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const timer = window.setTimeout(() => controller.abort(), 240000);
  let reader;
  try {
    const token = document.querySelector('meta[name="mailcue-api-token"]')?.content;
    if (!token) throw new Error("MailCue local session is missing. Reload the task pane.");
    const response = await fetch(path, {
      method: "POST",
      headers: { "X-MailCue-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Local bridge returned ${response.status}.`);
    }
    if (!response.body) throw new Error("MailCue could not stream the response in this Outlook view.");

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let completed = false;
    const processLine = (line) => {
      if (!line.trim()) return;
      let event;
      try { event = JSON.parse(line); }
      catch { throw new Error("MailCue received an invalid response stream."); }
      if (event.type === "delta") {
        text += event.delta || "";
        onDelta(event.delta || "");
      } else if (event.type === "done") {
        text = String(event.text || "");
        completed = true;
      } else if (event.type === "error") {
        throw new Error(event.error || "MailCue could not complete the request.");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) processLine(line);
      if (done) {
        processLine(buffer);
        break;
      }
    }
    if (!completed) throw new Error("The response stream ended before completion.");
    return { text };
  } catch (error) {
    if (externalSignal?.aborted) throw new Error("Response stopped.");
    if (controller.signal.aborted) throw new Error("MailCue did not respond in time. Check the menu bar service and try again.");
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
    if (reader) await reader.cancel().catch(() => {});
  }
}

async function loadModels() {
  if (!state.connected) return;
  const select = byId("model-select");
  select.disabled = true;
  select.replaceChildren(new Option("Loading models…", ""));
  try {
    const data = await request("/api/models");
    select.replaceChildren();
    for (const model of data.models || []) {
      select.add(new Option(model.displayName, model.slug));
    }
    if (!select.options.length) throw new Error("No models are available for this ChatGPT account.");
    select.value = data.selectedModel || data.models[0].slug;
    state.modelsLoaded = true;
  } catch (error) {
    select.replaceChildren(new Option("Could not load models", ""));
    state.modelsLoaded = false;
    setStatus(error.message, true);
  } finally {
    select.disabled = !select.options.length || !select.options[0].value;
  }
}

async function saveSelectedModel() {
  const select = byId("model-select");
  if (!select.value || select.disabled) return;
  select.disabled = true;
  try {
    const model = await request("/api/model", { modelSlug: select.value });
    setStatus(model.displayName);
  } catch (error) {
    setStatus(error.message, true);
    state.modelsLoaded = false;
  } finally {
    select.disabled = false;
  }
}

function refreshButtons() {
  const hasInput = state.mode === "email"
    ? Boolean(window.Office && Office.context.mailbox.item)
    : Boolean(byId("selected-text").value.trim());
  const enabled = state.allowed && state.connected && !state.busy && hasInput;
  byId("translate").disabled = !enabled;
  byId("suggest").disabled = !enabled;
  const askButton = byId("ask-follow-up");
  const responseIsStreaming = Boolean(state.followupController);
  askButton.disabled = responseIsStreaming ? false : state.busy || !state.context || !byId("follow-up-question").value.trim();
  askButton.classList.toggle("is-stopping", responseIsStreaming);
  byId("ask-follow-up-label").hidden = responseIsStreaming;
  byId("stop-response-icon").hidden = !responseIsStreaming;
  askButton.setAttribute("aria-label", responseIsStreaming ? "Stop response" : "Ask");
  askButton.title = responseIsStreaming ? "Stop response" : "Ask";
  byId("new-request").disabled = state.busy;
  byId("mode-button").disabled = state.busy;
  byId("selected-text").disabled = state.busy;
  byId("follow-up-question").disabled = state.busy;
  byId("mode-menu").querySelectorAll("button").forEach((button) => { button.disabled = state.busy; });
  byId("actions").hidden = !(state.allowed && state.connected) || state.conversationActive;
  byId("input-area").hidden = !(state.allowed && state.connected && state.mode === "selected") || state.conversationActive;
  byId("connect").hidden = state.provider !== "chatgpt" || state.connected;
  byId("connect").disabled = state.connecting || state.busy;
  byId("chatgpt-connection").hidden = state.provider !== "chatgpt";
  byId("api-connection").hidden = state.provider !== "api";
  byId("provider-select").disabled = state.busy || state.connecting;
  byId("api-key").disabled = state.busy;
  byId("save-api-key").disabled = state.busy || !byId("api-key").value.trim();
  const connectionText = state.provider === "api"
    ? (state.connected ? "OpenAI API connected" : "OpenAI API not connected")
    : (state.connected ? "ChatGPT connected" : "ChatGPT not connected");
  byId("connection-state").textContent = connectionText;
  byId("connection-dot").classList.toggle("is-connected", state.connected);
  byId("save-email").disabled = state.busy || !isEmail(byId("allowed-email").value.trim());
  byId("translation-language").disabled = state.busy;
  byId("save-language").disabled = state.busy || !byId("translation-language").value.trim();
}

function showConnectionDetails(email = "") {
  byId("connection-detail").textContent = state.provider === "api"
    ? (state.connected ? "API key is stored in MailCue's private folder on this Mac. API usage is billed separately." : "Save an OpenAI API key to connect.")
    : (state.connected ? (email || "Plan usage is authorized on this Mac.") : "Connect once to use your ChatGPT plan.");
  byId("api-key-help").textContent = state.apiKeyConfigured
    ? "A key is stored on this Mac. Enter a new key to replace it. API usage is billed separately from a ChatGPT plan."
    : "Stored on this Mac. API usage is billed separately from a ChatGPT plan.";
}

async function selectProvider(provider) {
  if (provider === "api" && !state.apiKeyConfigured) {
    state.provider = "api";
    state.connected = false;
    state.modelsLoaded = false;
    showConnectionDetails();
    refreshButtons();
    return;
  }
  try {
    const result = await request("/api/provider", { provider });
    state.provider = result.provider;
    const session = await request("/api/session");
    state.connected = session.connected;
    state.modelsLoaded = false;
    showConnectionDetails(session.email);
    setStatus(state.connected ? "Connection method updated." : (session.error || "Open Settings to connect the selected service."), Boolean(session.error));
    refreshButtons();
    if (state.connected) loadModels();
  } catch (error) {
    byId("provider-select").value = state.provider;
    setStatus(error.message, true);
  }
}

async function saveApiKey() {
  const apiKey = byId("api-key").value.trim();
  if (!apiKey) return;
  state.busy = true;
  refreshButtons();
  setStatus("Checking the API key and available models…");
  try {
    await request("/api/api-key", { apiKey });
    byId("api-key").value = "";
    state.apiKeyConfigured = true;
    const selected = await request("/api/provider", { provider: "api" });
    state.provider = selected.provider;
    byId("provider-select").value = state.provider;
    const session = await request("/api/session");
    state.connected = session.connected;
    state.modelsLoaded = false;
    showConnectionDetails();
    setStatus("OpenAI API key saved and verified.");
    refreshButtons();
    if (state.connected) loadModels();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    state.busy = false;
    refreshButtons();
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveAllowedEmail() {
  const email = byId("allowed-email").value.trim().toLowerCase();
  if (!isEmail(email)) {
    setStatus("Enter a valid Outlook email address.", true);
    return;
  }
  state.busy = true;
  refreshButtons();
  try {
    const config = await request("/api/config", { allowedOutlookEmail: email });
    const savedEmail = String(config.allowedOutlookEmail || "").trim().toLowerCase();
    state.allowed = Boolean(state.mailbox && state.mailbox === savedEmail);
    byId("allowed-email").value = savedEmail;
    setStatus(state.allowed
      ? "Saved. This Outlook account is enabled for MailCue."
      : "Saved. Open Outlook with this account to use MailCue.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    state.busy = false;
    refreshButtons();
  }
}

async function saveTranslationLanguage() {
  const translationLanguage = byId("translation-language").value.trim();
  if (!translationLanguage) {
    setStatus("Enter a language to translate into.", true);
    return;
  }
  state.busy = true;
  refreshButtons();
  try {
    const config = await request("/api/translation-language", { translationLanguage });
    state.translationLanguage = config.translationLanguage;
    byId("translation-language").value = state.translationLanguage;
    setStatus(`Translation language saved: ${state.translationLanguage}`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    state.busy = false;
    refreshButtons();
  }
}

async function runAction(action) {
  state.busy = true;
  state.context = null;
  state.thread = [];
  state.conversationActive = false;
  byId("conversation").replaceChildren();
  byId("result-title").textContent = action === "translate" ? `Translation · ${state.translationLanguage}` : "Suggested reply";
  byId("result").textContent = "";
  byId("result-card").hidden = false;
  byId("mode-wrap").hidden = true;
  byId("new-request").hidden = false;
  state.conversationActive = true;
  refreshButtons();
  setStatus(action === "translate" ? "Translating…" : "Drafting a reply…");
  try {
    const text = await getCurrentInputText();
    if (!text) throw new Error(state.mode === "email" ? "Open an email in Outlook, then try again." : "Paste the email text above first.");
    const result = await requestStream("/api/transform", { action, text, mailbox: state.mailbox }, (delta) => {
      byId("result").textContent += delta;
    });
    state.context = { action, text, result: result.text };
    byId("result").textContent = result.text;
    byId("actions").hidden = true;
    setStatus("");
  } catch (error) {
    if (!byId("result").textContent) {
      state.conversationActive = false;
      byId("result-card").hidden = true;
      byId("mode-wrap").hidden = false;
      byId("new-request").hidden = true;
    }
    setStatus(error.message, true);
  } finally {
    state.busy = false;
    refreshButtons();
  }
}

function getCurrentInputText() {
  if (state.mode === "selected") return Promise.resolve(byId("selected-text").value.trim());
  const item = window.Office && Office.context.mailbox.item;
  if (!item || !item.body) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      settled = true;
      reject(new Error("Outlook took too long to read this email. Try again."));
    }, 10000);
    try {
      item.body.getAsync(Office.CoercionType.Text, (result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          reject(new Error(result.error?.message || "Could not read the open email."));
          return;
        }
        const subject = String(item.subject || "").trim();
        const sender = item.from ? `${item.from.displayName || ""} <${item.from.emailAddress || ""}>`.trim() : "";
        const parts = [subject && `Subject: ${subject}`, sender && `From: ${sender}`, String(result.value || "").trim()].filter(Boolean);
        resolve(parts.join("\n\n").slice(0, 30000));
      });
    } catch (error) {
      settled = true;
      window.clearTimeout(timer);
      reject(error);
    }
  });
}

function renderConversation() {
  const list = byId("conversation");
  list.replaceChildren();
  for (const turn of state.thread) {
    const entry = document.createElement("div");
    entry.className = `chat-turn ${turn.role === "user" ? "from-user" : "from-assistant"}`;
    const text = document.createElement("p");
    text.textContent = turn.content;
    if (turn.role !== "user") {
      const label = document.createElement("strong");
      label.textContent = turn.stopped ? "MailCue (stopped)" : turn.incomplete ? "MailCue (incomplete)" : "MailCue";
      entry.append(label);
    }
    entry.append(text);
    list.append(entry);
  }
}

async function askFollowUp() {
  const question = byId("follow-up-question").value.trim();
  if (!state.context || !question || state.busy) return;
  const controller = new AbortController();
  state.followupController = controller;
  state.busy = true;
  refreshButtons();
  const history = state.thread.slice(-8).map((turn) => ({ ...turn, content: turn.content.slice(0, 3000) }));
  const userTurn = { role: "user", content: question };
  const assistantTurn = { role: "assistant", content: "" };
  state.thread.push(userTurn, assistantTurn);
  byId("follow-up-question").value = "";
  renderConversation();
  setStatus("Thinking about your question…");
  const streamingText = byId("conversation").lastElementChild.querySelector("p");
  try {
    const result = await requestStream("/api/transform", {
      action: "followup", mailbox: state.mailbox,
      text: state.context.text, originalAction: state.context.action,
      result: state.context.result,
      history,
      question,
    }, (delta) => {
      assistantTurn.content += delta;
      streamingText.textContent = assistantTurn.content;
    }, controller.signal);
    assistantTurn.content = result.text;
    renderConversation();
    setStatus("");
  } catch (error) {
    const stopped = controller.signal.aborted;
    if (assistantTurn.content) {
      assistantTurn.incomplete = true;
      assistantTurn.stopped = stopped;
    }
    else state.thread.pop();
    renderConversation();
    setStatus(stopped ? "Response stopped." : error.message, !stopped);
  } finally {
    if (state.followupController === controller) state.followupController = null;
    state.busy = false;
    refreshButtons();
  }
}

async function connect() {
  if (state.connecting || state.busy) return;
  state.connecting = true;
  refreshButtons();
  setStatus("Opening the official ChatGPT sign-in page…");
  const authWindow = window.open("about:blank", "_blank");
  let timer = 0;
  let pollInProgress = false;
  const stopPolling = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
    state.connecting = false;
    authWindow?.close();
    refreshButtons();
  };
  try {
    const result = await request("/api/sign-in", {});
    if (result.connected) {
      authWindow?.close();
      state.connected = true;
      byId("connection-detail").textContent = result.email || "Plan usage is authorized on this Mac.";
      setStatus("ChatGPT plan connection is ready.");
      if (!byId("settings-panel").hidden) loadModels();
      refreshButtons();
      return;
    }
    if (authWindow) authWindow.location.href = result.authorizationUrl;
    else throw new Error("The sign-in window was blocked. Allow pop-ups for Outlook and try again.");
    setStatus("Finish authorization in your browser. This pane will update when it completes.");
    const startedAt = Date.now();
    timer = window.setInterval(async () => {
      if (pollInProgress) return;
      pollInProgress = true;
      try {
        const session = await request("/api/session");
        if (session.connected) {
          state.connected = true;
          byId("connection-detail").textContent = session.email || "Plan usage is authorized on this Mac.";
          setStatus("ChatGPT plan connection is ready.");
          if (!byId("settings-panel").hidden) loadModels();
          stopPolling();
        } else if (session.error) {
          setStatus(session.error, true);
          stopPolling();
        } else if (Date.now() - startedAt > 180000) {
          setStatus("Sign-in timed out. Click Connect ChatGPT to try again.", true);
          stopPolling();
        }
      } catch (error) {
        setStatus(error.message, true);
        stopPolling();
      } finally {
        pollInProgress = false;
      }
    }, 1500);
  } catch (error) {
    authWindow?.close();
    setStatus(error.message, true);
  } finally {
    if (!timer) {
      state.connecting = false;
      refreshButtons();
    }
  }
}

async function initialize() {
  if (!window.Office) {
    setStatus("Open this task pane inside Outlook.", true);
    return;
  }
  Office.onReady(async () => {
    state.mailbox = (Office.context.mailbox.userProfile?.emailAddress || "").trim().toLowerCase();
    byId("current-account").textContent = state.mailbox || "Could not determine the active Outlook mailbox.";
    try {
      const [config, session] = await Promise.all([request("/api/config"), request("/api/session")]);
      const allowedEmail = String(config.allowedOutlookEmail || "").trim().toLowerCase();
      byId("allowed-email").value = allowedEmail;
      state.translationLanguage = String(config.translationLanguage || DEFAULT_TRANSLATION_LANGUAGE);
      byId("translation-language").value = state.translationLanguage;
      state.provider = config.provider === "api" ? "api" : "chatgpt";
      state.apiKeyConfigured = Boolean(config.apiKeyConfigured);
      byId("provider-select").value = state.provider;
      state.allowed = Boolean(state.mailbox && allowedEmail && state.mailbox === allowedEmail);
      state.connected = session.connected;
      showConnectionDetails(session.email);
      if (!config.allowedOutlookEmail) {
        setStatus("Open Settings to choose the Outlook account MailCue can use.", true);
      } else if (!state.allowed) {
        setStatus("This mailbox is not enabled. The assistant is restricted to the configured Outlook account.", true);
      } else if (session.connected) {
        setStatus("");
      } else {
        setStatus(session.error || (state.provider === "api" ? "Open Settings to add an OpenAI API key." : "Open Settings to connect ChatGPT."), Boolean(session.error));
      }
    } catch (error) {
      setStatus(`Could not load MailCue settings: ${error.message}`, true);
    }
    refreshButtons();
  });
}

byId("translate").addEventListener("click", () => runAction("translate"));
byId("suggest").addEventListener("click", () => runAction("suggest"));
byId("connect").addEventListener("click", connect);
byId("provider-select").addEventListener("change", (event) => selectProvider(event.target.value));
byId("api-key").addEventListener("input", refreshButtons);
byId("save-api-key").addEventListener("click", saveApiKey);
byId("allowed-email").addEventListener("input", refreshButtons);
byId("save-email").addEventListener("click", saveAllowedEmail);
byId("translation-language").addEventListener("input", refreshButtons);
byId("save-language").addEventListener("click", saveTranslationLanguage);
byId("selected-text").addEventListener("input", refreshButtons);
byId("follow-up-question").addEventListener("input", refreshButtons);
byId("follow-up-question").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!byId("ask-follow-up").disabled) askFollowUp();
  }
});
byId("ask-follow-up").addEventListener("click", () => {
  if (state.followupController) {
    state.followupController.abort();
    return;
  }
  askFollowUp();
});
function closeModeMenu() {
  byId("mode-menu").hidden = true;
  byId("mode-button").setAttribute("aria-expanded", "false");
}
byId("mode-button").addEventListener("click", () => {
  const button = byId("mode-button");
  const open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  byId("mode-menu").hidden = !open;
});
document.addEventListener("pointerdown", (event) => {
  if (!byId("mode-wrap").contains(event.target)) closeModeMenu();
});
byId("mode-menu").querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  byId("mode-value").textContent = state.mode === "selected" ? "Selected text" : "Email";
  closeModeMenu();
  byId("result-card").hidden = true;
  setStatus("");
  refreshButtons();
}));
byId("settings-button").addEventListener("click", () => {
  const button = byId("settings-button");
  const open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  byId("settings-panel").hidden = !open;
  if (open && state.connected && !state.modelsLoaded) loadModels();
});
byId("model-select").addEventListener("change", saveSelectedModel);
byId("new-request").addEventListener("click", () => {
  state.context = null;
  state.thread = [];
  state.conversationActive = false;
  byId("conversation").replaceChildren();
  byId("selected-text").value = "";
  byId("follow-up-question").value = "";
  byId("result-card").hidden = true;
  byId("mode-wrap").hidden = false;
  byId("new-request").hidden = true;
  setStatus("");
  refreshButtons();
});
initialize();
