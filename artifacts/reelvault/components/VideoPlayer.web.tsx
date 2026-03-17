import React, { useRef, useEffect } from "react";

type Props = {
  uri: string;
  onClose: () => void;
};

export function VideoPlayer({ uri, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.focus();
    }
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        backgroundColor: "#000",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        src={uri}
        controls
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: 220,
          display: "block",
          outline: "none",
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.7)",
          border: "none",
          borderRadius: "50%",
          width: 28,
          height: 28,
          cursor: "pointer",
          color: "#fff",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ✕
      </button>
    </div>
  );
}
