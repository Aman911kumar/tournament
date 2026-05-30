import type { ReactNode } from "react";
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

type PreferenceOption<T extends string> = { label: string; value: T };

const selectClassName =
  "arena-focus h-9 w-full rounded-sm border border-glass-border bg-[#0D1117] px-2.5 font-heading text-xs font-bold text-foreground outline-none transition-colors hover:border-primary/35 focus:border-primary/55";

const rangeClassName =
  "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary";

const getOptionLabel = <T extends string>(
  options: Array<PreferenceOption<T>>,
  value: T,
) => options.find((option) => option.value === value)?.label ?? value;

const PreferenceShell = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Type;
  title: string;
  children: ReactNode;
}) => (
  <div className="grid gap-2 border-t border-glass-border/70 px-3 py-2.5 sm:grid-cols-[116px_1fr] sm:items-center">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <p className="font-heading text-xs font-bold">{title}</p>
    </div>
    {children}
  </div>
);

const SelectPreference = <T extends string>({
  icon,
  title,
  options,
  value,
  onChange,
}: {
  icon: typeof Type;
  title: string;
  options: Array<PreferenceOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) => (
  <PreferenceShell icon={icon} title={title}>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={selectClassName}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </PreferenceShell>
);

const RangePreference = <T extends string>({
  icon,
  title,
  options,
  value,
  onChange,
}: {
  icon: typeof Type;
  title: string;
  options: Array<PreferenceOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) => {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <PreferenceShell icon={icon} title={title}>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-[11px] text-muted-foreground">
            {options[0]?.label}
          </span>
          <span className="rounded-sm border border-primary/25 bg-primary/10 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wide text-primary">
            {getOptionLabel(options, value)}
          </span>
          <span className="font-heading text-[11px] text-muted-foreground">
            {options[options.length - 1]?.label}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, options.length - 1)}
          step={1}
          value={activeIndex}
          onChange={(event) => {
            const option = options[Number(event.target.value)];
            if (option) onChange(option.value);
          }}
          className={cn(rangeClassName, "mt-2")}
          aria-label={title}
        />
      </div>
    </PreferenceShell>
  );
};

export const UiPreferencesPanel = () => {
  const { preferences, setPreferences, resetPreferences } = useUiPreferences();

  return (
    <Surface className="overflow-hidden bg-[#101620]/90 p-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="font-heading text-xs font-black uppercase tracking-[0.08em]">
            Interface
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Compact display controls
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

      <SelectPreference<UiDensity>
        icon={Gauge}
        title="Density"
        value={preferences.density}
        onChange={(density) => setPreferences({ density })}
        options={[
          { label: "Compact", value: "compact" },
          { label: "Comfort", value: "comfortable" },
        ]}
      />

      <RangePreference<UiTextScale>
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

      <RangePreference<UiScale>
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

      <SelectPreference<UiMotion>
        icon={Zap}
        title="Motion"
        value={preferences.motion}
        onChange={(motion) => setPreferences({ motion })}
        options={[
          { label: "Reduce", value: "reduced" },
          { label: "Auto", value: "auto" },
        ]}
      />

      <RangePreference<UiAnimationIntensity>
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

      <SelectPreference<UiContrast>
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
