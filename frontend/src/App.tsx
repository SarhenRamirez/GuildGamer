import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { HomePage } from './pages/HomePage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { NotFoundPage } from './pages/NotFoundPage';

const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const FeedPage = lazy(() => import('./pages/FeedPage').then((m) => ({ default: m.FeedPage })));
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((m) => ({ default: m.FriendsPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const MockCheckoutPage = lazy(() => import('./pages/MockCheckoutPage').then((m) => ({ default: m.MockCheckoutPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const PlayersPage = lazy(() => import('./pages/PlayersPage').then((m) => ({ default: m.PlayersPage })));
const PremiumPage = lazy(() => import('./pages/PremiumPage').then((m) => ({ default: m.PremiumPage })));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage').then((m) => ({ default: m.EditProfilePage })));
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })));
const SessionFormPage = lazy(() => import('./pages/SessionFormPage').then((m) => ({ default: m.SessionFormPage })));
const SessionsPage = lazy(() => import('./pages/SessionsPage').then((m) => ({ default: m.SessionsPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage })));

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner className="min-h-screen items-center" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Layout />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? children : <Navigate to="/" replace />;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner className="min-h-screen items-center" />;
  if (!user) return children;
  const from = (location.state as { from?: string } | null)?.from;
  return <Navigate to={location.pathname === '/register' ? '/profile?welcome=1' : (from ?? '/')} replace />;
}

export function App() {

  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route element={<RequireAuth />}>
        <Route index element={<HomePage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/new" element={<SessionFormPage />} />
        <Route path="sessions/:id" element={<SessionDetailPage />} />
        <Route path="sessions/:id/edit" element={<SessionFormPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="profile" element={<EditProfilePage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:userId" element={<MessagesPage />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="premium" element={<PremiumPage />} />
        <Route path="premium/checkout/:paymentId" element={<MockCheckoutPage />} />
        <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
