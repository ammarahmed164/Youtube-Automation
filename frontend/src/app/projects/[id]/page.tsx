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
  Play,
  Download,
  Terminal,
  Wand2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  ExternalLink,
  Shield,
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
  startVideoRender,
  fetchRenderStatus,
  getVideoStreamUrl,
  getVideoSubtitlesUrl,
  fetchVideoVersions,
  fetchQualityCheck,
  runQualityCheck,
  submitAiModification,
  approveVideoVersion,
  revokeVideoApproval,
  fetchVideoApproval,
  publishToYouTube,
  fetchPublishStatus,
  fetchYouTubeStatus,
} from "@/lib/api";
import {
  Project,
  ScriptRevisionData,
  VideoVersionData,
  QualityCheckData,
  ModificationResultData,
  VideoApprovalData,
  YouTubeUploadData,
  UploadMetadataForm,
  YouTubeAccountData,
} from "@/types/project";

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
  const [activeTab, setActiveTab] = useState<"scenes" | "script" | "sources" | "video">("scenes");

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

  // Phase 6 Video Rendering states
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  const [latestVideo, setLatestVideo] = useState<VideoVersionData | null>(null);
  const [videoVersions, setVideoVersions] = useState<VideoVersionData[]>([]);
  const [videoTimestamp, setVideoTimestamp] = useState<number>(Date.now());

  // Phase 7 Quality Checks & AI Modification states
  const [qualityCheck, setQualityCheck] = useState<QualityCheckData | null>(null);
  const [checkingQc, setCheckingQc] = useState(false);
  const [showQcDetails, setShowQcDetails] = useState(false);
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modificationResult, setModificationResult] = useState<ModificationResultData | null>(null);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);

  // Phase 8 Human Approval Gate & YouTube Publishing states
  const [activeApproval, setActiveApproval] = useState<VideoApprovalData | null>(null);
  const [publishRecord, setPublishRecord] = useState<YouTubeUploadData | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);

  // YouTube Upload Metadata Form
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadPrivacy, setUploadPrivacy] = useState<"private" | "unlisted" | "public">("unlisted");
  const [uploadCategory, setUploadCategory] = useState("28");

  useEffect(() => {
    if (!projectId) return;

    async function loadData() {
      try {
        // High-Performance Parallel Burst: Load all project metadata, scripts, versions, QC, and approvals simultaneously
        const [
          projResult,
          scriptResult,
          versionsResult,
          qcResult,
          statusResult,
          approvalResult,
          pubStatusResult,
        ] = await Promise.allSettled([
          fetchProjectById(projectId),
          fetchScript(projectId),
          fetchVideoVersions(projectId),
          fetchQualityCheck(projectId),
          fetchRenderStatus(projectId),
          fetchVideoApproval(projectId),
          fetchPublishStatus(projectId),
        ]);

        let loadedProj: Project | null = null;
        if (projResult.status === "fulfilled" && projResult.value) {
          loadedProj = projResult.value;
          setProject(loadedProj);
        }

        if (scriptResult.status === "fulfilled" && scriptResult.value) {
          const sc = scriptResult.value;
          setScript(sc);
          setEditableScript(sc.full_script);
          setEditableHook(sc.title_hook || "");
          setEditableConclusion(sc.conclusion || "");
        }

        if (versionsResult.status === "fulfilled" && versionsResult.value) {
          const versions = versionsResult.value;
          setVideoVersions(versions);
          if (versions.length > 0) {
            setLatestVideo(versions[0]);
            setSelectedVersionNum(versions[0].version_number);
          }
        }

        if (qcResult.status === "fulfilled" && qcResult.value) {
          setQualityCheck(qcResult.value);
        }

        if (statusResult.status === "fulfilled" && statusResult.value) {
          const status = statusResult.value;
          if (status.status === "queued" || status.status === "running") {
            setIsRendering(true);
            setRenderProgress(status.progress_percent || 0);
            if (status.log_messages) setRenderLogs(status.log_messages);
          }
        }

        if (approvalResult.status === "fulfilled" && approvalResult.value) {
          const approval = approvalResult.value;
          setActiveApproval(approval);
          if (approval.upload_settings) {
            setUploadTitle(approval.upload_settings.title || "");
            setUploadDescription(approval.upload_settings.description || "");
            setUploadTags(approval.upload_settings.tags?.join(", ") || "");
            setUploadPrivacy(approval.upload_settings.privacy_status || "unlisted");
            setUploadCategory(approval.upload_settings.category_id || "28");
          }
        } else if (loadedProj) {
          setUploadTitle(loadedProj.title);
          setUploadDescription(`${loadedProj.topic}\n\nProduced with AI YouTube Documentary Studio.`);
          setUploadTags("Documentary, Science, Space, Astronomy, AI");
        }

        if (pubStatusResult.status === "fulfilled" && pubStatusResult.value) {
          setPublishRecord(pubStatusResult.value);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load project workspace");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  // Polling for background rendering job
  useEffect(() => {
    let interval: any = null;
    if (isRendering) {
      interval = setInterval(async () => {
        try {
          const status = await fetchRenderStatus(projectId);
          if (status) {
            setRenderProgress(status.progress_percent || 0);
            if (status.log_messages) setRenderLogs(status.log_messages);
            if (status.status === "completed") {
              setIsRendering(false);
              const versions = await fetchVideoVersions(projectId);
              setVideoVersions(versions);
              if (versions.length > 0) setLatestVideo(versions[0]);
              setVideoTimestamp(Date.now());
              const updatedProj = await fetchProjectById(projectId);
              setProject(updatedProj);
            } else if (status.status === "failed") {
              setIsRendering(false);
              setError(status.error_details || "Rendering job failed.");
            }
          }
        } catch (e) {
          console.error("Status polling error:", e);
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRendering, projectId]);

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

  const handleStartRender = async () => {
    setError(null);
    setIsRendering(true);
    setRenderProgress(5);
    setRenderLogs(["Submitting render request to FFmpeg background worker..."]);
    setActiveTab("video");
    try {
      await startVideoRender(projectId);
    } catch (err: any) {
      setIsRendering(false);
      setError(err.message || "Failed to trigger video rendering.");
    }
  };

  const handleRunQc = async () => {
    setCheckingQc(true);
    try {
      const qc = await runQualityCheck(projectId, selectedVersionNum || undefined);
      setQualityCheck(qc);
    } catch (err: any) {
      alert(err.message || "Quality check failed.");
    } finally {
      setCheckingQc(false);
    }
  };

  const handleApplyAiModification = async () => {
    if (!modificationPrompt.trim()) return;
    setModifying(true);
    setError(null);
    try {
      const res = await submitAiModification(projectId, modificationPrompt, true);
      setModificationResult(res);
      setModificationPrompt("");

      // Refresh all project state (script, scenes, video versions, QC)
      const proj = await fetchProjectById(projectId);
      setProject(proj);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);

      const versions = await fetchVideoVersions(projectId);
      setVideoVersions(versions);
      if (versions && versions.length > 0) {
        setLatestVideo(versions[0]);
        setSelectedVersionNum(versions[0].version_number);
      }

      const qc = await fetchQualityCheck(projectId);
      if (qc) setQualityCheck(qc);

      setVideoTimestamp(Date.now());
      setAssetTimestamp(Date.now());

      alert(`AI Revision Applied Successfully!\nVersion v${res.new_video_version?.version_number} generated.\nSummary: ${res.plan_summary}`);
    } catch (err: any) {
      setError(err.message || "Failed to apply AI modification.");
    } finally {
      setModifying(false);
    }
  };

  // Synchronize approval and publish record when active version changes
  useEffect(() => {
    if (!projectId || !selectedVersionNum) return;
    const currentVer = videoVersions.find(v => v.version_number === selectedVersionNum);
    if (!currentVer) return;

    async function loadVersionApproval() {
      try {
        const app = await fetchVideoApproval(projectId, currentVer!.id);
        setActiveApproval(app);
        const pub = await fetchPublishStatus(projectId, currentVer!.id);
        setPublishRecord(pub);
      } catch {
        setActiveApproval(null);
        setPublishRecord(null);
      }
    }
    loadVersionApproval();
  }, [projectId, selectedVersionNum, videoVersions]);

  const handleApproveVersion = async () => {
    const currentVer = videoVersions.find(v => v.version_number === selectedVersionNum) || latestVideo;
    if (!currentVer) {
      alert("No video version selected for approval.");
      return;
    }
    if (!approvalConfirmed) {
      alert("Please confirm the explicit approval checkbox before proceeding.");
      return;
    }

    setIsApproving(true);
    setError(null);
    try {
      const tagsList = uploadTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await approveVideoVersion(projectId, {
        video_version_id: currentVer.id,
        confirmed_checksum: currentVer.file_checksum,
        upload_settings: {
          title: uploadTitle.trim() || project?.title || "Documentary",
          description: uploadDescription.trim(),
          tags: tagsList,
          category_id: uploadCategory,
          privacy_status: uploadPrivacy,
          notify_subscribers: false,
        },
        user_confirmation_statement: `I have previewed Version v${currentVer.version_number} and explicitly authorize publishing with checksum ${currentVer.file_checksum}.`
      });

      setActiveApproval(res);
      const updatedProj = await fetchProjectById(projectId);
      setProject(updatedProj);
      alert(`Approval Granted!\nVideo Version v${currentVer.version_number} is locked with SHA-256 Checksum:\n${currentVer.file_checksum}\n\nYou may now safely publish to YouTube.`);
    } catch (err: any) {
      setError(err.message || "Failed to grant video approval.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevokeApproval = async () => {
    const currentVer = videoVersions.find(v => v.version_number === selectedVersionNum) || latestVideo;
    if (!currentVer || !activeApproval) return;
    if (!confirm("Are you sure you want to revoke authorization for this video version? Publishing will be blocked immediately.")) return;

    setIsRevoking(true);
    try {
      await revokeVideoApproval(projectId, {
        video_version_id: currentVer.id,
        reason: "Creator revoked authorization from workspace"
      });
      setActiveApproval(null);
      const updatedProj = await fetchProjectById(projectId);
      setProject(updatedProj);
      alert("Video approval has been revoked. YouTube upload is now blocked.");
    } catch (err: any) {
      setError(err.message || "Failed to revoke approval.");
    } finally {
      setIsRevoking(false);
    }
  };

  const handlePublishToYouTube = async () => {
    const currentVer = videoVersions.find(v => v.version_number === selectedVersionNum) || latestVideo;
    if (!currentVer) return;
    if (!activeApproval || activeApproval.is_revoked) {
      alert("Approval Gate Violation: You must explicitly approve this version before publishing.");
      return;
    }

    setIsPublishing(true);
    setError(null);
    try {
      const res = await publishToYouTube(projectId, {
        video_version_id: currentVer.id,
        approval_id: activeApproval.id,
        expected_checksum: currentVer.file_checksum,
      }, false);

      setPublishRecord(res);
      const updatedProj = await fetchProjectById(projectId);
      setProject(updatedProj);
      alert(`Documentary Published Successfully!\nYouTube Video ID: ${res.youtube_video_id}\nURL: ${res.youtube_url}`);
    } catch (err: any) {
      setError(err.message || "YouTube publishing failed.");
    } finally {
      setIsPublishing(false);
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

  const selectedVersion = videoVersions.find(v => v.version_number === selectedVersionNum) || latestVideo;

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

              <button
                onClick={() => setActiveTab("video")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "video"
                    ? "bg-rose-600 text-white shadow-sm"
                    : latestVideo
                    ? "text-rose-400 hover:text-rose-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Player & Review {latestVideo ? `(v${latestVideo.version_number})` : ""}</span>
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
                      <span>{generatingVoice ? "Synthesizing Audio..." : "Generate Voiceover (AI Neural)"}</span>
                    </button>

                    <button
                      onClick={handleGenerateVisuals}
                      disabled={generatingVisuals}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-50 shadow-md shadow-purple-950/40"
                    >
                      <ImageIcon className={`w-3.5 h-3.5 ${generatingVisuals ? "animate-spin" : ""}`} />
                      <span>{generatingVisuals ? "Acquiring Visuals..." : "Generate Scene Visuals (Stock & AI)"}</span>
                    </button>

                    <button
                      onClick={handleStartRender}
                      disabled={isRendering}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white transition-all disabled:opacity-50 shadow-md shadow-rose-950/40"
                    >
                      <Film className={`w-3.5 h-3.5 ${isRendering ? "animate-spin" : ""}`} />
                      <span>{isRendering ? "Rendering Video..." : "Render Video (FFmpeg)"}</span>
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
                                loading="lazy"
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

            {/* Tab 4: Phase 6 Video Player & Review */}
            {activeTab === "video" && (
              <div className="space-y-6">
                {isRendering ? (
                  /* Live Rendering Progress Terminal */
                  <div className="p-6 sm:p-8 rounded-3xl border border-rose-500/30 bg-slate-950/80 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                          <Film className="w-4 h-4 animate-spin text-rose-500" />
                          <span>Phase 6 &bull; FFmpeg Video Rendering in Progress</span>
                        </div>
                        <h3 className="text-lg font-bold text-white">Compiling 1080p Documentary MP4...</h3>
                        <p className="text-xs text-slate-400">
                          Applying Ken Burns zoom/pan on visuals, synchronizing Piper voiceover audio, and embedding subtitles.
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-3xl font-black font-mono text-rose-400">{renderProgress}%</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-indigo-500 transition-all duration-500 rounded-full"
                        style={{ width: `${renderProgress}%` }}
                      />
                    </div>

                    {/* Real-time Render Log Terminal */}
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs space-y-1.5 max-h-56 overflow-y-auto">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] pb-1 border-b border-slate-800">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>FFmpeg Pipeline Event Logs</span>
                      </div>
                      {renderLogs && renderLogs.length > 0 ? (
                        renderLogs.map((log, i) => (
                          <div key={i} className="text-slate-300 text-[11px] flex items-start gap-2">
                            <span className="text-slate-500">[{i + 1}]</span>
                            <span>{log}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-[11px]">Initializing rendering engine...</div>
                      )}
                    </div>
                  </div>
                ) : latestVideo ? (
                  /* Rendered Video Player & Review Hub */
                  <div className="space-y-6">
                    {/* Version Switcher Bar (if multiple versions exist) */}
                    {videoVersions.length > 1 && (
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-400">Version History:</span>
                          <div className="flex items-center gap-1.5">
                            {videoVersions.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => {
                                  setSelectedVersionNum(v.version_number);
                                  setVideoTimestamp(Date.now());
                                }}
                                className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
                                  (selectedVersionNum || latestVideo.version_number) === v.version_number
                                    ? "bg-rose-600 text-white shadow-sm"
                                    : "bg-slate-800 text-slate-400 hover:text-white"
                                }`}
                              >
                                v{v.version_number}.0
                              </button>
                            ))}
                          </div>
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          Showing Version v{selectedVersionNum || latestVideo.version_number}.0
                        </span>
                      </div>
                    )}

                    {/* HTML5 Video Player */}
                    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
                      <video
                        controls
                        preload="metadata"
                        key={`${selectedVersionNum || latestVideo.version_number}-${videoTimestamp}`}
                        className="w-full aspect-video"
                        poster={script?.scenes[0]?.id ? `${getSceneVisualUrl(script.scenes[0].id)}?t=${assetTimestamp}` : undefined}
                      >
                        <source
                          src={`${getVideoStreamUrl(projectId, selectedVersionNum || undefined)}?t=${videoTimestamp}`}
                          type="video/mp4"
                        />
                        <track
                          kind="subtitles"
                          src={`${getVideoSubtitlesUrl(projectId, "vtt", selectedVersionNum || undefined)}?t=${videoTimestamp}`}
                          srcLang="en"
                          label="English"
                          default
                        />
                        Your browser does not support HTML5 video streaming.
                      </video>
                    </div>

                    {/* Video Information & Actions Card */}
                    <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Version v{selectedVersionNum || latestVideo.version_number}.0 Ready
                            </span>
                            <span className="text-xs text-slate-400">1080p Full HD &bull; H.264 / AAC</span>
                          </div>
                          <h3 className="text-base font-bold text-white">{project.title}</h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <a
                            href={getVideoStreamUrl(projectId, selectedVersionNum || undefined)}
                            download={`documentary_v${selectedVersionNum || latestVideo.version_number}.mp4`}
                            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-rose-400" />
                            <span>Download MP4</span>
                          </a>

                          <a
                            href={getVideoSubtitlesUrl(projectId, "srt", selectedVersionNum || undefined)}
                            download={`subtitles_v${selectedVersionNum || latestVideo.version_number}.srt`}
                            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Download Subtitles (.srt)</span>
                          </a>

                          <button
                            onClick={handleStartRender}
                            disabled={isRendering}
                            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRendering ? "animate-spin" : ""}`} />
                            <span>Full Re-Render</span>
                          </button>
                        </div>
                      </div>

                      {/* Technical Specs & SHA-256 Checksum (Crucial for Approval Gate!) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-900 text-xs">
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                          <span className="text-slate-500 text-[10px] block uppercase font-mono">Total Duration</span>
                          <span className="font-semibold text-slate-200 text-xs mt-0.5 block font-mono">
                            {Math.floor(latestVideo.duration_seconds / 60)}m {Math.round(latestVideo.duration_seconds % 60)}s
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                          <span className="text-slate-500 text-[10px] block uppercase font-mono">Resolution & Codec</span>
                          <span className="font-semibold text-slate-200 text-xs mt-0.5 block font-mono">
                            1920x1080 (16:9) &bull; libx264
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                          <span className="text-slate-500 text-[10px] block uppercase font-mono">Rendered Timestamp</span>
                          <span className="font-semibold text-slate-200 text-xs mt-0.5 block font-mono">
                            {new Date(latestVideo.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Immutable SHA-256 Checksum Pill */}
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-500 uppercase">SHA-256 Checksum:</span>
                        <span className="text-emerald-400 select-all font-semibold">{latestVideo.file_checksum}</span>
                      </div>
                    </div>

                    {/* PHASE 7: Automated Quality Control (QC) Panel */}
                    <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            qualityCheck?.passed ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-white">Automated Quality Control (QC)</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                qualityCheck?.passed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              }`}>
                                {qualityCheck ? `${qualityCheck.score_percent}% Verified` : "Pending Check"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Automated verification for duration tolerance (≤20m), audio loudness, black gaps, and resolution.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRunQc}
                            disabled={checkingQc}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${checkingQc ? "animate-spin" : ""}`} />
                            <span>{checkingQc ? "Auditing..." : "Re-Run QC"}</span>
                          </button>

                          <button
                            onClick={() => setShowQcDetails(!showQcDetails)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5"
                          >
                            <span>{showQcDetails ? "Hide Checks" : "View 8 Checks"}</span>
                            {showQcDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable QC Checklist */}
                      {showQcDetails && qualityCheck?.check_results && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 border-t border-slate-900 text-xs">
                          {Object.entries(qualityCheck.check_results).map(([key, check]: [string, any]) => (
                            <div
                              key={key}
                              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-2.5"
                            >
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                check.passed ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              }`}>
                                {check.passed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-200 capitalize">{key.replace(/_/g, " ")}</span>
                                  <span className={`text-[10px] font-mono font-bold ${
                                    check.passed ? "text-emerald-400" : "text-rose-400"
                                  }`}>
                                    {check.status_label}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{check.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* PHASE 7: AI Natural Language Modification Assistant */}
                    <div className="p-6 rounded-2xl border border-indigo-900/40 bg-gradient-to-b from-indigo-950/20 to-slate-950/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                            <Wand2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-white">AI Natural Language Modification Assistant</h4>
                            <p className="text-xs text-slate-400">
                              Tell AI what you'd like to refine. It will update only the affected scenes and re-render a new version.
                            </p>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                          Phase 7 &bull; Smart Deltas
                        </span>
                      </div>

                      {/* Prompt Input Area */}
                      <div className="space-y-3">
                        <textarea
                          rows={3}
                          value={modificationPrompt}
                          onChange={(e) => setModificationPrompt(e.target.value)}
                          placeholder="e.g. Make scene 3 narration shorter and more dramatic, and add on-screen text 'Alien Atmospheres'..."
                          className="w-full p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-white text-xs leading-relaxed focus:outline-none focus:border-indigo-500 font-sans resize-none"
                          disabled={modifying}
                        />

                        {/* Quick Suggestion Chips */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-500">Try asking:</span>
                          {[
                            "Make scene 3 narration punchier and shorter",
                            "Change scene 1 visual to a deep field nebula",
                            "Add on-screen text '13.8 Billion Years' to scene 2",
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setModificationPrompt(chip)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 hover:text-indigo-300 hover:border-slate-700 transition-colors"
                            >
                              "{chip}"
                            </button>
                          ))}
                        </div>

                        {/* Submit Button & Feedback */}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[11px] text-slate-500">
                            Re-synthesizes audio & re-renders video as a new version (e.g. v2.0).
                          </span>

                          <button
                            onClick={handleApplyAiModification}
                            disabled={modifying || !modificationPrompt.trim()}
                            className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-950/40 transition-all disabled:opacity-50 hover:scale-[1.01]"
                          >
                            <Sparkles className={`w-4 h-4 ${modifying ? "animate-spin" : ""}`} />
                            <span>{modifying ? "AI Applying Revision..." : "Apply AI Revision & Re-Render"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Success / Plan Summary Banner */}
                      {modificationResult && (
                        <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-xs text-slate-300 space-y-1 mt-3">
                          <div className="flex items-center gap-2 font-bold text-indigo-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Revision Summary:</span>
                          </div>
                          <p>{modificationResult.plan_summary}</p>
                          <div className="text-[11px] text-slate-400 pt-1">
                            Updated Scene(s): {modificationResult.affected_scenes?.join(", ") || "targeted"} &bull; Created Version v{modificationResult.new_video_version?.version_number}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PHASE 8: Mandatory Human Approval Gate & YouTube Publishing Engine */}
                    <div className="p-6 rounded-3xl border border-emerald-900/40 bg-gradient-to-b from-slate-900/90 to-slate-950/90 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-white">Human Approval Gate & YouTube Publishing</h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                                Phase 8 &bull; Rule 14
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              AI agents can never upload without your explicit button confirmation locked to the exact video checksum.
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {publishRecord && publishRecord.status === "published" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <Play className="w-3.5 h-3.5 fill-rose-400" />
                              <span>Published to YouTube</span>
                            </span>
                          ) : activeApproval && !activeApproval.is_revoked ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <Lock className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Approved & Locked (v{selectedVersion?.version_number})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                              <span>Awaiting Creator Approval</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Video Integrity Snapshot Box */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-500 uppercase font-semibold">Target Video Version</span>
                          <div className="font-bold text-white text-sm">Version v{selectedVersion?.version_number}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {selectedVersion?.resolution} &bull; {selectedVersion?.duration_seconds ? `${Math.floor(selectedVersion.duration_seconds / 60)}m ${Math.floor(selectedVersion.duration_seconds % 60)}s` : "--"}
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[11px] text-slate-500 uppercase font-semibold flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-indigo-400" />
                            <span>Immutable SHA-256 File Checksum</span>
                          </span>
                          <div className="font-mono text-[11px] text-indigo-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 break-all select-all">
                            {selectedVersion?.file_checksum || "Calculating..."}
                          </div>
                        </div>
                      </div>

                      {/* YouTube Publishing Metadata Form */}
                      <div className="space-y-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                        <h5 className="font-bold text-xs uppercase text-slate-300 tracking-wider">
                          YouTube Video Metadata Settings
                        </h5>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1.5">
                            <label className="font-semibold text-slate-300">Video Title</label>
                            <input
                              type="text"
                              value={uploadTitle}
                              onChange={(e) => setUploadTitle(e.target.value)}
                              placeholder="YouTube Video Title..."
                              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                              disabled={Boolean(activeApproval && !activeApproval.is_revoked)}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="font-semibold text-slate-300">Search & Discovery Tags (comma separated)</label>
                            <input
                              type="text"
                              value={uploadTags}
                              onChange={(e) => setUploadTags(e.target.value)}
                              placeholder="Space, Astronomy, James Webb, Science"
                              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                              disabled={Boolean(activeApproval && !activeApproval.is_revoked)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="space-y-1.5">
                            <label className="font-semibold text-slate-300">Privacy Visibility</label>
                            <select
                              value={uploadPrivacy}
                              onChange={(e) => setUploadPrivacy(e.target.value as any)}
                              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                              disabled={Boolean(activeApproval && !activeApproval.is_revoked)}
                            >
                              <option value="unlisted">Unlisted (Anyone with link)</option>
                              <option value="private">Private (Only you)</option>
                              <option value="public">Public (Visible to everyone)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="font-semibold text-slate-300">Category</label>
                            <select
                              value={uploadCategory}
                              onChange={(e) => setUploadCategory(e.target.value)}
                              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                              disabled={Boolean(activeApproval && !activeApproval.is_revoked)}
                            >
                              <option value="28">Science & Technology</option>
                              <option value="27">Education</option>
                              <option value="24">Entertainment</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="font-semibold text-slate-300">Broadcast Quality</label>
                            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-emerald-400 font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{qualityCheck?.score_percent || 100}% Checks Passed</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <label className="font-semibold text-slate-300">Video Description</label>
                          <textarea
                            rows={3}
                            value={uploadDescription}
                            onChange={(e) => setUploadDescription(e.target.value)}
                            placeholder="Video description, research citations, and timestamps..."
                            className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                            disabled={Boolean(activeApproval && !activeApproval.is_revoked)}
                          />
                        </div>
                      </div>

                      {/* Approval / Publishing Actions */}
                      {publishRecord && publishRecord.status === "published" ? (
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-800/60 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/40">
                                <Play className="w-5 h-5 fill-white" />
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-sm">Successfully Published to YouTube</h4>
                                <p className="text-xs text-slate-400">Video ID: {publishRecord.youtube_video_id}</p>
                              </div>
                            </div>

                            <a
                              href={publishRecord.youtube_url || `https://youtu.be/${publishRecord.youtube_video_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-rose-950/40"
                            >
                              <span>Watch on YouTube</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          <div className="font-mono text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                            <span>Direct Link: {publishRecord.youtube_url}</span>
                            <span>Published: {new Date(publishRecord.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ) : activeApproval && !activeApproval.is_revoked ? (
                        <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                              <div>
                                <h4 className="font-bold text-emerald-300 text-sm">
                                  Version v{selectedVersion?.version_number} Approved for YouTube Publishing
                                </h4>
                                <p className="text-xs text-slate-400">
                                  Approved on {new Date(activeApproval.approved_at).toLocaleString()} &bull; Locked Checksum: {activeApproval.file_checksum.slice(0, 16)}...
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleRevokeApproval}
                                disabled={isRevoking}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>{isRevoking ? "Revoking..." : "Revoke Approval"}</span>
                              </button>

                              <button
                                onClick={handlePublishToYouTube}
                                disabled={isPublishing}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02] disabled:opacity-50"
                              >
                                <Play className={`w-4 h-4 fill-white ${isPublishing ? "animate-spin" : ""}`} />
                                <span>{isPublishing ? "Publishing to YouTube..." : "Publish to YouTube Now"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              id="approval-checkbox"
                              checked={approvalConfirmed}
                              onChange={(e) => setApprovalConfirmed(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 mt-1 cursor-pointer"
                            />
                            <label htmlFor="approval-checkbox" className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
                              <strong className="text-white">Mandatory Human Approval Confirmation:</strong> I have watched the complete documentary preview for <span className="font-semibold text-emerald-400">Version v{selectedVersion?.version_number}</span> and confirm that the video quality, narration pacing, and subtitles are satisfactory. I explicitly authorize locking this exact SHA-256 checksum for YouTube publication.
                            </label>
                          </div>

                          <div className="flex items-center justify-end pt-2">
                            <button
                              onClick={handleApproveVersion}
                              disabled={isApproving || !approvalConfirmed}
                              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
                            >
                              <ShieldCheck className={`w-4 h-4 ${isApproving ? "animate-spin" : ""}`} />
                              <span>{isApproving ? "Locking Approval..." : `Approve Version v${selectedVersion?.version_number} & Authorize Publishing`}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Empty Video State / Call to Action */
                  <div className="p-10 rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                      <Film className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                      <h3 className="font-bold text-base text-white">Ready to Render Documentary MP4</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Voiceover and 1080p visuals are prepared. Click below to stitch scenes with Ken Burns cinematic zoom, audio narration, and synchronized subtitles.
                      </p>
                    </div>
                    <button
                      onClick={handleStartRender}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-semibold px-6 py-3 rounded-xl shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02]"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Video Rendering</span>
                    </button>
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
