"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Link from "next/link";
import { getApiBase } from "../../../lib/auth";

interface GameChoice {
  id: number;
  text: string;
  intensity: number;
  staminaCost: number;
  arousalGain: number;
}

interface GameState {
  phase: string;
  arousal: number;
  stamina: number;
  round: number;
  description: string;
  choices: GameChoice[];
  climaxAchieved: boolean;
  climaxCount: number;
  sessionComplete: boolean;
  version: number;
  imageUrl?: string;
}

interface SessionInfo {
  characterName: string;
  characterImageUrl?: string;
  relationshipType: string;
  scenario: string;
  language: string;
  intensity: number;
  version?: number;
}

interface CharacterSummary {
  id: string;
  name: string;
  imageUrl?: string | null;
}

const PHASE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  FOREPLAY: { label: "Foreplay", color: "text-pink-300", emoji: "💋" },
  BUILD_UP: { label: "Building Up", color: "text-rose-300", emoji: "🔥" },
  ACT: { label: "In the Act", color: "text-red-300", emoji: "💗" },
  INTENSE_ACT: { label: "Intense", color: "text-orange-300", emoji: "💥" },
  CLIMAX: { label: "Climax", color: "text-yellow-300", emoji: "✨" },
  AFTERCARE: { label: "Aftercare", color: "text-blue-300", emoji: "💙" },
};

export default function SexGamePage() {
  const [setupMode, setSetupMode] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [climaxFlash, setClimaxFlash] = useState(false);
  const [history, setHistory] = useState<
    Array<{ phase: string; choice: string; description: string; round: number }>
  >([]);

  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);

  const [characterId, setCharacterId] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [language, setLanguage] = useState<"ENGLISH" | "BANGLA">("ENGLISH");
  const [relationshipType, setRelationshipType] = useState("partner");
  const [scenario, setScenario] = useState("");
  const [intensity, setIntensity] = useState(7);
  const [generateImage, setGenerateImage] = useState(false);

  const descriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    if (game?.climaxAchieved) {
      setClimaxFlash(true);
      const t = setTimeout(() => setClimaxFlash(false), 2000);
      return () => clearTimeout(t);
    }
  }, [game?.climaxAchieved]);

  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.scrollTop = 0;
    }
  }, [game?.description]);

  const loadCharacters = async () => {
    setCharactersLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${getApiBase()}/api/characters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.characters || [];
      setCharacters(
        list.map((c: any) => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl,
        })),
      );
    } catch {
      setCharacters([]);
    } finally {
      setCharactersLoading(false);
    }
  };

  const startGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${getApiBase()}/api/sex-game/start`,
        {
          characterName: characterName || "Your Partner",
          characterId: characterId || undefined,
          relationshipType: relationshipType || "partner",
          scenario:
            scenario ||
            `${characterName || "Your partner"} is already dripping and begging to be fucked`,
          intensity,
          language,
          generateImage,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setSessionId(res.data.sessionId);
      setSessionInfo(res.data.session);
      setGame(res.data.game);
      setHistory([]);
      setSetupMode(false);
      setPlaying(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  const makeChoice = async (choiceId: number) => {
    if (!sessionId || !game) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${getApiBase()}/api/sex-game/act`,
        {
          sessionId,
          choiceId,
          version: game.version,
          generateImage,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.data.error) {
        setError(res.data.error);
        return;
      }

      const prevChoice = game.choices.find((c) => c.id === choiceId);
      if (prevChoice && game.description) {
        setHistory((h) => [
          ...h,
          {
            phase: game.phase,
            choice: prevChoice.text,
            description: game.description,
            round: game.round,
          },
        ]);
      }

      setGame(res.data.game);
      if (res.data.session) {
        setSessionInfo((s) => ({ ...s!, ...res.data.session }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to process action");
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setSetupMode(true);
    setPlaying(false);
    setSessionId(null);
    setSessionInfo(null);
    setGame(null);
    setHistory([]);
    setError(null);
  };

  const getIntensityBadge = (intensity: number) => {
    if (intensity >= 9) return { label: "🔥 Intense", color: "text-red-300" };
    if (intensity >= 7)
      return { label: "💗 Passionate", color: "text-rose-300" };
    if (intensity >= 5) return { label: "💋 Warm", color: "text-pink-300" };
    return { label: "🌸 Gentle", color: "text-purple-300" };
  };

  const phaseMeta = game
    ? PHASE_LABELS[game.phase] || {
        label: game.phase,
        color: "text-gray-300",
        emoji: "💫",
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      {climaxFlash && (
        <div className="fixed inset-0 bg-yellow-400/20 z-50 pointer-events-none animate-pulse" />
      )}

      <nav className="bg-black/50 backdrop-blur border-b border-purple-500/20 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"
          >
            ← Sex Game
          </Link>
          {playing && (
            <button
              onClick={resetGame}
              className="text-sm text-gray-400 hover:text-white transition min-h-[44px]"
            >
              New Game
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4 mb-6 text-red-300">
            {typeof error === "string" ? error : JSON.stringify(error)}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {setupMode && (
          <div className="bg-gray-800/50 backdrop-blur border border-purple-500/20 rounded-2xl p-8 space-y-6">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              Start Hardcore Sex Game
            </h1>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Character (optional)
              </label>
              <select
                value={characterId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCharacterId(id);
                  const c = characters.find((x) => x.id === id);
                  if (c) setCharacterName(c.name);
                }}
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white min-h-[44px]"
              >
                <option value="">— Custom / none —</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {charactersLoading && (
                <p className="text-xs text-gray-500 mt-1">Loading characters…</p>
              )}
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Character Name
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Enter character name"
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "ENGLISH" | "BANGLA")
                }
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white min-h-[44px]"
              >
                <option value="ENGLISH">English</option>
                <option value="BANGLA">Bangla</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Relationship
              </label>
              <input
                type="text"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                placeholder="partner, lover, …"
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Scenario
              </label>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={3}
                placeholder="She is already wet and on her knees…"
                className="w-full bg-gray-700/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Intensity Level: {intensity}/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300 min-h-[44px]">
              <input
                type="checkbox"
                checked={generateImage}
                onChange={(e) => setGenerateImage(e.target.checked)}
              />
              Generate scene images (slower)
            </label>

            <button
              onClick={startGame}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl text-lg transition min-h-[44px]"
            >
              {loading ? "Starting…" : "Start Fucking"}
            </button>
          </div>
        )}

        {playing && game && (
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-purple-500/20 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-400">Playing with</p>
                  <p className="text-xl font-semibold text-pink-300">
                    {sessionInfo?.characterName}
                  </p>
                </div>
                {phaseMeta && (
                  <div className={`text-lg font-medium ${phaseMeta.color}`}>
                    {phaseMeta.emoji} {phaseMeta.label}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">
                    Arousal {game.arousal}/100
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-red-500 transition-all"
                      style={{ width: `${game.arousal}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">
                    Stamina {game.stamina}/100
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                      style={{ width: `${game.stamina}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Round {game.round}
                {game.climaxCount > 0 && ` · Climaxes: ${game.climaxCount}`}
              </p>
            </div>

            {game.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-purple-500/20">
                <img
                  src={game.imageUrl}
                  alt={sessionInfo?.characterName || "Scene"}
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}

            <div
              ref={descriptionRef}
              className="bg-gray-800/60 border border-purple-500/20 rounded-2xl p-6 prose prose-invert max-w-none"
            >
              <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                {game.description}
              </p>
            </div>

            {!game.sessionComplete && game.choices?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-purple-300">
                  What do you do?
                </h3>
                {game.choices.map((choice) => {
                  const badge = getIntensityBadge(choice.intensity);
                  return (
                    <button
                      key={choice.id}
                      disabled={loading || choice.staminaCost > game.stamina}
                      onClick={() => makeChoice(choice.id)}
                      className="w-full text-left bg-gray-800/70 hover:bg-purple-900/40 border border-purple-500/30 disabled:opacity-40 rounded-xl p-4 transition min-h-[44px]"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-gray-100">{choice.text}</span>
                        <span className={`text-xs shrink-0 ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Stamina −{choice.staminaCost} · Arousal +
                        {choice.arousalGain}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {game.sessionComplete && (
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 text-center">
                <p className="text-lg text-blue-200 mb-4">
                  You and{" "}
                  {sessionInfo?.characterName} are a sticky, cum-soaked mess.
                  Thick cream still leaks from used holes as you catch your breath.
                </p>
                <button
                  onClick={resetGame}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl font-medium min-h-[44px]"
                >
                  Play Again
                </button>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-gray-400 hover:text-white min-h-[44px]"
                >
                  {showHistory ? "Hide" : "Show"} history ({history.length})
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                    {history.map((h, i) => (
                      <div
                        key={i}
                        className="text-sm bg-black/30 rounded-lg p-3 border border-gray-700"
                      >
                        <div className="text-purple-400 text-xs">
                          Round {h.round} · {h.phase}
                        </div>
                        <div className="text-gray-300">{h.choice}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="text-center text-purple-300 animate-pulse">
                Generating scene…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
