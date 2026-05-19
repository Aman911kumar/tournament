import { Loader2 } from "lucide-react";

const ButtonLoadingScreen = ({ label = "Loading" }: { label?: string }) => (
  <span className="inline-flex items-center justify-center gap-2 font-heading text-sm font-semibold">
    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    {label}
  </span>
);

export default ButtonLoadingScreen;
