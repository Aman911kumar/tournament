import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Index from "./pages/Index.tsx";
import LoginScreen from "./pages/LoginScreen.tsx";
import Test from "./pages/test.tsx"
import TournamentsScreen from "./pages/TournamentsScreen.tsx";
import TournamentDetailScreen from "./pages/TournamentDetailScreen.tsx";
import WalletScreen from "./pages/WalletScreen.tsx";
import AddMoneyScreen from "./pages/AddMoneyScreen.tsx";
import WithdrawScreen from "./pages/WithdrawScreen.tsx";
import TransactionDetailScreen from "./pages/TransactionDetailScreen.tsx";
import ProfileScreen from "./pages/ProfileScreen.tsx";
import EditProfileScreen from "./pages/EditProfileScreen.tsx";
import ChangePasswordScreen from "./pages/ChangePasswordScreen.tsx";
import GameAccountsScreen from "./pages/GameAccountsScreen.tsx";
import CreatorProfileScreen from "./pages/CreatorProfileScreen.tsx";
import CreateTournamentScreen from "./pages/CreateTournamentScreen.tsx";
import CreatorDashboardScreen from "./pages/CreatorDashboardScreen.tsx";
import AdminDashboardScreen from "./pages/AdminDashboardScreen.tsx";
import NotificationsScreen from "./pages/NotificationsScreen.tsx";
import SubscriptionsScreen from "./pages/SubscriptionsScreen.tsx";
import TournamentCommentsScreen from "./pages/TournamentCommentsScreen.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute";
import { toast } from "sonner";

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const queryClient = new QueryClient();

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
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tournaments" element={<ProtectedRoute><TournamentsScreen /></ProtectedRoute>} />
            <Route path="/tournament/:id" element={<ProtectedRoute><TournamentDetailScreen /></ProtectedRoute>} />
            <Route path="/tournament/:id/comments" element={<ProtectedRoute><TournamentCommentsScreen /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><WalletScreen /></ProtectedRoute>} />
            <Route path="/wallet/transaction/:id" element={<ProtectedRoute><TransactionDetailScreen /></ProtectedRoute>} />
            <Route path="/wallet/add" element={<ProtectedRoute><AddMoneyScreen /></ProtectedRoute>} />
            <Route path="/wallet/withdraw" element={<ProtectedRoute><WithdrawScreen /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfileScreen /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePasswordScreen /></ProtectedRoute>} />
            <Route path="/game-accounts" element={<ProtectedRoute><GameAccountsScreen /></ProtectedRoute>} />
            <Route path="/creator/:id" element={<ProtectedRoute><CreatorProfileScreen /></ProtectedRoute>} />
            <Route path="/create-tournament" element={<ProtectedRoute><CreateTournamentScreen /></ProtectedRoute>} />
            <Route path="/edit-tournament/:id" element={<ProtectedRoute><CreateTournamentScreen /></ProtectedRoute>} />
            <Route path="/creator-dashboard" element={<ProtectedRoute><CreatorDashboardScreen /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboardScreen /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsScreen /></ProtectedRoute>} />
            <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionsScreen /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </GoogleOAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
