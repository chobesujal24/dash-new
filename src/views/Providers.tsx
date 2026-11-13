import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Copy, Cpu, Pencil, Plus, Search, Sparkles, X, Zap } from "lucide-react";
import { fmtTokens, type Provider } from "../data/model";
import { resolveProviderIdentity } from "../data/provider-identity";
import { useConsole } from "../state/store";
import { ProviderLogo } from "../ui/art";
import { Bar, Button, Chip, EmptyState, Field, IconButton, Metric, Panel, Switch, TextInput } from "../ui/kit";
import { Dialog } from "../ui/overlay";
import { cn } from "../utils/cn";

/** `POST /api/providers` accepts at most 20 routes. */
const MAX_PROVIDERS = 20;
const KEY_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

/* ── KPIs ──────────────────────────────────────────────── */

function ProviderKPIs() {
  const providers = useConsole((s) => s.providers);
  const enabled = providers.filter((p) => p.enabled);
  const configured = providers.filter((p) => p.keyConfigured);
  const latencies = providers.map((p) => p.latencyMs).filter((v): v is number => v !== null);
  const average = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const modelCounts = providers.map((p) => p.modelCount).filter((v): v is number => v !== null);
  const models = modelCounts.length > 0 ? modelCounts.reduce((a, b) => a + b, 0) : null;
  const missing = providers.filter((p) => !p.keyConfigured);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric
        className="panel p-4 lg:p-5"
        label="Providers enabled"
        value={enabled.length}
        unit={`of ${providers.length}`}
        hint={enabled.length === 0 ? "agents cannot think" : `first choice: ${enabled[0].name}`}
        tone={enabled.length === 0 ? "danger" : "default"}
      />
      <Metric
        className="panel p-4 lg:p-5"
        label="Keys configured"
        value={configured.length}
        unit={`of ${providers.length}`}
        hint={missing.length === 0 ? "every route has a stored key" : `missing: ${missing.map((p) => p.keyName).join(", ")}`}
        tone={missing.length > 0 ? "warn" : "default"}
      />
      <Metric
        className="panel p-4 lg:p-5"
        label="Average handshake"
        value={average ?? "—"}
        unit={average === null ? undefined : "ms"}
        hint={latencies.length === 0 ? "run a test to measure" : `${latencies.length} endpoint${latencies.length === 1 ? "" : "s"} tested this session`}
        tone={average !== null && average > 500 ? "warn" : "default"}
      />
      <Metric
        className="panel p-4 lg:p-5"
        label="Models reachable"
        value={models ?? "—"}
        hint={models === null ? "tests report the model count" : `summed across ${modelCounts.length} tested endpoint${modelCounts.length === 1 ? "" : "s"}`}
      />
    </div>
  );
}

/* ── Row ───────────────────────────────────────────────── */

function ProviderRow({
  p,
  index,
  enabledRank,
  total,
  sortable,
  onEdit,
}: {
  p: Provider;
  index: number;
  enabledRank: number;
  total: number;
  sortable: boolean;
  onEdit: () => void;
}) {
  const toggle = useConsole((s) => s.providerToggle);
  const test = useConsole((s) => s.providerTest);
  const move = useConsole((s) => s.providerMove);
  const toast = useConsole((s) => s.toast);
  const testing = useConsole((s) => Boolean(s.pending[`provider:test:${p.id}`]));
  const busy = useConsole((s) => Boolean(s.pending["providers:save"]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.baseURL);
      toast({ title: "Endpoint copied", detail: p.baseURL, tone: "ok" });
    } catch {
      toast({ title: "Clipboard is blocked", detail: p.baseURL, tone: "info" });
    }
  };

  const keyState = p.keyConfigured
    ? { text: `${p.keyName} set`, tone: "text-faint" }
    : { text: `${p.keyName} missing`, tone: "text-warn" };

  const contextPct =
    p.contextWindow && p.contextWindow > 0 && p.contextUsed !== null
      ? Math.min(100, Math.round((p.contextUsed / p.contextWindow) * 100))
      : null;

  return (
    <motion.li
      layout="position"
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn("flex flex-col gap-3 px-3 py-3.5 sm:px-4 xl:flex-row xl:items-center xl:gap-4", !p.enabled && "bg-panel-2/20")}
    >
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-2.5 xl:flex-1">
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            aria-label={`Move ${p.name} up`}
            title={`Move ${p.name} up`}
            disabled={!sortable || busy || index === 0}
            onClick={() => move(p.id, -1)}
            className="flex size-5 items-center justify-center rounded text-mute transition-colors enabled:hover:bg-panel-2 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={`Move ${p.name} down`}
            title={`Move ${p.name} down`}
            disabled={!sortable || busy || index === total - 1}
            onClick={() => move(p.id, 1)}
            className="flex size-5 items-center justify-center rounded text-mute transition-colors enabled:hover:bg-panel-2 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowDown size={12} strokeWidth={2} />
          </button>
        </div>
        <ProviderLogo baseURL={p.baseURL} name={p.name} model={p.model} enabled={p.enabled} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="num text-[11px] text-faint">#{index + 1}</span>
            <span className={cn("truncate text-[13.5px] font-semibold", p.enabled ? "text-ink" : "text-mute")} title={p.name}>
              {p.name}
            </span>
            {p.enabled && (
              <span className={cn("text-[11px]", enabledRank === 0 ? "font-medium text-rose" : "text-faint")}>
                · {enabledRank === 0 ? "Primary" : `Fallback #${enabledRank}`}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px]">
            <button
              type="button"
              onClick={copy}
              title={p.baseURL}
              className="group inline-flex max-w-full items-center gap-1 rounded text-left text-faint transition-colors hover:text-mute"
            >
              <span className="truncate">{p.baseURL.replace(/^https?:\/\//, "")}</span>
              <Copy size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
            <span aria-hidden="true" className="text-line-2">·</span>
            <span className={cn("truncate", keyState.tone)}>{keyState.text}</span>
          </div>
        </div>
        <div className="shrink-0 xl:hidden">
          <Switch checked={p.enabled} onChange={() => toggle(p.id)} label={`${p.name}, ${p.enabled ? "enabled" : "disabled"}`} />
        </div>
      </div>

      {/* Numbers */}
      <dl className="grid min-w-0 grid-cols-3 gap-3 xl:w-[330px] xl:shrink-0 xl:gap-4">
        <div className="min-w-0">
          <dt className="eyebrow !text-[10px]">Model</dt>
          <dd className="mt-0.5 truncate font-mono text-[11px] text-mute" title={p.model || "not reported"}>
            {p.model || "—"}
          </dd>
          {p.tokensPerSec !== null && (
            <dd className="num mt-0.5 font-mono text-[10px] text-faint">{p.tokensPerSec.toFixed(1)} tok/s</dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="eyebrow !text-[10px]">Context</dt>
          {p.contextWindow ? (
            <dd className="mt-0.5">
              <span className="num block font-mono text-[11px] font-medium text-ink">
                {fmtTokens(p.contextUsed ?? 0)} <span className="text-faint">/ {fmtTokens(p.contextWindow)}</span>
              </span>
              {contextPct !== null && <Bar value={contextPct} tone={contextPct > 85 ? "warn" : "neutral"} className="mt-1 h-[3.5px]" />}
            </dd>
          ) : (
            <dd className="num mt-0.5 text-[12px] font-medium text-faint">—</dd>
          )}
        </div>
        <div>
          <dt className="eyebrow !text-[10px]">Latency</dt>
          <dd className={cn("num mt-0.5 text-[12px] font-medium", p.latencyMs === null ? "text-faint" : p.latencyMs > 500 ? "text-warn" : "text-ink")}>
            {p.latencyMs === null ? "—" : `${p.latencyMs} ms`}
          </dd>
          {p.modelCount !== null && (
            <dd className="num mt-0.5 font-mono text-[10px] text-faint">{p.modelCount} models</dd>
          )}
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 xl:contents">
        <p className="min-w-0 text-[10.5px] leading-snug text-faint xl:w-[96px] xl:shrink-0">
          {(p.timeoutMs / 1000).toFixed(0)}s timeout
        </p>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="xs"
            variant="quiet"
            loading={testing}
            loadingLabel="Testing"
            disabled={!p.keyConfigured}
            disabledReason={`Add a value for ${p.keyName} first.`}
            onClick={() => test(p.id)}
          >
            Test
          </Button>
          <IconButton size="sm" icon={Pencil} label={`Edit ${p.name}`} onClick={onEdit} />
          <span className="hidden pl-1 xl:inline-flex">
            <Switch checked={p.enabled} onChange={() => toggle(p.id)} label={`${p.name}, ${p.enabled ? "enabled" : "disabled"}`} />
          </span>
        </div>
      </div>
    </motion.li>
  );
}

/* ── Add / edit dialog ─────────────────────────────────── */

function ProviderDialog({ provider, onClose }: { provider: Provider | null; onClose: () => void }) {
  const save = useConsole((s) => s.providerSave);
  const remove = useConsole((s) => s.providerRemove);
  const askConfirm = useConsole((s) => s.askConfirm);
  const [name, setName] = useState(provider?.name ?? "");
  const [baseURL, setBaseURL] = useState(provider?.baseURL ?? "");
  const [model, setModel] = useState(provider?.model ?? "");
  const [keyName, setKeyName] = useState(provider?.keyName ?? "");
  const [timeoutMs, setTimeoutMs] = useState(String(provider?.timeoutMs ?? 30_000));
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [autoBrand, setAutoBrand] = useState<string | null>(null);
  const [autoKey, setAutoKey] = useState<string | null>(null);
  const [autoModel, setAutoModel] = useState<string | null>(null);

  const identity = resolveProviderIdentity({ baseURL, name, model });
  const urlOnlyIdentity = resolveProviderIdentity({ baseURL });

  const handleUrlChange = (nextUrl: string) => {
    setBaseURL(nextUrl);
    if (!provider) {
      const detected = resolveProviderIdentity({ baseURL: nextUrl });
      if (detected.brandName && (!name.trim() || name === autoBrand)) {
        setName(detected.brandName);
        setAutoBrand(detected.brandName);
      }
      if (detected.suggestedKeyName && (!keyName.trim() || keyName === autoKey)) {
        setKeyName(detected.suggestedKeyName);
        setAutoKey(detected.suggestedKeyName);
      }
      if (detected.suggestedModel && (!model.trim() || model === autoModel)) {
        setModel(detected.suggestedModel);
        setAutoModel(detected.suggestedModel);
      }
    }
  };

  const canApplyDefaults =
    Boolean(urlOnlyIdentity.brandName) &&
    ((urlOnlyIdentity.brandName && name !== urlOnlyIdentity.brandName) ||
      (urlOnlyIdentity.suggestedKeyName && keyName !== urlOnlyIdentity.suggestedKeyName) ||
      (urlOnlyIdentity.suggestedModel && !model.trim()));

  const applyDefaults = () => {
    if (urlOnlyIdentity.brandName) {
      setName(urlOnlyIdentity.brandName);
      setAutoBrand(urlOnlyIdentity.brandName);
    }
    if (urlOnlyIdentity.suggestedKeyName) {
      setKeyName(urlOnlyIdentity.suggestedKeyName);
      setAutoKey(urlOnlyIdentity.suggestedKeyName);
    }
    if (urlOnlyIdentity.suggestedModel && !model.trim()) {
      setModel(urlOnlyIdentity.suggestedModel);
      setAutoModel(urlOnlyIdentity.suggestedModel);
    }
  };

  const errors = {
    name: name.trim() ? "" : "Give the provider a name.",
    baseURL: /^https?:\/\/\S+$/i.test(baseURL.trim()) ? "" : "Enter a full URL starting with http:// or https://.",
    keyName: KEY_NAME.test(keyName.trim())
      ? ""
      : "Use an uppercase key variable such as OPENAI_API_KEY.",
    model: model.trim() || provider?.id === "nvidia-1" ? "" : "Enter the model identifier.",
    timeoutMs:
      Number.isInteger(Number(timeoutMs)) && Number(timeoutMs) >= 1_000 && Number(timeoutMs) <= 120_000
        ? ""
        : "Between 1,000 and 120,000 ms.",
  };
  const valid = Object.values(errors).every((message) => !message);
  const shown = (key: keyof typeof errors) => (attempted && errors[key] ? errors[key] : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!valid) return;
    save(
      { id: provider?.id, name, baseURL, keyName, model, timeoutMs: Number(timeoutMs) },
      { apiKey: apiKey.trim() || undefined, clear: clearKey && !apiKey.trim() },
    );
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow="Provider routing"
      title={provider ? `Edit ${provider.name}` : "Add provider"}
      width="md"
      footer={
        <>
          {provider && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                onClose();
                askConfirm({
                  eyebrow: "Provider routing",
                  title: `Remove ${provider.name}?`,
                  description: "The route leaves the fallback chain and ENI1 restarts. Its stored key is not deleted.",
                  confirmLabel: "Remove provider",
                  danger: true,
                  action: () => remove(provider.id),
                });
              }}
            >
              Remove
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="provider-form">
            {provider ? "Save provider" : "Add provider"}
          </Button>
        </>
      }
    >
      <form id="provider-form" className="space-y-4" onSubmit={submit} noValidate>
        <Field label="OpenAI-compatible base URL" htmlFor="pv-url" error={shown("baseURL")} hint="Paste the endpoint URL first — the console detects the provider logo and defaults automatically.">
          <div className="flex items-center gap-2.5">
            <ProviderLogo baseURL={baseURL} name={name} model={model} enabled size={36} />
            <TextInput
              id="pv-url"
              data-autofocus=""
              className="font-mono"
              placeholder="https://api.openai.com/v1 or https://api.deepseek.com/v1"
              value={baseURL}
              invalid={Boolean(shown("baseURL"))}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
          </div>
          {baseURL.trim() && (identity.brandName || identity.rootDomain) && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/60 px-2.5 py-1.5 text-[11px]">
              <span className="flex items-center gap-1.5 text-mute">
                <Sparkles size={11.5} className="shrink-0 text-rose" />
                <span>
                  {identity.isKnown ? "Detected provider:" : "Resolved domain:"}{" "}
                  <strong className="font-semibold text-ink">{identity.brandName ?? identity.rootDomain}</strong>
                  {identity.rootDomain && identity.brandName ? (
                    <span className="ml-1 font-mono text-[10.5px] text-faint">({identity.rootDomain})</span>
                  ) : null}
                </span>
              </span>
              {canApplyDefaults && (
                <button
                  type="button"
                  onClick={applyDefaults}
                  className="font-medium text-rose transition-colors hover:text-rose-2"
                >
                  Apply {urlOnlyIdentity.brandName} defaults
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="Display name" htmlFor="pv-name" error={shown("name")}>
          <TextInput id="pv-name" placeholder="e.g. OpenAI, DeepSeek, Groq" value={name} invalid={Boolean(shown("name"))} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
          <Field label="Model identifier" htmlFor="pv-model" error={shown("model")}>
            <TextInput id="pv-model" className="font-mono" placeholder="e.g. gpt-4o or deepseek-chat" value={model} invalid={Boolean(shown("model"))} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Timeout (ms)" htmlFor="pv-timeout" error={shown("timeoutMs")}>
            <TextInput id="pv-timeout" inputMode="numeric" value={timeoutMs} invalid={Boolean(shown("timeoutMs"))} onChange={(e) => setTimeoutMs(e.target.value.replace(/[^0-9]/g, ""))} />
          </Field>
        </div>

        <div className="space-y-4 border-t border-line pt-4">
          <Field label="Environment key variable" htmlFor="pv-keyname" error={shown("keyName")} hint="Required by the server. The key value is stored in keys.json by the supervisor.">
            <TextInput
              id="pv-keyname"
              className="font-mono"
              placeholder="e.g. OPENAI_API_KEY"
              value={keyName}
              invalid={Boolean(shown("keyName"))}
              onChange={(e) => {
                setKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
                setClearKey(false);
              }}
            />
          </Field>

          <Field
            label="API key value"
            htmlFor="pv-apikey"
            hint={
              provider?.keyConfigured
                ? `${provider.keyName} is already stored. Leave empty to keep it, or paste a new value to replace it.`
                : "Paste the secret once. It is sent to the supervisor and never returned to this console."
            }
          >
            <TextInput
              id="pv-apikey"
              type="password"
              autoComplete="new-password"
              className="font-mono"
              placeholder={provider?.keyConfigured ? "••••••••  (stored)" : "Paste the API key"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (e.target.value) setClearKey(false);
              }}
            />
          </Field>

          {provider?.keyConfigured && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-panel-2/60 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink">Remove the stored key</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-mute">
                  The provider stays configured, but testing and routing will fail until a new key is saved.
                </p>
              </div>
              <Switch checked={clearKey} onChange={setClearKey} disabled={Boolean(apiKey.trim())} label={`Remove the stored key for ${provider.keyName}`} />
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

/* ── View ──────────────────────────────────────────────── */

export function Providers() {
  const providers = useConsole((s) => s.providers);
  const saving = useConsole((s) => Boolean(s.pending["providers:save"]));
  const testingAll = useConsole((s) => Boolean(s.pending["provider:test:all"]));
  const testAll = useConsole((s) => s.providerTestAll);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const visible = term ? providers.filter((p) => `${p.name} ${p.model} ${p.baseURL}`.toLowerCase().includes(term)) : providers;
  const enabledList = providers.filter((p) => p.enabled);
  const target = editing && editing !== "new" ? (providers.find((p) => p.id === editing) ?? null) : null;
  const atLimit = providers.length >= MAX_PROVIDERS;

  return (
    <div className="view-in space-y-4">
      <ProviderKPIs />

      <Panel
        eyebrow="Routing order"
        title="Provider fallback chain"
        sub="The router tries enabled endpoints from the top down."
        pad={false}
        tools={
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={testingAll}
              loadingLabel="Probing"
              disabled={!providers.some((p) => p.keyConfigured)}
              onClick={testAll}
            >
              Test all
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={Plus}
              disabled={atLimit || saving}
              disabledReason={atLimit ? `The server accepts at most ${MAX_PROVIDERS} routes.` : "A routing change is being saved."}
              onClick={() => setEditing("new")}
            >
              Add provider
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 lg:px-5">
          <Search size={13} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, model, endpoint…"
            aria-label="Filter providers"
            className="h-6 min-w-0 flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none"
          />
          {query && <IconButton size="sm" icon={X} label="Clear search" onClick={() => setQuery("")} />}
          <span className="num shrink-0 text-[11px] text-faint">
            {visible.length} of {providers.length}
          </span>
        </div>

        {providers.length === 0 ? (
          <EmptyState icon={Cpu} title="No inference providers configured" action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing("new")}>Add provider</Button>}>
            Agents need at least one model endpoint before they can decide anything.
          </EmptyState>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-mute">No provider matches “{query}”.</p>
        ) : (
          <ol className="divide-y divide-line">
            {visible.map((p) => (
              <ProviderRow
                key={p.id}
                p={p}
                index={providers.indexOf(p)}
                enabledRank={enabledList.indexOf(p)}
                total={providers.length}
                sortable={!term}
                onEdit={() => setEditing(p.id)}
              />
            ))}
          </ol>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel eyebrow="Routing" title="Fallback behavior">
          <p className="text-[12.5px] leading-relaxed text-mute">
            Order the list from preferred to last resort. The router sends each request to the first enabled provider. If
            that call times out or fails, it retries on the next one down, so a single outage never stalls the fleet.
            Reordering or toggling a route restarts ENI1 so the new table is live.
          </p>
        </Panel>
        <Panel eyebrow="Credentials" title="Where keys live">
          <p className="text-[12.5px] leading-relaxed text-mute">
            Key values are written to the supervisor's <span className="font-mono text-[11.5px]">keys.json</span> and are
            never returned by the API. This console shows only the variable name and whether a value is stored. The Test
            button measures a real request; its result lasts for this session only.
          </p>
        </Panel>
      </div>

      {editing && <ProviderDialog key={editing} provider={target} onClose={() => setEditing(null)} />}
    </div>
  );
}
