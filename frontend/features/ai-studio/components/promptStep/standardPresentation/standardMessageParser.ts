/**
 * Standard message presentation parser.
 * Resolves the Standard presentation contract into one render-ready shape.
 */
import {
  resolveStandardMessageFormatMode,
  type StandardMessageFormatMode,
  type StandardMessageTone,
} from "./standardMessageFormatPolicy";

export type StandardMessagePresentation = {
  content: string;
  formatMode: StandardMessageFormatMode;
  tone: StandardMessageTone;
};

/**
 * Resolves the Standard-owned presentation contract without changing the
 * existing Create rich-text rendering behavior.
 */
export const parseStandardMessagePresentation = ({
  content,
  tone,
}: {
  content: string;
  tone: StandardMessageTone;
}): StandardMessagePresentation => ({
  content,
  tone,
  formatMode: resolveStandardMessageFormatMode(tone),
});
