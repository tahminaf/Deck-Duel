import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { roomsApi } from '../lib/api';

interface Deck {
  deckId: string;
  title: string;
  cards: { question: string; answer: string }[];
}

export default function GameSettingsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const deck = state?.deck as Deck | undefined;
  const username = localStorage.getItem('username') || 'player';

  const [maxPlayers, setMaxPlayers] = useState(2);
  const [timePerQuestion, setTimePerQuestion] = useState(15);
  const [shuffle, setShuffle] = useState(false);
  const [gameMode, setGameMode] = useState<'race' | 'wordle'>('race');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!deck) return <Navigate to="/home" replace />;

  const handleStart = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await roomsApi.create(deck.deckId, username, maxPlayers, shuffle, timePerQuestion, gameMode);
      navigate(`/battle/${res.data.room.roomCode}`, {
        state: { isHost: true, deck, maxPlayers, timePerQuestion, shuffle, gameMode },
      });
    } catch {
      setError('Could not create room. Try again.');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <span className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></span>
        <button onClick={() => navigate('/home')} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">← back</button>
      </nav>

      <div className="flex flex-1 max-w-sm mx-auto w-full px-4 py-10 flex-col">
        <div className="mb-8">
          <p className="text-xs text-gray-300 uppercase tracking-widest mb-1">Game settings</p>
          <h1 className="font-serif text-2xl font-medium text-gray-900">{deck.title}</h1>
          <p className="text-xs text-gray-400 mt-1">{deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'}</p>
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        <div className="space-y-6">
          {/* Players */}
          <div>
            <label className="text-xs text-gray-400 block mb-3">Players</label>
            <div className="flex gap-2">
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setMaxPlayers(n)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${maxPlayers === n ? 'bg-sage-400 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:border-sage-400'}`}>
                  {n}p
                </button>
              ))}
            </div>
          </div>

          {/* Time per question */}
          <div>
            <label className="text-xs text-gray-400 block mb-3">Time per question</label>
            <div className="flex gap-2">
              {[10, 15, 30, 60].map(s => (
                <button key={s} onClick={() => setTimePerQuestion(s)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${timePerQuestion === s ? 'bg-sage-400 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:border-sage-400'}`}>
                  {s}s
                </button>
              ))}
            </div>
          </div>

          {/* Game mode */}
          <div>
            <label className="text-xs text-gray-400 block mb-3">Game mode</label>
            <div className="flex gap-2">
              {([
                { value: 'race', label: 'Race', desc: 'Type your answer' },
                { value: 'wordle', label: 'Wordle', desc: 'Guess letter by letter' },
              ] as const).map(({ value, label, desc }) => (
                <button key={value} onClick={() => setGameMode(value)}
                  className={`flex-1 py-3 px-3 rounded-xl text-left text-sm transition-colors border ${gameMode === value ? 'bg-sage-400 border-sage-400 text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-sage-400'}`}>
                  <div className="font-medium">{label}</div>
                  <div className={`text-xs mt-0.5 ${gameMode === value ? 'text-white/70' : 'text-gray-400'}`}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Shuffle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div>
              <p className="text-sm text-gray-700">Shuffle questions</p>
              <p className="text-xs text-gray-400 mt-0.5">Randomize the card order</p>
            </div>
            <button onClick={() => setShuffle(s => !s)}
              className={`relative w-11 h-6 rounded-full transition-colors ${shuffle ? 'bg-sage-400' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${shuffle ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <button onClick={handleStart} disabled={creating}
          className="mt-10 w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-3 text-sm transition-colors disabled:opacity-50">
          {creating ? 'Creating room…' : 'Start race →'}
        </button>
      </div>
    </div>
  );
}
