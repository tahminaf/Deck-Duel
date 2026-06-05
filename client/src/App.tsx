import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BattlePage from './pages/BattlePage';
import StudyPage from './pages/StudyPage';
import GameSettingsPage from './pages/GameSettingsPage';
import EditDeckPage from './pages/EditDeckPage';
import { isSessionValid } from './lib/session';
import type { JSX } from 'react';

const ProtectedRoute = ({ children }: { children: JSX.Element }) =>
  isSessionValid() ? children : <Navigate to="/" replace />;

const PublicRoute = ({ children }: { children: JSX.Element }) =>
  isSessionValid() ? <Navigate to="/home" replace /> : children;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/battle/:roomCode" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
      <Route path="/study/:deckId" element={<ProtectedRoute><StudyPage /></ProtectedRoute>} />
      <Route path="/game-settings" element={<ProtectedRoute><GameSettingsPage /></ProtectedRoute>} />
      <Route path="/edit-deck" element={<ProtectedRoute><EditDeckPage /></ProtectedRoute>} />
    </Routes>
  );
}
