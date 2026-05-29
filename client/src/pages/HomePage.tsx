import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { decksApi, roomsApi } from '../lib/api';

interface Deck {
  deckId: string;
  title: string;
  cards: { question: string; answer: string }[];
  createdAt: string;
}

type Tab = 'decks' | 'join' | 'new';

export default function HomePage() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'player';

  const [tab, setTab] = useState<Tab>('decks');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [deckTitle, setDeckTitle] = useState('');
  const [cards, setCards] = useState([{ question: '', answer: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);

  useEffect(() => { fetchDecks(); }, []);

  const fetchDecks = async () => {
    setDecksLoading(true);
    try {
      const res = await decksApi.getAll(username);
      setDecks(res.data.decks);
    } catch {
    } finally {
      setDecksLoading(false);
    }
  };

  const handleCreateRoom = async (deck: Deck) => {
    setCreatingRoom(deck.deckId);
    setError('');
    try {
      const roomRes = await roomsApi.create(deck.deckId, username, maxPlayers);
      navigate(`/battle/${roomRes.data.room.roomCode}`, {
        state: { isHost: true, deck, maxPlayers },
      });
    } catch {
      setError('Could not create room. Try again.');
      setCreatingRoom(null);
    }
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) return;
    navigate(`/battle/${roomCode.toUpperCase()}`, { state: { isHost: false } });
  };

  const addCard = () => setCards([...cards, { question: '', answer: '' }]);
  const updateCard = (i: number, field: 'question' | 'answer', value: string) => {
    const updated = [...cards];
    updated[i][field] = value;
    setCards(updated);
  };
  const removeCard = (i: number) => setCards(cards.filter((_, idx) => idx !== i));

  const handleSaveDeck = async () => {
    setError('');
    const validCards = cards.filter(c => c.question.trim() && c.answer.trim());
    if (!deckTitle.trim() || validCards.length === 0) {
      setError('Add a deck title and at least one complete card');
      return;
    }
    setSaving(true);
    try {
      await decksApi.create(deckTitle.trim(), validCards, username);
      setDeckTitle('');
      setCards([{ question: '', answer: '' }]);
      await fetchDecks();
      setTab('decks');
    } catch {
      setError('Could not save deck. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'decks', label: 'My Decks' },
    { id: 'join', label: 'Join Room' },
    { id: 'new', label: 'New Deck' },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <span className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{username}</span>
          <div className="w-8 h-8 rounded-full bg-sage-50 flex items-center justify-center text-sage-400 text-sm font-medium">
            {username[0].toUpperCase()}
          </div>
          <button onClick={() => { localStorage.clear(); navigate('/'); }} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">sign out</button>
        </div>
      </nav>

      <div className="flex flex-1 max-w-2xl mx-auto w-full px-4 py-10 flex-col">
        <div className="flex gap-6 border-b border-gray-100 mb-8">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(''); }}
              className={`pb-3 text-sm transition-colors border-b-2 -mb-px ${tab === t.id ? 'border-sage-400 text-sage-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

        {/* MY DECKS */}
        {tab === 'decks' && (
          <div>
            {/* Player count picker */}
            <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-400">Players per room</span>
              <div className="flex gap-2 ml-auto">
                {[2, 3, 4].map(n => (
                  <button key={n} onClick={() => setMaxPlayers(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${maxPlayers === n ? 'bg-sage-400 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-sage-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {decksLoading ? (
              <div className="text-sm text-gray-300 text-center py-16">Loading decks…</div>
            ) : decks.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-300 text-sm mb-4">No decks yet.</p>
                <button onClick={() => setTab('new')} className="text-sm text-sage-400 hover:text-sage-600 transition-colors">Create your first deck →</button>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map(deck => (
                  <div key={deck.deckId} className="border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-200 transition-colors">
                    <div>
                      <div className="font-serif text-gray-900">{deck.title}</div>
                      <div className="text-xs text-gray-300 mt-0.5">{deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/study/${deck.deckId}`, { state: { deck } })}
                        className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                        Study
                      </button>
                      <button onClick={() => handleCreateRoom(deck)} disabled={creatingRoom === deck.deckId}
                        className="text-xs bg-sage-400 hover:bg-sage-600 text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex items-center gap-1">
                        {creatingRoom === deck.deckId ? '…' : <>Race ({maxPlayers}p)</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* JOIN ROOM */}
        {tab === 'join' && (
          <div className="max-w-sm">
            <label className="text-xs text-gray-400 block mb-2">Room code</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-4 py-3 font-serif text-2xl tracking-widest text-center focus:outline-none focus:border-sage-400 mb-4 uppercase"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              placeholder="A1B2"
              maxLength={4}
            />
            <button onClick={handleJoinRoom} className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors">
              Join room →
            </button>
          </div>
        )}

        {/* NEW DECK */}
        {tab === 'new' && (
          <div>
            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-2">Deck title</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-sage-400 font-serif"
                value={deckTitle}
                onChange={e => setDeckTitle(e.target.value)}
                placeholder="CS Fundamentals"
              />
            </div>
            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-3">Cards</label>
              <div className="space-y-3">
                {cards.map((card, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-300">Card {i + 1}</span>
                      {cards.length > 1 && (
                        <button onClick={() => removeCard(i)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">remove</button>
                      )}
                    </div>
                    <input
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:border-sage-400 bg-white font-serif"
                      value={card.question}
                      onChange={e => updateCard(i, 'question', e.target.value)}
                      placeholder="Question"
                    />
                    <input
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-sage-400 bg-white"
                      value={card.answer}
                      onChange={e => updateCard(i, 'answer', e.target.value)}
                      placeholder="Answer"
                    />
                  </div>
                ))}
              </div>
              <button onClick={addCard} className="mt-3 text-sm text-sage-400 hover:text-sage-600 transition-colors">+ Add card</button>
            </div>
            <button onClick={handleSaveDeck} disabled={saving}
              className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save deck'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}