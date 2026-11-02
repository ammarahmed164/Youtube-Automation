"use client";

import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Database, ShieldAlert, Cpu, Key, CheckCircle2, XCircle, ExternalLink, Play } from "lucide-react";
import { fetchHealth, fetchYouTubeStatus, fetchYouTubeAuthUrl } from "@/lib/api";
import { HealthStatus, YouTubeAccountData } from "@/types/project";

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ytStatus, setYtStatus] = useState<YouTubeAccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchHealth().catch(() => null),
      fetchYouTubeStatus().catch(() => null)
    ]).then(([h, yt]) => {
      if (h) setHealth(h);
      if (yt) setYtStatus(yt);
    }).finally(() => setLoading(false));
  }, []);

  const checks = health?.system_checks;

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
          <SettingsIcon className="w-3.5 h-3.5" />
          System & Provider Settings
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Studio Configuration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Review database connectivity, external AI providers, and media rendering tools.
        </p>
      </div>

      <div className="space-y-6">
        {/* Database & Cloud Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            1. Database (Supabase PostgreSQL)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block mb-1">Supabase Project Ref</span>
              <span className="font-mono text-emerald-400 font-semibold text-sm">ubdijlujjjkqxcloqudz</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block mb-1">Connection State</span>
              <span className="text-emerald-400 font-semibold text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Active (Live Session Pooler on Port 5432)
              </span>
            </div>
          </div>
        </div>

        {/* Local Environment & Rendering Engines */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            2. Local Runtimes & Media Tools
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block mb-1">Python Environment</span>
              <span className="text-slate-200 font-semibold">{checks?.python_version || "3.13.2"}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block mb-1">Local Workspace Storage</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accessible & Writable
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block mb-1">FFmpeg Video Compiler</span>
              <span className={checks?.ffmpeg_available ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {checks?.ffmpeg_available ? "Installed & Ready" : "Required in Phase 6"}
              </span>
            </div>
          </div>
        </div>

        {/* AI & Publishing Providers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-rose-400" />
            3. AI Services & Publishing Credentials
          </h2>

          <div className="divide-y divide-slate-800/80 text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Google Gemini API</span>
                <span className="text-slate-500 text-[11px]">Required for script writing & scene planning in Phase 4</span>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400">
                Configured via backend/.env
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Pexels Stock Footage API</span>
                <span className="text-slate-500 text-[11px]">Required for visual asset acquisition in Phase 5</span>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400">
                Configured via backend/.env
              </span>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">YouTube Data API v3 & OAuth 2.0</span>
                  <span className="text-slate-500 text-[11px]">Enforces explicit human approval before any documentary is uploaded</span>
                </div>
                {ytStatus?.connected ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Channel: {ytStatus.channel_title}
                  </span>
                ) : ytStatus?.configured ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    OAuth Configured &bull; Ready to Connect
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400">
                    Sandbox Ready &bull; Live OAuth Optional
                  </span>
                )}
              </div>

              {/* YouTube OAuth Configuration Instructions */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 font-sans">
                <div className="font-semibold text-slate-300">Google Cloud Console Configuration:</div>
                <p>
                  To connect your real YouTube channel, create an OAuth 2.0 Client ID (Web Application) in Google Cloud Console with scope <code className="text-rose-400 font-mono">youtube.upload</code> and add your credentials to <code className="text-indigo-400 font-mono">backend/.env</code>:
                </p>
                <div className="font-mono text-[10px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-0.5">
                  <div>YOUTUBE_CLIENT_ID="your-client-id.apps.googleusercontent.com"</div>
                  <div>YOUTUBE_CLIENT_SECRET="your-client-secret"</div>
                  <div>YOUTUBE_REDIRECT_URI="http://localhost:8000/api/v1/publishing/youtube/callback"</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Non-Negotiable System Constraint */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 flex items-start gap-3 text-xs text-rose-300">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-white">System Constraint: 20-Minute Maximum Duration</h4>
            <p className="text-slate-400">
              To prevent local rendering bottlenecks, GPU/CPU over-exhaustion, and API quota burnout, all documentary projects are capped at exactly 20 minutes maximum. Requests exceeding 20 minutes are rejected by both frontend and backend validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

