// Control-plane policy tuning script for local/staging safety iteration.
// Purpose: create policy versions for prod/staging profiles from explicit category targets,
// activate strict profile locally, and emit a before/after diff packet.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("../frontend/node_modules/@supabase/supabase-js");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const PROFILE_IDS = ["prod_safe_v1", "staging_lenient"];
const MODALITIES = ["text", "image", "video"];

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const asObjectRecord = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const ensurePolicyBase = (policy) => {
  const next = asObjectRecord(policy) ? deepClone(policy) : {};
  if (next.schemaVersion !== 2) next.schemaVersion = 2;
  if (!asObjectRecord(next.input)) next.input = {};
  if (!asObjectRecord(next.input.text)) next.input.text = {};

  for (const modality of MODALITIES) {
    if (!asObjectRecord(next.input.text[modality])) next.input.text[modality] = {};
    for (const family of ["sexual", "violence", "self_harm", "hate"]) {
      if (!asObjectRecord(next.input.text[modality][family])) {
        next.input.text[modality][family] = { level: "refuse" };
      }
      if (!next.input.text[modality][family].level) {
        next.input.text[modality][family].level = "refuse";
      }
    }
  }

  if (!asObjectRecord(next.input.image_preflight)) {
    next.input.image_preflight = {
      enabled: true,
      thresholds: {
        sexual: 0.75,
        violence: 0.8,
        self_harm: 0.8,
        hate: 0.8,
      },
    };
  }
  if (!asObjectRecord(next.input.image_preflight.thresholds)) {
    next.input.image_preflight.thresholds = {
      sexual: 0.75,
      violence: 0.8,
      self_harm: 0.8,
      hate: 0.8,
    };
  }

  if (!asObjectRecord(next.generation)) {
    next.generation = {
      defaults: {
        image: { level: "moderate" },
        video: { level: "moderate" },
      },
      per_model: {},
    };
  }
  if (!asObjectRecord(next.generation.defaults)) {
    next.generation.defaults = {
      image: { level: "moderate" },
      video: { level: "moderate" },
    };
  }
  if (!asObjectRecord(next.generation.defaults.image)) {
    next.generation.defaults.image = { level: "moderate" };
  }
  if (!asObjectRecord(next.generation.defaults.video)) {
    next.generation.defaults.video = { level: "moderate" };
  }
  if (!asObjectRecord(next.generation.per_model)) {
    next.generation.per_model = {};
  }

  if (!asObjectRecord(next.postprocess)) {
    next.postprocess = { mode: "enforce" };
  }

  return next;
};

const applyTargetTuning = ({ basePolicy, profileId }) => {
  const next = ensurePolicyBase(basePolicy);
  const sexualExplicitAction = profileId === "staging_lenient" ? "rewrite" : "refuse";

  for (const modality of MODALITIES) {
    next.input.text[modality].sexual = {
      level: "rewrite",
      suggestiveAction: "rewrite",
      explicitAction: sexualExplicitAction,
    };
    next.input.text[modality].violence = {
      level: "rewrite",
      suggestiveAction: "allow",
      explicitAction: "refuse",
    };
    next.input.text[modality].self_harm = {
      level: "refuse",
      suggestiveAction: "refuse",
      explicitAction: "refuse",
    };
    next.input.text[modality].hate = {
      level: "refuse",
      suggestiveAction: "refuse",
      explicitAction: "refuse",
    };
  }

  next.postprocess.mode = "enforce";
  next.schemaVersion = 2;
  return next;
};

const compactPolicyView = (policy) => {
  const text = policy?.input?.text ?? {};
  return {
    schemaVersion: policy?.schemaVersion ?? null,
    postprocessMode: policy?.postprocess?.mode ?? null,
    text,
  };
};

const readLatestPolicyForProfile = async (supabase, profileId) => {
  const { data, error } = await supabase
    .from("agent_safety_policy_versions")
    .select("id, profile_id, version, policy, is_enabled, created_at")
    .eq("profile_id", profileId)
    .eq("is_enabled", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const readActiveRuntime = async (supabase) => {
  const { data, error } = await supabase.rpc("get_active_agent_safety_policy");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

const createVersion = async ({ supabase, profileId, policy, reason, note, actorEmail }) => {
  const { data, error } = await supabase.rpc("create_agent_safety_policy_version", {
    p_profile_id: profileId,
    p_policy: policy,
    p_note: note,
    p_reason: reason,
    p_actor_user_id: null,
    p_actor_email: actorEmail,
    p_single_reviewer_ack: true,
    p_source: "local_tuning_script",
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row;
};

const activateProfile = async ({ supabase, profileId, reason, actorEmail }) => {
  const { data, error } = await supabase.rpc("activate_agent_safety_policy", {
    p_profile_id: profileId,
    p_reason: reason,
    p_actor_user_id: null,
    p_actor_email: actorEmail,
    p_single_reviewer_ack: true,
    p_source: "local_tuning_script",
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

const main = async () => {
  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
  fs.mkdirSync(outputDir, { recursive: true });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const actorEmail = "local_tuning_script@shortpulse.test";
  const reason = "Apply pre-provider category tuning targets for safety simulation cycle.";
  const note = "category_split_actions_v1";

  const beforeActive = await readActiveRuntime(supabase);
  const profilePackets = [];

  for (const profileId of PROFILE_IDS) {
    const latest = await readLatestPolicyForProfile(supabase, profileId);
    const latestPolicy = asObjectRecord(latest?.policy) ?? {};
    const targetPolicy = applyTargetTuning({ basePolicy: latestPolicy, profileId });
    const unchanged = JSON.stringify(latestPolicy) === JSON.stringify(targetPolicy);

    let created = null;
    if (!unchanged) {
      created = await createVersion({
        supabase,
        profileId,
        policy: targetPolicy,
        reason,
        note,
        actorEmail,
      });
    }

    profilePackets.push({
      profileId,
      latestVersion: latest?.version ?? null,
      latestPolicy: compactPolicyView(latestPolicy),
      targetPolicy: compactPolicyView(targetPolicy),
      unchanged,
      createResult: created,
    });
  }

  const activateResult = await activateProfile({
    supabase,
    profileId: "prod_safe_v1",
    reason: "Promote strict tuned policy for local correctness/stress safety validation.",
    actorEmail,
  });

  const afterActive = await readActiveRuntime(supabase);

  const packet = {
    runId: `agent-safety-tune-${Date.now()}`,
    startedAt: new Date().toISOString(),
    beforeActive: {
      profileId: beforeActive?.active_profile_id ?? null,
      version: beforeActive?.active_policy_version ?? null,
      cooldownUntil: beforeActive?.cooldown_until ?? null,
      policy: compactPolicyView(beforeActive?.active_policy ?? {}),
    },
    profiles: profilePackets,
    activateResult,
    afterActive: {
      profileId: afterActive?.active_profile_id ?? null,
      version: afterActive?.active_policy_version ?? null,
      cooldownUntil: afterActive?.cooldown_until ?? null,
      policy: compactPolicyView(afterActive?.active_policy ?? {}),
    },
    finishedAt: new Date().toISOString(),
  };

  const outputPath = path.join(outputDir, `${packet.runId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(packet, null, 2));

  console.log(
    JSON.stringify(
      {
        outputPath,
        beforeActive: packet.beforeActive,
        activateResult,
        afterActive: packet.afterActive,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
