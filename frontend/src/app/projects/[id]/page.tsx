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
  RefreshCw,
  Edit3,
  Search,
  CheckCheck,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Image as ImageIcon,
  UploadCloud,
  Volume2,
} from "lucide-react";
import {
  fetchProjectById,
  deleteProject,
  generateScript,
  fetchScript,
  updateScript,
  generateProjectVoice,
  generateProjectVisuals,
  uploadSceneAsset,
  getSceneVisualUrl,
  getSceneAudioUrl,
} from "@/lib/api";
import { Project, ScriptRevisionData } from "@/types/project";

function WorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [script, setScript] = useState<ScriptRevisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scenes" | "script" | "sources">("scenes");

  // Editable script states
  const [editableScript, setEditableScript] = useState("");
  const [editableHook, setEditableHook] = useState("");
  const [editableConclusion, setEditableConclusion] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Phase 5 Asset Generation states
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [generatingVisuals, setGeneratingVisuals] = useState(false);
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);
  const [assetTimestamp, setAssetTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    if (!projectId) return;

    async function loadData() {
      try {
        const proj = await fetchProjectById(projectId);
        setProject(proj);
        const sc = await fetchScript(projectId);
        if (sc) {
          setScript(sc);
          setEditableScript(sc.full_script);
          setEditableHook(sc.title_hook || "");
          setEditableConclusion(sc.conclusion || "");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load project workspace");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  const handleGenerateScript = async () => {
    setGenerating(true);
    setError(null);
    try {
      const newScript = await generateScript(projectId);
      setScript(newScript);
      setEditableScript(newScript.full_script);
      setEditableHook(newScript.title_hook || "");
      setEditableConclusion(newScript.conclusion || "");
      // Refresh project to get updated status ('script_review')
      const updatedProj = await fetchProjectById(projectId);
      setProject(updatedProj);
    } catch (err: any) {
      setError(err.message || "Script generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveScriptEdits = async () => {
    setSaving(true);
    try {
      const updated = await updateScript(projectId, {
        title_hook: editableHook,
        full_script: editableScript,
        conclusion: editableConclusion,
      });
      setScript(updated);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || "Failed to save script edits");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateVoice = async () => {
    setGeneratingVoice(true);
    setError(null);
    try {
      await generateProjectVoice(projectId);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
      alert("Neural voiceover synthesized successfully for all scenes!");
    } catch (err: any) {
      setError(err.message || "Failed to generate voiceover.");
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleGenerateVisuals = async () => {
    setGeneratingVisuals(true);
    setError(null);
    try {
      await generateProjectVisuals(projectId, true);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
      alert("Visual assets acquired successfully for all scenes!");
    } catch (err: any) {
      setError(err.message || "Failed to generate visual assets.");
    } finally {
      setGeneratingVisuals(false);
    }
  };

  const handleUploadAsset = async (sceneId: string, file: File) => {
    setUploadingSceneId(sceneId);
    try {
      await uploadSceneAsset(sceneId, file);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
      alert("Custom visual asset uploaded successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to upload asset.");
    } finally {
      setUploadingSceneId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this documentary project from Supabase?")) return;
    try {
      await deleteProject(projectId);
      router.push("/");
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 px-6 text-center text-slate-400 text-sm animate-pulse">
        Loading project workspace from Supabase...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || "Project not found"}
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
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
          className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Project</span>
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
              {script && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Revision v{script.revision_number}
                </span>
              )}
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

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* PHASE 4: Script & Scene Planning Workspace */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-rose-400 mb-1">
              <FileText className="w-3.5 h-3.5" />
              Phase 4 &bull; Research, Script & Scene Planning
            </div>
            <h2 className="text-xl font-bold text-white">Documentary Script & Scene Breakdown</h2>
          </div>

          <div className="flex items-center gap-3">
            {script ? (
              <button
                onClick={handleGenerateScript}
                disabled={generating}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                <span>{generating ? "Regenerating..." : "Regenerate with Gemini"}</span>
              </button>
            ) : (
              <button
                onClick={handleGenerateScript}
                disabled={generating}
                className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02]"
              >
                <Sparkles className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
                <span>{generating ? "Generating with Gemini..." : "Generate Script with Gemini"}</span>
              </button>
            )}
          </div>
        </div>

        {generating ? (
          /* Generation Loading State */
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400 animate-spin">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-white">Gemini is writing your documentary...</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Researching verified facts, pacing narration for {s?.target_duration_minutes || 10} minutes, and breaking down structured scenes.
              </p>
            </div>
          </div>
        ) : !script ? (
          /* Empty Script State */
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-bold text-base text-white">No script generated yet</h3>
              <p className="text-xs text-slate-400">
                Click the button above to have Google Gemini generate a structured documentary script with research citations and scene directions.
              </p>
            </div>
            <button
              onClick={handleGenerateScript}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Script Generation</span>
            </button>
          </div>
        ) : (
          /* Script Generated Review Workspace */
          <div className="space-y-6">
            {/* Title Hook Banner */}
            {script.title_hook && (
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Opening Hook</span>
                <p className="text-sm font-semibold text-white italic">"{script.title_hook}"</p>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab("scenes")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "scenes"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Scene Breakdown ({script.scenes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("script")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "script"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Continuous Script</span>
              </button>

              <button
                onClick={() => setActiveTab("sources")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "sources"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fact-Check & Citations ({script.research_sources?.length || 0})</span>
              </button>
            </div>

            {/* Tab 1: Scene Breakdown */}
            {activeTab === "scenes" && (
              <div className="space-y-6">
                {/* Phase 5 Action Bar: Voiceover & Visual Engine */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                        Phase 5 &bull; Production Studio
                      </span>
                      <span className="text-xs font-semibold text-slate-300">Voiceover & Visual Engine</span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-4">
                      <span>Audio: <b className="text-emerald-400">{script.scenes.filter(s => s.actual_audio_duration_seconds).length} / {script.scenes.length}</b> ready</span>
                      <span>Visuals: <b className="text-indigo-400">{script.scenes.filter(s => s.assets && s.assets.length > 0).length} / {script.scenes.length}</b> attached</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={handleGenerateVoice}
                      disabled={generatingVoice}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 shadow-md shadow-indigo-950/40"
                    >
                      <Mic className={`w-3.5 h-3.5 ${generatingVoice ? "animate-spin" : ""}`} />
                      <span>{generatingVoice ? "Synthesizing Audio..." : "Generate Voiceover (Piper TTS)"}</span>
                    </button>

                    <button
                      onClick={handleGenerateVisuals}
                      disabled={generatingVisuals}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-50 shadow-md shadow-purple-950/40"
                    >
                      <ImageIcon className={`w-3.5 h-3.5 ${generatingVisuals ? "animate-spin" : ""}`} />
                      <span>{generatingVisuals ? "Acquiring Visuals..." : "Generate Visuals (NASA & Canvas)"}</span>
                    </button>
                  </div>
                </div>

                {/* Scene Cards */}
                <div className="space-y-4">
                  {script.scenes.map((scene) => {
                    const hasAudio = !!scene.actual_audio_duration_seconds;
                    const asset = scene.assets && scene.assets.length > 0 ? scene.assets[0] : null;

                    return (
                      <div
                        key={scene.id || scene.scene_id_str}
                        className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-4 hover:border-slate-700 transition-colors"
                      >
                        {/* Scene Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 font-bold flex items-center justify-center text-xs">
                              {scene.scene_order}
                            </span>
                            <h4 className="font-bold text-sm text-white">{scene.scene_title || scene.scene_id_str}</h4>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-emerald-400 font-medium">
                              {hasAudio
                                ? `${Math.round(scene.actual_audio_duration_seconds!)}s (actual)`
                                : `~${scene.estimated_duration_seconds ? Math.round(scene.estimated_duration_seconds) : 30}s`}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 capitalize">
                              {scene.preferred_visual_type.replace(/_/g, " ")}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                              {scene.transition_preference}
                            </span>
                          </div>
                        </div>

                        {/* Visual & Narration 2-Column Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Left Column: Visual Preview (5 cols) */}
                          <div className="md:col-span-5 space-y-2">
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group">
                              <img
                                src={`${getSceneVisualUrl(scene.id)}?t=${assetTimestamp}`}
                                alt={scene.scene_title || "Visual Preview"}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 1920 1080'><rect fill='%230f172a' width='100%' height='100%'/><text fill='%2364748b' x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48'>Visual Pending</text></svg>";
                                }}
                              />

                              {/* Source badge on top-left of image */}
                              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-semibold text-slate-200 border border-slate-800">
                                  {asset?.source_provider
                                    ? asset.source_provider.replace(/_/g, " ").toUpperCase()
                                    : "VISUAL"}
                                </span>
                              </div>

                              {/* Upload Custom File Overlay on hover */}
                              <label
                                className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 cursor-pointer text-white"
                              >
                                <UploadCloud className="w-6 h-6 text-indigo-400" />
                                <span className="text-xs font-semibold">
                                  {uploadingSceneId === scene.id ? "Uploading..." : "Replace Visual Asset"}
                                </span>
                                <span className="text-[10px] text-slate-400">JPG, PNG, WebP, MP4</span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,video/mp4"
                                  className="hidden"
                                  disabled={uploadingSceneId === scene.id}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleUploadAsset(scene.id, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            {/* Attribution & License */}
                            {asset && (
                              <div className="text-[10px] text-slate-500 truncate flex items-center justify-between">
                                <span title={asset.attribution || ""}>
                                  Source: {asset.attribution || "Public Domain"}
                                </span>
                                <span>{asset.license_notes || ""}</span>
                              </div>
                            )}
                          </div>

                          {/* Right Column: Narration & Audio Player (7 cols) */}
                          <div className="md:col-span-7 flex flex-col justify-between space-y-3">
                            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                                Voiceover Narration
                              </span>
                              <p className="text-xs text-slate-200 leading-relaxed font-sans">{scene.narration_text}</p>
                            </div>

                            {/* Audio Player if generated */}
                            {hasAudio ? (
                              <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                                  <Volume2 className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className="font-semibold text-slate-300">Neural Voiceover</span>
                                    <span className="text-emerald-400 font-mono text-[10px]">
                                      {scene.actual_audio_duration_seconds?.toFixed(1)}s
                                    </span>
                                  </div>
                                  <audio
                                    controls
                                    src={`${getSceneAudioUrl(scene.id)}?t=${assetTimestamp}`}
                                    className="w-full h-7 text-xs"
                                    preload="none"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>Audio narration not synthesized yet</span>
                                <span className="text-[10px] text-indigo-400 font-semibold">Piper TTS ready</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom: Visual Direction & Keywords */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-900">
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Visual Direction:
                            </span>
                            <p className="text-slate-400 text-[11px] leading-relaxed">{scene.visual_description}</p>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Stock Keywords:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {scene.stock_keywords && scene.stock_keywords.length > 0 ? (
                                scene.stock_keywords.map((kw, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-mono"
                                  >
                                    #{kw}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 text-[11px]">No keywords</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {scene.on_screen_text && (
                          <div className="pt-2 border-t border-slate-900 flex items-center gap-2 text-[11px] text-amber-400">
                            <span className="font-semibold">On-Screen Text:</span>
                            <span>"{scene.on_screen_text}"</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Full Continuous Script Editor */}
            {activeTab === "script" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Review and polish the entire documentary narration before proceeding to voiceover.
                  </span>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Script</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveScriptEdits}
                        disabled={saving}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500"
                      >
                        <span>{saving ? "Saving..." : "Save Edits"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Title Hook:</label>
                      <input
                        type="text"
                        value={editableHook}
                        onChange={(e) => setEditableHook(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Full Script Text:</label>
                      <textarea
                        rows={12}
                        value={editableScript}
                        onChange={(e) => setEditableScript(e.target.value)}
                        className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs leading-relaxed focus:outline-none focus:border-rose-500 font-mono resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Conclusion / Outro:</label>
                      <input
                        type="text"
                        value={editableConclusion}
                        onChange={(e) => setEditableConclusion(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                    <p className="text-xs text-slate-200 leading-loose whitespace-pre-line font-sans">
                      {script.full_script}
                    </p>
                    {script.conclusion && (
                      <div className="pt-4 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                          Conclusion
                        </span>
                        <p className="text-xs text-slate-300 italic">{script.conclusion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Fact-Check Citations */}
            {activeTab === "sources" && (
              <div className="space-y-3">
                {script.research_sources && script.research_sources.length > 0 ? (
                  script.research_sources.map((item, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3"
                    >
                      <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{item.claim}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                            {item.verification_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{item.source_note}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No research citations recorded for this script.
                  </div>
                )}
              </div>
            )}

            {/* Ready for Phase 5 Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Script & Scenes Review Ready</h4>
                  <p className="text-[11px] text-slate-400">
                    Scenes are structured with timing and visual directions for Phase 5 (Voiceover & Assets).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-emerald-400">{script.scenes.length} Scenes</span>
                <span>&bull;</span>
                <span>Paced for ~{s?.target_duration_minutes} Mins</span>
              </div>
            </div>
          </div>
        )}
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
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-20 px-6 text-center text-slate-400 text-sm">Loading workspace...</div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
