create table if not exists public.ai_studio_builtin_style_runtime (
    singleton boolean primary key default true check (singleton = true),
    style_definitions jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by_user_id uuid null,
    updated_by_email text null,
    constraint ai_studio_builtin_style_runtime_definitions_array_check check (
        jsonb_typeof(style_definitions) = 'array'
    )
);

alter table public.ai_studio_builtin_style_runtime enable row level security;

revoke all on table public.ai_studio_builtin_style_runtime from public;
revoke all on table public.ai_studio_builtin_style_runtime from anon;
revoke all on table public.ai_studio_builtin_style_runtime from authenticated;
grant all on table public.ai_studio_builtin_style_runtime to service_role;

insert into public.ai_studio_builtin_style_runtime (
    singleton,
    style_definitions,
    updated_by_email
)
values (
    true,
    jsonb_build_array(
        jsonb_build_object(
            'styleId', 'photorealistic',
            'title', 'Photorealistic',
            'stylePrompt', 'photorealistic image, true-to-life skin texture and materials, natural color response, balanced dynamic range, crisp focus, realistic lighting and shadow falloff',
            'previewImageUrl', '/Styles/Photoreal.png',
            'referenceImageName', null,
            'schemaVersion', 1
        ),
        jsonb_build_object(
            'styleId', 'cinematic',
            'title', 'Cinematic',
            'stylePrompt', 'cinematic editorial photography, dramatic moody lighting, rich contrast, controlled color grade, shallow depth of field, polished high-end production finish',
            'previewImageUrl', '/Styles/Cinematic.png',
            'referenceImageName', null,
            'schemaVersion', 1
        ),
        jsonb_build_object(
            'styleId', 'cell-phone-snapshot',
            'title', 'Cell phone snapshot',
            'stylePrompt', 'casual smartphone photo, natural available light, candid framing, everyday realism, slightly imperfect composition, authentic handheld snapshot feel',
            'previewImageUrl', '/Styles/Cell Phone Snap Shot.jpeg',
            'referenceImageName', null,
            'schemaVersion', 1
        ),
        jsonb_build_object(
            'styleId', 'anime',
            'title', 'Anime',
            'stylePrompt', 'anime style, clean linework, expressive character design, soft cel shading, stylized color palette, polished 2D illustration finish',
            'previewImageUrl', '/Styles/Anime.png',
            'referenceImageName', null,
            'schemaVersion', 1
        )
    ),
    'seed'
)
on conflict (singleton) do nothing;

