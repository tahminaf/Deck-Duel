import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { decksApi } from '../lib/api';

interface Card { question: string; answer: string }
interface Deck { deckId: string; title: string; cards: Card[] }

export default function EditDeckPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const deck = state?.deck as Deck | undefined;

  if (!deck) return <Navigate to="/home" replace />;

  const [title, setTitle] = useState(deck.title);
  const [cards, setCards] = useState<Card[]>(deck.cards.map(c => ({ ...c })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateCard = (i: number, field: 'question' | 'answer', value: string) => {
    const updated = [...cards];
    updated[i] = { ...updated[i], [field]: value };
    setCards(updated);
  };

  const addCard = () => setCards([...cards, { question: '', answer: '' }]);

  const removeCard = (i: number) => {
    if (cards.length === 1) return;
    setCards(cards.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setError('');
    const validCards = cards.filter(c => c.question.trim() && c.answer.trim());
    if (!title.trim() || validCards.length === 0) {
      setError('Add a deck title and at least one complete card.');
      return;
    }
    setSaving(true);
    try {
      await decksApi.update(deck.deckId, title.trim(), validCards);
      navigate('/home');
    } catch {
      setError('Could not save changes. Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <button onClick={() => navigate('/home')} className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></button>
        <button onClick={() => navigate('/home')} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">← back</button>
      </nav>

      <div className="flex flex-1 max-w-2xl mx-auto w-full px-4 py-10 flex-col">
        <div className="mb-8">
          <p className="text-xs text-gray-300 uppercase tracking-widest mb-1">Edit deck</p>
          <h1 className="font-serif text-2xl font-medium text-gray-900">{deck.title}</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
        )}

        <div className="mb-6">
          <label className="text-xs text-gray-400 block mb-2">Deck title</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-sage-400 font-serif"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Deck title"
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
          <button onClick={addCard} className="mt-3 text-sm text-sage-400 hover:text-sage-600 transition-colors">
            + Add card
          </button>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-3 text-sm transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
