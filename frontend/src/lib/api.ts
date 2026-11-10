import { Project, ProjectSettings, ProjectCreateInput, HealthStatus, ScriptRevisionData } from "@/types/project";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE_URL}/projects/`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch projects: HTTP ${res.status}`);
  return res.json();
}

export async function fetchProjectById(id: string): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch project ${id}: HTTP ${res.status}`);
  return res.json();
}

export async function createProject(input: ProjectCreateInput): Promise<Project> {
  if (input.settings.target_duration_minutes > 20) {
    throw new Error("Maximum video duration allowed is 20 minutes.");
  }

  const res = await fetch(`${API_BASE_URL}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    const errorMsg = errorData?.detail?.[0]?.msg || errorData?.detail || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return res.json();
}

export interface ProjectUpdateInput {
  title?: string;
  topic?: string;
  description?: string;
  status?: string;
  settings?: Partial<ProjectSettings>;
}

export async function updateProject(id: string, data: ProjectUpdateInput): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Failed to update project: HTTP ${res.status}`);
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete project: HTTP ${res.status}`);
}

// Script & Scene Planning APIs
export async function generateScript(projectId: string): Promise<ScriptRevisionData> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/generate-script`, {
    method: "POST",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Script generation failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchScript(projectId: string): Promise<ScriptRevisionData | null> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/script`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch script: HTTP ${res.status}`);
  return res.json();
}

export async function updateScript(
  projectId: string,
  data: { title_hook?: string; full_script?: string; conclusion?: string }
): Promise<ScriptRevisionData> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/script`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Failed to update script: HTTP ${res.status}`);
  return res.json();
}

// Voiceover Narration APIs
export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  locale: string;
  gender: "male" | "female" | "neutral" | string;
  tone: string;
  preview_text: string;
  is_cloned?: boolean;
}

export interface ClonedVoiceData {
  id: string;
  raw_id: string;
  name: string;
  language: string;
  gender: string;
  duration_seconds: number;
  provider: string;
  created_at?: string;
  is_cloned: boolean;
}

export async function uploadVoiceClone(
  name: string,
  audioFile: Blob | File,
  language: string = "All Languages",
  gender: string = "neutral"
): Promise<{ status: string; message: string; voice: ClonedVoiceData }> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("file", audioFile, audioFile instanceof File ? audioFile.name : "recording.webm");
  formData.append("language", language);
  formData.append("gender", gender);

  const res = await fetch(`${API_BASE_URL}/projects/voices/clone`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Voice cloning failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchClonedVoices(): Promise<ClonedVoiceData[]> {
  const res = await fetch(`${API_BASE_URL}/projects/voices/clones`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch cloned voices: HTTP ${res.status}`);
  return res.json();
}

export async function deleteVoiceClone(cloneId: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/projects/voices/clones/${encodeURIComponent(cloneId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete cloned voice: HTTP ${res.status}`);
  return res.json();
}

export async function fetchVoices(language?: string): Promise<VoiceOption[]> {
  const url = language
    ? `${API_BASE_URL}/projects/voices?language=${encodeURIComponent(language)}`
    : `${API_BASE_URL}/projects/voices`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch voices: HTTP ${res.status}`);
  return res.json();
}

export function getVoicePreviewUrl(voiceId: string): string {
  return `${API_BASE_URL}/projects/voices/preview/${encodeURIComponent(voiceId)}`;
}

export async function generateProjectVoice(projectId: string, voicePreset?: string): Promise<any> {
  const url = voicePreset
    ? `${API_BASE_URL}/projects/${projectId}/generate-voice?voice_preset=${encodeURIComponent(voicePreset)}`
    : `${API_BASE_URL}/projects/${projectId}/generate-voice`;
  const res = await fetch(url, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Voice generation failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function generateSceneVoice(sceneId: string, voicePreset?: string): Promise<any> {
  const url = voicePreset
    ? `${API_BASE_URL}/projects/scenes/${sceneId}/generate-voice?voice_preset=${encodeURIComponent(voicePreset)}`
    : `${API_BASE_URL}/projects/scenes/${sceneId}/generate-voice`;
  const res = await fetch(url, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Failed to generate scene voice: HTTP ${res.status}`);
  }
  return res.json();
}

export function getSceneAudioUrl(sceneId: string): string {
  return `${API_BASE_URL}/projects/scenes/${sceneId}/audio`;
}

// Visual Asset Engine APIs
export async function generateProjectVisuals(projectId: string, forceRegenerate: boolean = false): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/generate-visuals?force_regenerate=${forceRegenerate}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Visuals generation failed: HTTP ${res.status}`);
  }
  return res.json();
}

export function getSceneVisualUrl(
  sceneId: string,
  slotOrOptions?: number | null | { slot?: number; t?: number },
  timestamp?: number
): string {
  const params = new URLSearchParams();
  if (typeof slotOrOptions === "object" && slotOrOptions !== null) {
    if (slotOrOptions.slot !== undefined && slotOrOptions.slot !== null) {
      params.set("slot", slotOrOptions.slot.toString());
    }
    if (slotOrOptions.t) params.set("t", slotOrOptions.t.toString());
  } else {
    if (slotOrOptions !== undefined && slotOrOptions !== null) {
      params.set("slot", slotOrOptions.toString());
    }
    if (timestamp) params.set("t", timestamp.toString());
  }
  const qs = params.toString();
  return `${API_BASE_URL}/projects/scenes/${sceneId}/visual${qs ? `?${qs}` : ""}`;
}

export async function uploadSceneAsset(sceneId: string, file: File, cutSlot: number = 0): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}/upload-asset?cut_slot=${cutSlot}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Upload asset failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function resetSceneVisual(sceneId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}/reset-visual`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Reset visual failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSceneCuts(sceneId: string): Promise<{
  scene_id: string;
  scene_order: number;
  scene_title?: string;
  total_cuts: number;
  cuts: Array<{
    slot: number;
    label: string;
    asset_type: "image" | "video";
    is_user_upload: boolean;
    source_provider: string;
    url: string;
  }>;
}> {
  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}/cuts`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch scene cuts: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteSceneCut(sceneId: string, slot: number): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}/cuts/${slot}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Failed to delete cut: HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateScene(sceneId: string, updateIn: {
  scene_title?: string;
  purpose?: string;
  narration_text?: string;
  visual_description?: string;
  preferred_visual_type?: string;
  stock_keywords?: string[];
  on_screen_text?: string;
  transition_preference?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateIn),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Failed to update scene: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteScene(sceneId: string): Promise<ScriptRevisionData> {
  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Failed to delete scene: HTTP ${res.status}`);
  }
  return res.json();
}

export async function createScene(
  projectId: string,
  input: {
    generate_with_ai?: boolean;
    ai_prompt?: string;
    insert_after_order?: number;
    scene_title?: string;
    purpose?: string;
    narration_text?: string;
    visual_description?: string;
    preferred_visual_type?: string;
    stock_keywords?: string[];
    on_screen_text?: string;
    transition_preference?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/scenes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Failed to create scene: HTTP ${res.status}`);
  }
  return res.json();
}

export async function aiRewriteScene(sceneId: string, instructions?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/scenes/${sceneId}/ai-rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions: instructions || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `AI rewrite failed: HTTP ${res.status}`);
  }
  return res.json();
}

// Phase 6: Video Rendering Engine APIs
export async function startVideoRender(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/render`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Rendering start failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchRenderStatus(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/render-status`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch render status: HTTP ${res.status}`);
  return res.json();
}

export function getVideoStreamUrl(
  projectId: string,
  versionOrOptions?: number | null | { version?: number | null; download?: boolean; t?: number },
  download?: boolean,
  timestamp?: number
): string {
  const params = new URLSearchParams();
  if (typeof versionOrOptions === "object" && versionOrOptions !== null) {
    if (versionOrOptions.version !== undefined && versionOrOptions.version !== null) {
      params.set("version", versionOrOptions.version.toString());
    }
    if (versionOrOptions.download) params.set("download", "true");
    if (versionOrOptions.t) params.set("t", versionOrOptions.t.toString());
  } else {
    if (versionOrOptions !== undefined && versionOrOptions !== null) {
      params.set("version", versionOrOptions.toString());
    }
    if (download) params.set("download", "true");
    if (timestamp) params.set("t", timestamp.toString());
  }
  const qs = params.toString();
  return `${API_BASE_URL}/projects/${projectId}/video${qs ? `?${qs}` : ""}`;
}

export function getVideoSubtitlesUrl(
  projectId: string,
  format: string = "vtt",
  versionOrOptions?: number | null | { version?: number | null; download?: boolean; t?: number },
  timestamp?: number
): string {
  const params = new URLSearchParams();
  params.set("format", format);
  if (typeof versionOrOptions === "object" && versionOrOptions !== null) {
    if (versionOrOptions.version !== undefined && versionOrOptions.version !== null) {
      params.set("version", versionOrOptions.version.toString());
    }
    if (versionOrOptions.download) params.set("download", "true");
    if (versionOrOptions.t) params.set("t", versionOrOptions.t.toString());
  } else {
    if (versionOrOptions !== undefined && versionOrOptions !== null) {
      params.set("version", versionOrOptions.toString());
    }
    if (timestamp) params.set("t", timestamp.toString());
  }
  return `${API_BASE_URL}/projects/${projectId}/subtitles?${params.toString()}`;
}

export async function fetchVideoVersions(projectId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/versions`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch video versions: HTTP ${res.status}`);
  return res.json();
}

export async function regenerateSubtitles(projectId: string, version?: number): Promise<any> {
  const q = version ? `?version=${version}` : "";
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/subtitles/regenerate${q}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to regenerate subtitles: HTTP ${res.status}`);
  return res.json();
}

// Phase 7: Quality Control & AI Modification APIs
export async function fetchQualityCheck(projectId: string, version?: number): Promise<any> {
  const vParam = version ? `?version=${version}` : "";
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/quality-check${vParam}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch quality check: HTTP ${res.status}`);
  return res.json();
}

export async function runQualityCheck(projectId: string, version?: number): Promise<any> {
  const vParam = version ? `?version=${version}` : "";
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/quality-check${vParam}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Quality check failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function submitAiModification(
  projectId: string,
  prompt: string,
  autoRerender: boolean = true
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, auto_rerender: autoRerender }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `AI modification failed: HTTP ${res.status}`);
  }
  return res.json();
}

// Phase 8: Human Approval Gate & YouTube Publishing APIs
export async function approveVideoVersion(
  projectId: string,
  payload: {
    video_version_id: string;
    confirmed_checksum: string;
    upload_settings: any;
    user_confirmation_statement?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/publishing/${projectId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Approval failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function revokeVideoApproval(
  projectId: string,
  payload: {
    video_version_id: string;
    reason?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/publishing/${projectId}/revoke-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Revoke approval failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchVideoApproval(
  projectId: string,
  videoVersionId?: string
): Promise<any> {
  const vParam = videoVersionId ? `?video_version_id=${videoVersionId}` : "";
  const res = await fetch(`${API_BASE_URL}/publishing/${projectId}/approval${vParam}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch approval status: HTTP ${res.status}`);
  return res.json();
}

export async function publishToYouTube(
  projectId: string,
  payload: {
    video_version_id: string;
    approval_id: string;
    expected_checksum: string;
  },
  forceSandbox: boolean = false
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/publishing/${projectId}/publish?force_sandbox=${forceSandbox}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Publishing to YouTube failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchPublishStatus(
  projectId: string,
  videoVersionId?: string
): Promise<any> {
  const vParam = videoVersionId ? `?video_version_id=${videoVersionId}` : "";
  const res = await fetch(`${API_BASE_URL}/publishing/${projectId}/publish-status${vParam}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch publish status: HTTP ${res.status}`);
  return res.json();
}

export async function fetchYouTubeStatus(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/publishing/youtube/status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch YouTube status: HTTP ${res.status}`);
  return res.json();
}

export async function fetchYouTubeAuthUrl(redirectUri?: string): Promise<any> {
  const rParam = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : "";
  const res = await fetch(`${API_BASE_URL}/publishing/youtube/auth-url${rParam}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch OAuth URL: HTTP ${res.status}`);
  return res.json();
}
