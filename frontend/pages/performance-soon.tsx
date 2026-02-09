import Head from "next/head";
import Link from "next/link";

export default function PerformanceComingSoonPage() {
  return (
    <>
      <Head>
        <title>ShortPulse · Analytics Coming Soon</title>
        <meta
          name="description"
          content="The performance analytics workspace is in progress. Check back soon for detailed signals."
        />
      </Head>
      <main className="page page-wide minimal placeholder-page">
        <section className="panel placeholder-panel">
          <div className="placeholder-header">
            <h1>Analytics Coming Soon</h1>
            <p className="subdued">
              We are still shaping the Performance Analytics experience. The demo scoring surface will return in a
              future sprint once the pipelines are production ready.
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
