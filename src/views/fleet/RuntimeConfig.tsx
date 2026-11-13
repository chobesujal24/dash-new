import { CircleAlert, RotateCw, TriangleAlert } from "lucide-react";
import { useSettingsDraft } from "../../state/derive";
import { BUNDLED_CLIENT_VERSION, useConsole, type SettingsState } from "../../state/store";
import { Button, Chip, Field, Panel, Select, Switch, TextInput } from "../../ui/kit";
import { Table, type Column } from "../../ui/Table";
import { cn } from "../../utils/cn";

type TextKey =
  | "host"
  | "port"
  | "minecraft_version"
  | "mindserver_port"
  | "base_profile"
  | "code_timeout_mins"
  | "spawn_timeout"
  | "only_chat_with"
  | "via_proxy_host"
  | "via_proxy_port"
  | "via_proxy_client_version";

type FlagKey = "load_memory" | "narrate_behavior" | "auto_open_ui" | "allow_insecure_coding";

/* ── Field helpers bound to the settings draft ─────────── */

function TextSetting({ name, label, hint, numeric, signed, error, className }: { name: TextKey; label: string; hint?: string; numeric?: boolean; signed?: boolean; error?: string; className?: string }) {
  const value = useConsole((s) => s.settings[name]);
  const saved = useConsole((s) => s.savedSettings[name]);
  const setSetting = useConsole((s) => s.setSetting);
  const id = `setting-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} dirty={value !== saved} className={className}>
      <TextInput
        id={id}
        value={value}
        invalid={Boolean(error)}
        inputMode={numeric ? "numeric" : undefined}
        spellCheck={false}
        onChange={(event) =>
          setSetting(
            name,
            numeric
              ? signed
                ? event.target.value.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, "")
                : event.target.value.replace(/[^0-9]/g, "")
              : event.target.value,
          )
        }
      />
    </Field>
  );
}

function FlagSetting({ name, label, hint, danger }: { name: FlagKey; label: string; hint: string; danger?: boolean }) {
  const checked = useConsole((s) => s.settings[name]);
  const saved = useConsole((s) => s.savedSettings[name]);
  const setSetting = useConsole((s) => s.setSetting);
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <span>{label}</span>
          {checked !== saved && <span title="Unsaved change" className="size-1.5 rounded-full bg-warn" />}
          {danger && checked && <span className="ml-1 text-[10.5px] font-semibold text-warn">risky</span>}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{hint}</p>
      </div>
      <Switch checked={checked} onChange={(next) => setSetting(name, next)} label={label} />
    </div>
  );
}

function Plane({ title, note, aside, children, first }: { title: string; note: string; aside?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <section className={cn(!first && "border-t border-line pt-5")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-[13.5px] font-semibold text-ink">{title}</h4>
          <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{note}</p>
        </div>
        {aside}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/* ── Saved versus live ─────────────────────────────────── */

type TruthRow = { key: string; label: string; saved: string; live: string; pinned: boolean };

const TRUTH_COLUMNS: Column<TruthRow>[] = [
  { key: "label", header: "Setting", render: (row) => <span className="font-medium text-ink">{row.label}</span> },
  { key: "saved", header: "Saved", render: (row) => <span className="num font-mono text-[11.5px] text-mute">{row.saved}</span> },
  { key: "live", header: "Running now", render: (row) => <span className="num font-mono text-[11.5px] text-ink">{row.live}</span> },
  {
    key: "state",
    header: "State",
    render: (row) =>
      row.pinned ? (
        <span className="text-[11px] font-semibold text-warn">pinned by env</span>
      ) : row.saved !== row.live ? (
        <span className="text-[11px] font-semibold text-warn">restart to apply</span>
      ) : (
        <span className="text-[11px] font-medium text-mute">in sync</span>
      ),
  },
];

function Reconciliation() {
  const saved = useConsole((s) => s.savedSettings);
  const live = useConsole((s) => s.effective);
  const restarting = useConsole((s) => Boolean(s.pending["config:restart"]));
  const applyLive = useConsole((s) => s.applyLive);
  const askConfirm = useConsole((s) => s.askConfirm);

  const rows: TruthRow[] = [
    { key: "host", label: "Host", saved: saved.host, live: live.host, pinned: live.overrides.host === "env" },
    { key: "port", label: "Port", saved: saved.port, live: String(live.port), pinned: live.overrides.port === "env" },
    { key: "version", label: "Version", saved: saved.minecraft_version, live: live.version, pinned: live.overrides.version === "env" },
    { key: "auth", label: "Auth", saved: saved.auth, live: live.auth, pinned: live.overrides.auth === "env" },
  ];
  const drift = rows.some((row) => !row.pinned && row.saved !== row.live);

  return (
    <Panel
      eyebrow="Reconciliation"
      title="Saved versus running"
      sub="Compare what is saved on disk with what the running process reports."
      pad={false}
      tools={
        <Chip tone={restarting || drift ? "warn" : "ok"} dot>
          {restarting ? "restarting" : drift ? "restart needed" : "in sync"}
        </Chip>
      }
    >
      <Table label="Saved versus live configuration" columns={TRUTH_COLUMNS} rows={rows} rowKey={(row) => row.key} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="max-w-[58ch] text-[11.5px] leading-relaxed text-faint">
          Connection settings are read when the foreman boots. Save writes settings.js; restart ENI1 to make the saved
          values live.
        </p>
        {(drift || restarting) && (
          <Button
            size="sm"
            icon={RotateCw}
            loading={restarting}
            loadingLabel="Restarting ENI1"
            onClick={() =>
              askConfirm({
                eyebrow: "Runtime configuration",
                title: "Restart ENI1 to apply?",
                description: "mc-foreman restarts with the saved connection settings. ENI1 reconnects once the foreman is back.",
                confirmLabel: "Restart ENI1",
                action: applyLive,
              })
            }
          >
            Restart ENI1 to apply
          </Button>
        )}
      </div>
    </Panel>
  );
}

/* ── Cluster configuration ─────────────────────────────── */

export function RuntimeConfig() {
  const auth = useConsole((s) => s.settings.auth);
  const bridgeOn = useConsole((s) => s.settings.via_proxy_enabled);
  const setSetting = useConsole((s) => s.setSetting);
  const draft = useSettingsDraft();
  const { errors, note } = draft;

  return (
    <div className="space-y-4">
      <Panel
        eyebrow="Runtime"
        title="Cluster configuration"
        sub="Edits stay in this browser until you save. Save writes settings.js; restart applies them."
        tools={
          <Chip tone={draft.dirty ? "warn" : "ok"} dot>
            {draft.dirty ? `${draft.dirtyKeys.length} unsaved` : "saved"}
          </Chip>
        }
      >
        <div className="space-y-5">
          <Plane first title="Minecraft server" note="Where the fleet connects. Applies the next time ENI1 joins.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextSetting name="host" label="Host" error={errors.host} />
              <TextSetting name="port" label="Port" numeric error={errors.port} />
              <TextSetting name="minecraft_version" label="Minecraft version" error={errors.minecraft_version} hint={`The bundled client data speaks ${BUNDLED_CLIENT_VERSION}.`} />
              <Field label="Auth mode" hint="Offline skips the Microsoft login. Use it on LAN servers only.">
                <Select
                  label="Auth mode"
                  value={auth}
                  onChange={(next) => setSetting("auth", next as SettingsState["auth"])}
                  options={[
                    { value: "offline", label: "Offline · username only" },
                    { value: "microsoft", label: "Microsoft · full account" },
                  ]}
                />
              </Field>
            </div>
          </Plane>

          <Plane title="Agent runtime" note="How the agents boot, talk and run generated code.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextSetting name="mindserver_port" label="Mindserver port" numeric error={errors.mindserver_port} />
              <TextSetting name="base_profile" label="Base profile" error={errors.base_profile} />
              <TextSetting name="code_timeout_mins" label="Code timeout (minutes)" numeric signed error={errors.code_timeout_mins} hint="Generated code is stopped after this long. -1 disables the timeout." />
              <TextSetting name="spawn_timeout" label="Spawn timeout (seconds)" numeric error={errors.spawn_timeout} hint="How long ENI1 waits for the world to load." />
              <TextSetting name="only_chat_with" label="Chat allow-list" className="sm:col-span-2" hint="Comma-separated usernames that may give orders. Empty means everyone." />
            </div>
            <div className="mt-4 divide-y divide-line border-t border-line pt-4">
              <FlagSetting name="load_memory" label="Load memory on boot" hint="Re-embeds the long-term store before connecting. Slower boot, sharper recall." />
              <FlagSetting name="narrate_behavior" label="Narrate behavior" hint="Agents say what they are doing in chat as they work." />
              <FlagSetting name="auto_open_ui" label="Open the console on boot" hint="Launches this console on the host when the supervisor starts." />
              <FlagSetting name="allow_insecure_coding" label="Allow insecure coding" hint="Lets generated code shell out and write files. Keep it off unless you trust everyone on the allow-list." danger />
            </div>
          </Plane>

          <Plane
            title="ViaProxy bridge"
            note="Translates the bundled client protocol for a newer server."
            aside={<Switch checked={bridgeOn} onChange={(next) => setSetting("via_proxy_enabled", next)} label="ViaProxy bridge" />}
          >
            <fieldset disabled={!bridgeOn} className={cn("grid gap-4 transition-opacity sm:grid-cols-3", !bridgeOn && "opacity-45")}>
              <legend className="sr-only">ViaProxy bridge address</legend>
              <TextSetting name="via_proxy_host" label="Bridge host" error={errors.via_proxy_host} />
              <TextSetting name="via_proxy_port" label="Bridge port" numeric error={errors.via_proxy_port} />
              <TextSetting name="via_proxy_client_version" label="Client version" error={errors.via_proxy_client_version} />
            </fieldset>
          </Plane>

          {note && (
            <div role="status" className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3", note.tone === "danger" ? "border-danger/30 bg-danger/[0.07]" : "border-warn/30 bg-warn/[0.07]")}>
              {note.tone === "danger" ? <CircleAlert size={14} className="mt-[2px] shrink-0 text-danger" /> : <TriangleAlert size={14} className="mt-[2px] shrink-0 text-warn" />}
              <div>
                <p className={cn("text-[12.5px] font-semibold", note.tone === "danger" ? "text-danger" : "text-warn")}>{note.title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-mute">{note.body}</p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Reconciliation />
    </div>
  );
}
