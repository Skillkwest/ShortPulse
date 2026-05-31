/**
 * Pulse-guided assistant message renderer.
 * Delegates guided rich-text formatting to the shared Create chat renderer.
 */
import React from "react";
import { CreateChatRichMessageBody } from "./CreateChatRichMessageBody";

type PulseGuidedMessageBodyProps = {
  content: string;
};

export const PulseGuidedMessageBody = React.forwardRef<HTMLDivElement, PulseGuidedMessageBodyProps>(
  function PulseGuidedMessageBody({ content }, ref) {
    return (
      <CreateChatRichMessageBody ref={ref} content={content} formatMode="guided" tone="assistant" />
    );
  }
);
