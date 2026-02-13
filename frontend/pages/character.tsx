/**
 * Character Manager route.
 * Hosts the beginner-first 10-shot intake workflow for character consistency.
 */
import Head from "next/head";
import { useEffect } from "react";
import { CharacterManagerShell } from "../features/character-manager/components/CharacterManagerShell";

export default function CharacterPage() {
  useEffect(() => {
    document.body.classList.add("character-manager-body");
    document.documentElement.classList.add("character-manager-body");
    return () => {
      document.body.classList.remove("character-manager-body");
      document.documentElement.classList.remove("character-manager-body");
    };
  }, []);

  return (
    <>
      <Head>
        <title>Character Manager | ShortPulse</title>
        <meta
          name="description"
          content="Character Manager for building consistent 10-shot reference packs in ShortPulse."
        />
      </Head>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <CharacterManagerShell />
    </>
  );
}
