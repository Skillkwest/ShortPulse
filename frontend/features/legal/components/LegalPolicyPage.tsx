import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { LEGAL_POLICY_NAV_ITEMS, type LegalPolicySource } from "../data/legalPolicies";
import { parseLegalPolicyMarkdown } from "../logic/markdownPolicyParser";

type LegalPolicyPageProps = {
  markdown: string;
  policy: LegalPolicySource;
};

export function LegalPolicyPage({ markdown, policy }: LegalPolicyPageProps) {
  const parsedPolicy = useMemo(() => parseLegalPolicyMarkdown(markdown), [markdown]);
  const pageTitle = parsedPolicy.title || policy.title;

  return (
    <>
      <Head>
        <title>{pageTitle} · ShortPulse</title>
        <meta name="description" content={policy.description} />
      </Head>

      <main className="legal-policy-page">
        <header className="legal-policy-topbar" aria-label="Legal page navigation">
          <Link href="/" className="legal-policy-logo" aria-label="ShortPulse home">
            <Image
              src="/small good d.png"
              alt="ShortPulse"
              width={203}
              height={64}
              priority
              style={{ height: "auto" }}
            />
          </Link>
          <nav className="legal-policy-nav" aria-label="Legal policies">
            {LEGAL_POLICY_NAV_ITEMS.map((navItem) => (
              <Link
                key={navItem.slug}
                href={navItem.routePath}
                aria-current={navItem.slug === policy.slug ? "page" : undefined}
              >
                {navItem.documentTitle.replace("ShortPulse ", "")}
              </Link>
            ))}
          </nav>
        </header>

        <article className="legal-policy-document">
          <div className="legal-policy-hero">
            <span className="legal-policy-eyebrow">Legal</span>
            <h1>{pageTitle}</h1>
            {parsedPolicy.lastUpdated ? (
              <p className="legal-policy-updated">Last updated: {parsedPolicy.lastUpdated}</p>
            ) : null}
            {parsedPolicy.publicationStatus ? (
              <p className="legal-policy-status">
                Publication status: {parsedPolicy.publicationStatus}
              </p>
            ) : null}
          </div>

          <div className="legal-policy-content">
            {parsedPolicy.blocks.map((block) => {
              if (block.type === "heading") {
                const HeadingTag = block.level === 2 ? "h2" : "h3";
                return (
                  <HeadingTag key={block.id} id={block.id}>
                    {block.text}
                  </HeadingTag>
                );
              }

              if (block.type === "list") {
                return (
                  <ul key={block.id}>
                    {block.items.map((item, index) => (
                      <li key={`${block.id}-${index}`}>{item}</li>
                    ))}
                  </ul>
                );
              }

              if (block.type === "table") {
                return (
                  <div key={block.id} className="legal-policy-table-scroll">
                    <table className="legal-policy-table">
                      <thead>
                        <tr>
                          {block.headers.map((header, index) => (
                            <th key={`${block.id}-header-${index}`}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr key={`${block.id}-row-${rowIndex}`}>
                            {block.headers.map((_, cellIndex) => (
                              <td key={`${block.id}-row-${rowIndex}-${cellIndex}`}>
                                {row[cellIndex] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              return <p key={block.id}>{block.text}</p>;
            })}
          </div>
        </article>
      </main>
    </>
  );
}
