import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { UserCircle } from "phosphor-react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

type Platform = "Instagram" | "TikTok" | "YouTube";

type Creator = {
  id: string;
  handle: string;
  platform: Platform;
  followers: number;
  avgViews: number;
  videosTracked: number;
  avatarUrl?: string | null;
};

const platformOptions: Platform[] = ["Instagram", "TikTok", "YouTube"];

const profilePrefixes: Record<string, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
};

const sanitizeHandle = (value: string) =>
  value
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "") // strip zero-width and nbsp
    .replace(/\s+/g, "") // remove all spaces/tabs
    .trim()
    .replace(/^@+/, ""); // drop leading @ symbols

const getProfileUrl = (handle: string, platform: Platform | string) => {
  const clean = sanitizeHandle(handle);
  const normalized = (platform || "").toString().toLowerCase();
  const prefix = profilePrefixes[normalized] || profilePrefixes.instagram;
  const safeHandle = encodeURIComponent(clean);
  const baseUrl = `${prefix}${safeHandle}`;
  if (normalized === "tiktok") {
    return `${baseUrl}/?lang=en`;
  }
  return baseUrl;
};

export default function SavedCreatorsPage() {
  const searchUsage = { used: 0, limit: 100 };
  const planUsage = { label: "Plan", name: "Creative Suite" };
  const router = useRouter();
  const platformMenuRef = useRef<HTMLDivElement | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [followers, setFollowers] = useState("");
  const [avgViews, setAvgViews] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("saved-creators-body");
    document.documentElement.classList.add("saved-creators-body");
    return () => {
      document.body.classList.remove("saved-creators-body");
      document.documentElement.classList.remove("saved-creators-body");
    };
  }, []);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (platformMenuRef.current && !platformMenuRef.current.contains(event.target as Node)) {
        setPlatformMenuOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlatformMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    const loadCreators = async () => {
      try {
        const supabase = ensureSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          router.replace("/auth");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("saved_creators")
          .select("id, handle, platform, followers, avg_views, created_at")
          .order("created_at", { ascending: false });
        if (fetchError) {
          throw fetchError;
        }
        const mapped = (data || []).map((row) => ({
          id: row.id,
          handle: sanitizeHandle(row.handle),
          platform: (row.platform || "instagram").toLowerCase() === "tiktok"
            ? "TikTok"
            : (row.platform || "instagram").toLowerCase() === "youtube"
              ? "YouTube"
              : "Instagram",
          followers: row.followers || 0,
          avgViews: row.avg_views || 0,
          videosTracked: 0,
          avatarUrl: null,
        })) as Creator[];
        setCreators(mapped);
      } catch (err: any) {
        setError(err?.message || "Unable to load creators");
      } finally {
        setLoading(false);
      }
    };

    loadCreators();
  }, [router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return creators;
    return creators.filter((c) => c.handle.toLowerCase().includes(term));
  }, [creators, search]);

  const totals = useMemo(
    () => ({
      saved: creators.length,
      reach: creators.reduce((sum, c) => sum + c.followers, 0),
    }),
    [creators],
  );

  const addCreator = async (e: FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setError(null);
    const supabase = ensureSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      router.replace("/auth");
      return;
    }

    try {
      const normalizedHandle = sanitizeHandle(handle);
      const payload = {
        handle: normalizedHandle,
        platform: platform.toLowerCase(),
        followers: followers ? Number(followers) : 0,
        avg_views: avgViews ? Number(avgViews) : 0,
        user_id: userId,
      };

      const { data, error } = await supabase
        .from("saved_creators")
        .insert(payload)
        .select("id, handle, platform, followers, avg_views")
        .single();
      if (error) throw error;

      const newCreator: Creator = {
        id: data.id,
        handle: data.handle,
        platform: data.platform.toLowerCase() === "tiktok" ? "TikTok" : data.platform.toLowerCase() === "youtube" ? "YouTube" : "Instagram",
        followers: data.followers || 0,
        avgViews: data.avg_views || 0,
        videosTracked: 0,
        avatarUrl: null,
      };
      setCreators((prev) => [newCreator, ...prev]);
    } catch (err: any) {
      setError(err?.message || "Unable to add creator");
    }

    setHandle("");
    setFollowers("");
    setAvgViews("");
  };

  const removeCreator = async (id: string) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.from("saved_creators").delete().eq("id", id);
      if (error) throw error;
      setCreators((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err?.message || "Unable to delete creator");
    }
  };

  const formatNumber = (n: number) =>
    new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  return (
    <>
      <Head>
        <title>ShortPulse · Saved creators</title>
        <meta name="description" content="Track saved creators for Reels, TikTok, and Shorts analytics." />
      </Head>
      <main className="page page-wide saved-creators-page">
        <div className="saved-top-row">
          <Link href="/dashboard" className="ghost-btn small header-link">← Back to dashboard</Link>
        </div>

        <section
          className="panel saved-header-bar saved-hero hero-image-card"
          style={{
            backgroundImage: "url('/Gray.png')",
          }}
        >
          <div className="saved-header-left">
            <div className="saved-title-stack">
              <div className="saved-title-row">
                <h1 className="title">Saved creators</h1>
              </div>
              <p className="subdued">Build a list of creators to follow and surface in your analytics filters.</p>
            </div>
          </div>
          <div className="saved-header-right">
            <div className="search-usage-card" aria-label="Search usage">
              <div className="search-usage-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2.5" y="8.5" width="2.8" height="7" rx="1" stroke="#25A9BF" strokeWidth="1.4" />
                  <rect x="7.4" y="5.5" width="2.8" height="10" rx="1" stroke="#25A9BF" strokeWidth="1.4" />
                  <rect x="12.3" y="3.5" width="2.8" height="12" rx="1" stroke="#25A9BF" strokeWidth="1.4" />
                </svg>
              </div>
              <div className="search-usage-text">
                <p className="metric-label subtle">Searches</p>
                <p className="search-usage-value">{searchUsage.used} / {searchUsage.limit}</p>
              </div>
            </div>
            <div className="search-usage-card plan-card" aria-label="Plan status" role="button" tabIndex={0}>
              <div className="search-usage-icon plan-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="9" cy="9" r="7" stroke="#25A9BF" strokeWidth="1.4" />
                  <path d="M6.3 9.1 8 10.8 11.7 7" stroke="#25A9BF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="search-usage-text">
                <p className="metric-label subtle">{planUsage.label}</p>
                <p className="search-usage-value plan-value">{planUsage.name}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel creator-panel discovery-panel intake-panel">
          <div className="discovery-header">
            <div>
              <h3>Enter a creator handle and pick a platform</h3>
            </div>
          </div>
          <form className="creator-intake" onSubmit={addCreator}>
            <div className="input-chip discovery-input">
              <label className="tiny subdued" htmlFor="creatorHandle">Creator handle</label>
              <div className="input-shell">
                <span className="input-prefix">@</span>
                <input
                  id="creatorHandle"
                  type="text"
                  placeholder="creatorhandle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>
            </div>
            <div className="input-chip select-chip">
              <label className="tiny subdued" htmlFor="platform">Platform</label>
              <div
                className={`platform-select ${platformMenuOpen ? "open" : ""}`}
                ref={platformMenuRef}
              >
                <button
                  type="button"
                  className="platform-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={platformMenuOpen}
                  onClick={() => setPlatformMenuOpen((prev) => !prev)}
                  id="platform"
                >
                  <span>{platform}</span>
                  <span className="platform-caret" aria-hidden="true">▾</span>
                </button>
                {platformMenuOpen && (
                  <div className="platform-menu" role="listbox" aria-label="Select platform">
                    {platformOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={platform === option}
                        className={`platform-option ${platform === option ? "selected" : ""}`}
                        onClick={() => {
                          setPlatform(option);
                          setPlatformMenuOpen(false);
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="creator-form-actions inline">
              <button className="primary-btn small" type="submit">Add creator</button>
            </div>
          </form>
        </section>

        <section className="panel creator-panel saved-list-panel spacious">
          <div className="creator-form-header saved-list-header">
            <div>
              <h3>Saved list</h3>
            </div>
            <div className="saved-list-tools">
              <input
                className="creator-search"
                type="text"
                placeholder="Filter saved creators"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search creators"
              />
              <span className="pill pill-ghost subtle-pill">{filtered.length} / {creators.length}</span>
            </div>
          </div>
          <div className="creator-table-wrap">
            <table className="creator-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Platform</th>
                  <th className="numeric-col">Followers</th>
                  <th className="numeric-col">Avg views</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="table-status" colSpan={5}>Loading your creators…</td>
                  </tr>
                )}
                {!loading && !filtered.length && (
                  <tr>
                    <td className="table-status" colSpan={5}>No creators match your search.</td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td className="table-status error" colSpan={5}>{error}</td>
                  </tr>
                )}
                {!loading && filtered.map((creator) => (
                  <tr key={creator.id}>
                    <td>
                      <div className="creator-cell">
                        <div className="creator-avatar small">
                          {creator.avatarUrl
                            ? <img src={creator.avatarUrl} alt="" aria-hidden="true" />
                            : <UserCircle size={18} weight="regular" />}
                        </div>
                        <div>
                          <p className="creator-handle">@{creator.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className="pill pill-ghost subtle-pill tight-pill">{creator.platform}</span></td>
                    <td className="numeric-col">{formatNumber(creator.followers)}</td>
                    <td className="numeric-col">{formatNumber(creator.avgViews)}</td>
                    <td className="actions-col">
                      <a
                        className="ghost-btn tiny plain-link"
                        href={getProfileUrl(creator.handle, creator.platform)}
                        target="_blank"
                        rel="noreferrer noopener"
                        referrerPolicy="no-referrer"
                        aria-label={`Open ${creator.platform} profile for ${creator.handle}`}
                      >
                        Profile
                      </a>
                      <button
                        className="ghost-btn tiny danger-link"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeCreator(creator.id);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
