/**
 * Standard message renderer.
 * Applies the Standard-owned presentation policy without crossing into Pulse formatting paths.
 */
import React from "react";
import { CreateChatRichMessageBody } from "../CreateChatRichMessageBody";
import {
  parseStandardMessagePresentation,
  type StandardMessagePresentation,
} from "./standardMessageParser";
import type { StandardMessageTone } from "./standardMessageFormatPolicy";

type StandardMessageRendererProps = {
  content: string;
  tone: StandardMessageTone;
};

const renderStandardMessageBody = ({ content, formatMode, tone }: StandardMessagePresentation) => (
  <CreateChatRichMessageBody content={content} formatMode={formatMode} tone={tone} />
);

export const StandardMessageRenderer = React.forwardRef<
  HTMLDivElement,
  StandardMessageRendererProps
>(function StandardMessageRenderer({ content, tone }, ref) {
  const presentation = parseStandardMessagePresentation({ content, tone });
  return (
    <CreateChatRichMessageBody
      ref={ref}
      content={presentation.content}
      formatMode={presentation.formatMode}
      tone={presentation.tone}
    />
  );
});

export const renderStandardMessagePreview = (presentation: StandardMessagePresentation) =>
  renderStandardMessageBody(presentation);
