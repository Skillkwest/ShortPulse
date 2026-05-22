import { describe, expect, it } from "vitest";
import { getServerSideProps as getCharacterRedirectProps } from "../../pages/character";
import { getServerSideProps as getCharacterSoonRedirectProps } from "../../pages/character-soon";

describe("deprecated character route aliases", () => {
  it("redirects /character into AI Studio", async () => {
    await expect(
      getCharacterRedirectProps({} as Parameters<typeof getCharacterRedirectProps>[0])
    ).resolves.toEqual({
      redirect: {
        destination: "/ai-studio",
        permanent: false,
      },
    });
  });

  it("redirects /character-soon into AI Studio", async () => {
    await expect(
      getCharacterSoonRedirectProps({} as Parameters<typeof getCharacterSoonRedirectProps>[0])
    ).resolves.toEqual({
      redirect: {
        destination: "/ai-studio",
        permanent: false,
      },
    });
  });
});
