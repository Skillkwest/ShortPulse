/**
 * Profile route CSS-module bridge.
 * Adds localized profile classes while preserving raw class names for tests and shared DOM contracts.
 */
import styles from "../../styles/profile-route.module.css";

const profileStyles = styles as Record<string, string | undefined>;

/**
 * Combines profile-local CSS module classes with the raw class contract already used by tests.
 */
export const profileClass = (...names: Array<string | false | null | undefined>): string => {
  const classNames = new Set<string>();

  names.forEach((name) => {
    if (!name) return;
    const mappedName = profileStyles[name];
    if (mappedName) {
      mappedName.split(/\s+/).forEach((className) => {
        if (className) classNames.add(className);
      });
    }
    classNames.add(name);
  });

  return Array.from(classNames).join(" ");
};
