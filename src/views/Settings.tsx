import { Keyboard, RotateCw } from "lucide-react";
import { SETTING_LABELS, useSettingsDraft } from "../state/derive";
import { useConsole, type ThemeName } from "../state/store";
import { Button, Chip, Panel, Segmented, Switch } from "../ui/kit";
import { ProfilesPanel } from "./fleet/ProfilesPanel";
import { RuntimeConfig } from "./fleet/RuntimeConfig";

/* ── Floating save bar ─────────────────────────────────── */

/**
 * Sits above the console, inside the content column, so it can never cover the
 * dock. It carries every way out of an edited form: discard, save, or save and
 * restart.
 */
export function SettingsSaveBar() {
  const onSettings = useConsole((s) => s.view === "settings");
  const saving = useConsole((s) => Boolean(s.pending["config:save"]));
  const save = useConsole((s) => s.saveSettings);
  const saveAndRestart = useConsole((s) => s.saveAndRestart);
  const discard = useConsole((s) => s.discardSettings);
  const askConfirm = useConsole((s) => s.askConfirm);
  const draft = useSettingsDraft();

  if (!onSettings || !draft.dirty) return null;

  const names = draft.dirtyKeys.map((key) => SETTING_LABELS[key]);
  const blocked = "Fix the highlighted fields first.";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3">
      <div role="region" aria-label="Unsaved changes" className="glass-deep sheet-in pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line-2 px-3.5 py-2.5 shadow-pop">
        <Chip tone={draft.valid ? "warn" : "danger"} dot>
          {draft.valid ? `${draft.dirtyKeys.length} unsaved` : `${draft.errorCount} to fix`}
        </Chip>
        <p className="hidden max-w-[30ch] truncate text-[12px] text-mute md:block">
          {names.slice(0, 2).join(", ")}
          {names.length > 2 ? ` and ${names.length - 2} more` : ""}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="quiet" onClick={discard}>
            Discard
          </Button>
          <Button size="sm" disabled={!draft.valid} disabledReason={blocked} loading={saving} loadingLabel="Saving" onClick={save}>
            Save
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={RotateCw}
            disabled={!draft.valid || saving}
            disabledReason={blocked}
            onClick={() =>
              askConfirm({
                eyebrow: "Runtime configuration",
                title: "Save and restart ENI1?",
                description: "The settings are written to settings.js and mc-foreman restarts, so ENI1 reconnects with them.",
                confirmLabel: "Save and restart",
                action: saveAndRestart,
              })
            }
          >
            Save and restart ENI1
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Interface preferences ─────────────────────────────── */

function InterfacePanel() {
  const theme = useConsole((s) => s.theme);
  const setTheme = useConsole((s) => s.setTheme);
  const sound = useConsole((s) => s.sound);
  const toggleSound = useConsole((s) => s.toggleSound);
  const setHelpOpen = useConsole((s) => s.setHelpOpen);

  return (
    <Panel eyebrow="This browser" title="Interface" pad={false}>
      <div className="divide-y divide-line">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">Theme</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-faint">Yozakura for night, Hanami for day.</p>
          </div>
          <Segmented<ThemeName>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "yozakura", label: "Yozakura" },
              { value: "hanami", label: "Hanami" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">Interface sounds</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-faint">A short chime when an action lands or needs attention.</p>
          </div>
          <Switch checked={sound} onChange={toggleSound} label="Interface sounds" />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">Keyboard shortcuts</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-faint">Every view and the console are reachable without a mouse.</p>
          </div>
          <Button size="sm" icon={Keyboard} onClick={() => setHelpOpen(true)}>
            View
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/* ── Maintenance ───────────────────────────────────────── */

function MaintenancePanel() {
  const askConfirm = useConsole((s) => s.askConfirm);
  const serviceAction = useConsole((s) => s.serviceAction);
  const foreman = useConsole((s) => s.services.find((svc) => svc.name === "mc-foreman"));
  const busy = useConsole((s) => Boolean(s.pending["service:mc-foreman"]));
  const stopped = foreman?.state === "inactive";

  return (
    <Panel eyebrow="Host · systemd" title="Maintenance" pad={false}>
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">{stopped ? "Start mc-foreman" : "Restart mc-foreman"}</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-faint">
            {stopped ? "ENI1 is offline. Start the unit to bring it back." : "ENI1 reconnects with the saved configuration. Job state stays on disk."}
          </p>
        </div>
        <Button
          size="sm"
          icon={RotateCw}
          loading={busy}
          loadingLabel={stopped ? "Starting" : "Restarting"}
          onClick={() =>
            askConfirm({
              eyebrow: "Maintenance",
              title: stopped ? "Start mc-foreman?" : "Restart mc-foreman?",
              description: stopped
                ? "The supervisor starts the foreman unit. ENI1 joins the server once it is ready."
                : "The foreman unit restarts. ENI1 disconnects briefly, then rejoins with the saved configuration.",
              confirmLabel: stopped ? "Start foreman" : "Restart foreman",
              action: () => serviceAction("mc-foreman", stopped ? "start" : "restart"),
            })
          }
        >
          {stopped ? "Start" : "Restart"}
        </Button>
      </div>
    </Panel>
  );
}

/* ── View ──────────────────────────────────────────────── */

export function Settings() {
  return (
    <div className="view-in grid items-start gap-4 pb-16 xl:grid-cols-[minmax(0,1fr)_380px]">
      <RuntimeConfig />
      <div className="space-y-4">
        <InterfacePanel />
        <ProfilesPanel />
        <MaintenancePanel />
      </div>
    </div>
  );
}
