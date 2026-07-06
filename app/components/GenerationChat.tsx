"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  KeyRound,
  Loader2,
  MessageSquarePlus,
  RadioTower,
  Send,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  X
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  imageUrl?: string;
  imageFileName?: string;
  provider?: string;
  agentId?: string;
  capability?: string;
  candidateCount?: number;
  roundCount?: number;
  selectedCandidateIndex?: number;
  model?: string;
  quality?: string;
  costUsd?: number;
  latencyMs?: number;
  error?: string;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type PlaygroundSettings = {
  apiKey: string;
  model: string;
  quality: string;
};

type SavedPlaygroundSettings = Omit<PlaygroundSettings, "apiKey">;

type OpenRouterModelOption = {
  id: string;
  name: string;
  description: string;
  pricing: string;
};

type VerificationStatus = "idle" | "verifying" | "valid" | "invalid";

type VerificationState = {
  status: VerificationStatus;
  message: string;
  models: OpenRouterModelOption[];
};

type VerificationCache = {
  cacheKey: string;
  message: string;
  models: OpenRouterModelOption[];
  verifiedAt: string;
};

type RuntimeStatusResponse = {
  ready: boolean;
  hasServerApiKey: boolean;
  issues: string[];
};

type GenerateResponse = {
  runId?: string;
  imageUrl?: string;
  imageFileName?: string;
  provider?: string;
  agentId?: string;
  capability?: string;
  candidateCount?: number;
  roundCount?: number;
  selectedCandidateIndex?: number;
  traceUrl?: string;
  model?: string;
  costUsd?: number;
  latencyMs?: number;
  error?: string;
};

type VerifyResponse = {
  verified?: boolean;
  key?: {
    label?: string;
    limit_remaining?: number | null;
  } | null;
  models?: OpenRouterModelOption[];
  usingServerKey?: boolean;
  warning?: string;
  error?: string;
};

const SESSIONS_KEY = "imagent.chatSessions";
const ACTIVE_SESSION_KEY = "imagent.activeSession";
const SETTINGS_KEY = "imagent.settings";
const LEGACY_VERIFICATION_CACHE_KEY = "imagent.openrouterVerification";

const defaultSettings: PlaygroundSettings = {
  apiKey: "",
  model: "openai/gpt-image-1-mini",
  quality: "low"
};

const defaultSavedSettings: SavedPlaygroundSettings = {
  model: defaultSettings.model,
  quality: defaultSettings.quality
};

const fallbackModelOptions: OpenRouterModelOption[] = [
  {
    id: "openai/gpt-image-1-mini",
    name: "OpenAI GPT Image 1 Mini",
    description: "Default OpenRouter image model",
    pricing: "pricing loads after verification"
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    name: "Black Forest Labs FLUX 2 Klein",
    description: "Fallback image model",
    pricing: "pricing loads after verification"
  }
];

const qualityOptions = ["low", "medium", "high", "auto"];

const emptyVerification: VerificationState = {
  status: "idle",
  message: "",
  models: []
};

const starterPrompts = [
  "Create a cinematic square poster for an open-source image agent leaderboard.",
  "Design a clean benchmark pass badge with a green check mark.",
  "Generate a product card for a miner contribution dashboard.",
  "Make a polished visual explaining PR benchmark automation."
];

export function GenerationChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [settings, setSettings] = useState<PlaygroundSettings>(defaultSettings);
  const [draftSettings, setDraftSettings] = useState<PlaygroundSettings>(defaultSettings);
  const [availableModels, setAvailableModels] = useState<OpenRouterModelOption[]>(fallbackModelOptions);
  const [verification, setVerification] = useState<VerificationState>(emptyVerification);
  const [verificationCache, setVerificationCache] = useState<VerificationCache | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatusResponse | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"composer-model" | "composer-quality" | "settings-model" | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function loadRuntimeStatus() {
    try {
      const response = await fetch("/api/playground/status", { cache: "no-store" });
      const data = (await response.json()) as RuntimeStatusResponse;
      setRuntimeStatus(data);
      setRuntimeError("");
    } catch (error) {
      setRuntimeStatus(null);
      setRuntimeError(error instanceof Error ? error.message : "Failed to check the Imagent runtime.");
    }
  }

  useEffect(() => {
    const savedSessions = sanitizeSessions(readJson<ChatSession[]>(SESSIONS_KEY, []));
    const savedSettings = readJson<Partial<SavedPlaygroundSettings>>(SETTINGS_KEY, defaultSavedSettings);
    const initialSettings = {
      ...defaultSettings,
      model: typeof savedSettings.model === "string" && savedSettings.model.trim() ? savedSettings.model : defaultSettings.model,
      quality: isQualityOption(savedSettings.quality) ? savedSettings.quality : defaultSettings.quality
    };
    const initialSessions = savedSessions.length ? savedSessions : [newSession()];
    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    const activeId = savedActive && initialSessions.some((session) => session.id === savedActive)
      ? savedActive
      : initialSessions[0].id;
    localStorage.removeItem(LEGACY_VERIFICATION_CACHE_KEY);
    setSessions(initialSessions);
    setActiveSessionId(activeId);
    setSettings(initialSettings);
    setDraftSettings(initialSettings);
    void loadRuntimeStatus();
  }, []);

  useEffect(() => {
    if (sessions.length) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    const persistedSettings: SavedPlaygroundSettings = {
      model: settings.model,
      quality: settings.quality
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(persistedSettings));
  }, [settings.model, settings.quality]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const apiKey = draftSettings.apiKey.trim();
    const cacheKey = apiKey ? `browser:${apiKey}` : runtimeStatus?.hasServerApiKey ? "server" : "";
    if (!cacheKey) {
      setVerification(emptyVerification);
      return;
    }

    if (isUsableVerificationCache(verificationCache, cacheKey)) {
      setAvailableModels(verificationCache.models);
      setVerification({
        status: "valid",
        message: verificationCache.message || "Verified",
        models: verificationCache.models
      });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setVerification({ status: "verifying", message: "Checking key", models: [] });
      try {
        const response = await fetch("/api/openrouter/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiKey ? { apiKey } : {}),
          signal: controller.signal
        });
        const data = (await response.json()) as VerifyResponse;
        if (!response.ok || data.error) {
          throw new Error(data.error || `Verification failed with HTTP ${response.status}`);
        }

        const models = data.models?.length ? data.models : fallbackModelOptions;
        const message = data.warning || (data.usingServerKey ? "Verified with the server key" : "Verified");
        const nextCache = {
          cacheKey,
          message,
          models,
          verifiedAt: new Date().toISOString()
        };
        setAvailableModels(models);
        setVerificationCache(nextCache);
        setVerification({
          status: "valid",
          message,
          models
        });
        setDraftSettings((current) => {
          const currentApiKey = current.apiKey.trim();
          if ((apiKey && currentApiKey !== apiKey) || (!apiKey && currentApiKey)) {
            return current;
          }
          if (models.some((model) => model.id === current.model)) {
            return current;
          }
          return { ...current, model: models[0].id };
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setVerification({
          status: "invalid",
          message: error instanceof Error ? error.message : "Verification failed",
          models: []
        });
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draftSettings.apiKey, runtimeStatus?.hasServerApiKey, settingsOpen, verificationCache]);

  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const hasServerApiKey = Boolean(runtimeStatus?.hasServerApiKey);
  const runtimeIssues = runtimeError ? [runtimeError] : runtimeStatus?.issues || [];
  const runtimeReady = Boolean(runtimeStatus?.ready);
  const hasConfiguredOpenRouter = hasServerApiKey || settings.apiKey.trim().length > 0;
  const draftApiKey = draftSettings.apiKey.trim();
  const draftUsesServerKey = !draftApiKey && hasServerApiKey;
  const modelChoices = verification.models.length ? verification.models : availableModels;
  const canUseVerifiedModels = (draftApiKey.length > 0 || draftUsesServerKey) && verification.status === "valid" && modelChoices.length > 0;
  const canSaveSettings = (!draftApiKey && !draftUsesServerKey) || verification.status === "valid";
  const selectedDraftModel = modelChoices.find((model) => model.id === draftSettings.model);
  const composerModelChoices = availableModels.length ? availableModels : fallbackModelOptions;
  const selectedComposerModel = composerModelChoices.find((model) => model.id === settings.model);
  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating && runtimeReady, [prompt, isGenerating, runtimeReady]);
  const canCreateNewSession = !activeSession || activeSession.messages.length > 0 || prompt.trim().length > 0;

  function createSession() {
    if (!canCreateNewSession && activeSession) {
      setActiveSessionId(activeSession.id);
      return;
    }

    const session = newSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setPrompt("");
  }

  function deleteSession(id: string) {
    setSessions((current) => {
      const next = current.filter((session) => session.id !== id);
      if (!next.length) {
        const replacement = newSession();
        setActiveSessionId(replacement.id);
        return [replacement];
      }
      if (activeSessionId === id) {
        setActiveSessionId(next[0].id);
      }
      return next;
    });
  }

  function saveSettings() {
    const selectableModels = availableModels.length ? availableModels : fallbackModelOptions;
    const selectedModel = selectableModels.some((model) => model.id === draftSettings.model)
      ? draftSettings.model
      : selectableModels[0]?.id || defaultSettings.model;
    const nextSettings = {
      apiKey: draftSettings.apiKey.trim(),
      model: selectedModel,
      quality: draftSettings.quality
    };
    if (!nextSettings.apiKey && !hasServerApiKey) {
      setVerification(emptyVerification);
      setVerificationCache(null);
    }
    setSettings(nextSettings);
    setOpenDropdown(null);
    setSettingsOpen(false);
  }

  function openSettings() {
    setDraftSettings(settings);
    setOpenDropdown(null);
    setSettingsOpen(true);
    void loadRuntimeStatus();
  }

  function cancelSettings() {
    setDraftSettings(settings);
    setOpenDropdown(null);
    setSettingsOpen(false);
  }

  function updateComposerModel(model: string) {
    setSettings((current) => ({...current, model}));
    setOpenDropdown(null);
  }

  function updateComposerQuality(quality: string) {
    setSettings((current) => ({...current, quality}));
    setOpenDropdown(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !activeSession) {
      return;
    }
    if (!runtimeReady || !hasConfiguredOpenRouter) {
      openSettings();
      return;
    }

    const userPrompt = prompt.trim();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userPrompt
    };

    updateSession(activeSession.id, [userMessage], titleFromPrompt(userPrompt));
    setPrompt("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/playground/generate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          prompt: userPrompt,
          apiKey: settings.apiKey.trim() || undefined,
          model: settings.model,
          quality: settings.quality
        })
      });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || data.error) {
        throw new Error(data.error || `Generation failed with HTTP ${response.status}`);
      }
      updateSession(activeSession.id, [
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: "Generated with Imagent",
          imageUrl: data.imageUrl,
          imageFileName: data.imageFileName,
          provider: data.provider,
          agentId: data.agentId,
          capability: data.capability,
          candidateCount: data.candidateCount,
          roundCount: data.roundCount,
          selectedCandidateIndex: data.selectedCandidateIndex,
          model: data.model,
          quality: settings.quality,
          costUsd: data.costUsd,
          latencyMs: data.latencyMs
        }
      ]);
    } catch (error) {
      updateSession(activeSession.id, [
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: "Imagent generation failed",
          error: error instanceof Error ? error.message : "Unknown generation error",
          model: settings.model
        }
      ]);
      void loadRuntimeStatus();
    } finally {
      setIsGenerating(false);
    }
  }

  function updateSession(sessionId: string, appendedMessages: ChatMessage[], nextTitle?: string) {
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }
        return {
          ...session,
          title: session.title === "New chat" && nextTitle ? nextTitle : session.title,
          updatedAt: new Date().toISOString(),
          messages: [...session.messages, ...appendedMessages]
        };
      })
    );
  }

  return (
    <div className="generation-shell">
      <aside className="history-sidebar" aria-label="Chat history">
        <button className="new-chat" type="button" onClick={createSession} aria-disabled={!canCreateNewSession}>
          <MessageSquarePlus size={17} />
          New chat
        </button>
        <div className="history-scroll custom-scrollbar">
          <div className="history-section-label">Chats</div>
          <div className="history-list">
            {sessions.map((session) => (
              <div
                className={session.id === activeSessionId ? "history-item active" : "history-item"}
                key={session.id}
              >
                <button className="history-select" type="button" onClick={() => setActiveSessionId(session.id)}>
                  <span>{session.title}</span>
                  <small>{session.messages.length} messages</small>
                </button>
                <button
                  className="history-delete"
                  type="button"
                  aria-label={`Delete ${session.title}`}
                  onClick={() => deleteSession(session.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <footer className="generation-sidebar-footer">
          <strong>IMAGENT</strong>
          <span>built by Gittensor subnet 74</span>
        </footer>
      </aside>

      <section className="generation-main">
        <button className="floating-settings-button" type="button" onClick={openSettings} aria-label="Settings">
          <Settings size={18} />
        </button>

        <div className="conversation custom-scrollbar">
          {!runtimeStatus && !runtimeError ? (
            <section className="runtime-alert info">
              <div className="runtime-alert-title">
                <Loader2 className="spin" size={16} />
                <strong>Checking local Imagent runtime</strong>
              </div>
            </section>
          ) : null}
          {runtimeIssues.length > 0 ? (
            <section className="runtime-alert error">
              <div className="runtime-alert-title">
                <AlertCircle size={16} />
                <strong>Generation is unavailable</strong>
              </div>
              <p>The local UI runtime is missing required dependencies.</p>
              <ul>
                {runtimeIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {!activeSession || activeSession.messages.length === 0 ? (
            <section className="generation-empty">
              <span className="empty-kicker">Powered by Gittensor · image agent · benchmark ready</span>
              <h1>What should Imagent plan and generate?</h1>
              <div className="gittensor-callout">
                <RadioTower size={16} />
                <div>
                  <strong>Built through Gittensor</strong>
                  <span>
                    Gittensor helps power the Imagent open agent competition:
                    contributors submit PRs, benchmark rounds evaluate them,
                    and winning agents become public code.
                  </span>
                </div>
              </div>
              <div className="generation-showcase" aria-hidden="true">
                <div className="showcase-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="showcase-brand" src="/brand/imagent-ai-avatar.jpg" alt="" />
                </div>
              </div>
              <div className="prompt-suggestions">
                {starterPrompts.map((item) => (
                  <button type="button" key={item} onClick={() => setPrompt(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="conversation-stack">
              {activeSession.messages.map((message) => (
                <article className={`chat-turn ${message.role}`} key={message.id}>
                  <div className="turn-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {message.role === "user" ? <UserRound size={16} strokeWidth={2.4} /> : <img src="/brand/imagent-ai-avatar.jpg" alt="" />}
                  </div>
                  <div className="turn-content">
                    <p>{message.content}</p>
                    {message.imageUrl ? (
                      <div className="generated-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={message.imageUrl} alt="Generated image" />
                        <a href={message.imageUrl} download={message.imageFileName || "imagent-output.png"}>
                          <Download size={14} />
                          Download
                        </a>
                      </div>
                    ) : null}
                    {message.error ? <div className="turn-error">{message.error}</div> : null}
                    {message.role === "agent" ? (
                      <div className="turn-meta">
                        {message.agentId ? <span>{message.agentId}</span> : null}
                        {message.capability ? <span>{message.capability}</span> : null}
                        <span>{message.model || settings.model}</span>
                        {message.quality ? <span>{message.quality}</span> : null}
                        {typeof message.candidateCount === "number" && message.candidateCount > 0 ? (
                          <span>{message.candidateCount} candidates</span>
                        ) : null}
                        {typeof message.roundCount === "number" && message.roundCount > 0 ? (
                          <span>{message.roundCount} rounds</span>
                        ) : null}
                        {typeof message.latencyMs === "number" ? <span>{message.latencyMs.toFixed(0)} ms</span> : null}
                        {typeof message.costUsd === "number" ? <span>${message.costUsd.toFixed(6)}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
              {isGenerating ? (
                <article className="chat-turn agent">
                  <div className="turn-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/imagent-ai-avatar.jpg" alt="" />
                  </div>
                  <div className="turn-content pending">
                    <Loader2 className="spin" size={16} />
                    Generating image
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </div>

        <div className="generation-composer-wrap">
          <form className="generation-composer" onSubmit={submit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Message Imagent"
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="composer-toolbar">
              {hasConfiguredOpenRouter ? (
                <>
                  <ModelDropdown
                    hideLabel
                    id="composer-model"
                    label="Model"
                    models={composerModelChoices}
                    open={openDropdown === "composer-model"}
                    selectedModel={settings.model}
                    selectedModelName={selectedComposerModel?.name || labelForModel(settings.model, composerModelChoices)}
                    onOpenChange={(open) => setOpenDropdown(open ? "composer-model" : null)}
                    onSelect={updateComposerModel}
                  />
                  <QualityDropdown
                    hideLabel
                    open={openDropdown === "composer-quality"}
                    selectedQuality={settings.quality}
                    onOpenChange={(open) => setOpenDropdown(open ? "composer-quality" : null)}
                    onSelect={updateComposerQuality}
                  />
                </>
              ) : (
                <button className="composer-configure-button" type="button" onClick={openSettings}>
                  <KeyRound size={15} />
                  Configure Imagent
                </button>
              )}
              <button className="composer-send-button" type="submit" disabled={!canSubmit} aria-label="Generate image">
                {isGenerating ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </form>
        </div>
      </section>

      {settingsOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelSettings();
            }
          }}
        >
          <section className="settings-modal custom-scrollbar" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header>
              <div className="settings-title-row">
                <span className="settings-title-icon">
                  <Settings size={18} />
                </span>
                <div>
                  <h2 id="settings-title">Generation settings</h2>
                  <p>OpenRouter-backed Imagent agent</p>
                </div>
              </div>
              <button type="button" onClick={cancelSettings} aria-label="Close settings">
                <X size={18} />
              </button>
            </header>
            <div className={runtimeReady ? "settings-runtime-status ready" : "settings-runtime-status error"}>
              <strong>Local runtime</strong>
              <p>{runtimeStatus ? "The UI server can reach the local Imagent runtime." : "Checking the local Imagent runtime."}</p>
              {runtimeIssues.length > 0 ? (
                <ul>
                  {runtimeIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <label className="settings-field">
              <span>OpenRouter API key</span>
              <div className="api-key-row">
                <div className="input-with-icon">
                  <KeyRound size={16} />
                  <input
                    type="password"
                    value={draftSettings.apiKey}
                    onChange={(event) => setDraftSettings({...draftSettings, apiKey: event.target.value})}
                    placeholder="sk-or-..."
                    autoComplete="off"
                  />
                </div>
                <VerificationBadge verification={verification} />
              </div>
              <small className="field-note">
                {hasServerApiKey
                  ? "A shared server OpenRouter key is enabled for this UI. Leave this blank to use it, or enter a browser key to override it."
                  : "No shared server key is enabled. Enter a browser key here, or enable IMAGENT_UI_ENABLE_SERVER_KEY_FALLBACK on a trusted private deployment."}
              </small>
            </label>
            <div className="settings-field">
              <span>Image model</span>
              <ModelDropdown
                id="settings-model"
                disabled={!canUseVerifiedModels}
                emptyLabel="Verify OpenRouter to load image models"
                label="Image model"
                models={canUseVerifiedModels ? modelChoices : []}
                open={openDropdown === "settings-model"}
                selectedModel={draftSettings.model}
                selectedModelName={selectedDraftModel?.name || labelForModel(draftSettings.model, modelChoices)}
                onOpenChange={(open) => setOpenDropdown(open ? "settings-model" : null)}
                onSelect={(model) => setDraftSettings({...draftSettings, model})}
              />
              {canUseVerifiedModels ? (
                <small className="field-note">
                  {selectedDraftModel?.pricing || "pricing unavailable"} · {modelChoices.length} image models loaded.
                </small>
              ) : null}
            </div>
            <div className="settings-field">
              <span>Quality level</span>
              <div className="segmented-control" role="radiogroup" aria-label="Quality level">
                {qualityOptions.map((quality) => (
                  <button
                    className={draftSettings.quality === quality ? "active" : ""}
                    type="button"
                    role="radio"
                    aria-checked={draftSettings.quality === quality}
                    key={quality}
                    onClick={() => setDraftSettings({...draftSettings, quality})}
                  >
                    {draftSettings.quality === quality ? <Check size={14} /> : null}
                    {quality}
                  </button>
                ))}
              </div>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={cancelSettings}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={saveSettings} disabled={!canSaveSettings}>
                Save settings
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ModelDropdown({
  disabled = false,
  emptyLabel = "No models loaded",
  hideLabel = false,
  id,
  label,
  models,
  onOpenChange,
  onSelect,
  open,
  selectedModel,
  selectedModelName
}: {
  disabled?: boolean;
  emptyLabel?: string;
  hideLabel?: boolean;
  id: string;
  label: string;
  models: OpenRouterModelOption[];
  onOpenChange: (open: boolean) => void;
  onSelect: (model: string) => void;
  open: boolean;
  selectedModel: string;
  selectedModelName: string;
}) {
  const selected = models.find((model) => model.id === selectedModel);
  const menuId = `${id}-menu`;

  return (
    <div
      className={`model-dropdown ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextFocus)) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onOpenChange(false);
        }
      }}
    >
      <button
        className="model-dropdown-trigger"
        type="button"
        disabled={disabled}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
      >
        <Sparkles size={15} />
        <span className="dropdown-copy">
          {hideLabel ? null : <small>{label}</small>}
          <strong>{disabled ? emptyLabel : selected?.name || selectedModelName}</strong>
        </span>
        <ChevronDown size={15} />
      </button>
      {open && !disabled ? (
        <div className="model-dropdown-menu custom-scrollbar" id={menuId} role="listbox" aria-label={label}>
          {models.map((model) => {
            const active = model.id === selectedModel;
            return (
              <button
                className={active ? "active" : ""}
                type="button"
                role="option"
                aria-selected={active}
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  onOpenChange(false);
                }}
              >
                <span>
                  <strong>{model.name}</strong>
                  <small>{model.pricing || model.id}</small>
                </span>
                {active ? <Check size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function QualityDropdown({
  hideLabel = false,
  onOpenChange,
  onSelect,
  open,
  selectedQuality
}: {
  hideLabel?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (quality: string) => void;
  open: boolean;
  selectedQuality: string;
}) {
  return (
    <div
      className={`quality-dropdown ${open ? "open" : ""}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextFocus)) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onOpenChange(false);
        }
      }}
    >
      <button
        className="quality-dropdown-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
      >
        <span className="dropdown-copy">
          {hideLabel ? null : <small>Level</small>}
          <strong>{selectedQuality}</strong>
        </span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="quality-dropdown-menu" role="listbox" aria-label="Generation level">
          {qualityOptions.map((quality) => {
            const active = quality === selectedQuality;
            return (
              <button
                className={active ? "active" : ""}
                type="button"
                role="option"
                aria-selected={active}
                key={quality}
                onClick={() => {
                  onSelect(quality);
                  onOpenChange(false);
                }}
              >
                <span>{quality}</span>
                {active ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function VerificationBadge({ verification }: { verification: VerificationState }) {
  if (verification.status === "verifying") {
    return (
      <span className="verification-status verifying" aria-label="Verifying OpenRouter key" title="Verifying OpenRouter key">
        <Loader2 className="spin" size={14} />
      </span>
    );
  }

  if (verification.status === "valid") {
    return (
      <span className="verification-status valid" aria-label={verification.message || "OpenRouter key verified"} title={verification.message || "OpenRouter key verified"}>
        <Check size={14} />
      </span>
    );
  }

  if (verification.status === "invalid") {
    return (
      <span className="verification-status invalid" aria-label={verification.message || "Invalid OpenRouter key"} title={verification.message || "Invalid OpenRouter key"}>
        <AlertCircle size={14} />
      </span>
    );
  }

  return (
    <span className="verification-status idle" aria-label="OpenRouter key not configured" title="OpenRouter key not configured">
      <KeyRound size={14} />
    </span>
  );
}

function newSession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function titleFromPrompt(prompt: string) {
  return prompt.length > 42 ? `${prompt.slice(0, 42)}...` : prompt;
}

function labelForModel(model: string, models: OpenRouterModelOption[]) {
  const knownModel = models.find((option) => option.id === model);
  if (knownModel) {
    return knownModel.name.replace("OpenAI ", "").replace("Black Forest Labs ", "");
  }
  return model.length > 30 ? `${model.slice(0, 30)}...` : model;
}

function isUsableVerificationCache(cache: VerificationCache | null, cacheKey: string): cache is VerificationCache {
  return Boolean(cache && cache.cacheKey === cacheKey && Array.isArray(cache.models) && cache.models.length > 0);
}

function sanitizeSessions(sessions: ChatSession[]) {
  return sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => {
      if (!message.imageUrl?.startsWith("data:")) {
        return message;
      }
      return {
        ...message,
        imageUrl: undefined,
        imageFileName: undefined
      };
    })
  }));
}

function isQualityOption(value: unknown): value is string {
  return typeof value === "string" && qualityOptions.includes(value);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
