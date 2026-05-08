import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Analytics } from "@vercel/analytics/react";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import { toast } from "@/components/ui/sonner";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { ApiError } from "@/api/client";

const Index = lazy(() => import("./pages/Index.tsx"));
const LoginScreen = lazy(() => import("./pages/LoginScreen.tsx"));
const ForgotPasswordScreen = lazy(() => import("./pages/ForgotPasswordScreen.tsx"));
const Test = lazy(() => import("./pages/test.tsx"));
const TournamentsScreen = lazy(() => import("./pages/TournamentsScreen.tsx"));
const TournamentDetailScreen = lazy(() => import("./pages/TournamentDetailScreen.tsx"));
const MyTournamentsScreen = lazy(() => import("./pages/MyTournamentsScreen.tsx"));
const SlotSelectionScreen = lazy(() => import("./pages/SlotSelectionScreen.tsx"));
const WalletScreen = lazy(() => import("./pages/WalletScreen.tsx"));
const AddMoneyScreen = lazy(() => import("./pages/AddMoneyScreen.tsx"));
const WithdrawScreen = lazy(() => import("./pages/WithdrawScreen.tsx"));
const TransferMoneyScreen = lazy(() => import("./pages/TransferMoneyScreen.tsx"));
const TransactionDetailScreen = lazy(() => import("./pages/TransactionDetailScreen.tsx"));
const PaymentDetailScreen = lazy(() => import("./pages/PaymentDetailScreen.tsx"));
const ProfileScreen = lazy(() => import("./pages/ProfileScreen.tsx"));
const EditProfileScreen = lazy(() => import("./pages/EditProfileScreen.tsx"));
const ChangePasswordScreen = lazy(() => import("./pages/ChangePasswordScreen.tsx"));
const GameAccountsScreen = lazy(() => import("./pages/GameAccountsScreen.tsx"));
const CreatorProfileScreen = lazy(() => import("./pages/CreatorProfileScreen.tsx"));
const ChannelSetupScreen = lazy(() => import("./pages/ChannelSetupScreen.tsx"));
const CreateTournamentScreen = lazy(() => import("./pages/CreateTournamentScreen.tsx"));
const CreatorDashboardScreen = lazy(() => import("./pages/CreatorDashboardScreen.tsx"));
const PrizeDistributionScreen = lazy(() => import("./pages/PrizeDistributionScreen.tsx"));
const AdminDashboardScreen = lazy(() => import("./pages/AdminDashboardScreen.tsx"));
const AdminDetailScreen = lazy(() => import("./pages/AdminDetailScreen.tsx"));
const NotificationsScreen = lazy(() => import("./pages/NotificationsScreen.tsx"));
const SubscriptionsScreen = lazy(() => import("./pages/SubscriptionsScreen.tsx"));
const TournamentCommentsScreen = lazy(() => import("./pages/TournamentCommentsScreen.tsx"));
const HelpCenterScreen = lazy(() => import("./pages/HelpCenterScreen.tsx"));
const RulesScreen = lazy(() => import("./pages/RulesScreen.tsx"));
const PrivacyPolicyScreen = lazy(() => import("./pages/PrivacyPolicyScreen.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 1;
      },
    },
  },
});

const ProtectedShell = () => (
  <ProtectedRoute>
    <div className="min-h-screen pb-24">
      <Outlet />
    </div>
    <BottomNav />
  </ProtectedRoute>
);

const RouteLoader = () => (
  <div className="min-h-screen bg-background px-4 pt-8">
    <div className="mx-auto w-full max-w-2xl space-y-3">
      <div className="h-6 w-36 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
    </div>
  </div>
);

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <Analytics />
        <BrowserRouter>
          <GoogleOAuthProvider
            clientId={VITE_GOOGLE_CLIENT_ID}
            onScriptLoadError={() => {
              toast.error("Google login unavailable", {
                description: "Try phone/email login or refresh this page.",
              });
            }}
          >
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
                <Route path="/test" element={<Test />} />
                <Route element={<ProtectedShell />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/tournaments" element={<TournamentsScreen />} />
                  <Route path="/my-tournaments" element={<MyTournamentsScreen />} />
                  <Route path="/tournament/:id" element={<TournamentDetailScreen />} />
                  <Route path="/tournament/:id/slots" element={<SlotSelectionScreen />} />
                  <Route path="/tournament/:id/comments" element={<TournamentCommentsScreen />} />
                  <Route path="/tournament/:id/distribute-prizes" element={<PrizeDistributionScreen />} />
                  <Route path="/wallet" element={<WalletScreen />} />
                  <Route path="/wallet/transaction/:id" element={<TransactionDetailScreen />} />
                  <Route path="/wallet/payment/:id" element={<PaymentDetailScreen />} />
                  <Route path="/wallet/add" element={<AddMoneyScreen />} />
                  <Route path="/wallet/withdraw" element={<WithdrawScreen />} />
                  <Route path="/wallet/transfer" element={<TransferMoneyScreen />} />
                  <Route path="/profile" element={<ProfileScreen />} />
                  <Route path="/edit-profile" element={<EditProfileScreen />} />
                  <Route path="/change-password" element={<ChangePasswordScreen />} />
                  <Route path="/game-accounts" element={<GameAccountsScreen />} />
                  <Route path="/creator/:id" element={<CreatorProfileScreen />} />
                  <Route path="/channel-setup" element={<ChannelSetupScreen />} />
                  <Route path="/create-tournament" element={<CreateTournamentScreen />} />
                  <Route path="/edit-tournament/:id" element={<CreateTournamentScreen />} />
                  <Route path="/creator-dashboard" element={<CreatorDashboardScreen />} />
                  <Route path="/admin" element={<AdminDashboardScreen />} />
                  <Route path="/admin/details/:section" element={<AdminDetailScreen />} />
                  <Route path="/notifications" element={<NotificationsScreen />} />
                  <Route path="/subscriptions" element={<SubscriptionsScreen />} />
                  <Route path="/help" element={<HelpCenterScreen />} />
                  <Route path="/rules" element={<RulesScreen />} />
                  <Route path="/privacy" element={<PrivacyPolicyScreen />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </GoogleOAuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
  
);

export default App;
