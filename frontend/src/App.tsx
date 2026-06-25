import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MediaProvider } from './context/MediaContext';
import { RequireAuth } from './components/RequireAuth';
import { AppLayout } from './layouts/AppLayout';
import { Auth } from './pages/Auth';
import { Home } from './pages/Home';
import { Scan } from './pages/Scan';
import { Gallery } from './pages/Gallery';
import { History } from './pages/History';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import './styles/app.css';

function App() {
  return (
    <AuthProvider>
      <MediaProvider>
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
              <Route path="/galerie" element={<Gallery />} />
              <Route path="/historique" element={<History />} />
              <Route path="/alertes" element={<Alerts />} />
              <Route path="/reglages" element={<Settings />} />
              <Route path="/profil" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </BrowserRouter>
      </MediaProvider>
    </AuthProvider>
  );
}

export default App;
