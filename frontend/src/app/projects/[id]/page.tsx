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
  RotateCcw,
  Plus,
  X,
  Save,
} from "lucide-react";
import {
  fetchProjectById,
  updateProject,
  deleteProject,
  generateScript,
  fetchScript,
  updateScript,
  updateScene,
  deleteScene,
  createScene,
  aiRewriteScene,
  generateProjectVoice,
  generateSceneVoice,
  fetchVoices,
  getVoicePreviewUrl,
  VoiceOption,
  generateProjectVisuals,
  uploadSceneAsset,
  resetSceneVisual,
  fetchSceneCuts,
  deleteSceneCut,
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
  const [selectedSceneSlots, setSelectedSceneSlots] = useState<Record<string, number>>({});
  const [resettingSceneId, setResettingSceneId] = useState<string | null>(null);
  const [sceneCuts, setSceneCuts] = useState<Record<string, any[]>>({});
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneEditForm, setSceneEditForm] = useState<{
    scene_title: string;
    narration_text: string;
    visual_description: string;
    preferred_visual_type: string;
    transition_preference: string;
  }>({
    scene_title: "",
    narration_text: "",
    visual_description: "",
    preferred_visual_type: "stock_footage",
    transition_preference: "fade",
  });
  const [savingScene, setSavingScene] = useState(false);
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null);
  const [videoPlayerError, setVideoPlayerError] = useState<string | null>(null);

  // Studio Voice Selection states
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewAudioObj, setPreviewAudioObj] = useState<HTMLAudioElement | null>(null);
  const [generatingSceneVoiceId, setGeneratingSceneVoiceId] = useState<string | null>(null);
  const [sceneSelectedVoices, setSceneSelectedVoices] = useState<Record<string, string>>({});

  // Add Scene Modal & Creation states
  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [addSceneMode, setAddSceneMode] = useState<"ai" | "manual">("ai");
  const [newSceneAiPrompt, setNewSceneAiPrompt] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneNarration, setNewSceneNarration] = useState("");
  const [newSceneVisualDesc, setNewSceneVisualDesc] = useState("");
  const [newSceneVisualType, setNewSceneVisualType] = useState("stock_footage");
  const [newSceneKeywords, setNewSceneKeywords] = useState("");
  const [newSceneInsertAfter, setNewSceneInsertAfter] = useState<number | null>(null);
  const [addingScene, setAddingScene] = useState(false);

  // AI Script Rewrite states
  const [rewriteModalScene, setRewriteModalScene] = useState<any | null>(null);
  const [rewriteInstructions, setRewriteInstructions] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);

  // Custom Target Duration Editing states
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [customProjectDuration, setCustomProjectDuration] = useState<number>(10);
  const [savingDuration, setSavingDuration] = useState(false);

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
        // High-Performance Parallel Burst: Load all project metadata, scripts, versions, QC, voices, and approvals simultaneously
        const [
          projResult,
          scriptResult,
          versionsResult,
          qcResult,
          statusResult,
          approvalResult,
          pubStatusResult,
          voicesResult,
        ] = await Promise.allSettled([
          fetchProjectById(projectId),
          fetchScript(projectId),
          fetchVideoVersions(projectId),
          fetchQualityCheck(projectId),
          fetchRenderStatus(projectId),
          fetchVideoApproval(projectId),
          fetchPublishStatus(projectId),
          fetchVoices(),
        ]);

        let loadedProj: Project | null = null;
        if (projResult.status === "fulfilled" && projResult.value) {
          loadedProj = projResult.value;
          setProject(loadedProj);
        }

        if (voicesResult.status === "fulfilled" && voicesResult.value) {
          const vList = voicesResult.value;
          setAvailableVoices(vList);
          if (loadedProj?.settings?.narration_preset) {
            setSelectedVoiceId(loadedProj.settings.narration_preset);
          } else {
            const lang = (loadedProj?.settings?.language || "").toLowerCase();
            if (lang === "urdu") setSelectedVoiceId("ur-PK-AsadNeural");
            else if (lang === "hindi") setSelectedVoiceId("hi-IN-MadhurNeural");
            else if (lang === "arabic") setSelectedVoiceId("ar-SA-HamedNeural");
            else if (lang === "spanish") setSelectedVoiceId("es-ES-AlvaroNeural");
            else setSelectedVoiceId("en-US-ChristopherNeural");
          }
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

  // Load and refresh multi-cut gallery and custom media status for all scenes
  useEffect(() => {
    if (!script?.scenes || script.scenes.length === 0) return;
    let isMounted = true;
    async function loadCuts() {
      const cutsMap: Record<string, any[]> = {};
      await Promise.all(
        script!.scenes.map(async (s) => {
          try {
            const res = await fetchSceneCuts(s.id);
            if (res && res.cuts) {
              cutsMap[s.id] = res.cuts;
            }
          } catch {
            // Cut gallery not ready yet
          }
        })
      );
      if (isMounted) setSceneCuts(cutsMap);
    }
    loadCuts();
    return () => {
      isMounted = false;
    };
  }, [script?.scenes, assetTimestamp]);

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

  const handlePlayVoicePreview = (voiceId: string) => {
    if (previewAudioObj) {
      previewAudioObj.pause();
    }
    const audioUrl = getVoicePreviewUrl(voiceId);
    const audio = new Audio(audioUrl);
    setPreviewAudioObj(audio);
    setIsPlayingPreview(true);
    audio.play().catch((e) => console.error("Audio preview failed:", e));
    audio.onended = () => setIsPlayingPreview(false);
    audio.onerror = () => setIsPlayingPreview(false);
  };

  const handleGenerateVoice = async () => {
    setGeneratingVoice(true);
    setError(null);
    try {
      const voiceToUse = selectedVoiceId || undefined;
      await generateProjectVoice(projectId, voiceToUse);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      const proj = await fetchProjectById(projectId);
      if (proj) setProject(proj);
      setAssetTimestamp(Date.now());
      alert("Neural voiceover synthesized successfully for all scenes!");
    } catch (err: any) {
      setError(err.message || "Failed to generate voiceover.");
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleGenerateSceneVoice = async (sceneId: string, overrideVoice?: string) => {
    setGeneratingSceneVoiceId(sceneId);
    try {
      const voiceToUse = overrideVoice || sceneSelectedVoices[sceneId] || selectedVoiceId || undefined;
      await generateSceneVoice(sceneId, voiceToUse);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
    } catch (err: any) {
      alert(err.message || "Failed to synthesize voice for this scene.");
    } finally {
      setGeneratingSceneVoiceId(null);
    }
  };

  const handleCreateScene = async () => {
    setAddingScene(true);
    try {
      if (addSceneMode === "manual" && !newSceneNarration.trim()) {
        alert("Please provide narration text for the scene.");
        setAddingScene(false);
        return;
      }

      await createScene(projectId, {
        generate_with_ai: addSceneMode === "ai",
        ai_prompt: addSceneMode === "ai" ? newSceneAiPrompt.trim() || undefined : undefined,
        insert_after_order: newSceneInsertAfter !== null ? Number(newSceneInsertAfter) : undefined,
        scene_title: newSceneTitle.trim() || undefined,
        narration_text: addSceneMode === "manual" ? newSceneNarration.trim() : undefined,
        visual_description: newSceneVisualDesc.trim() || undefined,
        preferred_visual_type: newSceneVisualType,
        stock_keywords: newSceneKeywords
          ? newSceneKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : undefined,
      });

      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      const proj = await fetchProjectById(projectId);
      if (proj) setProject(proj);
      setAssetTimestamp(Date.now());

      // Reset Modal Form
      setShowAddSceneModal(false);
      setNewSceneAiPrompt("");
      setNewSceneTitle("");
      setNewSceneNarration("");
      setNewSceneVisualDesc("");
      setNewSceneKeywords("");
      setNewSceneInsertAfter(null);
      alert("New scene successfully added to the documentary!");
    } catch (err: any) {
      alert(err.message || "Failed to add new scene.");
    } finally {
      setAddingScene(false);
    }
  };

  const handleAiRewriteScene = async () => {
    if (!rewriteModalScene) return;
    setIsRewriting(true);
    try {
      await aiRewriteScene(rewriteModalScene.id, rewriteInstructions.trim() || undefined);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
      setRewriteModalScene(null);
      setRewriteInstructions("");
      alert("Scene script enhanced with AI successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to rewrite scene script with AI.");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleSaveProjectDuration = async () => {
    if (customProjectDuration < 1 || customProjectDuration > 20) {
      alert("Target duration must be between 1 and 20 minutes.");
      return;
    }
    setSavingDuration(true);
    try {
      const updated = await updateProject(projectId, {
        settings: { target_duration_minutes: customProjectDuration },
      });
      setProject(updated);
      setShowDurationModal(false);
      alert(`Documentary target duration updated to ${customProjectDuration} minutes!`);
    } catch (err: any) {
      alert(err.message || "Failed to update target duration.");
    } finally {
      setSavingDuration(false);
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

  const handleUploadAsset = async (sceneId: string, file: File, cutSlot: number = 0) => {
    setUploadingSceneId(sceneId);
    try {
      await uploadSceneAsset(sceneId, file, cutSlot);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
      alert(`Media "${file.name}" uploaded to cut #${cutSlot === 0 ? "Main" : cutSlot + 1} and normalized to 1080p Full HD successfully!`);
    } catch (err: any) {
      alert(err.message || "Failed to upload asset.");
    } finally {
      setUploadingSceneId(null);
    }
  };

  const handleResetVisual = async (sceneId: string) => {
    if (!confirm("Are you sure you want to revert to the AI Archival visual? This will replace any custom uploaded media for this scene.")) return;
    setResettingSceneId(sceneId);
    try {
      await resetSceneVisual(sceneId);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setAssetTimestamp(Date.now());
    } catch (err: any) {
      alert(err.message || "Failed to reset scene visual.");
    } finally {
      setResettingSceneId(null);
    }
  };

  const handleStartEditScene = (scene: any) => {
    setEditingSceneId(scene.id);
    setSceneEditForm({
      scene_title: scene.scene_title || "",
      narration_text: scene.narration_text || "",
      visual_description: scene.visual_description || "",
      preferred_visual_type: scene.preferred_visual_type || "stock_footage",
      transition_preference: scene.transition_preference || "fade",
    });
  };

  const handleSaveScene = async (sceneId: string) => {
    setSavingScene(true);
    try {
      await updateScene(sceneId, sceneEditForm);
      const sc = await fetchScript(projectId);
      if (sc) setScript(sc);
      setEditingSceneId(null);
    } catch (err: any) {
      alert(err.message || "Failed to update scene.");
    } finally {
      setSavingScene(false);
    }
  };

  const handleDeleteScene = async (sceneId: string, sceneOrder: number) => {
    if (!confirm(`Are you sure you want to delete Scene #${sceneOrder}? The remaining scenes will be sequentially reordered.`)) {
      return;
    }
    setDeletingSceneId(sceneId);
    try {
      const updatedScript = await deleteScene(sceneId);
      if (updatedScript) setScript(updatedScript);
      const proj = await fetchProjectById(projectId);
      if (proj) setProject(proj);
      setAssetTimestamp(Date.now());
    } catch (err: any) {
      alert(err.message || "Failed to delete scene.");
    } finally {
      setDeletingSceneId(null);
    }
  };

  const handleDeleteCut = async (sceneId: string, slot: number) => {
    if (!confirm(`Remove Cut #${slot + 1}?`)) return;
    try {
      await deleteSceneCut(sceneId, slot);
      setSelectedSceneSlots((prev) => ({ ...prev, [sceneId]: 0 }));
      setAssetTimestamp(Date.now());
    } catch (err: any) {
      alert(err.message || "Failed to remove cut.");
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
            <div
              onClick={() => {
                setCustomProjectDuration(s.target_duration_minutes);
                setShowDurationModal(true);
              }}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all group flex items-center justify-between"
              title="Click to change or customize target duration"
            >
              <div>
                <span className="text-slate-500 text-[11px] block flex items-center gap-1">
                  <span>Duration</span>
                  <span className="text-[10px] text-emerald-400 group-hover:underline">(Edit)</span>
                </span>
                <span className="font-semibold text-emerald-400 mt-0.5 block">{s.target_duration_minutes} Mins</span>
              </div>
              <Clock className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
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
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
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
                    {/* Studio Voice Selector & Audio Preview */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/90 border border-slate-800">
                      <div className="flex items-center gap-1.5 px-2 text-xs text-slate-300">
                        <Mic className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold hidden sm:inline">Voice:</span>
                      </div>
                      <select
                        value={selectedVoiceId}
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[190px] truncate"
                      >
                        {availableVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.language} - {v.gender})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handlePlayVoicePreview(selectedVoiceId)}
                        disabled={isPlayingPreview || !selectedVoiceId}
                        className="p-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-800/40 transition-colors"
                        title="Listen to 2-second studio sample"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isPlayingPreview ? "animate-pulse text-emerald-400" : ""}`} />
                      </button>
                    </div>

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

                {/* Scene Controls & Add Scene Header */}
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Documentary Scenes Breakdown ({script.scenes.length})</span>
                  </h3>

                  <button
                    type="button"
                    onClick={() => {
                      setNewSceneInsertAfter(null);
                      setShowAddSceneModal(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add New Scene</span>
                  </button>
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

                          <div className="flex items-center gap-2">
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

                            {/* Scene Action Buttons: AI Rewrite, Voice, Edit & Delete */}
                            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                              <button
                                type="button"
                                title="Enhance or rewrite this scene's narration with Gemini AI"
                                onClick={() => {
                                  setRewriteModalScene(scene);
                                  setRewriteInstructions("");
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-purple-950/50 text-slate-400 hover:text-purple-300 border border-slate-800 hover:border-purple-800/40 transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              </button>

                              <button
                                type="button"
                                title="Synthesize or regenerate voice for this scene"
                                disabled={generatingSceneVoiceId === scene.id}
                                onClick={() => handleGenerateSceneVoice(scene.id)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-indigo-950/50 text-slate-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-800/40 transition-colors disabled:opacity-40"
                              >
                                <Mic className={`w-3.5 h-3.5 ${generatingSceneVoiceId === scene.id ? "animate-spin text-indigo-400" : "text-indigo-400"}`} />
                              </button>

                              <button
                                type="button"
                                title="Edit scene title, narration script, or visual style"
                                onClick={() => handleStartEditScene(scene)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Delete this scene from documentary"
                                disabled={deletingSceneId === scene.id || script.scenes.length <= 1}
                                onClick={() => handleDeleteScene(scene.id, scene.scene_order)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/40 transition-colors disabled:opacity-40"
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${deletingSceneId === scene.id ? "animate-spin text-rose-400" : ""}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Inline Scene Edit Form if editing */}
                        {editingSceneId === scene.id && (
                          <div className="p-4 rounded-xl bg-slate-900/95 border border-indigo-500/40 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Scene #{scene.scene_order} Details</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingSceneId(null)}
                                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingScene}
                                  onClick={() => handleSaveScene(scene.id)}
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 shadow-sm transition-all"
                                >
                                  <Save className={`w-3.5 h-3.5 ${savingScene ? "animate-spin" : ""}`} />
                                  <span>{savingScene ? "Saving..." : "Save Scene"}</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                  Scene Title:
                                </label>
                                <input
                                  type="text"
                                  value={sceneEditForm.scene_title}
                                  onChange={(e) =>
                                    setSceneEditForm((prev) => ({ ...prev, scene_title: e.target.value }))
                                  }
                                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                    Visual Type:
                                  </label>
                                  <select
                                    value={sceneEditForm.preferred_visual_type}
                                    onChange={(e) =>
                                      setSceneEditForm((prev) => ({
                                        ...prev,
                                        preferred_visual_type: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                                  >
                                    <option value="archival_photograph">Archival Photograph</option>
                                    <option value="stock_footage">Stock Footage</option>
                                    <option value="ai_image">AI Image</option>
                                    <option value="cinematic_concept">Cinematic Concept</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                    Transition:
                                  </label>
                                  <select
                                    value={sceneEditForm.transition_preference}
                                    onChange={(e) =>
                                      setSceneEditForm((prev) => ({
                                        ...prev,
                                        transition_preference: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                                  >
                                    <option value="fade">Fade</option>
                                    <option value="crossfade">Crossfade</option>
                                    <option value="cut">Direct Cut</option>
                                    <option value="zoom">Zoom</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Narration Voiceover Text:
                              </label>
                              <textarea
                                rows={3}
                                value={sceneEditForm.narration_text}
                                onChange={(e) =>
                                  setSceneEditForm((prev) => ({ ...prev, narration_text: e.target.value }))
                                }
                                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-y"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Visual Description / Direction:
                              </label>
                              <input
                                type="text"
                                value={sceneEditForm.visual_description}
                                onChange={(e) =>
                                  setSceneEditForm((prev) => ({
                                    ...prev,
                                    visual_description: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* Visual & Narration 2-Column Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Left Column: Multi-Cut Visual Studio (5 cols) */}
                          <div className="md:col-span-5 space-y-2.5">
                            {(() => {
                              const cuts = sceneCuts[scene.id] || [
                                {
                                  slot: 0,
                                  label: "Main Cut (01)",
                                  asset_type: asset?.file_path?.endsWith(".mp4") ? "video" : "image",
                                  is_user_upload: asset?.source_provider === "user_upload",
                                  source_provider: asset?.source_provider || "AI Visual",
                                  url: getSceneVisualUrl(scene.id, 0),
                                },
                              ];
                              const activeSlot = selectedSceneSlots[scene.id] ?? 0;
                              const activeCut = cuts.find((c) => c.slot === activeSlot) || cuts[0];
                              const isUserCut = !!activeCut?.is_user_upload;
                              const hasAnyUserCut = cuts.some((c) => c.is_user_upload);

                              return (
                                <>
                                  {/* Multi-Cut Selector Pills + [+ Add Cut] Button */}
                                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    {cuts.map((c) => {
                                      const isSelected = c.slot === activeSlot;
                                      return (
                                        <button
                                          key={c.slot}
                                          type="button"
                                          onClick={() =>
                                            setSelectedSceneSlots((prev) => ({
                                              ...prev,
                                              [scene.id]: c.slot,
                                            }))
                                          }
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border ${
                                            isSelected
                                              ? c.is_user_upload
                                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950"
                                                : "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-950"
                                              : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700"
                                          }`}
                                        >
                                          {c.is_user_upload ? (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                          ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                          )}
                                          <span>{c.label}</span>
                                          {c.asset_type === "video" && (
                                            <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-amber-300 uppercase">
                                              VID
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}

                                    {/* [+ Add New Cut] Button */}
                                    <label
                                      title="Add an extra video, image, or animation cut to this scene"
                                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all whitespace-nowrap border border-dashed border-indigo-500/50 hover:border-indigo-400 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 hover:text-white cursor-pointer shadow-sm shrink-0"
                                    >
                                      <Plus className="w-3 h-3 text-indigo-400" />
                                      <span>Add Cut</span>
                                      <input
                                        type="file"
                                        accept="image/*,video/mp4,video/quicktime,video/webm,video/x-matroska,image/gif"
                                        className="hidden"
                                        disabled={uploadingSceneId === scene.id}
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            const nextSlot = cuts.length;
                                            setSelectedSceneSlots((prev) => ({
                                              ...prev,
                                              [scene.id]: nextSlot,
                                            }));
                                            handleUploadAsset(scene.id, e.target.files[0], nextSlot);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>

                                  {/* Visual Preview Frame */}
                                  <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group shadow-inner">
                                    {activeCut?.asset_type === "video" ? (
                                      <video
                                        key={`${scene.id}-${activeSlot}-${assetTimestamp}`}
                                        src={`${getSceneVisualUrl(scene.id, activeSlot)}&t=${assetTimestamp}`}
                                        controls
                                        playsInline
                                        preload="auto"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <img
                                        key={`${scene.id}-${activeSlot}-${assetTimestamp}`}
                                        src={`${getSceneVisualUrl(scene.id, activeSlot)}&t=${assetTimestamp}`}
                                        alt={activeCut?.label || "Visual Preview"}
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src =
                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 1920 1080'><rect fill='%230f172a' width='100%' height='100%'/><text fill='%2364748b' x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48'>Visual Pending</text></svg>";
                                        }}
                                      />
                                    )}

                                    {/* Source Badge (Top Left) */}
                                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 pointer-events-none">
                                      {isUserCut ? (
                                        <div className="px-2 py-0.5 rounded-md bg-emerald-950/90 backdrop-blur-md text-[10px] font-bold text-emerald-300 border border-emerald-500/40 shadow-lg flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                          <span>USER {activeCut?.asset_type?.toUpperCase()}</span>
                                        </div>
                                      ) : (
                                        <div className="px-2 py-0.5 rounded-md bg-purple-950/90 backdrop-blur-md text-[10px] font-bold text-purple-300 border border-purple-500/40 shadow-lg flex items-center gap-1">
                                          <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                                          <span>
                                            AI &bull;{" "}
                                            {activeCut?.source_provider
                                              ? activeCut.source_provider.replace(/_/g, " ").toUpperCase()
                                              : "ARCHIVAL"}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Slot Number Badge (Top Right) */}
                                    <div className="absolute top-2 right-2 z-10 pointer-events-none">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[9px] font-mono text-slate-400 border border-slate-800">
                                        Slot {activeSlot + 1}/{cuts.length}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Media Management Action Buttons */}
                                  <div className="flex items-center gap-2 pt-0.5">
                                    <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-indigo-500 text-slate-200 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-sm group/btn">
                                      <UploadCloud className="w-3.5 h-3.5 text-indigo-400 group-hover/btn:scale-110 transition-transform" />
                                      <span>
                                        {uploadingSceneId === scene.id
                                          ? "Uploading..."
                                          : `Upload Media (${activeCut?.label || "Cut"})`}
                                      </span>
                                      <input
                                        type="file"
                                        accept="image/*,video/mp4,video/quicktime,video/webm,video/x-matroska,image/gif"
                                        className="hidden"
                                        disabled={uploadingSceneId === scene.id}
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleUploadAsset(scene.id, e.target.files[0], activeSlot);
                                          }
                                        }}
                                      />
                                    </label>

                                    {activeSlot > 0 && isUserCut && (
                                      <button
                                        type="button"
                                        title="Delete this custom cut slot"
                                        onClick={() => handleDeleteCut(scene.id, activeSlot)}
                                        className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-400 transition-all text-xs font-medium"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Delete Cut</span>
                                      </button>
                                    )}

                                    {hasAnyUserCut && (
                                      <button
                                        type="button"
                                        title="Revert all custom uploads for this scene and restore AI historical visual"
                                        onClick={() => handleResetVisual(scene.id)}
                                        disabled={resettingSceneId === scene.id}
                                        className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition-all text-xs font-medium disabled:opacity-50"
                                      >
                                        <RotateCcw
                                          className={`w-3.5 h-3.5 ${
                                            resettingSceneId === scene.id ? "animate-spin text-rose-400" : ""
                                          }`}
                                        />
                                        <span className="hidden sm:inline">Reset to AI</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Attribution & Metadata */}
                                  <div className="text-[10px] text-slate-500 flex items-center justify-between px-0.5">
                                    <span className="truncate">
                                      {isUserCut
                                        ? "Creator Custom Media (Broadcast 1080p Normalized)"
                                        : `Source: ${activeCut?.source_provider?.replace(/_/g, " ") || "Public Domain"}`}
                                    </span>
                                    <span className="text-[9px] text-slate-600 font-mono">
                                      {activeCut?.asset_type === "video" ? "MP4 Video" : "1080p Image"}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Right Column: Narration & Audio Studio (7 cols) */}
                          <div className="md:col-span-7 flex flex-col justify-between space-y-3">
                            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                                Voiceover Narration Script
                              </span>
                              <p className="text-xs text-slate-200 leading-relaxed font-sans">{scene.narration_text}</p>
                            </div>

                            {/* Scene-Specific Voice Selector & Narration Controls */}
                            {(() => {
                              const activeVoicePreset =
                                sceneSelectedVoices[scene.id] ||
                                scene.audio?.voice_preset ||
                                selectedVoiceId ||
                                "ur-PK-AsadNeural";
                              const currentVoiceObj = availableVoices.find((v) => v.id === activeVoicePreset);
                              const existingVoicePreset = scene.audio?.voice_preset;
                              const isVoiceChanged =
                                !!existingVoicePreset && existingVoicePreset !== activeVoicePreset;

                              return (
                                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                                      <Mic className="w-3.5 h-3.5 text-indigo-400" />
                                      <span>Scene Voice:</span>
                                    </span>
                                    {existingVoicePreset && (
                                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                        <span>Current:</span>
                                        <b className="text-indigo-300">
                                          {availableVoices.find((v) => v.id === existingVoicePreset)?.name ||
                                            existingVoicePreset}
                                        </b>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Multi-Voice Selector Dropdown */}
                                    <select
                                      value={activeVoicePreset}
                                      onChange={(e) =>
                                        setSceneSelectedVoices((prev) => ({
                                          ...prev,
                                          [scene.id]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 min-w-[190px] bg-slate-950 border border-slate-700 hover:border-indigo-500 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-sans truncate"
                                    >
                                      <optgroup label="Urdu Voices (اردو)">
                                        {availableVoices
                                          .filter((v) => v.language.toLowerCase() === "urdu")
                                          .map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name} ({v.locale.includes("PK") ? "Pakistan" : "India"} &bull;{" "}
                                              {v.tone.split(" ")[0]} {v.gender})
                                            </option>
                                          ))}
                                      </optgroup>
                                      <optgroup label="Hindi Voices (हिंदी)">
                                        {availableVoices
                                          .filter((v) => v.language.toLowerCase() === "hindi")
                                          .map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name} ({v.tone.split(" ")[0]} {v.gender})
                                            </option>
                                          ))}
                                      </optgroup>
                                      <optgroup label="English Voices (US / UK)">
                                        {availableVoices
                                          .filter((v) => v.language.toLowerCase() === "english")
                                          .map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name} ({v.locale.includes("GB") ? "BBC UK" : "US"} &bull;{" "}
                                              {v.gender})
                                            </option>
                                          ))}
                                      </optgroup>
                                      <optgroup label="Arabic & Spanish">
                                        {availableVoices
                                          .filter(
                                            (v) =>
                                              !["urdu", "hindi", "english"].includes(
                                                v.language.toLowerCase()
                                              )
                                          )
                                          .map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name} ({v.language} &bull; {v.gender})
                                            </option>
                                          ))}
                                      </optgroup>
                                    </select>

                                    {/* Play 2-Second Preview */}
                                    <button
                                      type="button"
                                      onClick={() => handlePlayVoicePreview(activeVoicePreset)}
                                      disabled={isPlayingPreview}
                                      className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-800/40 transition-colors"
                                      title={`Listen to sample of ${currentVoiceObj?.name || activeVoicePreset}`}
                                    >
                                      <Volume2
                                        className={`w-3.5 h-3.5 ${
                                          isPlayingPreview ? "animate-pulse text-emerald-400" : ""
                                        }`}
                                      />
                                    </button>

                                    {/* Synthesize / Apply Voice to This Scene Button */}
                                    <button
                                      type="button"
                                      disabled={generatingSceneVoiceId === scene.id}
                                      onClick={() =>
                                        handleGenerateSceneVoice(scene.id, activeVoicePreset)
                                      }
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 ${
                                        hasAudio
                                          ? isVoiceChanged
                                            ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40"
                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40"
                                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
                                      }`}
                                      title="Generate voiceover for this scene with selected voice"
                                    >
                                      <Mic
                                        className={`w-3.5 h-3.5 ${
                                          generatingSceneVoiceId === scene.id ? "animate-spin" : ""
                                        }`}
                                      />
                                      <span>
                                        {generatingSceneVoiceId === scene.id
                                          ? "Synthesizing..."
                                          : hasAudio
                                          ? isVoiceChanged
                                            ? "Apply Voice"
                                            : "Re-Voice"
                                          : "Synthesize Audio"}
                                      </span>
                                    </button>
                                  </div>

                                  {/* Audio Player if generated */}
                                  {hasAudio ? (
                                    <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex items-center gap-3 mt-1">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                                        <Volume2 className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                          <span className="font-semibold text-slate-300">
                                            {currentVoiceObj?.name || "Neural Voice"} Narration
                                          </span>
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
                                    <div className="p-2 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-[11px] text-slate-400 flex items-center justify-between mt-1">
                                      <span>Audio not synthesized yet for this scene</span>
                                      <span className="text-[10px] text-indigo-400 font-semibold">
                                        Select voice above & click Synthesize
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
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

                {/* Bottom Add Scene Trigger */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setNewSceneInsertAfter(null);
                      setShowAddSceneModal(true);
                    }}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 text-emerald-400 hover:text-emerald-300 border border-dashed border-emerald-500/30 hover:border-emerald-500/60 text-xs font-semibold transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Another Scene to Documentary</span>
                  </button>
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
                      {videoPlayerError ? (
                        <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
                          <AlertCircle className="w-10 h-10 text-rose-400" />
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white">Video Stream Failed to Start</h4>
                            <p className="text-xs text-slate-400 max-w-md">
                              {videoPlayerError}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => {
                                setVideoPlayerError(null);
                                setVideoTimestamp(Date.now());
                              }}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Retry Stream</span>
                            </button>
                            <a
                              href={getVideoStreamUrl(projectId, { version: selectedVersionNum || latestVideo.version_number, download: true })}
                              download={`documentary_v${selectedVersionNum || latestVideo.version_number}.mp4`}
                              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download File</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <video
                          key={`${selectedVersionNum || latestVideo.version_number}-${videoTimestamp}`}
                          src={getVideoStreamUrl(projectId, { version: selectedVersionNum || latestVideo.version_number, t: videoTimestamp })}
                          controls
                          playsInline
                          crossOrigin="anonymous"
                          preload="auto"
                          className="w-full aspect-video bg-black"
                          poster={script?.scenes[0]?.id ? getSceneVisualUrl(script.scenes[0].id, { t: assetTimestamp }) : undefined}
                          onError={(e) => {
                            const err = (e.target as HTMLVideoElement).error;
                            console.error("Video player error:", err);
                            setVideoPlayerError(
                              err
                                ? `Media Error Code ${err.code}: ${err.message || "Could not decode video stream"}`
                                : "Playback could not be initialized."
                            );
                          }}
                        >
                          <track
                            kind="subtitles"
                            src={getVideoSubtitlesUrl(projectId, "vtt", { version: selectedVersionNum || latestVideo.version_number, t: videoTimestamp })}
                            srcLang="en"
                            label="English"
                            default
                          />
                          Your browser does not support HTML5 video streaming.
                        </video>
                      )}
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
                            href={getVideoStreamUrl(projectId, { version: selectedVersionNum || latestVideo.version_number, download: true })}
                            download={`documentary_v${selectedVersionNum || latestVideo.version_number}.mp4`}
                            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-rose-400" />
                            <span>Download MP4</span>
                          </a>

                          <a
                            href={getVideoSubtitlesUrl(projectId, "srt", { version: selectedVersionNum || latestVideo.version_number, download: true })}
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

      {/* Modal 1: + Add New Scene Modal */}
      {showAddSceneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-slate-950 border border-slate-800 p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-white">Add New Scene to Documentary</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSceneModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddSceneMode("ai")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  addSceneMode === "ai"
                    ? "bg-purple-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Write with AI (AI se likhwayen)</span>
              </button>
              <button
                type="button"
                onClick={() => setAddSceneMode("manual")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  addSceneMode === "manual"
                    ? "bg-emerald-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manual Script (Khod likhein)</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              {/* Common: Position selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Insert Scene Position:
                </label>
                <select
                  value={newSceneInsertAfter === null ? "end" : newSceneInsertAfter.toString()}
                  onChange={(e) =>
                    setNewSceneInsertAfter(e.target.value === "end" ? null : parseInt(e.target.value, 10))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="end">At the end of documentary (Scene #{script?.scenes ? script.scenes.length + 1 : 1})</option>
                  {script?.scenes.map((s) => (
                    <option key={s.id} value={s.scene_order}>
                      After Scene #{s.scene_order}: {s.scene_title || s.scene_id_str}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode A: Write with AI */}
              {addSceneMode === "ai" ? (
                <div className="space-y-3.5 p-4 rounded-xl bg-purple-950/20 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-300 font-semibold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gemini AI will write narration matching {project?.settings?.language || "Documentary"} language & tone.</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Scene Topic or Direction (Optional):
                    </label>
                    <textarea
                      rows={3}
                      value={newSceneAiPrompt}
                      onChange={(e) => setNewSceneAiPrompt(e.target.value)}
                      placeholder="e.g. Write about the 1965 Tashkent declaration and its diplomatic consequences, or leave empty to naturally continue the story."
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Optional Custom Title:
                      </label>
                      <input
                        type="text"
                        value={newSceneTitle}
                        onChange={(e) => setNewSceneTitle(e.target.value)}
                        placeholder="Leave blank for AI title"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Visual Style:
                      </label>
                      <select
                        value={newSceneVisualType}
                        onChange={(e) => setNewSceneVisualType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                      >
                        <option value="archival_photograph">Archival Photograph</option>
                        <option value="stock_footage">Stock Footage</option>
                        <option value="ai_image">AI Image</option>
                        <option value="cinematic_concept">Cinematic Concept</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode B: Manual Script Input */
                <div className="space-y-3.5 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Scene Title:
                    </label>
                    <input
                      type="text"
                      value={newSceneTitle}
                      onChange={(e) => setNewSceneTitle(e.target.value)}
                      placeholder="e.g. The Turning Point"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Voiceover Narration Script: <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Language: {project?.settings?.language || "English"}
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={newSceneNarration}
                      onChange={(e) => setNewSceneNarration(e.target.value)}
                      placeholder={`Enter the voiceover script in ${project?.settings?.language || "your preferred language"}...`}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Visual Direction / What Should Appear on Screen:
                    </label>
                    <textarea
                      rows={2}
                      value={newSceneVisualDesc}
                      onChange={(e) => setNewSceneVisualDesc(e.target.value)}
                      placeholder="e.g. Historical black-and-white footage of leaders signing documents at the summit table."
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Preferred Visual Type:
                      </label>
                      <select
                        value={newSceneVisualType}
                        onChange={(e) => setNewSceneVisualType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="archival_photograph">Archival Photograph</option>
                        <option value="stock_footage">Stock Footage</option>
                        <option value="ai_image">AI Image</option>
                        <option value="user_upload">Creator Custom Upload</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Stock Search Keywords:
                      </label>
                      <input
                        type="text"
                        value={newSceneKeywords}
                        onChange={(e) => setNewSceneKeywords(e.target.value)}
                        placeholder="e.g. diplomacy, treaty, leaders"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddSceneModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addingScene || (addSceneMode === "manual" && !newSceneNarration.trim())}
                onClick={handleCreateScene}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 ${
                  addSceneMode === "ai"
                    ? "bg-purple-600 hover:bg-purple-500 shadow-purple-950/40"
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40"
                }`}
              >
                {addSceneMode === "ai" ? (
                  <Sparkles className={`w-3.5 h-3.5 ${addingScene ? "animate-spin" : ""}`} />
                ) : (
                  <Plus className={`w-3.5 h-3.5 ${addingScene ? "animate-spin" : ""}`} />
                )}
                <span>
                  {addingScene
                    ? addSceneMode === "ai"
                      ? "Generating Scene with AI..."
                      : "Adding Scene..."
                    : addSceneMode === "ai"
                    ? "Generate Scene with AI"
                    : "Add Scene to Documentary"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: ✨ AI Script Rewrite Modal */}
      {rewriteModalScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-purple-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    AI Script Rewrite &bull; Scene #{rewriteModalScene.scene_order}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {rewriteModalScene.scene_title || rewriteModalScene.scene_id_str}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRewriteModalScene(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Current Narration Text:
                </span>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed font-sans max-h-32 overflow-y-auto">
                  {rewriteModalScene.narration_text}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1 flex items-center justify-between">
                  <span>How should Gemini improve or rewrite this scene?</span>
                  <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                </label>
                <textarea
                  rows={3}
                  value={rewriteInstructions}
                  onChange={(e) => setRewriteInstructions(e.target.value)}
                  placeholder="e.g. Make it more intense and dramatic, explain the treaty terms in deeper detail, or polish Urdu/Hindi phrasing. Leave empty for automatic cinematic enhancement."
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRewriteModalScene(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRewriting}
                onClick={handleAiRewriteScene}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-950/40 transition-all disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRewriting ? "animate-spin" : ""}`} />
                <span>{isRewriting ? "Rewriting with Gemini AI..." : "Enhance with Gemini AI"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Target Duration Customization Modal */}
      {showDurationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-emerald-500/30 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Customize Target Duration</h3>
                  <span className="text-[11px] text-slate-400">Hard limit: 1 to 20 minutes</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDurationModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-2">
                  Quick Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[3, 5, 8, 10, 11, 15, 20].map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setCustomProjectDuration(m)}
                      className={`px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                        customProjectDuration === m
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {m === 11 ? "★ 11 Mins" : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact Stepper & Slider */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Exact Duration:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomProjectDuration(Math.max(1, customProjectDuration - 1))}
                      disabled={customProjectDuration <= 1}
                      className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={customProjectDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setCustomProjectDuration(Math.max(1, Math.min(20, val)));
                      }}
                      className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-center font-bold text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomProjectDuration(Math.min(20, customProjectDuration + 1))}
                      disabled={customProjectDuration >= 20}
                      className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                    <span className="text-slate-400 font-medium">Minutes</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={20}
                  value={customProjectDuration}
                  onChange={(e) => setCustomProjectDuration(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center text-[10px]">
                  <div>
                    <span className="text-slate-500 block">Paced Words</span>
                    <span className="font-bold text-indigo-400">~{customProjectDuration * 135}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Scenes</span>
                    <span className="font-bold text-emerald-400">
                      ~{Math.max(4, Math.min(24, Math.round((customProjectDuration * 60) / 45)))}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Runtime</span>
                    <span className="font-bold text-amber-400">{customProjectDuration * 60}s</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDurationModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingDuration}
                onClick={handleSaveProjectDuration}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${savingDuration ? "animate-spin" : ""}`} />
                <span>{savingDuration ? "Saving..." : "Save Target Duration"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
