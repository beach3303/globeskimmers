import { useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import AuthGate from '@/components/auth/AuthGate';
import { ToastContainer } from '@/components/Toast';
import FrozenScreen from '@/components/auth/FrozenScreen';
import FinishPassport from '@/components/auth/FinishPassport';
import { FontScaleProvider } from '@/components/a11y/FontScaleContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Reset scroll to the top on every route change so each feature opens at its
// header, never wherever the previous screen happened to be scrolled.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, socialTier } = useAuth();
  const navigate = useNavigate();
  const wasAuthenticated = useRef(false);

  // On every fresh sign-in (unauthenticated → authenticated) land the user on
  // Home — never on whatever route they were on when they signed out (e.g.
  // /Settings). Layout's onboarding gate then forwards to Onboarding if needed.
  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      navigate('/', { replace: true });
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, navigate]);

  // Brief spinner while the persisted Supabase session is restored on launch.
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Forced sign-in gate: with no session, ONLY the gate is reachable — no app
  // routes render until the user signs in or signs up.
  if (!isAuthenticated) {
    return <AuthGate />;
  }

  // An under-13 birthday freezes the whole account (founder, 2026-10-11):
  // only the frozen notice, delete-now and the access-only appeal remain.
  if (socialTier === 'blocked') {
    return <FrozenScreen />;
  }

  // Authenticated → render the app. Onboarding gating happens in Layout.
  // FinishPassport is mounted over every route (founder, 2026-10-18; deferred 2026-10-19: it shows
  // the first time a save or a share needs the passport, not at the door): until the account has its full
  // birthday and, at 18+, a @username, it covers the app — kindly, but there's no skipping it.
  // With nothing missing it renders ConfirmBirthday, which re-asks when a stamp or post is
  // refused for the birthday.
  return (
    <>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    <FinishPassport />
    </>
  );
};

function App() {
  return (
    <FontScaleProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        {/* Once, above every screen — the sign-in gate and the frozen screen
            render outside Layout, and their messages must show too. */}
        <ToastContainer />
      </QueryClientProvider>
    </AuthProvider>
    </FontScaleProvider>
  )
}

export default App
