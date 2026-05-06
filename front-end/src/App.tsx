import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Analytics } from "@vercel/analytics/next"
import Index from "./pages/Index.tsx";
import LoginScreen from "./pages/LoginScreen.tsx";
import Test from "./pages/test.tsx"
import TournamentsScreen from "./pages/TournamentsScreen.tsx";
import TournamentDetailScreen from "./pages/TournamentDetailScreen.tsx";
import MyTournamentsScreen from "./pages/MyTournamentsScreen.tsx";
import SlotSelectionScreen from "./pages/SlotSelectionScreen.tsx";
import WalletScreen from "./pages/WalletScreen.tsx";
import AddMoneyScreen from "./pages/AddMoneyScreen.tsx";
import WithdrawScreen from "./pages/WithdrawScreen.tsx";
import TransferMoneyScreen from "./pages/TransferMoneyScreen.tsx";
import TransactionDetailScreen from "./pages/TransactionDetailScreen.tsx";
import ProfileScreen from "./pages/ProfileScreen.tsx";
import EditProfileScreen from "./pages/EditProfileScreen.tsx";
import ChangePasswordScreen from "./pages/ChangePasswordScreen.tsx";
import GameAccountsScreen from "./pages/GameAccountsScreen.tsx";
import CreatorProfileScreen from "./pages/CreatorProfileScreen.tsx";
import CreateTournamentScreen from "./pages/CreateTournamentScreen.tsx";
import CreatorDashboardScreen from "./pages/CreatorDashboardScreen.tsx";
import PrizeDistributionScreen from "./pages/PrizeDistributionScreen.tsx";
import AdminDashboardScreen from "./pages/AdminDashboardScreen.tsx";
import NotificationsScreen from "./pages/NotificationsScreen.tsx";
import SubscriptionsScreen from "./pages/SubscriptionsScreen.tsx";
import TournamentCommentsScreen from "./pages/TournamentCommentsScreen.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import { toast } from "@/components/ui/sonner";

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const queryClient = new QueryClient();

const ProtectedShell = () => (
  <ProtectedRoute>
    <div className="min-h-screen pb-24">
      <Outlet />
    </div>
    <BottomNav />
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <GoogleOAuthProvider
          clientId={VITE_GOOGLE_CLIENT_ID}
          onScriptLoadSuccess={() => {
            console.log("Google Loaded")
          }}
          onScriptLoadError={() => {
            toast.error("Failed to load")
            console.log("Failed to load")
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
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
              <Route path="/wallet/add" element={<AddMoneyScreen />} />
              <Route path="/wallet/withdraw" element={<WithdrawScreen />} />
              <Route path="/wallet/transfer" element={<TransferMoneyScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/edit-profile" element={<EditProfileScreen />} />
              <Route path="/change-password" element={<ChangePasswordScreen />} />
              <Route path="/game-accounts" element={<GameAccountsScreen />} />
              <Route path="/creator/:id" element={<CreatorProfileScreen />} />
              <Route path="/create-tournament" element={<CreateTournamentScreen />} />
              <Route path="/edit-tournament/:id" element={<CreateTournamentScreen />} />
              <Route path="/creator-dashboard" element={<CreatorDashboardScreen />} />
              <Route path="/admin" element={<AdminDashboardScreen />} />
              <Route path="/notifications" element={<NotificationsScreen />} />
              <Route path="/subscriptions" element={<SubscriptionsScreen />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Analytics />
        </GoogleOAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  
);

export default App;
