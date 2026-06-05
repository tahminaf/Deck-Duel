import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';

type GameState = 'lobby' | 'battle' | 'finished';
interface Scores { [username: string]: number }
interface CarPositions { [username: string]: number }

// ── Wordle types & helpers ────────────────────────────────────────────────────
type TileStatus = 'empty' | 'tbd' | 'correct' | 'present' | 'absent';
interface WordleTile { letter: string; status: TileStatus }

const TILE_COLORS: Record<TileStatus, { bg: string; border: string; color: string }> = {
  empty:   { bg: 'white',   border: '#d1d5db', color: '#111' },
  tbd:     { bg: 'white',   border: '#374151', color: '#111' },
  correct: { bg: '#4a7c59', border: '#4a7c59', color: 'white' },
  present: { bg: '#d97706', border: '#d97706', color: 'white' },
  absent:  { bg: '#9ca3af', border: '#9ca3af', color: 'white' },
};

const MAX_WORDLE_GUESSES = 6;

function normalizeWord(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

function evaluateGuess(guess: string, answer: string): WordleTile[] {
  const g = normalizeWord(guess);
  const a = normalizeWord(answer);
  const tiles: WordleTile[] = Array.from({ length: a.length }, (_, i) => ({
    letter: g[i] ?? '',
    status: 'absent' as TileStatus,
  }));
  const used = new Array(a.length).fill(false);
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) { tiles[i].status = 'correct'; used[i] = true; }
  }
  for (let i = 0; i < a.length; i++) {
    if (tiles[i].status === 'correct') continue;
    for (let j = 0; j < a.length; j++) {
      if (!used[j] && g[i] === a[j]) { tiles[i].status = 'present'; used[j] = true; break; }
    }
  }
  return tiles;
}

function WordleGrid({ submitted, currentInput, targetLen, done }: {
  submitted: WordleTile[][];
  currentInput: string;
  targetLen: number;
  done: boolean;
}) {
  const ts = Math.min(44, Math.max(20, Math.floor(280 / targetLen)));
  const rows: WordleTile[][] = [...submitted];
  if (!done && submitted.length < MAX_WORDLE_GUESSES) {
    rows.push(Array.from({ length: targetLen }, (_, i) => ({
      letter: currentInput[i] ?? '',
      status: (currentInput[i] ? 'tbd' : 'empty') as TileStatus,
    })));
  }
  while (rows.length < MAX_WORDLE_GUESSES) {
    rows.push(Array(targetLen).fill({ letter: '', status: 'empty' as TileStatus }));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', userSelect: 'none' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 4 }}>
          {row.map((tile, ci) => {
            const { bg, border, color } = TILE_COLORS[tile.status];
            return (
              <div key={ci} style={{
                width: ts, height: ts, border: `2px solid ${border}`,
                background: bg, color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: ts * 0.42, fontWeight: 700,
                textTransform: 'uppercase', borderRadius: 4, transition: 'all 0.2s',
              }}>
                {tile.letter}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// SVG car colors per lane
const LANE_COLORS = ['#4a7c59', '#5b8dd9', '#e07b54', '#9b59b6'];

// Beautiful inline SVG car
function CarSVG({ color }: { color: string }) {
  return (
    <svg width="56" height="28" viewBox="0 0 56 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="4" y="13" width="46" height="12" rx="5" fill={color} />
      {/* Roof */}
      <path d="M14 13 Q16 5 22 5 H34 Q40 5 42 13 Z" fill={color} />
      {/* Windshield front */}
      <path d="M34 6 Q39 6 41 13 H34 Z" fill="#c8e8f5" opacity="0.85" />
      {/* Windshield back */}
      <path d="M22 6 Q17 6 15 13 H22 Z" fill="#c8e8f5" opacity="0.85" />
      {/* Side windows */}
      <rect x="23" y="6" width="10" height="7" rx="1" fill="#c8e8f5" opacity="0.85" />
      {/* Wheels */}
      <circle cx="14" cy="25" r="4.5" fill="#1a1a1a" />
      <circle cx="14" cy="25" r="2.2" fill="#555" />
      <circle cx="42" cy="25" r="4.5" fill="#1a1a1a" />
      <circle cx="42" cy="25" r="2.2" fill="#555" />
      {/* Headlights */}
      <rect x="48" y="16" width="4" height="3" rx="1.5" fill="#fff9c4" />
      {/* Taillights */}
      <rect x="4" y="16" width="3" height="3" rx="1.5" fill="#ff6b6b" />
      {/* Stripe detail */}
      <rect x="8" y="17" width="36" height="2" rx="1" fill="white" opacity="0.12" />
    </svg>
  );
}

// Animated road stripes
function RoadStripes() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes stripeScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-120px); }
        }
        .road-stripe-anim {
          animation: stripeScroll 0.8s linear infinite;
        }
      `}</style>
      <div className="road-stripe-anim" style={{
        position: 'absolute', top: '50%', left: -120, right: -120,
        height: 3, marginTop: -1.5,
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0, rgba(255,255,255,0.25) 50px, transparent 50px, transparent 110px)',
      }} />
    </div>
  );
}

// The full racetrack component
function RaceTrack({
  players, carPositions, totalQuestions, username, carStates,
}: {
  players: string[];
  carPositions: CarPositions;
  totalQuestions: number;
  username: string;
  carStates: { [p: string]: 'driving' | 'boost' | 'slow' };
}) {
  const laneH = 80;
  const trackH = players.length * laneH;

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', marginBottom: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      border: '1px solid #e5e7eb',
    }}>
      {/* Sky / scenery */}
      <div style={{
        background: 'linear-gradient(180deg, #87ceeb 0%, #b8e4f9 100%)',
        height: 36, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'flex-end', padding: '0 12px 4px',
        gap: 8,
      }}>
        {/* Clouds */}
        {[10, 30, 55, 75, 90].map((left, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${left}%`, bottom: 6,
            background: 'rgba(255,255,255,0.85)', borderRadius: 20,
            width: 40 + (i % 3) * 16, height: 12,
          }} />
        ))}
        {/* Trees silhouette */}
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ fontSize: 14 + (i % 2) * 4, lineHeight: 1, flexShrink: 0 }}>🌲</span>
        ))}
      </div>

      {/* Road */}
      <div style={{
        background: '#2d2d2d',
        position: 'relative',
        minHeight: trackH,
      }}>
        {/* Top edge stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#f5c842' }} />
        {/* Bottom edge stripe */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: '#f5c842' }} />

        {/* Animated road center stripes */}
        <RoadStripes />

        {/* Finish line */}
        <div style={{
          position: 'absolute', right: 48, top: 0, bottom: 0, width: 16,
          background: 'repeating-linear-gradient(180deg,#fff 0,#fff 10px,#111 10px,#111 20px)',
          opacity: 0.9, zIndex: 2,
        }} />
        <div style={{ position: 'absolute', right: 30, top: -2, fontSize: 22, zIndex: 3 }}>🏁</div>

        {/* Lanes */}
        {players.map((player, i) => {
          const rawPct = carPositions[player] ?? 0;
          // Reserve right 60px for finish line — car max left is ~88%
          const trackPct = Math.min(rawPct, 88);
          const color = LANE_COLORS[i % LANE_COLORS.length];
          const isMe = player === username;
          const state = carStates[player] || 'driving';

          // Boost = slight forward bounce, slow = wiggle
          let carAnim = '';
          if (state === 'boost') carAnim = 'boostPulse 0.4s ease-out';
          if (state === 'slow') carAnim = 'slowWiggle 0.5s ease-in-out';

          return (
            <div key={player} style={{
              position: 'relative', height: laneH,
              display: 'flex', alignItems: 'center',
              borderBottom: i < players.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              {/* Lane number */}
              <div style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                width: 22, height: 22, borderRadius: '50%',
                background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: '#fff', zIndex: 2, flexShrink: 0,
              }}>{i + 1}</div>

              {/* Player name tag */}
              <div style={{
                position: 'absolute', left: 38, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: isMe ? color : 'rgba(255,255,255,0.5)',
                fontWeight: isMe ? 600 : 400,
                background: 'rgba(0,0,0,0.45)', borderRadius: 6,
                padding: '2px 7px', zIndex: 2, whiteSpace: 'nowrap',
              }}>
                {player}{isMe ? ' ⭐' : ''}
              </div>

              {/* Car */}
              <style>{`
                @keyframes boostPulse { 0%{transform:translateY(-50%) scale(1)} 50%{transform:translateY(-54%) scale(1.08)} 100%{transform:translateY(-50%) scale(1)} }
                @keyframes slowWiggle { 0%{transform:translateY(-50%)} 25%{transform:translateY(-53%)} 75%{transform:translateY(-47%)} 100%{transform:translateY(-50%)} }
                @keyframes driveIdle { 0%,100%{transform:translateY(-50%)} 50%{transform:translateY(-52%)} }
              `}</style>
              <div style={{
                position: 'absolute',
                left: `calc(${trackPct}% - 28px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                transition: 'left 0.9s cubic-bezier(0.34, 1.3, 0.64, 1)',
                zIndex: 3,
                animation: carAnim || 'driveIdle 0.6s ease-in-out infinite',
                filter: `drop-shadow(0 3px 6px rgba(0,0,0,0.4))`,
              }}>
                <CarSVG color={color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Ground / grass */}
      <div style={{
        background: '#4a7a3a',
        height: 20,
        display: 'flex', alignItems: 'center', paddingLeft: 12, gap: 6, overflow: 'hidden',
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} style={{ fontSize: 12, opacity: 0.7, flexShrink: 0 }}>🌿</span>
        ))}
      </div>
    </div>
  );
}

function TimerBar({ resetKey, active, duration }: { resetKey: number; active: boolean; duration: number }) {
  const [pct, setPct] = useState(100);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPct(100);
    if (!active) return;
    const total = duration * 1000;
    const start = Date.now();
    ref.current = setInterval(() => {
      const remaining = Math.max(0, 100 - ((Date.now() - start) / total) * 100);
      setPct(remaining);
      if (remaining <= 0) clearInterval(ref.current!);
    }, 80);
    return () => clearInterval(ref.current!);
  }, [resetKey, active]);

  const color = pct > 50 ? '#4a7c59' : pct > 20 ? '#f5c842' : '#e05555';
  return (
    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 4, transition: 'width 0.08s linear, background 0.4s',
      }} />
    </div>
  );
}

export default function BattlePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'player';

  const [gameState, setGameState] = useState<GameState>('lobby');
  const [players, setPlayers] = useState<string[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [scores, setScores] = useState<Scores>({});
  const [carPositions, setCarPositions] = useState<CarPositions>({});
  const [carStates, setCarStates] = useState<{ [p: string]: 'driving' | 'boost' | 'slow' }>({});
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playerFinished, setPlayerFinished] = useState(false);
  const [winner, setWinner] = useState('');
  const [error, setError] = useState('');
  const [timerKey, setTimerKey] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState(15);
  const [feedback, setFeedback] = useState<{ correct: boolean; by: string } | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);

  const [gameMode, setGameMode] = useState<'race' | 'wordle'>(state?.gameMode ?? 'race');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [wordleGuesses, setWordleGuesses] = useState<WordleTile[][]>([]);
  const [wordleInput, setWordleInput] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const reactionIdRef = useRef(0);

  const triggerCarState = useCallback((player: string, state: 'boost' | 'slow') => {
    setCarStates(prev => ({ ...prev, [player]: state }));
    setTimeout(() => setCarStates(prev => ({ ...prev, [player]: 'driving' })), 600);
  }, []);

  const { send } = useWebSocket(useCallback((data: any) => {
    switch (data.type) {
      case 'JOINED':
        setPlayers(data.players);
        setMaxPlayers(data.maxPlayers || 2);
        if (data.gameMode) setGameMode(data.gameMode);
        break;

      case 'GAME_STARTING': {
        setPlayers(data.players);
        setMaxPlayers(data.maxPlayers || 2);
        setTotalQuestions(data.totalQuestions || 0);
        setTimePerQuestion(data.timePerQuestion || 15);
        if (data.gameMode) setGameMode(data.gameMode);
        setGameState('battle');
        setHasAnswered(false);
        setTimerKey(k => k + 1);
        const q = state?.deck?.cards?.[0]?.question || data.firstQuestion || '';
        setCurrentQuestion(q);
        setCurrentAnswer(data.firstAnswer || state?.deck?.cards?.[0]?.answer || '');
        if (state?.deck?.cards?.length) setTotalQuestions(state.deck.cards.length);
        const initPos: CarPositions = {};
        data.players.forEach((p: string) => { initPos[p] = 0; });
        setCarPositions(initPos);
        break;
      }

      case 'ANSWER_RESULT':
        setScores(data.scores);
        if (data.carPositions) setCarPositions(data.carPositions);
        setFeedback({ correct: data.isCorrect, by: data.answeredBy });
        triggerCarState(data.answeredBy, data.isCorrect ? 'boost' : 'slow');
        setTimeout(() => setFeedback(null), 1800);

        // Only the answering player advances their question
        if (data.answeredBy === username) {
          setHasAnswered(false);
          setAnswer('');
          if (data.playerFinished) {
            setPlayerFinished(true);
          } else if (data.nextQuestion) {
            setCurrentQuestion(data.nextQuestion.question);
            setCurrentAnswer(data.nextQuestion.answer || state?.deck?.cards?.[data.nextQuestion.index]?.answer || '');
            setQuestionIndex(data.nextQuestion.index);
            setTimerKey(k => k + 1);
          }
        }
        break;

      case 'REACTION':
        spawnReaction(data.emoji);
        break;

      case 'GAME_OVER':
        setScores(data.scores);
        if (data.carPositions) setCarPositions(data.carPositions);
        setWinner(data.winner);
        setTimeout(() => setGameState('finished'), 1800);
        break;

      case 'ERROR':
        setError(data.message);
        break;
    }
  }, [username, state, triggerCarState]));

  useEffect(() => {
    const t = setTimeout(() => send({ action: 'joinRoom', roomCode, username }), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (gameState === 'battle' && !hasAnswered && !playerFinished) inputRef.current?.focus();
  }, [gameState, currentQuestion, hasAnswered, playerFinished]);

  const handleSubmit = () => {
    if (!answer.trim() || hasAnswered || playerFinished) return;
    send({ action: 'submitAnswer', answer });
    setHasAnswered(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const sendReaction = (emoji: string) => {
    send({ action: 'reaction', emoji });
    spawnReaction(emoji);
  };

  const spawnReaction = (emoji: string) => {
    const id = reactionIdRef.current++;
    const x = Math.random() * 60 + 20;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 1500);
  };

  // Reset wordle state on each new question
  useEffect(() => {
    setWordleGuesses([]);
    setWordleInput('');
  }, [questionIndex]);

  const wordleRawAnswer = currentAnswer;
  const wordleAnswer = normalizeWord(wordleRawAnswer);
  const wordleTargetLen = wordleAnswer.length || 1;
  const wordleDone = hasAnswered;

  const submitWordleGuess = useCallback(() => {
    if (wordleInput.length !== wordleTargetLen || hasAnswered || playerFinished) return;
    const result = evaluateGuess(wordleInput, wordleAnswer);
    const isCorrect = normalizeWord(wordleInput) === wordleAnswer;
    setWordleGuesses(prev => {
      const next = [...prev, result];
      if (isCorrect || next.length >= MAX_WORDLE_GUESSES) {
        send({ action: 'submitAnswer', answer: isCorrect ? wordleRawAnswer : wordleInput });
        setHasAnswered(true);
      }
      return next;
    });
    setWordleInput('');
  }, [wordleInput, wordleTargetLen, wordleAnswer, wordleRawAnswer, hasAnswered, playerFinished, send]);

  // Global keyboard capture for wordle mode
  useEffect(() => {
    if (gameMode !== 'wordle' || gameState !== 'battle' || hasAnswered || playerFinished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { submitWordleGuess(); }
      else if (e.key === 'Backspace') { setWordleInput(p => p.slice(0, -1)); }
      else if (/^[a-z]$/i.test(e.key)) {
        setWordleInput(p => p.length < wordleTargetLen ? p + e.key.toLowerCase() : p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameMode, gameState, hasAnswered, playerFinished, submitWordleGuess, wordleTargetLen]);

  // ── LOBBY ──
  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/home')} className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></button>
          <button onClick={() => navigate('/home')} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">← leave</button>
        </nav>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-3xl font-medium text-gray-900 mb-1">Room ready.</h1>
            <p className="text-sm text-gray-400 mb-8">Share the code with your opponents</p>
            <div className="bg-sage-50 rounded-xl p-6 text-center mb-6">
              <div className="font-serif text-5xl font-medium text-sage-400 tracking-widest mb-1">{roomCode}</div>
              <div className="text-xs text-sage-400">room code</div>
            </div>
            {error && <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
            <div className="border border-gray-100 rounded-lg overflow-hidden mb-4">
              {Array.from({ length: maxPlayers }).map((_, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < maxPlayers - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="w-2 h-2 rounded-full" style={{ background: players[i] ? LANE_COLORS[i] : '#e5e7eb' }} />
                  {players[i] ? (
                    <span className="text-sm text-gray-700">
                      {players[i]}{players[i] === username && <span className="text-xs text-sage-400 ml-2">(you)</span>}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300 italic">waiting for player {i + 1}…</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-300 text-center">Race starts when all {maxPlayers} players join</p>
          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED ──
  if (gameState === 'finished') {
    const sortedPlayers = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const isWinner = winner === username;
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/home')} className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></button>
          <button onClick={() => navigate('/home')} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">← home</button>
        </nav>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-lg text-center">
            <div className="text-5xl mb-3">{isWinner ? '🏆' : '🏁'}</div>
            <h1 className="font-serif text-3xl font-medium text-gray-900 mb-2">{isWinner ? 'You won!' : `${winner} wins.`}</h1>
            <p className="text-sm text-gray-400 mb-6">{isWinner ? 'Well raced.' : 'Better luck next time.'}</p>
            <RaceTrack players={players} carPositions={carPositions} totalQuestions={totalQuestions} username={username} carStates={{}} />
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
              {sortedPlayers.map(([player, score], i) => (
                <div key={player} className={`flex justify-between items-center px-5 py-4 ${i < sortedPlayers.length - 1 ? 'border-b border-gray-100' : ''} ${player === winner ? 'bg-sage-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: LANE_COLORS[players.indexOf(player) % LANE_COLORS.length] }} />
                    <span className="text-sm text-gray-700">{player}</span>
                    {player === username && <span className="text-xs text-sage-400">(you)</span>}
                  </div>
                  <span className="font-serif text-2xl text-gray-900">{score}</span>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/home')} className="w-full bg-sage-400 hover:bg-sage-600 text-white rounded-lg py-2.5 text-sm transition-colors">Back to home →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── BATTLE (wordle mode) ──
  if (gameMode === 'wordle') {
    return (
      <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
        <style>{`
          @keyframes floatUp {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-80px) scale(1.5); }
          }
        `}</style>

        {floatingReactions.map(r => (
          <div key={r.id} style={{
            position: 'fixed', bottom: 200, left: `${r.x}%`,
            fontSize: 30, animation: 'floatUp 1.4s ease-out forwards',
            pointerEvents: 'none', zIndex: 50,
          }}>{r.emoji}</div>
        ))}

        <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/home')} className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></button>
          <span className="text-xs text-gray-300 uppercase tracking-widest">Room {roomCode}</span>
        </nav>

        <div className="flex flex-1 flex-col items-center max-w-sm mx-auto w-full px-4 py-8">
          {!playerFinished ? (
            <>
              <div className="text-xs text-gray-300 uppercase tracking-widest mb-4 self-start">
                Question {questionIndex + 1}{totalQuestions > 0 ? ` of ${totalQuestions}` : ''}
              </div>

              <div className="border border-gray-100 rounded-xl p-5 mb-4 bg-gray-50 w-full">
                <p className="font-serif text-lg text-gray-900 leading-relaxed">
                  {currentQuestion || 'Waiting…'}
                </p>
              </div>

              <TimerBar resetKey={timerKey} active={!hasAnswered} duration={timePerQuestion} />

              {feedback && (
                <div className={`rounded-lg px-4 py-2.5 text-sm mb-4 border w-full ${feedback.correct ? 'bg-sage-50 border-sage-100 text-sage-400' : 'bg-red-50 border-red-100 text-red-400'}`}>
                  {feedback.correct ? `✓ ${feedback.by} got it` : `✗ ${feedback.by} got it wrong — keep going`}
                </div>
              )}

              {hasAnswered && !feedback && (
                <div className="rounded-lg px-4 py-2.5 text-sm mb-4 bg-gray-50 border border-gray-100 text-gray-400 w-full">
                  Checking your answer…
                </div>
              )}

              <div className="mb-4">
                <WordleGrid
                  submitted={wordleGuesses}
                  currentInput={wordleInput}
                  targetLen={wordleTargetLen}
                  done={wordleDone}
                />
              </div>

              {!hasAnswered && (
                <p className="text-xs text-gray-300 text-center mb-6">
                  {wordleTargetLen} letter{wordleTargetLen !== 1 ? 's' : ''} · Enter to guess · Backspace to delete
                </p>
              )}
            </>
          ) : (
            <div className="border border-sage-100 rounded-xl p-5 mb-4 bg-sage-50 text-center w-full">
              <div className="font-serif text-xl text-sage-400 mb-1">You finished!</div>
              <p className="text-sm text-gray-400">Waiting for other players…</p>
            </div>
          )}

          {/* Reactions */}
          <div className="flex gap-2 justify-center mt-auto">
            {['🔥', '😭', '💀', '👏', '⚡'].map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)}
                className="bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-full px-3 py-1.5 text-base transition-all hover:scale-110">
                {emoji}
              </button>
            ))}
          </div>

          {error && <div className="mt-3 bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3 w-full">{error}</div>}
        </div>
      </div>
    );
  }

  // ── BATTLE (standard race mode) ──
  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.5); }
        }
      `}</style>

      {floatingReactions.map(r => (
        <div key={r.id} style={{
          position: 'fixed', bottom: 200, left: `${r.x}%`,
          fontSize: 30, animation: 'floatUp 1.4s ease-out forwards',
          pointerEvents: 'none', zIndex: 50,
        }}>{r.emoji}</div>
      ))}

      <nav className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <span className="font-serif text-xl tracking-tight">Deck<span className="text-sage-400">Duel</span></span>
        <span className="text-xs text-gray-300 uppercase tracking-widest">Room {roomCode}</span>
      </nav>

      <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full px-4 py-5">

        {/* Racetrack */}
        <RaceTrack
          players={players}
          carPositions={carPositions}
          totalQuestions={totalQuestions}
          username={username}
          carStates={carStates}
        />

        {/* Score strip */}
        <div className="flex gap-2 mb-4">
          {players.map((player, i) => (
            <div key={player} className="flex-1 border rounded-xl px-3 py-2 transition-colors"
              style={{ borderColor: player === username ? LANE_COLORS[i] : '#f3f4f6', background: player === username ? '#eef4f0' : 'white' }}>
              <div className="text-xs text-gray-400 truncate mb-0.5">{player}</div>
              <div className="font-serif text-2xl font-medium" style={{ color: LANE_COLORS[i % LANE_COLORS.length] }}>
                {scores[player] ?? 0}
              </div>
            </div>
          ))}
        </div>

        {/* Question */}
        {!playerFinished ? (
          <>
            <div className="text-xs text-gray-300 uppercase tracking-widest mb-2">
              Question {questionIndex + 1}{totalQuestions > 0 ? ` of ${totalQuestions}` : ''}
            </div>

            <div className="border border-gray-100 rounded-xl p-5 mb-3 bg-gray-50">
              <p className="font-serif text-lg text-gray-900 leading-relaxed">
                {currentQuestion || 'Waiting…'}
              </p>
            </div>

            <TimerBar resetKey={timerKey} active={!hasAnswered} duration={timePerQuestion} />

            {feedback && (
              <div className={`rounded-lg px-4 py-2.5 text-sm mb-3 border ${feedback.correct ? 'bg-sage-50 border-sage-100 text-sage-400' : 'bg-red-50 border-red-100 text-red-400'}`}>
                {feedback.correct ? `✓ ${feedback.by} answered correctly` : `✗ ${feedback.by} got it wrong — keep going`}
              </div>
            )}

            {hasAnswered && !feedback && (
              <div className="rounded-lg px-4 py-2.5 text-sm mb-3 bg-gray-50 border border-gray-100 text-gray-400">
                Checking your answer…
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input
                ref={inputRef}
                className={`flex-1 border rounded-lg px-4 py-3 text-sm font-serif italic focus:outline-none transition-colors ${hasAnswered ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' : 'border-gray-200 focus:border-sage-400'}`}
                value={answer}
                onChange={e => !hasAnswered && setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasAnswered ? 'Submitted…' : 'Type your answer and hit Enter…'}
                disabled={hasAnswered}
              />
              <button onClick={handleSubmit} disabled={hasAnswered}
                className="bg-sage-400 hover:bg-sage-600 disabled:opacity-40 text-white rounded-lg px-5 py-3 text-sm transition-colors">→</button>
            </div>
          </>
        ) : (
          <div className="border border-sage-100 rounded-xl p-5 mb-3 bg-sage-50 text-center">
            <div className="font-serif text-xl text-sage-400 mb-1">You finished!</div>
            <p className="text-sm text-gray-400">Waiting for other players to finish the race…</p>
          </div>
        )}

        {/* Reactions */}
        <div className="flex gap-2 justify-center">
          {['🔥', '😭', '💀', '👏', '⚡'].map(emoji => (
            <button key={emoji} onClick={() => sendReaction(emoji)}
              className="bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-full px-3 py-1.5 text-base transition-all hover:scale-110">
              {emoji}
            </button>
          ))}
        </div>

        {error && <div className="mt-3 bg-red-50 border border-red-100 text-red-500 text-sm rounded-lg px-4 py-3">{error}</div>}
      </div>
    </div>
  );
}