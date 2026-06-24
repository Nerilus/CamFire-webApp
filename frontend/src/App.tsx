import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { AppLayout } from './layouts/AppLayout';
import { Auth } from './pages/Auth';
import { Home } from './pages/Home';
import { Scan } from './pages/Scan';
import { History } from './pages/History';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';
import './styles/app.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/historique" element={<History />} />
            <Route path="/alertes" element={<Alerts />} />
            <Route path="/reglages" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
