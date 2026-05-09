import { BellRing, CheckCircle2, Flame, Info, Sparkles, Trophy } from "lucide-react";
import { PageHeader, PageShell, Surface } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const demoToasts = [
  {
    label: "Success",
    icon: CheckCircle2,
    action: () => toast.success("Saved successfully", { description: "Your changes are ready." }),
  },
  {
    label: "Tournament",
    icon: Trophy,
    action: () => toast.reward("Prize credited", { description: "Rs. 500 added to your wallet." }),
  },
  {
    label: "Live",
    icon: Flame,
    action: () => toast.orange("Tournament is live", { description: "Room details are now available." }),
  },
  {
    label: "System",
    icon: Info,
    action: () => toast.info("New update available", { description: "Refresh when your current match is complete." }),
  },
];

export default function Test() {
  return (
    <PageShell bottomNavPadding={false} className="min-h-screen" contentClassName="py-6">
      <PageHeader
        title="UI Test Lab"
        subtitle="Developer-only visual checks for Battle4Arena components"
        icon={Sparkles}
      />

      <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <Surface className="space-y-4">
          <div>
            <h1 className="font-heading text-xl font-bold">Toast Preview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quick visual smoke test for the shared notification style.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {demoToasts.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.label} type="button" variant="soft" onClick={item.action} className="justify-start">
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </Surface>

        <Surface className="flex flex-col justify-between gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-secondary/30 bg-secondary/10 text-secondary">
            <BellRing className="h-8 w-8" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold">Dark-only lab route</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This route stays lightweight and uses the same shell, buttons, and surfaces as production screens.
            </p>
          </div>
        </Surface>
      </div>
    </PageShell>
  );
}
