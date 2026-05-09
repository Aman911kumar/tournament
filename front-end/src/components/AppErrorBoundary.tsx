import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "The app hit an unexpected error.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("App render error:", error, info.componentStack);
    }
  }

  reset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="arena-shell min-h-screen px-4 py-8">
        <GlassCard className="mx-auto max-w-md py-8 text-center">
          <h1 className="font-heading text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.message}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={this.reset}>
              Try again
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }
}

export default AppErrorBoundary;
