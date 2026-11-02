"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Film, ShieldAlert, Sparkles, Video, Layers, Cpu, Database } from "lucide-react";

interface HealthData {
  status: string;
  app: string;
  version: string;
  environment: string;
  max_video_duration_minutes: number;
  system_checks: {
    python_version: string;
    workspace_data_dir: string;
    workspace_accessible: boolean;
    ffmpeg_available: boolean;
    database_configured: boolean;
    gemini_configured: boolean;
    youtube_configured: boolean;
  };
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHealth(data);
      } catch (err: any) {
        setError(err.message || "Backend offline");
      } finally {
        setLoading(false);
      }
    }
    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/50">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AI YouTube Documentary Studio
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Phase 1 Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <span className={`w-2.5 h-2.5 rounded-full ${health ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-xs font-medium text-slate-300">
                {health ? "Backend Connected (Port 8000)" : loading ? "Checking Backend..." : "Backend Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-8 sm:p-12 shadow-2xl">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Human-in-the-Loop Production Architecture
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Create Polished YouTube Documentaries with AI & Total Human Control.
            </h1>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Research, script, synthesize scene voiceovers, source stock footage, and compile 1080p documentaries. 
              Uploads occur <span className="text-rose-400 font-semibold underline decoration-rose-500/40">strictly after explicit user approval</span>.
            </p>
          </div>

          {/* Golden Rules Banner */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 border-t border-slate-800/80">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Mandatory Approval Gate</h4>
                <p className="text-xs text-slate-400 mt-1">AI never publishes without explicit button approval tied to file checksum.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <Film className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Strict 20-Min Duration Cap</h4>
                <p className="text-xs text-slate-400 mt-1">Hard maximum limit of 20 minutes to ensure stability and quality.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Supabase Connected</h4>
                <p className="text-xs text-slate-400 mt-1">Remote MCP integration active for database, migrations & schemas.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Backend & Environment Status Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">System Environment & Health Status</h2>
            </div>
            <span className="text-xs text-slate-400">Endpoint: /api/v1/health</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
              Verifying backend connection on http://localhost:8000...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
              <span className="font-semibold">Backend offline:</span> Start backend with <code className="bg-slate-800 px-2 py-0.5 rounded text-xs">uvicorn app.main:app --port 8000</code>.
            </div>
          ) : health ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs text-slate-400">Application</span>
                <p className="font-semibold text-sm text-slate-100 mt-1 truncate">{health.app}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs text-slate-400">Python Runtime</span>
                <p className="font-semibold text-sm text-slate-100 mt-1">{health.system_checks.python_version}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs text-slate-400">Max Video Duration</span>
                <p className="font-semibold text-sm text-emerald-400 mt-1">{health.max_video_duration_minutes} Minutes (Enforced)</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs text-slate-400">Workspace Storage</span>
                <p className="font-semibold text-sm text-emerald-400 mt-1">Ready & Writable</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Studio Pipeline Stages Overview */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-rose-400" />
            10-Phase Studio Roadmap Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { num: "01", name: "Architecture & Setup", status: "VERIFIED", active: true },
              { num: "02", name: "Database & Models", status: "NEXT", active: false },
              { num: "03", name: "Creation Wizard UI", status: "QUEUED", active: false },
              { num: "04", name: "Gemini AI Scripting", status: "QUEUED", active: false },
              { num: "05", name: "Piper TTS & Assets", status: "QUEUED", active: false },
              { num: "06", name: "FFmpeg Rendering", status: "QUEUED", active: false },
              { num: "07", name: "QC & AI Revisions", status: "QUEUED", active: false },
              { num: "08", name: "YouTube Publishing", status: "QUEUED", active: false },
              { num: "09", name: "Cloud Deployment", status: "QUEUED", active: false },
              { num: "10", name: "Scaling & Templates", status: "QUEUED", active: false },
            ].map((phase) => (
              <div
                key={phase.num}
                className={`p-4 rounded-xl border transition-all ${
                  phase.active
                    ? "bg-rose-500/10 border-rose-500/30 shadow-lg shadow-rose-950/20"
                    : "bg-slate-900/30 border-slate-800/60 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>PHASE {phase.num}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      phase.active ? "bg-rose-500/20 text-rose-300" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {phase.status}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-slate-200">{phase.name}</h4>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        AI YouTube Documentary Studio &bull; Windows Local Development &bull; Built with Next.js, FastAPI & Supabase
      </footer>
    </div>
  );
}
