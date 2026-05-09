/**
 * Character Manager route.
 * Hosts the character reference intake workflow.
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
          content="Character Manager for uploading and organizing character references in ShortPulse."
        />
      </Head>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <CharacterManagerShell />
    </>
  );
}
