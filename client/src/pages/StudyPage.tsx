import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { decksApi } from '../lib/api';

interface Card {
  question: string;
  answer: string;
}

interface Deck {
  deckId: string;
  title: string;
  cards: Card[];
}

export default function StudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(state?.deck ?? null);
  const [loading, setLoading] = useState(!state?.deck);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // track which cards have been seen (flipped at least once)
  const [seen, setSeen] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!deck && deckId) {
      decksApi.getById(deckId)
        .then(res => setDeck(res.data.deck))
        .catch(() => navigate('/home'))
        .finally(() => setLoading(false));
    }
  }, [deckId, deck, navigate]);

  const cards = deck?.cards ?? [];
  const total = cards.length;
  const card = cards[index];

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setFlipped(false);
  }, []);

  const prev = () => { if (index > 0) goTo(index - 1); };
  const next = () => { if (index < total - 1) goTo(index + 1); };

  const handleFlip = () => {
    if (!flipped) setSeen(s => new Set(s).add(index));
    setFlipped(f => !f);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip(); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, flipped, total]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-sm text-gray-300">Loading deck…</span>
      </div>
    );
  }

  if (!deck) return null;

  const seenCount = seen.size;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <button onClick={() => navigate('/home')} className="font-serif text-xl tracking-tight">
          Deck<span className="text-sage-400">Duel</span>
        </button>
        <button
          onClick={() => navigate('/home')}
          className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
        >
          ← back
        </button>
      </nav>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Deck title + progress */}
          <div className="flex justify-between items-baseline mb-6">
            <h1 className="font-serif text-xl text-gray-900">{deck.title}</h1>
            <span className="text-sm text-gray-300">
              {index + 1} / {total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full mb-8">
            <div
              className="h-1 bg-sage-400 rounded-full transition-all duration-300"
              style={{ width: `${(seenCount / total) * 100}%` }}
            />
          </div>

          {/* Flashcard */}
          <div
            className="relative w-full cursor-pointer select-none"
            style={{ perspective: '1200px', height: '280px' }}
            onClick={handleFlip}
          >
            <div
              className="absolute inset-0 transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front — question */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-8 py-10 shadow-sm"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-xs text-gray-300 uppercase tracking-widest mb-4">Question</div>
                <p className="font-serif text-2xl text-gray-900 text-center leading-relaxed">
                  {card?.question}
                </p>
                <div className="mt-6 text-xs text-gray-200">click or press Space to reveal</div>
              </div>

              {/* Back — answer */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-sage-100 bg-sage-50 px-8 py-10 shadow-sm"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="text-xs text-sage-400 uppercase tracking-widest mb-4">Answer</div>
                <p className="font-serif text-2xl text-gray-900 text-center leading-relaxed">
                  {card?.answer}
                </p>
                <div className="mt-6 text-xs text-sage-400">click to flip back</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={prev}
              disabled={index === 0}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 disabled:text-gray-200 transition-colors"
            >
              ← prev
            </button>

            <div className="flex gap-1.5">
              {cards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === index
                      ? 'bg-sage-400'
                      : seen.has(i)
                      ? 'bg-sage-100'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              disabled={index === total - 1}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 disabled:text-gray-200 transition-colors"
            >
              next →
            </button>
          </div>

          <p className="text-center text-xs text-gray-200 mt-4">
            ← → arrow keys to navigate · Space to flip
          </p>
        </div>
      </div>
    </div>
  );
}
