/**
 * Legacy landing-route alias.
 * Keeps historic `/landing` links working by serving the public dashboard/home surface.
 */
export { default, getStaticProps } from "./dashboard";
