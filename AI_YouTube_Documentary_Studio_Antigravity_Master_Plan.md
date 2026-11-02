# AI YouTube Documentary Studio

## Complete Product Requirements, Technical Architecture & Master Build Prompt

**Document purpose:** This is the master specification to give to an AI
coding agent (Codex, Claude Code, Cursor, Gemini CLI, or another coding
assistant). The agent must use this document as the source of truth
while designing and building the project.

**Project name:** AI YouTube Documentary Studio\
**Product type:** Human-in-the-loop AI video/documentary creation and
YouTube publishing platform\
**Initial environment:** Windows PC (local development and local video
rendering)\
**Future goal:** Proper cloud deployment with scalable background
rendering\
**Primary content:** AI stories, facts, educational videos, and
documentaries\
**Video duration:** 5--20 minutes strictly enforced (Hard maximum limit: 20 minutes)

------------------------------------------------------------------------

# 1. Product Vision

Build a professional web-based studio that helps a user create complete
YouTube documentaries with AI assistance.

The system should take a topic and a few configuration choices, generate
a documentary script, divide it into scenes, create narration, find or
generate suitable visuals, assemble everything into a polished video,
and present the finished video to the user for review.

The most important product rule is:

> **AI may generate, inspect, and modify videos, but it must NEVER
> publish a video to YouTube without an explicit, deliberate approval
> action from the user.**

The user must be able to preview the complete rendered video, request
changes using natural language, receive a newly rendered version,
preview it again, and only then explicitly approve that exact version
for upload.

The product is not an unattended auto-publishing bot. It is an
AI-assisted production studio with a mandatory human approval gate.

## Core workflow

**User creates project → AI generates video → user previews video → user
requests AI modifications if needed → updated video is rendered → user
previews again → user explicitly approves → YouTube upload begins.**

If the user is not satisfied, the system must remain in the
review/editing stage. It must not upload.

------------------------------------------------------------------------

# 2. Product Principles and Non-Negotiable Rules

1.  **Human approval is mandatory before every YouTube upload.**
2.  Generating a video does not imply permission to upload it.
3.  A video passing automated quality checks does not imply permission
    to upload it.
4.  The AI YouTube Agent must not interpret messages such as "looks
    good", "nice", or "thanks" as upload approval unless the user
    explicitly confirms the upload action through the designated
    approval control or an unambiguous, deliberate approval command.
5.  The final approval must be tied to the exact video version being
    uploaded.
6.  If the video changes after approval, the old approval becomes
    invalid. The new version must be previewed and approved again.
7.  No background worker, scheduled task, retry handler, or AI agent may
    bypass the approval gate.
8.  The user must be able to cancel or pause a generation job where
    technically possible.
9.  Keep the original generated video and each revised version
    identifiable.
10. Never silently overwrite the last approved or reviewed version.
11. Do not store large video binaries inside PostgreSQL. Store file
    paths or storage object keys in the database.
12. Keep API keys, OAuth refresh tokens, and secrets out of frontend
    code, logs, Git, and generated prompts.
13. Do not promise unlimited free AI generation, unlimited stock
    footage, or unlimited free hosting. Respect provider quotas,
    licensing, and terms.
14. Build a reliable working MVP before adding advanced agent
    orchestration or optional features.
15. **Strict 20-minute maximum duration limit.** The system enforces a hard
    maximum limit of 20 minutes for any documentary project. If a user
    requests or inputs a duration exceeding 20 minutes (via UI or direct API
    call), the system must reject the request and display/return the clear
    message: *"Maximum video duration allowed is 20 minutes."* This protects
    local hardware from rendering crashes/OOM, ensures consistent output
    quality, and prevents provider quota burnout.

------------------------------------------------------------------------

# 3. Users and Main Use Case

The initial product can be single-user/local-first. Design the data
model so authentication and multiple users can be added for cloud
deployment later.

Typical user journey:

1.  The user opens the web dashboard.
2.  The user creates a documentary project.
3.  The user enters a topic and selects duration, tone, language,
    narration style, and scene planning mode.
4.  The AI generates a structured script and scene plan.
5.  The user reviews or edits the script if desired.
6.  The system generates narration and gathers/creates visuals.
7.  The rendering engine produces a complete MP4.
8.  The user watches the video in the dashboard.
9.  The user gives natural-language revision instructions if changes are
    needed.
10. The AI applies the requested changes and renders a new version.
11. The user previews the latest version.
12. The user explicitly chooses **Approve & Upload to YouTube**.
13. The system displays upload settings and asks for final confirmation
    if required.
14. Only after confirmation does the YouTube upload process start.
15. The dashboard displays upload progress and the resulting YouTube
    URL.

------------------------------------------------------------------------

# 4. Recommended Technology Stack

Use the following stack unless a technical limitation requires a
documented alternative.

## Frontend

-   **Next.js with TypeScript:** Main web application and dashboard.
-   **Tailwind CSS:** Styling.
-   **shadcn/ui:** Accessible, reusable UI components.
-   **HTML5 video player:** Preview rendered MP4 files.
-   **React state management:** Use a simple approach initially;
    introduce a dedicated state library only if needed.

Responsibilities: - Project creation and settings. - Script and scene
review. - Generation progress. - Video preview and version history. -
Natural-language modification interface. - YouTube upload settings and
explicit approval. - Settings and provider configuration.

## Backend

-   **Python + FastAPI:** Main API and application logic.
-   **Pydantic:** Request/response validation and structured AI output.
-   **SQLAlchemy:** Database access and ORM.
-   **Alembic:** Database migrations.

Responsibilities: - Project and version management. - AI provider
calls. - Scene and asset planning. - Voice generation orchestration. -
Video rendering orchestration. - Quality checks. - Approval
validation. - YouTube OAuth and upload integration.

## AI

-   **Google Gemini API:** Script writing, research planning, scene
    descriptions, metadata drafts, and modification planning.
-   Use structured JSON outputs and validate them with Pydantic.
-   Keep the LLM provider behind an adapter/service interface so a
    different model provider can be added later.
-   Do not ask the LLM to perform deterministic file operations. The
    backend and rendering services must execute those operations.

Important: The AI must not invent facts and present them as verified.
For factual documentaries, design a research/fact-checking stage. Where
web research is integrated, save source URLs and evidence notes for
important claims. If reliable sources cannot be found, mark claims as
needing review rather than fabricating citations.

## Voice generation

-   **Piper TTS:** Initial local/offline text-to-speech option.
-   Provide at least two selectable voice-style presets:
    -   Deep male cinematic/documentary style.
    -   Natural male narration style.
-   Actual voice availability and quality depend on the installed Piper
    models. Do not claim a particular voice exists until it has been
    installed and tested.
-   Keep the TTS provider modular so another provider can be added
    later.
-   Allow voice speed and volume configuration where supported.
-   Generate narration per scene or per manageable segment to support
    re-rendering individual scenes.

## Video and audio processing

-   **FFmpeg:** Core media processing and final rendering.
-   **Python:** Orchestration, timing, file management, subtitles, and
    media analysis.
-   Build rendering as a separate service/module, not as a long-running
    HTTP request.
-   Support MP4 output, initially 1080p at a configurable frame rate.
-   Provide configurable aspect ratio, initially 16:9 for standard
    YouTube videos.
-   Add scene transitions, background music, narration mixing,
    subtitles, title cards, and simple cinematic pan/zoom effects.
-   Respect source asset resolution, aspect ratio, codec, and license
    restrictions.

## Visual assets

Use a hybrid visual strategy:

1.  **Stock footage:** Pexels API or another source whose current terms
    permit the intended use.
2.  **AI-generated images:** Integrate a provider only when a usable API
    and its pricing/limits are confirmed. Keep this provider
    replaceable.
3.  **Diagrams and simple animations:** Generate using code/templates
    for educational, scientific, historical, and explanatory scenes.
4.  **Optional user uploads:** Allow the user to add their own images,
    clips, logos, or other assets.

Rules: - Do not scrape websites or download assets in violation of their
terms. - Store source, creator/attribution details, license notes, and
asset URL where available. - Do not assume all "free" assets can be used
commercially or monetized on YouTube. - If an asset cannot be sourced,
show a clear placeholder or request user input; do not silently use
unrelated footage. - Avoid repetitive visuals. Track which assets have
already been used in a project. - Keep stock, generated, diagram, and
user-uploaded assets distinguishable in the project data.

## Database

-   **Supabase PostgreSQL:** Recommended primary database for both
    initial development and future deployment.
-   Connect to Supabase from the local Windows backend using environment
    variables.
-   Use SQLAlchemy and Alembic so the app is not tightly coupled to one
    database vendor.
-   For an offline-only development mode, SQLite may be offered as an
    optional fallback, but PostgreSQL/Supabase is the primary target.

Store structured records such as users, projects, scripts, scenes, asset
metadata, video versions, generation jobs, approvals, and YouTube upload
records.

Do not store rendered MP4 files or large audio/video binaries in
PostgreSQL.

## Background jobs

-   **Redis + Celery:** Background task queue for long-running jobs.
-   Use jobs for script-to-media pipeline stages, TTS generation, asset
    acquisition, rendering, and YouTube uploads.
-   The API should create jobs and return job IDs quickly.
-   The frontend should poll or subscribe to job status.
-   Design the queue interface so a different worker/queue service can
    be used later if necessary.
-   Local development can run Redis locally (including through WSL on
    Windows) or use a compatible local service. Document the selected
    setup clearly.

## Storage

Initial local mode: - Store project assets and rendered video versions
in a configurable local workspace directory. - Keep generated assets
organized by project and version. - Save relative paths or storage keys
in PostgreSQL, not machine-specific absolute paths where avoidable. -
Validate file access and prevent path traversal.

Future cloud mode: - Use object storage compatible with the chosen
deployment provider. - Store object keys and metadata in PostgreSQL. -
Use signed URLs or authenticated streaming for private previews. - Do
not assume Vercel or a short-lived backend filesystem is suitable for
permanent video storage.

## YouTube integration

-   **YouTube Data API v3** for upload and video metadata.
-   **Google OAuth 2.0** for user authorization.
-   Request only the scopes needed for the intended YouTube actions.
-   Store OAuth tokens securely on the backend; encrypt sensitive tokens
    at rest where practical.
-   Provide upload title, description, tags, category, thumbnail,
    visibility, and schedule settings where supported.
-   Show the user exactly which video version and settings are about to
    be uploaded.
-   Handle quota errors, token expiry, network failures, resumable
    uploads, and retry-safe behavior.
-   Do not assume API quotas or account publishing limits are unlimited;
    display meaningful errors and documentation links when relevant.

## Deployment target

Initial development: - Windows PC. - Next.js frontend running locally. -
FastAPI backend running locally. - Redis/Celery worker running
locally. - FFmpeg rendering on the local PC. - Supabase PostgreSQL as
the database. - Local media workspace for files.

Future deployment (not required for the first MVP): - **Vercel:**
Next.js frontend. - **Render or another suitable host:** FastAPI API and
background workers, subject to runtime/resource limits. - **Supabase:**
PostgreSQL. - **Object storage:** Rendered video and media assets. -
**Dedicated worker infrastructure:** Heavy FFmpeg rendering. - Do not
run 5--15 minute video rendering inside a short-lived serverless
request. - Keep the rendering worker separate from the dashboard/API so
it can later be moved to a machine with sufficient CPU, RAM, disk, and
bandwidth.

------------------------------------------------------------------------

# 5. Functional Modules

## Module A --- Dashboard

Create a professional, modern dashboard showing:

-   Total projects.
-   Draft projects.
-   Videos currently generating.
-   Videos awaiting review.
-   Videos approved for upload.
-   Uploaded videos.
-   Failed jobs requiring attention.
-   Recent projects with thumbnails, titles, dates, and statuses.
-   Quick action to create a new documentary.

Use clear status labels. Do not display a project as uploaded until
YouTube confirms successful upload.

## Module B --- Create Documentary

The creation form should collect:

-   Project/documentary title.
-   Topic or subject.
-   Short description or creative direction (optional).
-   Target duration: 5, 10, 15, or 20 minutes, with custom input capped
    strictly at 20 minutes maximum.
    -   *Validation Rule:* Any input greater than 20 minutes is strictly
        rejected by both UI and backend validation with the message:
        `"Maximum video duration allowed is 20 minutes."`
-   Language.
-   Tone: documentary, cinematic, educational, investigative,
    storytelling, or user-defined.
-   Audience level: general, beginner, intermediate, or advanced.
-   Narration style: deep male cinematic or natural male.
-   Scene planning:
    -   Automatic: AI decides scene count and scene durations.
    -   Manual: user specifies desired scene count.
-   Visual strategy: hybrid by default, with optional user preferences.
-   Aspect ratio: 16:9 initially.
-   Target resolution: 1080p initially, with lower preview resolution as
    an optional performance setting.

Allow partial optional settings and sensible defaults. Validate required
fields before starting generation.

## Module C --- Research and Script Agent

Responsibilities: - Understand the topic and intended audience. - Create
a clear narrative structure with an introduction, main sections, and
conclusion. - Generate a narration script appropriate to the requested
duration. - Avoid unnecessary repetition and filler. - Identify claims
that require factual verification. - If research sources are available,
attach source URLs and short evidence notes to relevant claims. -
Distinguish verified facts, uncertain claims, and creative
storytelling. - Generate a compelling but truthful title and opening
hook. - Output validated structured data, not unstructured text only.

Script review interface: - Show full script. - Allow manual edits. -
Allow regeneration of the full script or a selected section. - Save
script revisions. - Do not start final rendering until required script
and scene data are valid.

## Module D --- Scene Planner Agent

For every scene, generate structured fields such as:

-   Scene number and stable scene ID.
-   Scene title.
-   Purpose of the scene.
-   Narration text.
-   Estimated duration.
-   Visual description.
-   Preferred visual type: stock footage, AI image, diagram/animation,
    or user asset.
-   Search keywords for stock footage.
-   Image-generation prompt when needed.
-   On-screen text, if any.
-   Transition preference.
-   Relevant research/source references.
-   Asset status.

Automatic mode: - AI chooses scene count based on topic and duration. -
Scene durations should add up to the target video duration as closely as
practical. - Actual narration/audio duration must be measured after TTS;
do not rely only on word-count estimates. - Reconcile scene timing with
real audio duration before rendering.

Manual mode: - Respect the requested scene count where feasible. -
Explain if the requested count is impractical for the target duration.

## Module E --- Visual Asset Agent

Responsibilities: - Search approved stock footage sources using scene
keywords. - Select relevant clips and record their
source/attribution/license metadata. - Use AI image generation where a
configured provider is available. - Create simple diagrams or animated
explanatory visuals where useful. - Allow user-uploaded assets. -
Provide a visual asset review/replace action. - Detect missing assets
before rendering. - Never claim that an image was generated if the
provider failed. - Never use unrelated visuals merely to fill a scene.

## Module F --- Voice Agent

Responsibilities: - Convert narration into speech using the selected
voice preset. - Generate audio per scene or segment. - Save audio files
and metadata. - Measure actual duration. - Support regeneration of an
individual scene's voice-over. - Keep narration loudness consistent. -
Mix narration and background music with appropriate ducking so speech
remains clear. - Handle punctuation and text normalization carefully.

## Module G --- Video Editor / Rendering Engine

Responsibilities: - Combine scene visuals and narration. - Fit visuals
to actual scene durations. - Add transitions. - Add subtitles with
readable timing and safe margins. - Add title cards and section headings
where appropriate. - Add background music from approved/licensed sources
or user uploads. - Apply subtle zoom/pan effects to still images. -
Balance audio levels. - Render a complete MP4. - Save render logs and
errors. - Produce a thumbnail candidate or allow user upload. - Generate
a lower-resolution preview if useful. - Preserve each render as a
distinct video version.

Rendering should be deterministic where possible: the same inputs and
settings should produce a reproducible output, subject to external
provider variability.

## Module H --- Quality Check Agent

Run automated checks before presenting a version as ready for review:

-   MP4 file exists and is readable.
-   Video duration is within an acceptable tolerance of the requested
    duration.
-   Video has expected resolution and aspect ratio.
-   Audio exists and is not unintentionally silent.
-   Narration is present for required scenes.
-   Subtitle file or subtitle track exists if subtitles are enabled.
-   No missing scene assets.
-   No obvious black gaps or empty scenes caused by missing media.
-   Rendering completed without fatal FFmpeg errors.
-   The final video can be played by the dashboard player.

The quality agent may flag issues and recommend fixes. It must not
approve the video for YouTube and must never trigger upload.

## Module I --- Preview and Review Workspace

This is one of the most important parts of the product.

The review page must show: - Embedded video player for the complete
rendered MP4. - Video title and project details. - Duration, resolution,
and version number. - Script and scene list. - Download/export option
for the rendered MP4. - Quality-check results and warnings. - Version
history. - A natural-language AI modification panel. - A clear status
such as "Awaiting your review".

The user should be able to watch the complete video before making an
upload decision.

## Module J --- AI Modification Agent

The user can request changes in natural language, for example:

-   "Change scene 3; use visuals of a real city instead."
-   "Make the introduction more engaging."
-   "Make the narration sound more natural."
-   "Replace the background music."
-   "Correct the subtitles in scene 5."
-   "Shorten this section."
-   "Make the ending more powerful."
-   "Replace this image with a relevant stock video."

Modification process: 1. Parse the user's instruction. 2. Identify the
affected project components/scenes. 3. Show a concise plan of intended
changes where useful. 4. Apply only the requested changes and necessary
dependencies. 5. Re-generate affected narration/assets. 6. Re-render the
complete final video when required. 7. Run quality checks again. 8.
Create a new immutable video version. 9. Return the user to
preview/review.

Do not silently change unrelated scenes or the entire script when only
one scene needs modification. If the instruction is ambiguous or could
cause a major change, ask one concise clarification before proceeding.

A modification must never cause an upload.

## Module K --- YouTube Publishing Agent

Responsibilities: - Connect the user's YouTube account using OAuth. -
Prepare upload metadata. - Allow the user to edit title, description,
tags, category, thumbnail, visibility, and schedule settings where
supported. - Show the exact video version selected for upload. - Display
a clear final confirmation step. - Upload only after explicit
approval. - Display progress, success, failure, and resulting YouTube
URL. - Support retry/resume safely where the API allows it.

### Mandatory approval gate

The upload service must enforce this rule at the backend level, not just
in the frontend.

Before an upload job can be created, the backend must verify all of the
following:

1.  The user is authenticated/authorized for the project.
2.  The selected video version exists.
3.  The selected version completed rendering.
4.  The selected version passed required quality checks or the user
    explicitly acknowledged any allowed warnings.
5.  The selected version is the exact version currently being approved.
6.  The user performed a deliberate approval action.
7.  The approval record references the exact video version ID and a file
    checksum/hash.
8.  The upload settings have been reviewed.
9.  No later edit or new render has invalidated the approval.

If any check fails, reject the upload request.

The frontend button should be clearly labelled **"Approve & Upload to
YouTube"**. Do not use a generic "Continue" button for this critical
action.

After a new version is rendered, the previous approval must be
invalidated. The user must preview and approve the new version again.

The system must not upload automatically after rendering, after quality
checks, after an AI agent says the video is ready, or after a
modification request.

------------------------------------------------------------------------

# 6. Video Versioning and Approval State Machine

Use explicit states. Suggested project/video states:

-   `draft`
-   `script_generating`
-   `script_review`
-   `assets_preparing`
-   `voice_generating`
-   `rendering`
-   `quality_check`
-   `awaiting_review`
-   `modification_requested`
-   `modifying`
-   `rendering_revision`
-   `approved_for_upload`
-   `uploading`
-   `uploaded`
-   `generation_failed`
-   `upload_failed`
-   `cancelled`

Important state rules: - `awaiting_review` means the video is ready for
the user to inspect, not approved. - `approved_for_upload` is allowed
only after an explicit user approval record is created. - A new video
version moves the project back to `awaiting_review`. - If a version
changes, any prior approval is revoked/invalidated. - `uploading` can
only be entered by the backend upload service after validating
approval. - `uploaded` can only be set after successful confirmation
from YouTube. - A failed upload must not silently create another upload
without a deliberate retry action and approval validation.

Store an immutable version record for each final render: - Version ID. -
Project ID. - Version number. - File storage key/path. - File
checksum. - Duration. - Resolution. - Render settings. - Script revision
ID. - Scene/asset manifest. - Quality-check result. - Created
timestamp. - Review status.

Store approval records separately: - Approval ID. - User ID. - Project
ID. - Exact video version ID. - Exact video checksum. - Approval
timestamp. - Upload settings snapshot. - Approval status/revocation
reason.

------------------------------------------------------------------------

# 7. Suggested Database Entities

Design normalized PostgreSQL tables with appropriate foreign keys,
indexes, and timestamps.

Suggested tables:

1.  `users` --- account/profile data (authentication provider can be
    added as needed).
2.  `projects` --- documentary project details and current status.
3.  `project_settings` --- duration, language, tone, voice, aspect
    ratio, and preferences.
4.  `script_revisions` --- generated and manually edited script
    versions.
5.  `scenes` --- scene order, narration, timing, visual direction, and
    scene metadata.
6.  `scene_assets` --- stock footage, AI images, diagrams, user assets,
    source, license, and storage metadata.
7.  `audio_assets` --- generated narration and music metadata.
8.  `generation_jobs` --- task type, status, progress, logs, error
    details, and retry information.
9.  `video_versions` --- immutable rendered output records and
    checksums.
10. `quality_checks` --- automated validation results and warnings.
11. `video_approvals` --- explicit approval tied to exact video version
    and checksum.
12. `youtube_accounts` --- OAuth account metadata; protect tokens.
13. `youtube_uploads` --- upload job, settings snapshot, status, YouTube
    video ID, and URL.
14. `project_activity` --- audit trail of important user and agent
    actions.

Use migrations. Do not create the entire database schema only through
ad-hoc SQL in application startup.

------------------------------------------------------------------------

# 8. API Design Expectations

Create clean, versioned API routes, for example:

-   `POST /api/v1/projects`
-   `GET /api/v1/projects`
-   `GET /api/v1/projects/{project_id}`
-   `PATCH /api/v1/projects/{project_id}`
-   `POST /api/v1/projects/{project_id}/generate-script`
-   `POST /api/v1/projects/{project_id}/plan-scenes`
-   `POST /api/v1/projects/{project_id}/generate-video`
-   `GET /api/v1/jobs/{job_id}`
-   `GET /api/v1/projects/{project_id}/versions`
-   `GET /api/v1/versions/{version_id}`
-   `POST /api/v1/projects/{project_id}/modifications`
-   `POST /api/v1/versions/{version_id}/quality-check`
-   `POST /api/v1/versions/{version_id}/approve-upload`
-   `POST /api/v1/versions/{version_id}/youtube-upload`
-   `GET /api/v1/youtube/uploads/{upload_id}`
-   `POST /api/v1/youtube/connect`
-   `GET /api/v1/youtube/callback`

These are suggested route names; refine them as appropriate. All routes
must validate ownership/authorization and request schemas. Do not expose
internal filesystem paths or secrets.

The upload endpoint must call a dedicated approval-validation service
before creating an upload job.

------------------------------------------------------------------------

# 9. Frontend Pages and UX

Build a polished, responsive desktop-first dashboard with a clean
professional visual system.

Suggested pages:

1.  **Dashboard**
    -   Summary cards and recent projects.
2.  **Create Documentary**
    -   Topic, duration, language, tone, voice, scene planning, visual
        options.
3.  **Project Workspace**
    -   Script, scenes, assets, job progress, and project settings.
4.  **Script Editor**
    -   Review and revise script content.
5.  **Scene Editor**
    -   Inspect narration and visuals scene by scene.
6.  **Generation Progress**
    -   Show current pipeline stage, progress, and errors.
7.  **Video Preview & Review**
    -   Main video player, version details, quality results, scene list,
        modification chat.
8.  **Version History**
    -   Compare versions and identify the latest reviewed version.
9.  **YouTube Publishing**
    -   Account connection, metadata, thumbnail, visibility, schedule,
        final approval.
10. **Settings**

-   Gemini key, stock footage key, TTS settings, FFmpeg path, storage
    directory, and YouTube connection status.

Do not expose secret API key values after saving them. Show
configured/not configured status and provide a safe update flow.

Use clear empty states, loading states, error messages, and confirmation
dialogs. Avoid misleading progress bars: show real pipeline stage/job
status rather than invented percentages.

------------------------------------------------------------------------

# 10. Security, Privacy, and Reliability

-   Keep secrets in `.env` files locally and secure environment
    variables in deployment.
-   Provide `.env.example` with placeholder values only.
-   Add `.env`, OAuth token files, generated private media, and secrets
    to `.gitignore` as appropriate.
-   Never commit API keys or OAuth credentials.
-   Validate uploads and file types.
-   Prevent path traversal and arbitrary file access.
-   Enforce project ownership on every private endpoint.
-   Protect OAuth callback/state handling against CSRF.
-   Encrypt sensitive tokens at rest where practical.
-   Use structured logs without secrets or full tokens.
-   Add job retries only for safe/retryable operations.
-   Avoid duplicate YouTube uploads through idempotency and upload
    tracking.
-   Keep an audit trail for approvals, revocations, modifications, and
    upload attempts.
-   Handle API timeouts, provider rate limits, quota exhaustion, missing
    assets, and render failures gracefully.
-   Make cancellation and cleanup safe.
-   Clearly communicate any costs or provider limits to the user.

------------------------------------------------------------------------

# 11. Local Windows Development Requirements

The first complete working version must run on the user's Windows PC.

Provide: - Clear installation instructions. - Python virtual environment
setup. - Node.js dependencies. - FFmpeg installation and PATH
verification. - Piper installation and voice-model setup instructions. -
Redis setup instructions suitable for Windows (WSL is an acceptable
documented option). - Supabase project/database setup instructions. -
Environment variable setup. - Database migration commands. - Commands to
run frontend, backend, and worker. - Troubleshooting guide for common
errors.

Suggested development processes: - Next.js development server. - FastAPI
development server. - Celery worker. - Redis service. - Optional local
scheduler only if needed.

Do not assume all tools are already installed. Detect and document
prerequisites.

------------------------------------------------------------------------

# 12. Professional Phase-by-Phase Development Roadmap

The project must be developed in controlled phases. Complete, test, and
verify each phase before starting the next one. Do not skip phases or
generate the entire application in one unverified coding pass.

Every phase must produce a working, demonstrable result. Keep the
application runnable throughout development.

## Phase 1 --- Environment Inspection, Project Setup, and Architecture

**Objective:** Understand the user's Windows development environment and
establish a clean, maintainable project foundation.

### Tasks

-   Inspect the existing repository and files before changing anything.
-   Confirm availability and versions of Git, Node.js, npm, Python,
    FFmpeg, and any required tools.
-   Identify missing prerequisites and explain how to install them in
    beginner-friendly steps.
-   Create the agreed monorepo or clearly separated frontend/backend
    structure.
-   Set up Next.js, TypeScript, Tailwind CSS, shadcn/ui, FastAPI, and
    the Python virtual environment.
-   Establish configuration management and `.env.example`.
-   Add `.gitignore` entries for secrets, virtual environments, build
    artifacts, generated media, and private tokens.
-   Create initial README with exact setup and run commands.
-   Define service boundaries for AI, TTS, visual providers, rendering,
    storage, background jobs, and YouTube integration.

### Deliverables

-   Clean repository structure.
-   Frontend starts locally.
-   Backend starts locally and exposes health endpoint.
-   Setup documentation and environment-variable template.
-   No real API keys hardcoded.

### Verification / exit gate

The frontend and backend both run locally. The agent reports
installed/missing prerequisites and demonstrates the health endpoint.

## Phase 2 --- Database, Backend Foundation, and Project Management

**Objective:** Build persistent project management before adding AI
generation.

### Tasks

-   Connect FastAPI to Supabase PostgreSQL using environment variables.
-   Set up SQLAlchemy models and Alembic migrations.
-   Create core tables for users (or local single-user owner model),
    projects, project settings, project activity, and generation jobs.
-   Implement project create, list, view, update, and delete/archive
    operations as appropriate.
-   Add request validation, error handling, logging, and API versioning.
-   Create local media workspace configuration and safe file-path
    handling.
-   Keep database access behind repository/service layers.

### Deliverables

-   Working PostgreSQL connection.
-   Initial migrations.
-   Project CRUD APIs.
-   Dashboard can create and list projects.
-   Project data persists after restarting the app.

### Verification / exit gate

Create a project through the UI, restart the backend, and confirm the
project remains available from PostgreSQL.

## Phase 3 --- Dashboard UX and Documentary Creation Wizard

**Objective:** Build the main user experience and collect all inputs
required to create a documentary.

### Tasks

-   Implement Dashboard, Create Documentary, Project Workspace, and
    Settings pages.
-   Build a guided creation form for topic, project title, target
    duration (hard-capped at max 20 minutes with UI & API rejection),
    language, tone, audience, narration preset, scene planning mode, aspect
    ratio, resolution, and visual strategy.
-   Support automatic scene planning and manual scene count.
-   Provide sensible defaults and validate required fields.
-   Show project statuses, recent projects, empty states, loading
    states, and clear errors.
-   Make the UI responsive and consistent using shadcn/ui and Tailwind
    CSS.

### Deliverables

-   Professional dashboard.
-   Working documentary creation wizard.
-   Project workspace with settings and status.
-   Form data saved to PostgreSQL.

### Verification / exit gate

The user can create a project with the required settings, reopen it, and
see the saved configuration.

## Phase 4 --- Gemini Research, Script Generation, and Scene Planning

**Objective:** Turn a topic into a structured, reviewable documentary
script and scene plan.

### Tasks

-   Integrate Gemini through a backend provider adapter.
-   Request the Gemini API key from the user when it is needed; do not
    invent or hardcode credentials.
-   Generate a documentary outline, opening hook, narration script, and
    conclusion.
-   Add a research/fact-checking stage for factual topics where research
    tools/sources are configured.
-   Record source URLs and evidence notes for important claims when
    available.
-   Clearly flag unsupported or uncertain claims rather than fabricating
    facts or citations.
-   Generate structured scene JSON and validate it using Pydantic.
-   Implement automatic and manual scene planning.
-   Store script revisions and scene data.
-   Build script editor and scene review interfaces.
-   Allow regeneration of the full script or selected sections.

### Deliverables

-   Gemini integration.
-   Structured script and scene plan.
-   Script revision history.
-   Script and scene review UI.

### Verification / exit gate

The user enters a topic and receives a valid script and scene plan that
can be reviewed, edited, saved, and regenerated.

## Phase 5 --- Voice-over and Visual Asset Generation

**Objective:** Prepare all audio and visual assets required by the
rendering engine.

### Tasks

-   Install and configure Piper TTS locally.
-   Ask the user to choose or confirm voice models when multiple
    suitable models are available.
-   Implement the deep male cinematic and natural male voice presets
    only when matching installed/tested models exist.
-   Generate narration per scene or segment.
-   Measure actual audio duration and store audio metadata.
-   Integrate Pexels or another approved stock-footage provider through
    an adapter.
-   Ask the user for provider API keys when needed.
-   Integrate an AI image provider only after confirming the provider,
    API availability, and user credentials/limits.
-   Create simple diagram and animation templates for educational
    scenes.
-   Allow user-uploaded media.
-   Store asset source, attribution/license notes, provider, and storage
    metadata.
-   Build asset review, replace, and missing-asset handling.
-   Do not use unrelated footage as a silent fallback.

### Deliverables

-   Working narration generation.
-   Scene-level audio assets and measured durations.
-   Stock footage search/download workflow where configured.
-   Optional AI image generation adapter.
-   Asset review UI and source metadata.

### Verification / exit gate

Each scene has narration and an appropriate visual asset, or a clearly
surfaced missing-asset issue that the user can resolve.

## Phase 6 --- FFmpeg Rendering, Subtitles, and Video Preview

**Objective:** Produce a real, playable documentary MP4 and make it
available for user review.

### Tasks

-   Implement a separate rendering service using Python and FFmpeg.
-   Run rendering as a background job, never as a long-running HTTP
    request.
-   Synchronize scenes using actual narration duration.
-   Add transitions, title cards, on-screen text, subtitles, background
    music, audio ducking, and subtle pan/zoom effects.
-   Render a configurable 16:9 MP4, initially 1080p.
-   Create a lower-resolution preview when useful.
-   Save render logs, errors, media metadata, and version records.
-   Implement video version history and checksums.
-   Build the HTML5 video preview page.
-   Add download/export of the rendered MP4.
-   Validate the rendered file before marking it ready for review.

### Deliverables

-   Real FFmpeg rendering pipeline.
-   Complete MP4 output.
-   Subtitle and audio integration.
-   Video preview and download.
-   Immutable video version history.

### Verification / exit gate

The user can create a documentary and watch the complete rendered MP4 in
the dashboard. A mocked video or placeholder file does not satisfy this
phase.

## Phase 7 --- Quality Checks and AI Modification Workflow

**Objective:** Let the user inspect the documentary and refine it
through AI agents until satisfied.

### Tasks

-   Implement automated quality checks for file readability, duration,
    resolution, aspect ratio, audio presence, subtitle availability,
    missing assets, and rendering errors.
-   Display quality results and warnings to the user.
-   Implement a natural-language modification panel.
-   Parse modification requests and identify affected scenes/components.
-   Show a concise proposed change plan when useful.
-   Apply targeted changes to script, scenes, narration, visuals,
    subtitles, music, or editing settings.
-   Avoid changing unrelated scenes without reason.
-   Ask a concise clarification when a request is ambiguous or
    high-impact.
-   Re-render the revised documentary as a new version.
-   Re-run quality checks.
-   Return the user to the preview page after every revision.
-   Invalidate any previous approval whenever a new video version is
    created.

### Deliverables

-   Quality-check service and UI.
-   AI modification interface.
-   Targeted scene/component changes.
-   Revised video versions and review history.

### Verification / exit gate

The user previews version 1, requests a change in natural language,
receives version 2, and can preview version 2. No modification action
can upload a video.

## Phase 8 --- YouTube OAuth, Approval Gate, and Publishing

**Objective:** Enable YouTube publishing while enforcing explicit user
approval for the exact final video version.

### Tasks

-   Implement Google OAuth 2.0 and YouTube Data API v3 integration.
-   Ask the user for required Google Cloud project details, OAuth client
    credentials, redirect URL configuration, and any API settings when
    needed.
-   Guide the user through configuring credentials securely.
-   Implement title, description, tags, category, thumbnail, visibility,
    and scheduling settings where supported.
-   Display the exact selected video version, checksum, and upload
    settings before approval.
-   Implement a clearly labelled **Approve & Upload to YouTube** action.
-   Create a durable approval record tied to the exact video version and
    checksum.
-   Enforce approval validation in the backend upload service.
-   Invalidate approval if the video changes.
-   Support upload progress, resumable upload where supported, safe
    retry, quota errors, token expiry, and result URL.
-   Record all approval and upload actions in the audit log.

### Deliverables

-   YouTube account connection.
-   Upload metadata editor.
-   Explicit approval UI.
-   Backend-enforced approval service.
-   Upload progress and result page.

### Verification / exit gate

All approval acceptance tests in Section 14 pass. Direct API calls,
workers, retries, and AI agents cannot bypass the approval gate.

## Phase 9 --- Production Readiness and Cloud Deployment

**Objective:** Deploy the application properly without relying on the
user's Windows PC.

### Tasks

-   Prepare production configuration and deployment documentation.
-   Deploy Next.js frontend to Vercel or a suitable alternative.
-   Deploy FastAPI API to Render or another suitable persistent service.
-   Use Supabase PostgreSQL for production database.
-   Move generated media to suitable object storage.
-   Deploy a dedicated background worker for TTS and FFmpeg rendering on
    infrastructure with adequate CPU, RAM, disk, and runtime.
-   Configure Redis/queue infrastructure.
-   Configure secure secrets, OAuth redirect URLs, CORS, HTTPS, logging,
    monitoring, backups, and cleanup policies.
-   Test large media upload/download and private preview access.
-   Add resource limits, job timeouts, retry policies, and storage
    lifecycle management.
-   Document deployment, rollback, and recovery procedures.

### Deliverables

-   Production deployment.
-   Cloud media storage.
-   Separate rendering worker.
-   Production environment documentation.
-   Monitoring and backup strategy.

### Verification / exit gate

The deployed system can create a project, generate and render a video in
cloud infrastructure, preview it, revise it, and upload only after
explicit approval.

## Phase 10 --- Enhancements and Scaling (After Core Product)

**Objective:** Add advanced features only after the complete core
workflow is stable.

Possible enhancements: - Multiple user accounts and workspaces. - More
languages and voice models. - More TTS and image/video providers. -
Advanced timeline editor. - Reusable documentary templates. - Brand kits
and custom intro/outro. - Thumbnail generation and A/B variants. -
Analytics for published videos. - Cost estimation per generation. -
Content calendar and scheduled drafts. - More detailed fact-checking and
source management. - Improved rendering performance and parallel scene
processing.

These features are not blockers for the first working product.

## Mandatory Phase Completion Report

At the end of every phase, the coding agent must provide:

1.  Phase name and completion status.
2.  Features implemented.
3.  Files/modules created or changed.
4.  Exact commands to run the updated application.
5.  Environment variables or credentials required.
6.  Tests performed and their results.
7.  Known limitations or incomplete items.
8.  Confirmation that the phase exit gate passed.
9.  What the next phase will implement.

Do not mark a phase complete if its exit gate has not passed. If
something is blocked by missing credentials, tools, or user decisions,
report it as **Blocked --- awaiting user input**, not as completed.

# 13. MVP Definition

The first MVP is complete when all of the following work end to end:

1.  User creates a documentary project.
2.  User selects a duration and automatic/manual scene planning.
3.  Gemini generates a structured script and scene plan.
4.  Piper generates narration.
5.  The system obtains or creates appropriate visuals using configured
    providers.
6.  FFmpeg renders a complete MP4 with narration and visuals.
7.  The user previews the video in the dashboard.
8.  The user can request at least one modification through natural
    language.
9.  The system renders a new version and allows another preview.
10. The user can export/download the video.
11. YouTube publishing remains disabled until the explicit approval and
    upload module is implemented and tested.

Do not call a mock UI or placeholder workflow a completed MVP. Clearly
label any feature that is simulated or not yet integrated.

------------------------------------------------------------------------

# 14. Acceptance Tests for the Mandatory Approval Rule

These tests are critical and must be automated where practical:

**Test A --- Render does not upload** - Generate a video. - Do not
approve it. - Confirm that no YouTube upload job is created and no
upload API call occurs.

**Test B --- Quality check does not upload** - Complete rendering and
quality checks. - Do not approve it. - Confirm that upload does not
start.

**Test C --- Explicit approval permits upload** - Preview a completed
version. - Explicitly approve that exact version. - Confirm that the
backend validates approval before creating the upload job.

**Test D --- New version invalidates approval** - Approve version 1. -
Create version 2 through a modification. - Confirm version 1 approval
cannot authorize uploading version 2.

**Test E --- Wrong version is rejected** - Approve version 1. - Attempt
to upload version 2. - Confirm the backend rejects the request.

**Test F --- Approval revoked** - Revoke approval before upload
begins. - Confirm upload cannot proceed.

**Test G --- No implicit approval** - Send chat messages such as "looks
good", "thanks", or "great". - Confirm no approval record or upload job
is created.

**Test H --- Duplicate upload protection** - Retry a completed or
in-progress upload request. - Confirm the system does not create an
unintended duplicate upload.

**Test I --- Direct API bypass is blocked** - Call the upload API
directly without a valid approval record. - Confirm the backend rejects
the request.

The backend is the source of truth. Hiding or disabling a frontend
button is not sufficient security.

------------------------------------------------------------------------

# 15. Instructions to the AI Coding Agent --- Google Antigravity

The implementation agent for this project is **Google Antigravity**.
Treat this document as the project source of truth.

You are acting as the senior full-stack engineer, software architect,
and implementation agent. Work in the user's existing development
environment and communicate with the user through Antigravity's
chat/messages whenever a decision, credential, URL, permission, or other
input is required.

## 15.1 Required communication protocol with the user

**If you need anything from the user, ask through a clear message in the
Antigravity conversation. Do not guess, fabricate, or silently skip
required information.**

This includes, but is not limited to:

-   Gemini API key.
-   Pexels or other stock-footage API key.
-   AI image-generation provider choice and API key.
-   Supabase project URL.
-   Supabase database connection string or required database
    credentials.
-   YouTube / Google Cloud project details.
-   Google OAuth Client ID and Client Secret.
-   OAuth redirect URL configuration.
-   YouTube channel/account authorization.
-   Any other API key, endpoint URL, service URL, credential,
    permission, or user-specific setting.
-   Voice model preference if more than one suitable installed model is
    available.
-   Any decision that materially changes product behaviour or
    architecture.

When requesting input: 1. Explain **what is needed**. 2. Explain **why
it is needed** and which feature/phase depends on it. 3. Tell the user
exactly **where to obtain it** or how to configure it, where practical.
4. Show the expected format or variable name, but never ask the user to
commit a secret into source code. 5. Ask only for the information needed
at that point in the current phase. 6. Pause the blocked task and wait
for the user's reply when the missing input is essential. 7. Once the
user supplies the information, help them configure it securely and
verify that the integration works. 8. Do not ask repeatedly for
information already provided and securely configured.

### Credential safety

-   Prefer asking the user to place secrets in a local `.env` file or
    the appropriate Antigravity secret/environment-variable interface.
-   If the user sends a secret in chat, do not repeat it in responses,
    logs, code, screenshots, or documentation. Guide the user to store
    it securely and rotate it if it has been exposed in an unsafe
    location.
-   Never hardcode API keys, OAuth secrets, database passwords, or
    refresh tokens.
-   Never commit secrets to Git.
-   Use placeholders in `.env.example`, never real values.
-   Do not print full secrets when testing configuration; report only
    whether the variable is configured and whether authentication
    succeeded.
-   For URLs that are not secret (for example Supabase project URL or
    OAuth redirect URL), ask the user for the exact value when required.
    Do not invent production URLs.
-   Do not request credentials before the phase that actually needs
    them. Build credential-independent parts first.

### Example user messages Antigravity should send

**Example --- Gemini key needed**

"I'm starting the Gemini script-generation integration. Please
provide/configure your Gemini API key. I'll add it as `GEMINI_API_KEY`
in your local environment file. Do not put it directly into source code.
I'll wait for the key to be configured before testing real Gemini
generation."

**Example --- Supabase details needed**

"Phase 2 requires your Supabase PostgreSQL connection. Please share your
Supabase Project URL and configure the database connection string as
`DATABASE_URL` in the local `.env` file. I'll show you where to find
these values and then verify the database connection."

**Example --- YouTube OAuth details needed**

"We are now implementing YouTube publishing. Please create or select a
Google Cloud project and configure the YouTube Data API v3 and OAuth
consent/client settings. I need the OAuth Client ID, Client Secret, and
the exact redirect URL configuration. Store the secret securely in
environment variables; do not commit it to Git. Upload functionality
will remain disabled until OAuth is configured and the approval tests
pass."

**Example --- missing product decision**

"I need one decision before proceeding: should this feature use the
existing configured provider, or should I integrate a different
provider? Here are the practical differences..."

## 15.2 Implementation behaviour

1.  Read this entire specification before coding.
2.  Inspect the existing repository and environment before making
    changes.
3.  Do not delete, overwrite, or restructure existing user work without
    explaining the impact and obtaining permission when necessary.
4.  Start with Phase 1 and follow the phase order in Section 12.
5.  Before each phase, summarize the phase goal and planned work.
6.  If a required API key, URL, credential, permission, or user decision
    is missing, message the user and wait. Continue with independent
    tasks only if doing so will not create throwaway or unsafe work.
7.  Use the specified stack unless a genuine technical blocker requires
    an alternative. Explain the reason and ask the user before a major
    stack change.
8.  Build clean, modular, maintainable code. Keep frontend, backend, AI
    services, TTS, visual providers, rendering, storage, background
    jobs, and YouTube integration separated.
9.  Use provider adapters so Gemini, TTS, stock footage, image
    generation, storage, and YouTube components can be replaced later.
10. Validate AI structured output before using it.
11. Keep long-running operations in background jobs, not HTTP request
    handlers.
12. Implement video versioning from the rendering phase.
13. Implement and test the backend approval gate before enabling YouTube
    upload.
14. Do not fake integrations. Clearly label mocks and placeholders.
15. Do not claim a video is complete unless a real playable MP4 exists
    and passes validation.
16. Do not claim a YouTube upload succeeded unless YouTube confirms it.
17. Run relevant tests after changes and fix regressions before moving
    forward.
18. Keep the app runnable after every phase.
19. Update README documentation with exact setup, configuration, and run
    commands.
20. Use beginner-friendly explanations when asking the user to run
    Windows commands or configure external services.
21. Ask only concise, necessary questions. Otherwise use the defaults in
    this specification and document the choice.
22. Prioritize a reliable end-to-end local video-generation workflow
    over unnecessary complexity.
23. Never weaken, bypass, or make optional the mandatory user approval
    requirement for YouTube publishing.

## 15.3 First task for Antigravity

Start with **Phase 1 --- Environment Inspection, Project Setup, and
Architecture**.

Before implementation: - Inspect the current workspace and repository. -
Confirm installed Node.js, npm, Python, Git, and FFmpeg
versions/availability. - Identify missing prerequisites. - Propose the
folder structure. - Explain the local development processes. - Identify
which values will be needed later, but do not ask for every API key at
the beginning. - Ask the user for any information that is genuinely
required to complete Phase 1. - Then implement the foundation, run it,
and verify the frontend and backend health endpoint.

Do not begin by generating a large amount of untested code. Build, run,
test, and verify each stage.

## 15.4 Required handoff after each phase

At the end of every phase, send the user a clear message containing: -
What is completed. - What is not completed. - What the user needs to
provide, if anything. - Exact commands to run or test the project. -
Test results. - Any known issue. - The next phase and its objective.

Wait for user input whenever a required credential, permission, URL, or
decision blocks progress. Do not pretend the blocked integration is
complete.

# 16. Final Product Definition

The finished product should behave like a professional AI documentary
production studio:

**AI creates the documentary. The user reviews it. AI makes requested
changes. The user approves the exact final version. Only then does the
system upload it to YouTube.**

This approval rule is a core product requirement and must remain
enforced in every future version, deployment, worker, and integration.
