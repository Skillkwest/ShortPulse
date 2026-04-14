/**
 * Dev-only Phase 1 route for the master-stage bakeoff lab.
 * Returns 404 in production so the experiment remains an engineering surface.
 */
import Head from "next/head";
import type { GetServerSideProps } from "next";

import { MasterStageBakeoffLab } from "../../features/ai-studio/components/edit/bakeoff/MasterStageBakeoffLab";

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === "production") {
    return {
      notFound: true,
    };
  }
  return {
    props: {},
  };
};

export default function AiStudioStageBakeoffPage() {
  return (
    <>
      <Head>
        <title>ShortPulse · AI Studio Stage Bakeoff</title>
        <meta
          name="description"
          content="Dev-only Phase 1 bakeoff lab for the new AI Studio master stage."
        />
      </Head>
      <MasterStageBakeoffLab />
    </>
  );
}
