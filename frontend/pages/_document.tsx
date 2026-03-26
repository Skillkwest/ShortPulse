/**
 * Custom Next.js document for app-wide HTML shell configuration.
 * Sets the global favicon and preserves the default document structure.
 */
import Document, { Head, Html, Main, NextScript } from "next/document";

/**
 * Render the base HTML document for the app.
 */
export default class CustomDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="icon" href="/Fav.png" type="image/png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
