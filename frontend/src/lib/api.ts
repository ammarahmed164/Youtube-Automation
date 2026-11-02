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
