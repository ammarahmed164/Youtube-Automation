"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Film,
  Clock,
  Sparkles,
  Layers,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Mic,
  Video,
  ShieldAlert,
  Share2,
  Trash2,
} from "lucide-react";
import { fetchProjectById, deleteProject } from "@/lib/api";
import { Project } from "@/types/project";

function WorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetchProjectById(projectId)
      .then((data) => setProject(data))
      .catch((err) => setError(err.message || "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this documentary project from Supabase?")) return;
    setDeleting(true);
    try {
      await deleteProject(projectId);
      router.push("/");
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 px-6 text-center text-slate-400 text-sm animate-pulse">
        Loading project workspace from Supabase...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || "Project not found"}
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const s = project.settings;

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{deleting ? "Deleting..." : "Delete Project"}</span>
        </button>
      </div>

      {/* Project Banner & Meta */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                Project ID: {project.id.slice(0, 8)}...
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                {project.status.replace("_", " ")}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{project.title}</h1>
            <p className="text-slate-400 text-sm leading-relaxed">{project.topic}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 self-start sm:self-center">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Project Configuration Badges */}
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-6 border-t border-slate-800/80 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Duration</span>
              <span className="font-semibold text-emerald-400 mt-0.5 block">{s.target_duration_minutes} Mins</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Format & Aspect</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{s.resolution} &bull; {s.aspect_ratio}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Tone</span>
              <span className="font-semibold text-slate-200 mt-0.5 block capitalize">{s.tone}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Narration Voice</span>
              <span className="font-semibold text-indigo-400 mt-0.5 block truncate">
                {s.narration_preset.replace(/_/g, " ")}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Planning Mode</span>
              <span className="font-semibold text-slate-200 mt-0.5 block capitalize">{s.scene_planning_mode}</span>
            </div>
          </div>
        )}
      </div>

      {/* Production Pipeline Roadmap Stages */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-rose-400" />
          Documentary Production Workspace
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            {
              title: "1. Script & Research",
              desc: "Gemini AI narrative hook & structured scene plan.",
              status: "Phase 4 Ready",
              icon: FileText,
              color: "text-rose-400",
            },
            {
              title: "2. Voice & Assets",
              desc: "Piper TTS audio & Pexels footage hunter.",
              status: "Phase 5",
              icon: Mic,
              color: "text-amber-400",
            },
            {
              title: "3. FFmpeg Rendering",
              desc: "Compile 1080p MP4, transitions, music & subtitles.",
              status: "Phase 6",
              icon: Video,
              color: "text-blue-400",
            },
            {
              title: "4. QC & Modifications",
              desc: "Automated checks & natural-language AI revisions.",
              status: "Phase 7",
              icon: Sparkles,
              color: "text-indigo-400",
            },
            {
              title: "5. YouTube Publishing",
              desc: "Mandatory human approval gate tied to hash.",
              status: "Phase 8",
              icon: Share2,
              color: "text-emerald-400",
            },
          ].map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-4 h-4 ${step.color}`} />
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {step.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-white">{step.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{step.desc}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-medium">Stage {idx + 1} of 5</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety & Approval Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60 flex items-start gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Strict Human Approval Guarantee:</span> When video rendering is complete in Phase 6, you will be able to watch the entire MP4, request AI revisions in Phase 7, and explicitly approve the exact final version in Phase 8 before any YouTube upload can be authorized.
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-20 px-6 text-center text-slate-400 text-sm">Loading workspace...</div>}>
      <WorkspaceContent />
    </Suspense>
  );
}

