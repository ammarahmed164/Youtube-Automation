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

