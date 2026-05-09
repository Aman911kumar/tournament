import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, SearchX, Trophy } from "lucide-react";
import { PageShell, Surface } from "@/components/design-system";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <PageShell bottomNavPadding={false} className="min-h-screen" contentClassName="flex min-h-screen items-center justify-center py-10">
      <Surface className="w-full max-w-md p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <SearchX className="h-8 w-8" />
        </div>
        <p className="mt-5 font-display text-5xl font-bold leading-none text-foreground">404</p>
        <h1 className="mt-3 font-heading text-xl font-bold">Page Not Found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          This arena link is unavailable or moved. Head back home and pick up from the live matches.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button asChild variant="soft">
            <Link to="/tournaments">
              <Trophy className="mr-2 h-4 w-4" />
              Tournaments
            </Link>
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </Surface>
    </PageShell>
  );
};

export default NotFound;
