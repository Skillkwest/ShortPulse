/**
 * Saved Creators page for managing per-user creator lists stored in Supabase.
 * Provides add/search/delete flows with plan/search usage chrome and TikTok-safe profile links.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useResolvedAccountPlan } from "../features/billing/useResolvedAccountPlan";
import { CreatorIntakeForm } from "../features/saved-creators/components/CreatorIntakeForm";
import { SavedCreatorTable } from "../features/saved-creators/components/SavedCreatorTable";
import { SavedCreatorsHeader } from "../features/saved-creators/components/SavedCreatorsHeader";
import {
  AUTH_REQUIRED_ERROR,
  deleteCreator,
  fetchCreators,
  insertCreator,
} from "../features/saved-creators/logic/supabase";
import { Creator, Platform } from "../features/saved-creators/types";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function SavedCreatorsPage() {
  const { resolvedPlan } = useResolvedAccountPlan();
  const searchUsage = { used: 0, limit: 100 };
  const planUsage = { label: "Current plan", name: resolvedPlan?.label ?? "Starter" };
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("saved-creators-body");
    document.documentElement.classList.add("saved-creators-body");
    return () => {
      document.body.classList.remove("saved-creators-body");
      document.documentElement.classList.remove("saved-creators-body");
    };
  }, []);

  useEffect(() => {
    const loadCreators = async () => {
      try {
        const data = await fetchCreators();
        setCreators(data);
      } catch (err: unknown) {
        if (getErrorMessage(err, "") === AUTH_REQUIRED_ERROR) {
          router.replace("/auth");
          return;
        }
        setError(getErrorMessage(err, "Unable to load creators"));
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

  const addCreator = async (event: FormEvent) => {
    event.preventDefault();
    if (!handle.trim()) return;
    setError(null);
    try {
      const newCreator = await insertCreator({ handle, platform });
      setCreators((prev) => [newCreator, ...prev]);
      setHandle("");
    } catch (err: unknown) {
      if (getErrorMessage(err, "") === AUTH_REQUIRED_ERROR) {
        router.replace("/auth");
        return;
      }
      setError(getErrorMessage(err, "Unable to add creator"));
    }
  };

  const removeCreator = async (id: string) => {
    setError(null);
    try {
      await deleteCreator(id);
      setCreators((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      if (getErrorMessage(err, "") === AUTH_REQUIRED_ERROR) {
        router.replace("/auth");
        return;
      }
      setError(getErrorMessage(err, "Unable to delete creator"));
    }
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Saved creators</title>
        <meta
          name="description"
          content="Track saved creators for Reels, TikTok, and Shorts analytics."
        />
      </Head>
      <main className="page page-wide saved-creators-page">
        <SavedCreatorsHeader searchUsage={searchUsage} planUsage={planUsage} />

        <CreatorIntakeForm
          handle={handle}
          platform={platform}
          onHandleChange={setHandle}
          onPlatformChange={setPlatform}
          onSubmit={addCreator}
        />

        <SavedCreatorTable
          creators={creators}
          filtered={filtered}
          loading={loading}
          error={error}
          search={search}
          onSearchChange={setSearch}
          onRemove={removeCreator}
        />
      </main>
    </>
  );
}
