import { Project, ProjectCreateInput, HealthStatus, ScriptRevisionData } from "@/types/project";

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

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
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
export async function generateProjectVoice(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/generate-voice`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `Voice generation failed: HTTP ${res.status}`);
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

export function getSceneVisualUrl(sceneId: string, slot?: number): string {
  const slotParam = slot !== undefined ? `?slot=${slot}` : "";
  return `${API_BASE_URL}/projects/scenes/${sceneId}/visual${slotParam}`;
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

export function getVideoStreamUrl(projectId: string, version?: number): string {
  const vParam = version ? `?version=${version}` : "";
  return `${API_BASE_URL}/projects/${projectId}/video${vParam}`;
}

export function getVideoSubtitlesUrl(projectId: string, format: string = "vtt", version?: number): string {
  const vParam = version ? `&version=${version}` : "";
  return `${API_BASE_URL}/projects/${projectId}/subtitles?format=${format}${vParam}`;
}

export async function fetchVideoVersions(projectId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/versions`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch video versions: HTTP ${res.status}`);
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
