create table if not exists public.expert_edit_system_preset_runtime (
    singleton boolean primary key default true check (singleton = true),
    preset_definitions jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by_user_id uuid null,
    updated_by_email text null,
    constraint expert_edit_system_preset_runtime_definitions_array_check check (
        jsonb_typeof(preset_definitions) = 'array'
    )
);

alter table public.expert_edit_system_preset_runtime enable row level security;

revoke all on table public.expert_edit_system_preset_runtime from public;
revoke all on table public.expert_edit_system_preset_runtime from anon;
revoke all on table public.expert_edit_system_preset_runtime from authenticated;
grant all on table public.expert_edit_system_preset_runtime to service_role;

insert into public.expert_edit_system_preset_runtime (
    singleton,
    preset_definitions,
    updated_by_email
)
values (
    true,
    jsonb_build_array(
        jsonb_build_object(
            'presetId', 'selfie',
            'label', 'Selfie',
            'prompt', 'Make the figure hold the camera in a selfie-style perspective. Keep the framing tight and realistic so it feels like the camera is in the figure''s hand, with the subject looking directly into the lens.'
        ),
        jsonb_build_object(
            'presetId', 'side_profile',
            'label', 'Side Profile',
            'prompt', 'Compose the subject in a clean side-profile pose, emphasizing the silhouette from forehead to chin with the face turned 90 degrees from camera.'
        ),
        jsonb_build_object(
            'presetId', 'over_shoulder',
            'label', 'Over Shoulder',
            'prompt', 'Frame the shot from over the subject''s shoulder so the near shoulder anchors the foreground while the face and scene remain readable in the midground.'
        ),
        jsonb_build_object(
            'presetId', 'from_behind',
            'label', 'From Behind',
            'prompt', 'Position the camera behind the subject so we primarily see the back of the head and body, with subtle head turn only if needed for context.'
        ),
        jsonb_build_object(
            'presetId', 'low_angle',
            'label', 'Low Angle',
            'prompt', 'Use a low-angle camera position looking upward at the subject to create stronger presence and scale while keeping anatomy and proportions natural.'
        ),
        jsonb_build_object(
            'presetId', 'drone_view',
            'label', 'Drone View',
            'prompt', 'Use a high aerial perspective, as if shot from a drone, looking downward with wide environmental context and clear subject placement.'
        ),
        jsonb_build_object(
            'presetId', 'zoom_in',
            'label', 'Zoom In',
            'prompt', 'Zoom in for a tighter composition focused on the subject''s face and upper body, reducing background clutter while preserving sharp detail.'
        ),
        jsonb_build_object(
            'presetId', 'zoom_out',
            'label', 'Zoom Out',
            'prompt', 'Zoom out to a wider composition that includes more environment and negative space while keeping the subject clearly identifiable.'
        ),
        jsonb_build_object(
            'presetId', 'enhance_realism',
            'label', 'Enhance Realism',
            'prompt', 'Increase photographic realism with natural skin texture, believable lighting falloff, accurate shadows, subtle lens behavior, and physically plausible detail.'
        )
    ),
    'seed'
)
on conflict (singleton) do nothing;
