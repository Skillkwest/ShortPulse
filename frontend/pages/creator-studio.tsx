/**
 * Creator Studio placeholder page.
 * Communicates upcoming tooling for scripting, ideation, and AI assists.
 */
import Head from "next/head";
import Link from "next/link";

/**
 * Render the Coming Soon stub for Creator Studio.
 */
export default function CreatorStudio() {
  return (
    <>
      <Head>
        <title>ShortPulse · Creator Studio</title>
        <meta name="description" content="Creator Studio coming soon." />
      </Head>
      <main className="page page-wide">
        <div className="page-top">
          <Link href="/dashboard" className="ghost-btn small">
            ← Back to dashboard
          </Link>
        </div>
        <section className="panel hero-banner">
          <div className="hero-text">
            <h1 className="title">Creator Studio</h1>
            <p className="lede">Coming soon</p>
            <p className="subdued">
              We’re finishing AI-assisted scripts, storyboards, and planning flows. You’ll be able to draft content and
              move it directly into your workspace once this unlocks.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
