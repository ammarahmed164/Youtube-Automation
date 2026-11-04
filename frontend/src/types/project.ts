export interface ProjectSettings {
  id?: string;
  target_duration_minutes: number;
  language: string;
  tone: string;
  audience_level: string;
  narration_preset: string;
  scene_planning_mode: "automatic" | "manual";
  desired_scene_count?: number | null;
  aspect_ratio: string;
  resolution: string;
  visual_strategy: string;
}

export interface Project {
  id: string;
  user_id?: string | null;
  title: string;
  topic: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  settings?: ProjectSettings | null;
}

export interface ProjectCreateInput {
  title: string;
  topic: string;
  description?: string;
  settings: {
    target_duration_minutes: number;
    language: string;
    tone: string;
    audience_level: string;
    narration_preset: string;
    scene_planning_mode: string;
    desired_scene_count?: number | null;
    aspect_ratio: string;
    resolution: string;
    visual_strategy: string;
  };
}

export interface HealthStatus {
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

export interface SceneAssetItem {
  id: string;
  asset_type: string;
  source_provider?: string | null;
  source_url?: string | null;
  file_path: string;
  attribution?: string | null;
  license_notes?: string | null;
  duration_seconds?: number | null;
}

export interface AudioAssetItem {
  id: string;
  voice_preset: string;
  file_path: string;
  duration_seconds: number;
}

export interface SceneItem {
  id: string;
  scene_order: number;
  scene_id_str: string;
  scene_title?: string | null;
  purpose?: string | null;
  narration_text: string;
  estimated_duration_seconds?: number | null;
  actual_audio_duration_seconds?: number | null;
  visual_description?: string | null;
  preferred_visual_type: string;
  stock_keywords?: string[] | null;
  image_prompt?: string | null;
  on_screen_text?: string | null;
  transition_preference: string;
  assets?: SceneAssetItem[];
  audio?: AudioAssetItem | null;
}

export interface ScriptRevisionData {
  id: string;
  project_id: string;
  revision_number: number;
  title_hook?: string | null;
  full_script: string;
  conclusion?: string | null;
  research_sources?: Array<{
    claim: string;
    source_note: string;
    verification_status: string;
  }> | null;
  created_at: string;
  scenes: SceneItem[];
}

export interface VideoVersionData {
  id: string;
  project_id: string;
  version_number: number;
  file_path: string;
  file_checksum: string;
  duration_seconds: number;
  resolution: string;
  render_settings?: Record<string, any> | null;
  created_at: string;
}

export interface RenderJobStatus {
  job_id: string;
  project_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  log_messages?: string[] | null;
  error_details?: string | null;
  video_version?: VideoVersionData | null;
}

export interface QualityCheckDetail {
  passed: boolean;
  status_label: string;
  message: string;
  [key: string]: any;
}

export interface QualityCheckData {
  id: string;
  video_version_id: string;
  passed: boolean;
  overall_status: string;
  score_percent: number;
  check_results: Record<string, QualityCheckDetail>;
  warnings: string[];
  created_at: string;
}

export interface ModificationResultData {
  status: string;
  project_id: string;
  plan_summary: string;
  affected_scenes: number[];
  re_rendered: boolean;
  new_video_version?: VideoVersionData | null;
  quality_check?: QualityCheckData | null;
  message: string;
}

export interface UploadMetadataForm {
  title: string;
  description: string;
  tags: string[];
  category_id: string;
  privacy_status: "private" | "unlisted" | "public";
  notify_subscribers: boolean;
}

export interface VideoApprovalData {
  id: string;
  project_id: string;
  video_version_id: string;
  file_checksum: string;
  upload_settings: UploadMetadataForm;
  approved_at: string;
  is_revoked: boolean;
  revoked_at?: string | null;
  revocation_reason?: string | null;
}

export interface YouTubeUploadData {
  id: string;
  project_id: string;
  video_version_id: string;
  approval_id: string;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  status: "uploading" | "published" | "failed";
  upload_metadata: Record<string, any>;
  error_message?: string | null;
  created_at: string;
}

export interface YouTubeAccountData {
  connected: boolean;
  configured: boolean;
  id?: string | null;
  channel_id?: string | null;
  channel_title?: string | null;
  message: string;
}
