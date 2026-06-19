import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth.tsx';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './components/AdminLayout';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import PostDetail from './pages/PostDetail';
import TagsPage from './pages/TagsPage';
import Guestbook from './pages/Guestbook';
import About from './pages/About';
import SearchPage from './pages/SearchPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import PostEditor from './pages/admin/PostEditor';
import PostManagement from './pages/admin/PostManagement';
import CommentManagement from './pages/admin/CommentManagement';
import GuestbookManagement from './pages/admin/GuestbookManagement';
import WallpaperAdmin from './pages/admin/WallpaperAdmin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes — use blog Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/post/:slug" element={<PostDetail />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/guestbook" element={<Guestbook />} />
        <Route path="/about" element={<About />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>

      {/* Admin login — no layout (centered minimal) */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin pages — use AdminLayout with sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/posts" element={<PostManagement />} />
        <Route path="/admin/posts/new" element={<PostEditor />} />
        <Route path="/admin/posts/:id/edit" element={<PostEditor />} />
        <Route path="/admin/comments" element={<CommentManagement />} />
        <Route path="/admin/guestbook" element={<GuestbookManagement />} />
        <Route path="/admin/wallpaper" element={<WallpaperAdmin />} />
      </Route>

      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
