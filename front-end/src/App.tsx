import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/react";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import NotificationRealtimeBridge from "./components/NotificationRealtimeBridge";
import NetworkStatusBanner from "./components/NetworkStatusBanner";
import OnboardingGate from "./components/OnboardingGate";
import CapacitorUrlListener from "./components/CapacitorUrlListener";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { RouteSkeleton } from "@/components/design-system";
import { ApiError, scheduleRealtimeWarmup } from "@/api/client";
import { recordFrontendEvent } from "@/lib/frontend-monitoring";
import { useUiPreferences } from "@/hooks/useUiPreferences";

const Index = lazy(() => import("./pages/Index.tsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.tsx"));
const LoginScreen = lazy(() => import("./pages/LoginScreen.tsx"));
const ForgotPasswordRequestScreen = lazy(
  () => import("./pages/ForgotPasswordRequestScreen.tsx"),
);
const ForgotPasswordOtpScreen = lazy(
  () => import("./pages/ForgotPasswordOtpScreen.tsx"),
);
const ForgotPasswordResetScreen = lazy(
  () => import("./pages/ForgotPasswordResetScreen.tsx"),
);
const ForgotPasswordExpiredScreen = lazy(
  () => import("./pages/ForgotPasswordExpiredScreen.tsx"),
);
const VerifyEmailScreen = lazy(() => import("./pages/VerifyEmailScreen.tsx"));
const VerifyPhoneScreen = lazy(() => import("./pages/VerifyPhoneScreen.tsx"));
const OAuthCallbackScreen = lazy(
  () => import("./pages/OAuthCallbackScreen.tsx"),
);
const Test = lazy(() => import("./pages/test.tsx"));
const TournamentsScreen = lazy(() => import("./pages/TournamentsScreen.tsx"));
const TournamentDetailScreen = lazy(
  () => import("./pages/TournamentDetailScreen.tsx"),
);
const MyTournamentsScreen = lazy(
  () => import("./pages/MyTournamentsScreen.tsx"),
);
const SlotSelectionScreen = lazy(
  () => import("./pages/SlotSelectionScreen.tsx"),
);
const WalletScreen = lazy(() => import("./pages/WalletScreen.tsx"));
const AddMoneyScreen = lazy(() => import("./pages/AddMoneyScreen.tsx"));
const WithdrawScreen = lazy(() => import("./pages/WithdrawScreen.tsx"));
const TransferMoneyScreen = lazy(
  () => import("./pages/TransferMoneyScreen.tsx"),
);
const TransferPinSetupScreen = lazy(
  () => import("./pages/TransferPinSetupScreen.tsx"),
);
const TransactionDetailScreen = lazy(
  () => import("./pages/TransactionDetailScreen.tsx"),
);
const PaymentDetailScreen = lazy(
  () => import("./pages/PaymentDetailScreen.tsx"),
);
const ProfileScreen = lazy(() => import("./pages/ProfileScreen.tsx"));
const EditProfileScreen = lazy(() => import("./pages/EditProfileScreen.tsx"));
const ChangePasswordScreen = lazy(
  () => import("./pages/ChangePasswordScreen.tsx"),
);
const GameAccountsScreen = lazy(() => import("./pages/GameAccountsScreen.tsx"));
const CreatorProfileScreen = lazy(
  () => import("./pages/CreatorProfileScreen.tsx"),
);
const ChannelSetupScreen = lazy(() => import("./pages/ChannelSetupScreen.tsx"));
const CreateTournamentScreen = lazy(
  () => import("./pages/CreateTournamentScreen.tsx"),
);
const CreatorDashboardScreen = lazy(
  () => import("./pages/CreatorDashboardScreen.tsx"),
);
const PrizeDistributionScreen = lazy(
  () => import("./pages/PrizeDistributionScreen.tsx"),
);
const AdminDashboardScreen = lazy(
  () => import("./pages/AdminDashboardScreen.tsx"),
);
const AdminDetailScreen = lazy(() => import("./pages/AdminDetailScreen.tsx"));
const AdminModerationScreen = lazy(
  () => import("./pages/AdminModerationScreen.tsx"),
);
const NotificationsScreen = lazy(
  () => import("./pages/NotificationsScreen.tsx"),
);
const SubscriptionsScreen = lazy(
  () => import("./pages/SubscriptionsScreen.tsx"),
);
const TournamentCommentsScreen = lazy(
  () => import("./pages/TournamentCommentsScreen.tsx"),
);
const HelpCenterScreen = lazy(() => import("./pages/HelpCenterScreen.tsx"));
const RulesScreen = lazy(() => import("./pages/RulesScreen.tsx"));
const PrivacyPolicyScreen = lazy(
  () => import("./pages/PrivacyPolicyScreen.tsx"),
);
const LegalCenterScreen = lazy(() => import("./pages/LegalCenterScreen.tsx"));
const GoogleOnboardingScreen = lazy(
  () => import("./pages/GoogleOnboardingScreen.tsx"),
);
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status))
          return false;
        return failureCount < 1;
      },
      retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 4_000),
    },
    mutations: {
      retry: false,
    },
  },
});

const ProtectedShell = () => (
  <ProtectedRoute>
    <OnboardingGate />
    <Outlet />
    <NotificationRealtimeBridge />
    <BottomNav />
  </ProtectedRoute>
);

const ProtectedFullscreenShell = () => (
  <ProtectedRoute>
    <OnboardingGate />
    <Outlet />
    <NotificationRealtimeBridge />
  </ProtectedRoute>
);

const RouteLoader = () => <RouteSkeleton />;

const RoutePerformanceMonitor = () => {
  const location = useLocation();

  useEffect(() => {
    const startedAt = performance.now();
    const frame = window.requestAnimationFrame(() => {
      recordFrontendEvent({
        type: "route-transition",
        name: "route-mounted",
        route: location.pathname,
        value: Math.round(performance.now() - startedAt),
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  return null;
};

const RealtimeWarmup = () => {
  useEffect(() => {
    scheduleRealtimeWarmup("app-open");
  }, []);

  return null;
};

const UiPreferenceBridge = () => {
  useUiPreferences();
  return null;
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <NetworkStatusBanner />
        <Analytics />
        <UiPreferenceBridge />
        <BrowserRouter>
          <CapacitorUrlListener />
          <RoutePerformanceMonitor />
          <RealtimeWarmup />
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route
                path="/forgot-password"
                element={<ForgotPasswordRequestScreen />}
              />
              <Route
                path="/forgot-password/verify"
                element={<ForgotPasswordOtpScreen />}
              />
              <Route
                path="/forgot-password/reset"
                element={<ForgotPasswordResetScreen />}
              />
              <Route
                path="/forgot-password/expired"
                element={<ForgotPasswordExpiredScreen />}
              />
              <Route path="/verify-email" element={<VerifyEmailScreen />} />
              <Route path="/verify-phone" element={<VerifyPhoneScreen />} />
              <Route path="/oauth/callback" element={<OAuthCallbackScreen />} />
              <Route path="/test" element={<Test />} />
              <Route path="/legal" element={<LegalCenterScreen />} />
              <Route path="/legal/:doc" element={<LegalCenterScreen />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <GoogleOnboardingScreen />
                  </ProtectedRoute>
                }
              />
              <Route element={<ProtectedFullscreenShell />}>
                <Route
                  path="/tournament/:id/chat"
                  element={<TournamentCommentsScreen />}
                />
                <Route
                  path="/tournament/:id/comments"
                  element={<TournamentCommentsScreen />}
                />
              </Route>
              <Route element={<ProtectedShell />}>
                <Route path="/" element={<Index />} />
                <Route path="/tournaments" element={<TournamentsScreen />} />
                <Route
                  path="/my-tournaments"
                  element={<MyTournamentsScreen />}
                />
                <Route
                  path="/tournament/:id"
                  element={<TournamentDetailScreen />}
                />
                <Route
                  path="/tournament/:id/slots"
                  element={<SlotSelectionScreen />}
                />
                <Route
                  path="/tournament/:id/distribute-prizes"
                  element={<PrizeDistributionScreen />}
                />
                <Route path="/wallet" element={<WalletScreen />} />
                <Route
                  path="/wallet/transaction/:id"
                  element={<TransactionDetailScreen />}
                />
                <Route
                  path="/wallet/payment/:id"
                  element={<PaymentDetailScreen />}
                />
                <Route path="/wallet/add" element={<AddMoneyScreen />} />
                <Route path="/wallet/withdraw" element={<WithdrawScreen />} />
                <Route
                  path="/wallet/transfer"
                  element={<TransferMoneyScreen />}
                />
                <Route
                  path="/wallet/transfer-pin"
                  element={<TransferPinSetupScreen />}
                />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="/edit-profile" element={<EditProfileScreen />} />
                <Route
                  path="/change-password"
                  element={<ChangePasswordScreen />}
                />
                <Route path="/game-accounts" element={<GameAccountsScreen />} />
                <Route path="/creator/:id" element={<CreatorProfileScreen />} />
                <Route path="/channel-setup" element={<ChannelSetupScreen />} />
                <Route
                  path="/create-tournament"
                  element={<CreateTournamentScreen />}
                />
                <Route
                  path="/edit-tournament/:id"
                  element={<CreateTournamentScreen />}
                />
                <Route
                  path="/creator-dashboard"
                  element={<CreatorDashboardScreen />}
                />
                <Route path="/admin" element={<AdminDashboardScreen />} />
                <Route
                  path="/admin/moderation"
                  element={<AdminModerationScreen />}
                />
                <Route
                  path="/admin/details/:section"
                  element={<AdminDetailScreen />}
                />
                <Route
                  path="/notifications"
                  element={<NotificationsScreen />}
                />
                <Route
                  path="/subscriptions"
                  element={<SubscriptionsScreen />}
                />
                <Route path="/help" element={<HelpCenterScreen />} />
                <Route path="/rules" element={<RulesScreen />} />
                <Route path="/privacy" element={<PrivacyPolicyScreen />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
