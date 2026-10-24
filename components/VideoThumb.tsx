"use client";

import { useState } from "react";
import { IconFilm } from "./icons";

/** 用视频首帧做缩略图，避免额外转码/存储 */
export function VideoThumb({ videoId, className = "" }: { videoId: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative size-full overflow-hidden bg-black ${className}`}>
      {!failed ? (
        <video
          src={`/api/videos/${videoId}/stream#t=0.8`}
          preload="metadata"
          muted
          playsInline
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <IconFilm size={20} />
        </div>
      )}
    </div>
  );
}
