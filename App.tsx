import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Token {
  id: string;
  number: number;
  customerName: string;
  service: string;
  status: "waiting" | "serving" | "completed" | "skipped";
  createdAt: Date;
  servedAt?: Date;
}

const SERVICES = [
  { id: "haircut", label: "💇 Haircut", duration: 30, color: "rose" },
  { id: "coloring", label: "🎨 Hair Coloring", duration: 90, color: "violet" },
  { id: "styling", label: "✨ Blow Dry & Styling", duration: 45, color: "amber" },
  { id: "facial", label: "🧖 Facial", duration: 45, color: "emerald" },
  { id: "manicure", label: "💅 Manicure", duration: 30, color: "pink" },
  { id: "pedicure", label: "🦶 Pedicure", duration: 45, color: "cyan" },
  { id: "massage", label: "💆 Massage", duration: 60, color: "indigo" },
  { id: "waxing", label: "🕯️ Waxing", duration: 30, color: "orange" },
];

const STORAGE_KEY = "salon-tokens";

// ─── Sound Utility ──────────────────────────────────────────────────────────
function playBeep(frequency = 800, duration = 200, type: OscillatorType = "sine") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch { /* audio not supported */ }
}

function playCallSound() {
  playBeep(880, 150, "sine");
  setTimeout(() => playBeep(1100, 250, "sine"), 180);
}

function playGenerateSound() {
  playBeep(600, 100, "triangle");
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function loadTokens(): Token[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((t: Token) => ({ ...t, createdAt: new Date(t.createdAt), servedAt: t.servedAt ? new Date(t.servedAt) : undefined }));
  } catch {
    return [];
  }
}

function saveTokens(tokens: Token[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [tokens, setTokens] = useState<Token[]>(loadTokens);
  const [customerName, setCustomerName] = useState("");
  const [selectedService, setSelectedService] = useState(SERVICES[0].id);
  const [nextNumber, setNextNumber] = useState(1);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Persist tokens
  useEffect(() => {
    saveTokens(tokens);
  }, [tokens]);

  // Compute next token number on mount
  useEffect(() => {
    const nums = tokens.map((t) => t.number);
    if (nums.length > 0) setNextNumber(Math.max(...nums) + 1);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────
  const generateToken = useCallback(() => {
    const name = customerName.trim() || "Walk-in Guest";
    const token: Token = {
      id: generateId(),
      number: nextNumber,
      customerName: name,
      service: selectedService,
      status: "waiting",
      createdAt: new Date(),
    };
    setTokens((prev) => [...prev, token]);
    setNextNumber((n) => n + 1);
    setCustomerName("");
    setSelectedService(SERVICES[0].id);
    playGenerateSound();
    nameInputRef.current?.focus();
  }, [customerName, selectedService, nextNumber]);

  const callNext = useCallback(() => {
    setTokens((prev) => {
      // Mark any currently serving as completed
      const updated = prev.map((t) =>
        t.status === "serving" ? { ...t, status: "completed" as const, servedAt: new Date() } : t
      );
      // Find first waiting token
      const nextIdx = updated.findIndex((t) => t.status === "waiting");
      if (nextIdx === -1) return updated;
      updated[nextIdx] = { ...updated[nextIdx], status: "serving" as const };
      playCallSound();
      return updated;
    });
  }, []);

  const completeCurrent = useCallback(() => {
    setTokens((prev) =>
      prev.map((t) =>
        t.status === "serving" ? { ...t, status: "completed" as const, servedAt: new Date() } : t
      )
    );
  }, []);

  const skipCurrent = useCallback(() => {
    setTokens((prev) =>
      prev.map((t) =>
        t.status === "serving" ? { ...t, status: "skipped" as const } : t
      )
    );
  }, []);

  const cancelToken = useCallback((id: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setTokens((prev) => prev.filter((t) => t.status === "waiting" || t.status === "serving"));
  }, []);

  // ─── Derived data ───────────────────────────────────────────────────────
  const currentToken = tokens.find((t) => t.status === "serving");
  const waitingTokens = tokens.filter((t) => t.status === "waiting");
  const completedTokens = tokens.filter((t) => t.status === "completed");
  const skippedTokens = tokens.filter((t) => t.status === "skipped");
  const historyTokens = [...completedTokens, ...skippedTokens].sort(
    (a, b) => (b.servedAt?.getTime() || 0) - (a.servedAt?.getTime() || 0)
  );

  const currentService = SERVICES.find((s) => s.id === currentToken?.service);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") generateToken();
  };

  // ─── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-rose-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-200">
              <span className="text-2xl">💈</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">Glamour Salon</h1>
              <p className="text-xs text-slate-500">Token Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-600">
              {waitingTokens.length} waiting
            </span>
            {historyTokens.length > 0 && (
              <button
                onClick={clearHistory}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Clear History
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* ── Now Serving ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-8 shadow-2xl">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-widest text-rose-300">Now Serving</p>
              {currentToken ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-7xl font-black tabular-nums text-white drop-shadow-lg">
                      {String(currentToken.number).padStart(3, "0")}
                    </span>
                    <span className="rounded-full bg-rose-500/30 px-3 py-1 text-sm font-medium text-rose-200">
                      {currentService?.label || currentToken.service}
                    </span>
                  </div>
                  <p className="text-lg font-medium text-white">{currentToken.customerName}</p>
                </>
              ) : (
                <div className="space-y-1">
                  <span className="text-5xl font-black text-slate-500">---</span>
                  <p className="text-slate-400">No customer being served</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={callNext}
                disabled={waitingTokens.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Call Next
              </button>
              {currentToken && (
                <>
                  <button
                    onClick={completeCurrent}
                    className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    ✅ Mark Complete
                  </button>
                  <button
                    onClick={skipCurrent}
                    className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-white/20"
                  >
                    ⏭️ Skip
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Generate Token Form */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">🎫</span>
                Generate Token
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Customer Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter name or leave blank for walk-in"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Service</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICES.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => setSelectedService(svc.id)}
                        className={`rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all ${
                          selectedService === svc.id
                            ? "bg-rose-100 text-rose-700 ring-2 ring-rose-300"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className="block">{svc.label}</span>
                        <span className="text-[10px] opacity-60">{svc.duration} min</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-xs text-amber-700">Next token number</p>
                  <p className="text-4xl font-black tabular-nums text-amber-500">{String(nextNumber).padStart(3, "0")}</p>
                </div>
                <button
                  onClick={generateToken}
                  className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 py-3.5 font-semibold text-white shadow-lg shadow-rose-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                >
                  🎫 Generate Token
                </button>
              </div>
            </div>
          </div>

          {/* Right: Queue / History */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-rose-100 bg-white shadow-sm">
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`flex-1 px-4 py-3.5 text-sm font-semibold transition ${
                    activeTab === "queue"
                      ? "border-b-2 border-rose-500 text-rose-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  🕐 Waiting Queue ({waitingTokens.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 px-4 py-3.5 text-sm font-semibold transition ${
                    activeTab === "history"
                      ? "border-b-2 border-rose-500 text-rose-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  📋 History ({historyTokens.length})
                </button>
              </div>

              {/* Queue Content */}
              {activeTab === "queue" && (
                <div className="divide-y divide-slate-50">
                  {waitingTokens.length === 0 && (
                    <div className="flex flex-col items-center py-12 text-slate-400">
                      <span className="text-5xl">☕</span>
                      <p className="mt-3 text-sm font-medium">No customers waiting</p>
                      <p className="text-xs">Generate a token to get started</p>
                    </div>
                  )}
                  {waitingTokens.map((token, idx) => {
                    const svc = SERVICES.find((s) => s.id === token.service);
                    return (
                      <div
                        key={token.id}
                        className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50"
                      >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold tabular-nums text-slate-700">
                          {String(token.number).padStart(3, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{token.customerName}</p>
                          <p className="text-xs text-slate-500">
                            {svc?.label || token.service} &middot; ~{svc?.duration || "?"} min
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">#{idx + 1} in queue</span>
                        <button
                          onClick={() => cancelToken(token.id)}
                          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                          title="Cancel"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* History Content */}
              {activeTab === "history" && (
                <div className="divide-y divide-slate-50">
                  {historyTokens.length === 0 && (
                    <div className="flex flex-col items-center py-12 text-slate-400">
                      <span className="text-5xl">📋</span>
                      <p className="mt-3 text-sm font-medium">No history yet</p>
                      <p className="text-xs">Completed tokens will appear here</p>
                    </div>
                  )}
                  {historyTokens.map((token) => {
                    const svc = SERVICES.find((s) => s.id === token.service);
                    const isCompleted = token.status === "completed";
                    return (
                      <div
                        key={token.id}
                        className="flex items-center gap-4 px-5 py-3.5"
                      >
                        <span
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {String(token.number).padStart(3, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{token.customerName}</p>
                          <p className="text-xs text-slate-500">{svc?.label || token.service}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isCompleted
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-amber-100 text-amber-600"
                            }`}
                          >
                            {isCompleted ? "✓ Done" : "Skipped"}
                          </span>
                          {token.servedAt && (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {token.servedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{completedTokens.length}</p>
                <p className="text-[10px] font-medium uppercase text-emerald-500">Completed</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{waitingTokens.length}</p>
                <p className="text-[10px] font-medium uppercase text-amber-500">Waiting</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-center">
                <p className="text-2xl font-bold text-rose-600">{skippedTokens.length}</p>
                <p className="text-[10px] font-medium uppercase text-rose-500">Skipped</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-rose-100 py-6 text-center">
        <p className="text-xs text-slate-400">💈 Glamour Salon &copy; {new Date().getFullYear()} &mdash; Token Management System</p>
      </footer>
    </div>
  );
}
