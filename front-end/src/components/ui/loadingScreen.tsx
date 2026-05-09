const Loader = () => (
  <div className="grid place-items-center py-8" role="status" aria-live="polite">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 rounded-lg border border-primary/25 bg-primary/10" />
      <div className="absolute inset-2 rounded-lg border border-secondary/25 bg-secondary/10" />
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-accent shadow-[0_0_18px_hsl(var(--accent)/0.36)] motion-reduce:animate-none" />
    </div>
    <span className="sr-only">Loading</span>
  </div>
);

export default Loader;
