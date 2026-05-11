import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, "..")
const frontendRequire = createRequire(path.join(REPO_ROOT, "frontend", "package.json"))
const { createClient } = frontendRequire("@supabase/supabase-js")

const PAGE_SIZE = 1000
const MAX_QUERY_ATTEMPTS = 3

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function parseArgs(argv) {
  const args = {
    envName: process.env.SUPABASE_ENV_NAME ?? null,
    url: process.env.SUPABASE_URL ?? null,
    serviceKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_KEY ??
      null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const next = argv[i + 1]

    if (token === "--env" && next) {
      args.envName = next
      i += 1
      continue
    }
    if (token === "--url" && next) {
      args.url = next
      i += 1
      continue
    }
    if ((token === "--service-key" || token === "--service-role-key") && next) {
      args.serviceKey = next
      i += 1
      continue
    }
  }

  if (!args.url || !args.serviceKey) {
    const command = "node scripts/check_character_sheet_alias_readiness.mjs --env staging"
    throw new Error(
      `Missing Supabase credentials. Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or --url/--service-key). Example: ${command}`
    )
  }

  return args
}

async function fetchAllRows(client, table, columns, configure) {
  const rows = []
  let from = 0

  while (true) {
    let data = null

    for (let attempt = 1; attempt <= MAX_QUERY_ATTEMPTS; attempt += 1) {
      let query = client.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
      if (configure) {
        query = configure(query)
      }

      const result = await query
      if (!result.error) {
        data = result.data
        break
      }

      if (attempt === MAX_QUERY_ATTEMPTS) {
        const error = new Error(`${table}: ${result.error.message}`)
        error.cause = result.error
        throw error
      }

      await sleep(250 * attempt)
    }

    if (!Array.isArray(data) || data.length === 0) {
      break
    }

    rows.push(...data)
    if (data.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}

function isMissingColumnError(error, columns) {
  const source = [error?.message, error?.cause?.message, error?.cause?.details, error?.cause?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return columns.some((column) => source.includes(column.toLowerCase()))
}

async function fetchRowsWithAliasFallback(
  client,
  { table, primaryColumns, fallbackColumns, missingColumns, configure }
) {
  try {
    return {
      rows: await fetchAllRows(client, table, primaryColumns, configure),
      aliasColumnsPresent: true,
    }
  } catch (error) {
    if (!isMissingColumnError(error, missingColumns)) {
      throw error
    }

    return {
      rows: await fetchAllRows(client, table, fallbackColumns, configure),
      aliasColumnsPresent: false,
    }
  }
}

function hasNonEmptyValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ""
}

function hasMetadataKey(metadata, key) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && key in metadata)
}

function summarizeAliasPresence(rows, canonicalKey, legacyKey, legacyColumnPresent = true) {
  const summary = {
    totalRows: rows.length,
    bothPresent: 0,
    canonicalOnly: 0,
    legacyOnly: 0,
    neither: 0,
  }

  for (const row of rows) {
    const hasCanonical = hasNonEmptyValue(row[canonicalKey])
    const hasLegacy = legacyColumnPresent && hasNonEmptyValue(row[legacyKey])

    if (hasCanonical && hasLegacy) {
      summary.bothPresent += 1
      continue
    }
    if (hasCanonical) {
      summary.canonicalOnly += 1
      continue
    }
    if (hasLegacy) {
      summary.legacyOnly += 1
      continue
    }
    summary.neither += 1
  }

  return summary
}

function summarizeMetadataAssignmentPresence(rows) {
  const summary = {
    totalRows: rows.length,
    bothPresent: 0,
    canonicalOnly: 0,
    legacyOnly: 0,
    neither: 0,
  }

  for (const row of rows) {
    const metadata = row.metadata ?? null
    const hasCanonical = hasMetadataKey(metadata, "character_sheet_assignments")
    const hasLegacy = hasMetadataKey(metadata, "reference_pack_assignments")

    if (hasCanonical && hasLegacy) {
      summary.bothPresent += 1
      continue
    }
    if (hasCanonical) {
      summary.canonicalOnly += 1
      continue
    }
    if (hasLegacy) {
      summary.legacyOnly += 1
      continue
    }
    summary.neither += 1
  }

  return summary
}

function summarizeMediaMetadataPresence(rows) {
  const summary = {
    totalRows: rows.length,
    bothPresent: 0,
    canonicalOnly: 0,
    legacyOnly: 0,
    neither: 0,
  }

  for (const row of rows) {
    const metadata = row.metadata ?? null
    const hasCanonical = hasNonEmptyValue(metadata?.character_sheet_id)
    const hasLegacy = hasNonEmptyValue(metadata?.reference_pack_id)

    if (hasCanonical && hasLegacy) {
      summary.bothPresent += 1
      continue
    }
    if (hasCanonical) {
      summary.canonicalOnly += 1
      continue
    }
    if (hasLegacy) {
      summary.legacyOnly += 1
      continue
    }
    summary.neither += 1
  }

  return summary
}

function computeDriftCounts({
  characters,
  characterReferenceImages,
  characterGenerationJobs,
  characterReferenceMedia,
  aliasColumnsPresent,
}) {
  return [
    {
      checkName: "characters.active_sheet_alias",
      mismatchCount: aliasColumnsPresent.characters
        ? characters.filter((row) => row.active_character_sheet_id !== row.active_reference_pack_id).length
        : 0,
    },
    {
      checkName: "character_reference_images.sheet_alias",
      mismatchCount: aliasColumnsPresent.characterReferenceImages
        ? characterReferenceImages.filter((row) => row.character_sheet_id !== row.reference_pack_id).length
        : 0,
    },
    {
      checkName: "character_generation_jobs.sheet_alias",
      mismatchCount: aliasColumnsPresent.characterGenerationJobs
        ? characterGenerationJobs.filter((row) => row.character_sheet_id !== row.reference_pack_id).length
        : 0,
    },
    {
      checkName: "characters.metadata_assignment_alias",
      mismatchCount: characters.filter((row) => {
        const metadata = row.metadata ?? null
        const hasCanonical = hasMetadataKey(metadata, "character_sheet_assignments")
        const hasLegacy = hasMetadataKey(metadata, "reference_pack_assignments")
        if (!hasCanonical || !hasLegacy) {
          return false
        }
        return (
          JSON.stringify(metadata.character_sheet_assignments) !==
          JSON.stringify(metadata.reference_pack_assignments)
        )
      }).length,
    },
    {
      checkName: "media_files.character_reference_metadata_alias",
      mismatchCount: characterReferenceMedia.filter((row) => {
        const metadata = row.metadata ?? null
        const canonical = metadata?.character_sheet_id ?? ""
        const legacy = metadata?.reference_pack_id ?? ""
        if (!hasNonEmptyValue(canonical) || !hasNonEmptyValue(legacy)) {
          return false
        }
        return canonical !== legacy
      }).length,
    },
  ]
}

function buildSummary(driftCounts, presence) {
  const hasDriftMismatches = driftCounts.some((entry) => entry.mismatchCount > 0)
  const legacyOnlyRows = {
    charactersMetadataAssignments: presence.characters.metadataAssignments.legacyOnly,
    charactersActiveSheetIds: presence.characters.activeSheetIds.legacyOnly,
    characterReferenceImages: presence.characterReferenceImages.sheetIds.legacyOnly,
    characterGenerationJobs: presence.characterGenerationJobs.sheetIds.legacyOnly,
    mediaFilesCharacterReference: presence.mediaFilesCharacterReference.metadataSheetIds.legacyOnly,
  }
  const hasLegacyOnlyRows = Object.values(legacyOnlyRows).some((count) => count > 0)

  return {
    hasDriftMismatches,
    hasLegacyOnlyRows,
    readyToEvaluateFallbackRetirement: !hasDriftMismatches && !hasLegacyOnlyRows,
    legacyOnlyRows,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const client = createClient(args.url, args.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "shortpulse-character-alias-readiness-check",
      },
    },
  })

  const [
    charactersResult,
    characterReferenceImagesResult,
    characterGenerationJobsResult,
    characterReferenceMedia,
  ] =
    await Promise.all([
      fetchRowsWithAliasFallback(client, {
        table: "characters",
        primaryColumns: "id, metadata, active_character_sheet_id, active_reference_pack_id",
        fallbackColumns: "id, metadata, active_character_sheet_id",
        missingColumns: ["active_reference_pack_id"],
      }),
      fetchRowsWithAliasFallback(client, {
        table: "character_reference_images",
        primaryColumns: "id, character_sheet_id, reference_pack_id",
        fallbackColumns: "id, character_sheet_id",
        missingColumns: ["reference_pack_id"],
      }),
      fetchRowsWithAliasFallback(client, {
        table: "character_generation_jobs",
        primaryColumns: "id, character_sheet_id, reference_pack_id",
        fallbackColumns: "id, character_sheet_id",
        missingColumns: ["reference_pack_id"],
      }),
      fetchAllRows(client, "media_files", "id, metadata", (query) =>
        query.eq("source", "character_reference")
      ),
    ])

  const characters = charactersResult.rows
  const characterReferenceImages = characterReferenceImagesResult.rows
  const characterGenerationJobs = characterGenerationJobsResult.rows
  const aliasColumnsPresent = {
    characters: charactersResult.aliasColumnsPresent,
    characterReferenceImages: characterReferenceImagesResult.aliasColumnsPresent,
    characterGenerationJobs: characterGenerationJobsResult.aliasColumnsPresent,
  }

  const driftCounts = computeDriftCounts({
    characters,
    characterReferenceImages,
    characterGenerationJobs,
    characterReferenceMedia,
    aliasColumnsPresent,
  })

  const presence = {
    characters: {
      metadataAssignments: summarizeMetadataAssignmentPresence(characters),
      activeSheetIds: summarizeAliasPresence(
        characters,
        "active_character_sheet_id",
        "active_reference_pack_id",
        aliasColumnsPresent.characters
      ),
    },
    characterReferenceImages: {
      sheetIds: summarizeAliasPresence(
        characterReferenceImages,
        "character_sheet_id",
        "reference_pack_id",
        aliasColumnsPresent.characterReferenceImages
      ),
    },
    characterGenerationJobs: {
      sheetIds: summarizeAliasPresence(
        characterGenerationJobs,
        "character_sheet_id",
        "reference_pack_id",
        aliasColumnsPresent.characterGenerationJobs
      ),
    },
    mediaFilesCharacterReference: {
      metadataSheetIds: summarizeMediaMetadataPresence(characterReferenceMedia),
    },
  }

  const result = {
    environment: args.envName ?? "unspecified",
    generatedAt: new Date().toISOString(),
    driftCounts,
    presence,
    aliasColumnsPresent,
    summary: buildSummary(driftCounts, presence),
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
})
