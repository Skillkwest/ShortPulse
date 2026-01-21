/**
 * Marketing landing page for ShortPulse.
 * Presents product positioning, feature highlights, testimonials, and pricing for visitors.
 */
/* eslint-disable @next/next/no-img-element */
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  Funnel,
  Lightning,
  ListChecks,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  Target,
  UsersThree,
  VideoCamera,
} from "phosphor-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Lifestyle creator",
    img: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200",
    quote: "ShortPulse keeps me focused on what’s working instead of doomscrolling. I can test ideas with confidence.",
  },
  {
    name: "Marcus Johnson",
    role: "Fitness coach",
    img: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200",
    quote: "The outlier view shows me what really beats baseline. It’s the fastest way to spot a winner.",
  },
  {
    name: "Priya Kapoor",
    role: "Agency editor",
    img: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=200",
    quote: "Saved creator lists plus platform intel = fewer guesses. Clients see results faster.",
  },
];

const faqItems = [
  {
    q: "Do I need to connect my accounts?",
    a: "No. We surface public performance data; you can start without linking social accounts.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Change plans or cancel whenever you want—no contracts.",
  },
  {
    q: "Is this data real while in beta?",
    a: "The performance data is live. Some areas may be polishing pipelines, but the signals you see are real.",
  },
  {
    q: "Will my saved creators and filters carry over to paid plans?",
    a: "Yes. Your saved creators, filters, and lists stay tied to your account across plans.",
  },
];

/**
 * Render the public landing experience with hero, feature, and pricing sections.
 */
export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      title: "Discover top performers",
      body: "Browse the highest-performing short-form videos with real engagement signals.",
      highlight: "Filter by views, likes, and more",
      icon: <MagnifyingGlass size={22} weight="bold" />,
    },
    {
      title: "Performance metrics",
      body: "See views, likes, comments, shares, and engagement rates in one calm view.",
      highlight: "15+ data points per video",
      icon: <Target size={22} weight="bold" />,
    },
    {
      title: "Smart filtering",
      body: "Filter by view count, engagement rate, date range, or creator to study exact content.",
      highlight: "Sort and filter any way you need",
      icon: <Funnel size={22} weight="bold" />,
    },
    {
      title: "Engagement analysis",
      body: "Understand how audiences interact—likes, comments, shares, saves—on winners.",
      highlight: "Complete engagement breakdown",
      icon: <ChartLineUp size={22} weight="bold" />,
    },
    {
      title: "Save and organize",
      body: "Build your own library of reference content. Keep inspiration ready to use.",
      highlight: "Personal research library",
      icon: <Sparkle size={22} weight="bold" />,
    },
    {
      title: "Visual content browser",
      body: "Browse thumbnails, preview content, and click through to source without endless scrolling.",
      highlight: "One-click source access",
      icon: <VideoCamera size={22} weight="bold" />,
    },
  ];

  const steps = [
    {
      title: "Choose your niche",
      body: "Select the content categories and creators you want to study. We gather performance data from across platforms.",
      icon: <MagnifyingGlass size={22} weight="bold" />,
    },
    {
      title: "Browse top content",
      body: "Explore the highest-performing videos with detailed metrics. Filter, sort, and compare to find patterns.",
      icon: <ChartLineUp size={22} weight="bold" />,
    },
    {
      title: "Learn and apply",
      body: "Study what makes top content successful. Use these insights to inform your next posts.",
      icon: <Lightning size={22} weight="bold" />,
    },
  ];

  return (
    <>
      <Head>
        <title>ShortPulse · Short-form performance command center</title>
        <meta
          name="description"
          content="Track what’s working on Reels, TikTok, and Shorts. See outlier posts, saved creators, and engagement signals in one calm workspace."
        />
      </Head>

      <div className="lp-shell">
        <header className="lp-nav sticky">
          <div className="lp-brand">
            <Link href="/" className="lp-brand-link">
              <span className="logo-dot" />
              <span className="lp-brand-text">ShortPulse</span>
            </Link>
            <span className="lp-badge">Command Center</span>
          </div>
          <nav className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <Link href="/auth">Sign in</Link>
          </nav>
          <div className="lp-actions">
            <Link href="/auth" className="primary-btn">
              Start free
            </Link>
          </div>
        </header>

        <main className="lp-main">
          <section className="lp-hero" id="top">
            <div className="lp-hero-grid">
              <div className="lp-hero-copy">
                <div className="lp-pill">
                  <ChartLineUp size={16} weight="bold" />
                  Live short-form intel
                </div>
                <h1>
                  See what’s winning.
                  <span className="lp-hero-accent">Create what works.</span>
                </h1>
                <p className="lp-hero-sub">
                  ShortPulse shows you top-performing short-form videos and outlier posts so you can stop guessing and
                  start creating content that hits.
                </p>
                <div className="lp-cta-row">
                  <Link href="/auth" className="primary-btn lg">
                    Start free with email
                    <ArrowRight size={18} weight="bold" />
                  </Link>
                  <Link href="/performance" className="ghost-btn lg">
                    View live analytics demo
                  </Link>
                </div>
                <div className="lp-hero-sub small">No credit card required.</div>
              </div>

            </div>
          </section>

          <section className="lp-section" id="features">
            <div className="lp-section-head">
              <div>
                <p className="eyebrow">Why ShortPulse</p>
                <h2>See the signals that actually move views.</h2>
              </div>
            </div>
            <div className="lp-feature-grid feature-tiles">
              {features.map((f) => (
                <article key={f.title} className="lp-card tile">
                  <div className="tile-icon">{f.icon}</div>
                  <div className="tile-body">
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                    <div className="tile-highlight">
                      <ShieldCheck size={14} weight="bold" /> {f.highlight}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="lp-section" id="testimonials">
            <div className="lp-section-head">
              <div>
                <p className="eyebrow">Proof</p>
                <h2>Trusted by serious short-form operators.</h2>
              </div>
            </div>
            <div className="lp-testimonial-grid">
              {testimonials.map((t) => (
                <article key={t.name} className="lp-testimonial-card">
                  <div className="lp-testimonial-header">
                    <img src={t.img} alt={t.name} className="lp-avatar-img" />
                    <div>
                      <div className="lp-testimonial-name">{t.name}</div>
                      <div className="lp-testimonial-role">{t.role}</div>
                    </div>
                  </div>
                  <p className="lp-testimonial-quote">“{t.quote}”</p>
                </article>
              ))}
            </div>
          </section>

          <section className="lp-section" id="how">
            <div className="steps-heading">
              <h2>Three steps to better content research</h2>
              <p>From scattered research to organized insights in minutes.</p>
            </div>
            <div className="steps-grid">
              <div className="steps-line" />
              {steps.map((step, idx) => (
                <div key={step.title} className="steps-card">
                  <div className="steps-icon-box">
                    {step.icon}
                    <span className="steps-badge">{String(idx + 1).padStart(2, "0")}</span>
                  </div>
                  <h4>{step.title}</h4>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="lp-section" id="pricing">
            <div className="pricing-hero">
              <h2>Simple, transparent pricing</h2>
              <p>Start free, upgrade when you&apos;re ready</p>
            </div>
            <div className="lp-plan-grid">
              <article className="lp-plan-card pricing-card">
                <div className="lp-plan-top">
                  <span className="lp-plan-name">Starter</span>
                  <p className="lp-plan-sub">Perfect for getting started</p>
                </div>
                <div className="lp-price-block">
                  <div className="lp-price-big">Free</div>
                  <div className="lp-price-note">forever</div>
                </div>
                <ul className="lp-plan-list">
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Browse 100 videos/day
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Basic performance metrics
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    7-day data history
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Email support
                  </li>
                </ul>
                <Link href="/auth" className="pricing-btn neutral">
                  Start Free
                </Link>
              </article>

              <article className="lp-plan-card pricing-card pro-card">
                <div className="lp-plan-top pro-top">
                  <span className="lp-plan-name">Pro</span>
                  <p className="lp-plan-sub">For serious creators</p>
                  <span className="lp-badge pro-badge">Most Popular</span>
                </div>
                <div className="lp-price-block">
                  <div className="lp-price-big">$29</div>
                  <div className="lp-price-note">/month</div>
                </div>
                <ul className="lp-plan-list">
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Unlimited video browsing
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Full performance metrics
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    90-day data history
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Save unlimited videos
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Export to CSV
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Priority support
                  </li>
                </ul>
                <Link href="/auth" className="pricing-btn primary">
                  Start Pro Trial
                </Link>
              </article>

              <article className="lp-plan-card pricing-card">
                <div className="lp-plan-top">
                  <span className="lp-plan-name">Agency</span>
                  <p className="lp-plan-sub">For teams and agencies</p>
                </div>
                <div className="lp-price-block">
                  <div className="lp-price-big">$99</div>
                  <div className="lp-price-note">/month</div>
                </div>
                <ul className="lp-plan-list">
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Everything in Pro
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Multi-user access (5 seats)
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Custom category tracking
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    API access
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    White-label reports
                  </li>
                  <li>
                    <CheckCircle size={16} weight="bold" />
                    Dedicated success manager
                  </li>
                </ul>
                <Link href="/auth" className="pricing-btn neutral">
                  Contact Sales
                </Link>
              </article>
            </div>
          </section>

          <section className="lp-section" id="faq">
            <div className="lp-section-head">
              <div>
                <p className="eyebrow">FAQ</p>
                <h2>Questions before you start?</h2>
              </div>
            </div>
            <div className="lp-faq">
              {faqItems.map((item, idx) => (
                <div key={item.q} className="lp-faq-item">
                  <button
                    className="lp-faq-toggle"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    aria-expanded={openFaq === idx}
                  >
                    <span>{item.q}</span>
                    <span>{openFaq === idx ? "–" : "+"}</span>
                  </button>
                  {openFaq === idx && <p>{item.a}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="lp-section lp-cta-band">
            <div>
              <p className="eyebrow">Ready to create content that actually performs?</p>
              <h2>Sign up free and start tracking what’s blowing up today.</h2>
              <p className="lp-hero-sub">
                Open the live Performance Analytics page, save the creators you care about, and copy what’s already
                winning.
              </p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/auth" className="primary-btn lg">
                Start free with email
              </Link>
              <Link href="/performance" className="ghost-btn lg">
                See live analytics
              </Link>
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          <div className="footer">ShortPulse keeps your performance data and media private to your account.</div>
        </footer>
      </div>
    </>
  );
}
