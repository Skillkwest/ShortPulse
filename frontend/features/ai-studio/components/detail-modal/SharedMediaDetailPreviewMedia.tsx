import React from "react";

type SharedMediaDetailPreviewMediaProps = {
  mediaUrl: string | null;
  mediaKind: "image" | "video" | "audio" | null;
  altText: string;
  isLoading?: boolean;
  loadingMessage?: string;
  unavailableMessage?: string;
  placeholderClassName?: string;
  imageClassName: string;
  videoClassName?: string;
  audioClassName?: string;
  imageStyle?: React.CSSProperties;
  videoStyle?: React.CSSProperties;
  videoRef?: React.Ref<HTMLVideoElement>;
  audioRef?: React.Ref<HTMLAudioElement>;
  videoControls?: boolean;
  videoAutoPlay?: boolean;
  videoLoop?: boolean;
  videoMuted?: boolean;
  videoPlaysInline?: boolean;
  audioControls?: boolean;
  audioAutoPlay?: boolean;
  audioPreload?: "none" | "metadata" | "auto";
  imageDraggable?: boolean;
  onImageDragStart?: React.DragEventHandler<HTMLImageElement>;
  onImageLoad?: React.ReactEventHandler<HTMLImageElement>;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  onVideoLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoPlay?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoPause?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoEnded?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoError?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoVolumeChange?: React.ReactEventHandler<HTMLVideoElement>;
  onAudioPlay?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioPause?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioEnded?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioError?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioVolumeChange?: React.ReactEventHandler<HTMLAudioElement>;
};

/**
 * Shared media renderer for AI Studio detail surfaces.
 * Keeps image/video/audio display logic aligned across modal implementations.
 */
export function SharedMediaDetailPreviewMedia({
  mediaUrl,
  mediaKind,
  altText,
  isLoading = false,
  loadingMessage = "Loading media...",
  unavailableMessage = "Media unavailable.",
  placeholderClassName = "art-text-placeholder",
  imageClassName,
  videoClassName,
  audioClassName,
  imageStyle,
  videoStyle,
  videoRef,
  audioRef,
  videoControls = true,
  videoAutoPlay = true,
  videoLoop = false,
  videoMuted = false,
  videoPlaysInline = true,
  audioControls = true,
  audioAutoPlay = true,
  audioPreload = "metadata",
  imageDraggable = false,
  onImageDragStart,
  onImageLoad,
  onImageError,
  onVideoLoadedMetadata,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
  onVideoError,
  onVideoVolumeChange,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
  onAudioError,
  onAudioVolumeChange,
}: SharedMediaDetailPreviewMediaProps) {
  if (!mediaUrl) {
    return (
      <div className={placeholderClassName}>
        <p>{isLoading ? loadingMessage : unavailableMessage}</p>
      </div>
    );
  }

  if (mediaKind === "video") {
    return (
      <video
        className={videoClassName ?? imageClassName}
        src={mediaUrl}
        ref={videoRef}
        controls={videoControls}
        autoPlay={videoAutoPlay}
        loop={videoLoop}
        muted={videoMuted}
        playsInline={videoPlaysInline}
        style={videoStyle}
        onLoadedMetadata={onVideoLoadedMetadata}
        onPlay={onVideoPlay}
        onPause={onVideoPause}
        onEnded={onVideoEnded}
        onError={onVideoError}
        onVolumeChange={onVideoVolumeChange}
      />
    );
  }

  if (mediaKind === "audio") {
    return (
      <audio
        className={audioClassName ?? imageClassName}
        src={mediaUrl}
        ref={audioRef}
        controls={audioControls}
        autoPlay={audioAutoPlay}
        preload={audioPreload}
        onPlay={onAudioPlay}
        onPause={onAudioPause}
        onEnded={onAudioEnded}
        onError={onAudioError}
        onVolumeChange={onAudioVolumeChange}
      />
    );
  }

  return (
    <>
      {/* Generated and signed media URLs can be provider-specific and not allowlisted. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={imageClassName}
        src={mediaUrl}
        alt={altText}
        style={imageStyle}
        draggable={imageDraggable}
        onDragStart={onImageDragStart}
        onLoad={onImageLoad}
        onError={onImageError}
      />
    </>
  );
}
