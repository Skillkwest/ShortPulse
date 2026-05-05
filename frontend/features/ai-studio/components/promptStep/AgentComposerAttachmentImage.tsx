/**
 * Composer attachment image preview with ordered fallback URL recovery.
 * Used by Standard and Pulse composer attachment strips.
 */
import React from "react";

type AgentComposerAttachmentImageProps = {
  src: string;
  fallbackUrls?: string[];
};

export const AgentComposerAttachmentImage: React.FC<AgentComposerAttachmentImageProps> = ({
  src,
  fallbackUrls = [],
}) => {
  const [activeSrc, setActiveSrc] = React.useState(src);
  const fallbackQueueRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    setActiveSrc(src);
    fallbackQueueRef.current = fallbackUrls.filter((candidate) => candidate && candidate !== src);
  }, [fallbackUrls, src]);

  const handleError = React.useCallback(() => {
    const nextSrc = fallbackQueueRef.current.shift();
    if (nextSrc) {
      setActiveSrc(nextSrc);
    }
  }, []);

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={activeSrc} alt="" className="agent-attachment-card-media" onError={handleError} />
  );
};
