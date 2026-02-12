/**
 * Temporary placeholder route for Character while the full workflow is being finalized.
 * Provides a simple "coming soon" landing linked from the dashboard.
 */
import Head from "next/head";
import Link from "next/link";

export default function CharacterComingSoonPage() {
  return (
    <>
      <Head>
        <title>ShortPulse · Character Coming Soon</title>
        <meta
          name="description"
          content="The Character workspace is in progress. Check back soon for identity and generation workflows."
        />
      </Head>
      <main className="page page-wide minimal placeholder-page">
        <section className="panel placeholder-panel">
          <div className="placeholder-header">
            <h1>Character Coming Soon</h1>
            <p className="subdued">
              We are still shaping the Character workflow. Identity tools and generation controls
              will return in a future sprint once this surface is production ready.
            </p>
          </div>
          <div className="placeholder-actions">
            <Link href="/dashboard" className="ghost-btn">
              Return to dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
