import Head from "next/head";
import Link from "next/link";

export default function OnboardingCourses() {
  return (
    <>
      <Head>
        <title>ShortPulse · Onboarding Courses</title>
        <meta name="description" content="ShortPulse onboarding courses coming soon." />
      </Head>
      <main className="page page-wide">
        <div className="page-top">
          <Link href="/dashboard" className="ghost-btn small">
            ← Back to dashboard
          </Link>
        </div>
        <section className="panel">
          <p className="eyebrow">Onboarding</p>
          <h1>Coming soon</h1>
          <p className="subdued">We&apos;re preparing guided walkthroughs to help you ramp quickly.</p>
        </section>
      </main>
    </>
  );
}
