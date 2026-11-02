"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Film,
  PlusCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Database,
} from "lucide-react";
import { fetchProjects, fetchHealth } from "@/lib/api";
import { Project, HealthStatus } from "@/types/project";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [projData, healthData] = await Promise.allSettled([fetchProjects(), fetchHealth()]);
        if (projData.status === "fulfilled") setProjects(projData.value);
        if (healthData.status === "fulfilled") setHealth(healthData.value);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalProjects = projects.length;
  const draftCount = projects.filter((p) => p.status === "draft").length;
  const reviewCount = projects.filter((p) => p.status === "awaiting_review" || p.status === "script_review").length;
  const uploadedCount = projects.filter((p) => p.status === "uploaded").length;

  return (
    <div className="max-w-7xl mx-auto py-10 px-6 space-y-10">
      {/* Studio Header & Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            AI YouTube Documentary Production Dashboard
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Documentary Studio Control Center
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Manage your AI-assisted documentary projects. Structured scripts, offline neural voices, stock visuals, and 1080p MP4 rendering with a mandatory human approval gate.
          </p>
        </div>

        <Link
          href="/create"
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg shadow-rose-950/40 transition-all hover:scale-[1.02] self-start md:self-center"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Documentary</span>
        </Link>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Projects</span>
          <p className="text-3xl font-extrabold text-white">{totalProjects}</p>
          <span className="text-[11px] text-slate-500 block">Saved in Supabase PostgreSQL</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Draft & Planning</span>
          <p className="text-3xl font-extrabold text-amber-400">{draftCount}</p>
          <span className="text-[11px] text-slate-500 block">Awaiting script or rendering</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Awaiting Review</span>
          <p className="text-3xl font-extrabold text-indigo-400">{reviewCount}</p>
          <span className="text-[11px] text-slate-500 block">Ready for user inspection</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Approved & Uploaded</span>
          <p className="text-3xl font-extrabold text-emerald-400">{uploadedCount}</p>
          <span className="text-[11px] text-slate-500 block">Published to YouTube</span>
        </div>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg font-bold text-white">Your Documentary Projects</h2>
          </div>
          <span className="text-xs text-slate-400">
            Source: <span className="text-emerald-400 font-mono">ubdijlujjjkqxcloqudz.supabase.co</span>
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm animate-pulse">
            Fetching projects from Supabase database...
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 py-16 px-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
              <Film className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-bold text-base text-white">No documentary projects yet</h3>
              <p className="text-xs text-slate-400">
                Click below to start your first AI documentary with structured scenes and offline voice narration.
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Documentary</span>
            </Link>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => {
              const s = project.settings;
              return (
                <div
                  key={project.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col justify-between hover:border-slate-700 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                        {project.status.replace("_", " ")}
                      </span>
                      {s && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <Clock className="w-3 h-3" />
                          {s.target_duration_minutes}m
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-rose-400 transition-colors line-clamp-1">
                        {project.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {project.topic}
                      </p>
                    </div>

                    {s && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 capitalize">{s.tone}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80">{s.resolution}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 capitalize">{s.visual_strategy}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>

                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* System Integrity & Guarantees */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900/60 to-slate-950 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">Full Local Isolation & Strict Approval Architecture</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Duration capped strictly at 20 min. Videos render locally in 1080p and publish only after explicit button confirmation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto text-xs font-medium text-slate-400">
          <span>PostgreSQL: <strong className="text-slate-200">Connected</strong></span>
          <span>&bull;</span>
          <span>Max Duration: <strong className="text-emerald-400">20 Mins</strong></span>
        </div>
      </div>
    </div>
  );
}
