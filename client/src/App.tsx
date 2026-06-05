import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BattlePage from './pages/BattlePage';
import StudyPage from './pages/StudyPage';
import GameSettingsPage from './pages/GameSettingsPage';
import EditDeckPage from './pages/EditDeckPage';
import type { JSX } from 'react';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('accessToken');
  return token ? children : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/home" element={
        <ProtectedRoute><HomePage /></ProtectedRoute>
      } />
      <Route path="/battle/:roomCode" element={
        <ProtectedRoute><BattlePage /></ProtectedRoute>
      } />
      <Route path="/study/:deckId" element={
        <ProtectedRoute><StudyPage /></ProtectedRoute>
      } />
      <Route path="/game-settings" element={
        <ProtectedRoute><GameSettingsPage /></ProtectedRoute>
      } />
      <Route path="/edit-deck" element={
        <ProtectedRoute><EditDeckPage /></ProtectedRoute>
      } />
    </Routes>
  );
}