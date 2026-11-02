"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Clock, Sparkles, Mic, Layers, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";
import { createProject } from "@/lib/api";

export default function CreateDocumentaryPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State with sensible defaults
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(10);
  const [customDurationInput, setCustomDurationInput] = useState<string>("10");
  const [isCustomDuration, setIsCustomDuration] = useState(false);

  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("documentary");
  const [audienceLevel, setAudienceLevel] = useState("general");
  const [narrationPreset, setNarrationPreset] = useState("deep_male_cinematic");
  const [scenePlanningMode, setScenePlanningMode] = useState<"automatic" | "manual">("automatic");
  const [desiredSceneCount, setDesiredSceneCount] = useState<number>(8);
  const [visualStrategy, setVisualStrategy] = useState("hybrid");

  // Duration Validation Logic
  const handleDurationPresetClick = (mins: number) => {
    setIsCustomDuration(false);
    setDuration(mins);
    setCustomDurationInput(mins.toString());
    setError(null);
  };

  const handleCustomDurationChange = (val: string) => {
    setCustomDurationInput(val);
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      setDuration(0);
      setError("Please enter a valid number of minutes.");
      return;
    }

    if (parsed > 20) {
      setDuration(parsed);
      setError("Maximum video duration allowed is 20 minutes.");
    } else if (parsed < 1) {
      setDuration(parsed);
      setError("Video duration must be at least 1 minute.");
    } else {
      setDuration(parsed);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !topic.trim()) {
      setError("Title and Topic are required.");
      return;
    }

    if (duration > 20) {
      setError("Maximum video duration allowed is 20 minutes.");
      return;
    }

    if (duration < 1) {
      setError("Video duration must be at least 1 minute.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newProject = await createProject({
        title: title.trim(),
        topic: topic.trim(),
        description: description.trim() || undefined,
        settings: {
          target_duration_minutes: duration,
          language,
          tone,
          audience_level: audienceLevel,
          narration_preset: narrationPreset,
          scene_planning_mode: scenePlanningMode,
          desired_scene_count: scenePlanningMode === "manual" ? desiredSceneCount : undefined,
          aspect_ratio: "16:9",
          resolution: "1080p",
          visual_strategy: visualStrategy,
        },
      });

      // Redirect directly to the project's workspace
      router.push(`/projects/${newProject.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create documentary project.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
          <Film className="w-3.5 h-3.5" />
          Documentary Production Wizard
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create a New AI Documentary</h1>
        <p className="text-slate-400 text-sm mt-1">
          Define your topic, narrative tone, and format. AI will plan scenes and voiceovers, subject to your approval.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300 text-sm animate-shake">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Project Identity */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            1. Core Topic & Title
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Documentary Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., The Lost Secrets of the Indus Valley Civilization"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Topic / Subject Premise *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe what the documentary should explore, key questions, historical events, or scientific facts..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Creative Direction / Angle (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Dark investigative style, cinematic hook, focus on archaeological discoveries"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Duration & Pacing (Strict 20-Min Enforced) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              2. Target Duration (Hard Maximum: 20 Minutes)
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              System Cap: 20m
            </span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[5, 10, 15, 20].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => handleDurationPresetClick(mins)}
                  className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${
                    !isCustomDuration && duration === mins
                      ? "bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-950/40"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {mins} Minutes
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomDuration(true)}
                className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  isCustomDuration
                    ? "bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-950/40"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                Custom
              </button>
            </div>

            {isCustomDuration && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="block text-xs font-medium text-slate-400">
                  Custom Duration in Minutes (1 to 20):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={customDurationInput}
                    onChange={(e) => handleCustomDurationChange(e.target.value)}
                    className="w-32 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-xs text-slate-400">minutes</span>
                </div>
                {duration > 20 && (
                  <p className="text-xs text-rose-400 font-semibold mt-1">
                    ⚠️ Maximum video duration allowed is 20 minutes. Larger videos cannot be processed.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Tone, Language & Voice Style */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-indigo-400" />
            3. Tone & Narration Style
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Documentary Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="documentary">Standard Documentary</option>
                <option value="cinematic">Cinematic & Dramatic</option>
                <option value="investigative">Investigative & Mystery</option>
                <option value="educational">Educational & Explanatory</option>
                <option value="storytelling">Storytelling & Narrative</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Narration Voice Preset
              </label>
              <select
                value={narrationPreset}
                onChange={(e) => setNarrationPreset(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="deep_male_cinematic">Deep Male Cinematic (Piper)</option>
                <option value="natural_male">Natural Male Narrator (Piper)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="English">English</option>
                <option value="Urdu">Urdu</option>
                <option value="Hindi">Hindi</option>
                <option value="Spanish">Spanish</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 4: Scene Planning & Visual Strategy */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            4. Scene Planning & Visual Strategy
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Scene Planning Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScenePlanningMode("automatic")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    scenePlanningMode === "automatic"
                      ? "bg-rose-500/20 border-rose-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Automatic (AI decides)
                </button>
                <button
                  type="button"
                  onClick={() => setScenePlanningMode("manual")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    scenePlanningMode === "manual"
                      ? "bg-rose-500/20 border-rose-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Manual Count
                </button>
              </div>

              {scenePlanningMode === "manual" && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1">Desired Scene Count:</label>
                  <input
                    type="number"
                    min={3}
                    max={30}
                    value={desiredSceneCount}
                    onChange={(e) => setDesiredSceneCount(parseInt(e.target.value, 10) || 5)}
                    className="w-24 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Visual Strategy
              </label>
              <select
                value={visualStrategy}
                onChange={(e) => setVisualStrategy(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="hybrid">Hybrid (Pexels Stock + AI Images + Code Diagrams)</option>
                <option value="stock_first">Stock Footage Priority (Pexels)</option>
                <option value="ai_images">AI Imagery Priority</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Project data persists automatically in Supabase PostgreSQL</span>
          </div>

          <button
            type="submit"
            disabled={submitting || duration > 20 || duration < 1}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02]"
          >
            <span>{submitting ? "Saving to Supabase..." : "Create Project & Open Workspace"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

