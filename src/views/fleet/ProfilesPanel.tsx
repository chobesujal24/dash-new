import { Check, Loader2 } from "lucide-react";
import { useConsole } from "../../state/store";
import { Chip, EmptyState, Panel } from "../../ui/kit";
import { cn } from "../../utils/cn";

export function ProfilesPanel() {
  const profiles = useConsole((s) => s.profiles);
  const activeProfile = useConsole((s) => s.activeProfile);
  const switching = useConsole((s) => Boolean(s.pending.profile));
  const setProfile = useConsole((s) => s.setProfile);
  const askConfirm = useConsole((s) => s.askConfirm);

  return (
    <Panel
      eyebrow="Identity"
      title="Profiles"
      sub="The persona and model ENI1 boots with."
      pad={false}
      tools={
        switching ? (
          <Loader2 size={14} className="animate-spin text-faint" aria-label="Switching profile" />
        ) : (
          <Chip tone="neutral">{profiles.length} available</Chip>
        )
      }
    >
      {profiles.length === 0 ? (
        <EmptyState icon={Check} title="No profiles found">
          The supervisor reads profiles from the profiles folder. Create one there, then refresh.
        </EmptyState>
      ) : (
        <ul aria-label="Profiles" className="max-h-[340px] space-y-1.5 overflow-y-auto p-3">
          {profiles.map((profile) => {
            const active = profile.file === activeProfile;
            return (
              <li key={profile.file}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={switching}
                  onClick={() => {
                    if (active) return;
                    askConfirm({
                      eyebrow: "Profile swap",
                      title: `Boot ${profile.name}?`,
                      description: `mc-foreman restarts and ENI1 boots with this profile (${profile.model}). Job state stays on disk.`,
                      confirmLabel: "Apply profile",
                      action: () => setProfile(profile.file),
                    });
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-wait",
                    active ? "border-rose/45 bg-rose/[0.05]" : "border-line enabled:hover:border-line-2 enabled:hover:bg-panel-2",
                  )}
                >
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", active ? "border-rose bg-rose text-on-rose" : "border-line-2")}>
                    {active && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-semibold text-ink">{profile.name}</span>
                      {active && (
                        <span className="rounded bg-rose/15 px-1.5 py-px text-[10px] font-semibold text-rose">
                          booted
                        </span>
                      )}
                      {profile.online && <span className="text-[10.5px] font-medium text-faint">online account</span>}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] text-faint">{profile.model}</span>
                    <span className="mt-1 block text-[11.5px] leading-snug text-mute">{profile.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

