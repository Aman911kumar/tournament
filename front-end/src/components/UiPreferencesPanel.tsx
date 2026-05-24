import {
  Gauge,
  MonitorSmartphone,
  RotateCcw,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";
import {
  UiAnimationIntensity,
  UiContrast,
  UiDensity,
  UiMotion,
  UiScale,
  UiTextScale,
  useUiPreferences,
} from "@/hooks/useUiPreferences";
import { Surface } from "@/components/design-system";
import { cn } from "@/lib/utils";

const ChoiceButton = <T extends string>({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean;
  label: string;
  value: T;
  onClick: (value: T) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={cn(
      "arena-focus min-h-9 rounded-md border px-2.5 font-heading text-[11px] font-bold transition-colors",
      active
        ? "border-primary/45 bg-primary/15 text-primary"
        : "border-glass-border bg-background/38 text-muted-foreground hover:border-primary/35 hover:text-foreground",
    )}
  >
    {label}
  </button>
);

const PreferenceRow = <T extends string>({
  icon: Icon,
  title,
  options,
  value,
  onChange,
}: {
  icon: typeof Type;
  title: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <p className="font-heading text-xs font-bold">{title}</p>
    </div>
    <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3">
      {options.map((option) => (
        <ChoiceButton
          key={option.value}
          active={value === option.value}
          label={option.label}
          value={option.value}
          onClick={onChange}
        />
      ))}
    </div>
  </div>
);

export const UiPreferencesPanel = () => {
  const { preferences, setPreferences, resetPreferences } = useUiPreferences();

  return (
    <Surface className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-sm font-black">Interface</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Tune density, text, contrast, and motion for your device.
          </p>
        </div>
        <button
          type="button"
          onClick={resetPreferences}
          className="arena-focus grid h-9 w-9 shrink-0 place-items-center rounded-md border border-glass-border text-muted-foreground hover:border-primary/35 hover:text-primary"
          aria-label="Reset interface preferences"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <PreferenceRow<UiDensity>
        icon={Gauge}
        title="Density"
        value={preferences.density}
        onChange={(density) => setPreferences({ density })}
        options={[
          { label: "Compact", value: "compact" },
          { label: "Comfort", value: "comfortable" },
        ]}
      />

      <PreferenceRow<UiTextScale>
        icon={Type}
        title="Text"
        value={preferences.textScale}
        onChange={(textScale) => setPreferences({ textScale })}
        options={[
          { label: "Small", value: "sm" },
          { label: "Base", value: "base" },
          { label: "Large", value: "lg" },
        ]}
      />

      <PreferenceRow<UiScale>
        icon={MonitorSmartphone}
        title="UI scale"
        value={preferences.uiScale}
        onChange={(uiScale) => setPreferences({ uiScale })}
        options={[
          { label: "Small", value: "sm" },
          { label: "Base", value: "base" },
          { label: "Large", value: "lg" },
        ]}
      />

      <PreferenceRow<UiMotion>
        icon={Zap}
        title="Motion"
        value={preferences.motion}
        onChange={(motion) => setPreferences({ motion })}
        options={[
          { label: "Reduce", value: "reduced" },
          { label: "Auto", value: "auto" },
        ]}
      />

      <PreferenceRow<UiAnimationIntensity>
        icon={Sparkles}
        title="Animation"
        value={preferences.animationIntensity}
        onChange={(animationIntensity) => setPreferences({ animationIntensity })}
        options={[
          { label: "Minimal", value: "minimal" },
          { label: "Subtle", value: "subtle" },
          { label: "Rich", value: "rich" },
        ]}
      />

      <PreferenceRow<UiContrast>
        icon={Gauge}
        title="Contrast"
        value={preferences.contrast}
        onChange={(contrast) => setPreferences({ contrast })}
        options={[
          { label: "High", value: "high" },
          { label: "Standard", value: "standard" },
        ]}
      />
    </Surface>
  );
};

export default UiPreferencesPanel;
