import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { ROUTES, STANDALONE } from './routes';

const NotFound = lazy(() => import('@/pages/NotFoundPage'));

export function App() {
  useEffect(() => {
    // warm every route chunk shortly after first paint, a few at a time
    const all = [...ROUTES, ...STANDALONE];
    const t = window.setTimeout(() => { all.forEach((r, i) => window.setTimeout(() => void r.preload(), i * 40)); }, 1200);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <Suspense fallback={null}>
      <Routes>
        {STANDALONE.map((r) => <Route key={r.path} path={r.path} element={<r.Page />} />)}
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {ROUTES.map((r) => <Route key={r.path} path={r.path} element={<r.Page />} />)}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
