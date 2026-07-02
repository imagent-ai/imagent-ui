"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  KeyRound,
  Loader2,
  MessageSquarePlus,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  imageUrl?: string;
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

type GenerateResponse = {
  imageUrl?: string;
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
  warning?: string;
  error?: string;
};

const SESSIONS_KEY = "imagent.chatSessions";
const ACTIVE_SESSION_KEY = "imagent.activeSession";
const SETTINGS_KEY = "imagent.settings";

const defaultSettings: PlaygroundSettings = {
  apiKey: "",
  model: "openai/gpt-image-1-mini",
  quality: "low"
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const savedSessions = readJson<ChatSession[]>(SESSIONS_KEY, []);
    const savedSettings = readJson<PlaygroundSettings>(SETTINGS_KEY, defaultSettings);
    const initialSessions = savedSessions.length ? savedSessions : [newSession()];
    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    const activeId = savedActive && initialSessions.some((session) => session.id === savedActive)
      ? savedActive
      : initialSessions[0].id;
    setSessions(initialSessions);
    setActiveSessionId(activeId);
    setSettings({...defaultSettings, ...savedSettings});
    setDraftSettings({...defaultSettings, ...savedSettings});
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const apiKey = draftSettings.apiKey.trim();
    if (!apiKey) {
      setVerification(emptyVerification);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setVerification({ status: "verifying", message: "Checking key", models: [] });
      try {
        const response = await fetch("/api/openrouter/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey }),
          signal: controller.signal
        });
        const data = (await response.json()) as VerifyResponse;
        if (!response.ok || data.error) {
          throw new Error(data.error || `Verification failed with HTTP ${response.status}`);
        }

        const models = data.models?.length ? data.models : fallbackModelOptions;
        setAvailableModels(models);
        setVerification({
          status: "valid",
          message: data.warning || "Verified",
          models
        });
        setDraftSettings((current) => {
          if (current.apiKey.trim() !== apiKey || models.some((model) => model.id === current.model)) {
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
  }, [draftSettings.apiKey, settingsOpen]);

  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const hasConfiguredOpenRouter = settings.apiKey.trim().length > 0;
  const draftApiKey = draftSettings.apiKey.trim();
  const modelChoices = verification.models.length ? verification.models : availableModels;
  const canUseVerifiedModels = draftApiKey.length > 0 && verification.status === "valid" && modelChoices.length > 0;
  const canSaveSettings = !draftApiKey || verification.status === "valid";
  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating, [prompt, isGenerating]);

  function createSession() {
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
    const selectedModel = availableModels.some((model) => model.id === draftSettings.model)
      ? draftSettings.model
      : availableModels[0]?.id || defaultSettings.model;
    setSettings({
      apiKey: draftSettings.apiKey.trim(),
      model: selectedModel,
      quality: draftSettings.quality
    });
    setSettingsOpen(false);
  }

  function openSettings() {
    setDraftSettings(settings);
    setSettingsOpen(true);
  }

  function cancelSettings() {
    setDraftSettings(settings);
    setSettingsOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !activeSession) {
      return;
    }
    if (!settings.apiKey.trim()) {
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
          apiKey: settings.apiKey,
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
          content: "Generated image",
          imageUrl: data.imageUrl,
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
          content: "Generation failed",
          error: error instanceof Error ? error.message : "Unknown generation error",
          model: settings.model
        }
      ]);
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
        <button className="new-chat" type="button" onClick={createSession}>
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
          <strong>IMAGENT BENCH</strong>
          <span>made by Gittensor subnet 74</span>
        </footer>
      </aside>

      <section className="generation-main">
        <header className="generation-topbar">
          {hasConfiguredOpenRouter ? (
            <button className="model-chip" type="button" onClick={openSettings}>
              <Sparkles size={16} />
              <span>{labelForModel(settings.model, availableModels)}</span>
            </button>
          ) : (
            <button className="openrouter-placeholder" type="button" onClick={openSettings}>
              <KeyRound size={16} />
              <span>Configure OpenRouter to choose an image model</span>
            </button>
          )}
          <div className="topbar-actions">
            {hasConfiguredOpenRouter ? <span className="quality-chip">{settings.quality}</span> : null}
            <button className="icon-button" type="button" onClick={openSettings} aria-label="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="conversation custom-scrollbar">
          {!activeSession || activeSession.messages.length === 0 ? (
            <section className="generation-empty">
              <img className="empty-mark" src="/brand/imagent-ai-avatar.jpg" alt="" />
              <span className="empty-kicker">Gittensor subnet 74 · image agent · benchmark ready</span>
              <h1>What should imagent create?</h1>
              <div className="generation-showcase" aria-hidden="true">
                <div className="showcase-image">
                  <span className="showcase-sun" />
                  <span className="showcase-ring ring-one" />
                  <span className="showcase-ring ring-two" />
                  <span className="showcase-plate plate-one" />
                  <span className="showcase-plate plate-two" />
                  <span className="showcase-plate plate-three" />
                  <span className="showcase-scanline" />
                </div>
                <div className="showcase-meta">
                  {hasConfiguredOpenRouter ? (
                    <>
                      <span>{labelForModel(settings.model, availableModels)}</span>
                      <strong>{settings.quality}</strong>
                      <span>preview</span>
                    </>
                  ) : (
                    <>
                      <span>OpenRouter</span>
                      <strong>configure</strong>
                      <span>required</span>
                    </>
                  )}
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
                    {message.role === "user" ? "You" : <img src="/brand/imagent-ai-avatar.jpg" alt="" />}
                  </div>
                  <div className="turn-content">
                    <p>{message.content}</p>
                    {message.imageUrl ? (
                      <div className="generated-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={message.imageUrl} alt="Generated image" />
                        <a href={message.imageUrl} download="imagent-output.png">
                          <Download size={14} />
                          Download
                        </a>
                      </div>
                    ) : null}
                    {message.error ? <div className="turn-error">{message.error}</div> : null}
                    {message.role === "agent" ? (
                      <div className="turn-meta">
                        <span>{message.model || settings.model}</span>
                        {message.quality ? <span>{message.quality}</span> : null}
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
              placeholder="Message imagent"
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" disabled={!canSubmit} aria-label="Generate image">
              {isGenerating ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            </button>
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
              <div>
                <h2 id="settings-title">Generation settings</h2>
              </div>
              <button type="button" onClick={cancelSettings} aria-label="Close settings">
                <X size={18} />
              </button>
            </header>
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
            </label>
            <label className="settings-field">
              <span>Image model</span>
              <select
                value={canUseVerifiedModels ? draftSettings.model : ""}
                onChange={(event) => setDraftSettings({...draftSettings, model: event.target.value})}
                disabled={!canUseVerifiedModels}
              >
                {canUseVerifiedModels ? (
                  modelChoices.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name} · {option.pricing}
                    </option>
                  ))
                ) : (
                  <option value="">Verify OpenRouter to load image models</option>
                )}
              </select>
              {canUseVerifiedModels ? (
                <small className="field-note">{modelChoices.length} image models loaded from OpenRouter.</small>
              ) : null}
            </label>
            <label className="settings-field">
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
            </label>
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

function VerificationBadge({ verification }: { verification: VerificationState }) {
  if (verification.status === "verifying") {
    return (
      <span className="verification-status verifying">
        <Loader2 className="spin" size={14} />
        Verifying
      </span>
    );
  }

  if (verification.status === "valid") {
    return (
      <span className="verification-status valid">
        <Check size={14} />
        {verification.message || "Verified"}
      </span>
    );
  }

  if (verification.status === "invalid") {
    return (
      <span className="verification-status invalid" title={verification.message}>
        <AlertCircle size={14} />
        Invalid key
      </span>
    );
  }

  return <span className="verification-status idle">Not configured</span>;
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

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
