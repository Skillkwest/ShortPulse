/**
 * Performance route CSS-module bridge.
 * Adds localized analytics classes while preserving raw class names for tests and DOM contracts.
 */
import styles from "../../styles/performance-route.module.css";

const performanceStyles = styles as Record<string, string | undefined>;

/**
 * Combines performance-local CSS module classes with raw class names already used by tests.
 */
export const performanceClass = (...names: Array<string | false | null | undefined>): string => {
  const classNames = new Set<string>();

  names.forEach((name) => {
    if (!name) return;
    const mappedName = performanceStyles[name];
    if (mappedName) {
      mappedName.split(/\s+/).forEach((className) => {
        if (className) classNames.add(className);
      });
    }
    classNames.add(name);
  });

  return Array.from(classNames).join(" ");
};
