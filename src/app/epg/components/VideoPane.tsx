import { useEffect, useMemo, useState } from "react";
import { useEPG } from "../context/EPGContext";

const guessMime = (url: string | null) => {
  if (!url) return undefined;
  if (/\.(mp4|m4v)(\?|$)/i.test(url)) return "video/mp4";
  if (/\.(mov)(\?|$)/i.test(url)) return "video/quicktime";
  if (/\.(mkv)(\?|$)/i.test(url)) return "video/x-matroska"; // may not play in all browsers
  return undefined;
};

const VideoPane = () => {
  const { channels, currentChannelIndex, getProgramMeta, fetchProgramLink } = useEPG();

  // current program
  const program = useMemo(
    () => channels[currentChannelIndex]?.programs?.[0],
    [channels, currentChannelIndex]
  );

  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!program) return;

      // try cached link
      const cached = getProgramMeta(program)?.link ?? null;
      if (cached) {
        setSrc(cached);
        return;
      }

      // fetch link (prowlarr -> stremthru -> RD)
      const link = await fetchProgramLink(program).catch(() => null);
      if (!cancelled) setSrc(link ?? null);
    })();

    return () => { cancelled = true; };
  }, [program, getProgramMeta, fetchProgramLink]);

  const type = guessMime(src);

  return (
    <div className="bg-slate-700 flex-1 rounded p-2">
      {src ? (
        <video
          key={src}                 // force re-mount on source change
          className="aspect-video w-full rounded"
          src={src}
          controls
          autoPlay
          muted                     // required for autoplay on most browsers
          playsInline               // iOS/Safari inline playback
          preload="metadata"
          onError={(e) => console.warn("Video failed to load", e)}
        >
          {type && <source src={src} type={type} />}
        </video>
      ) : (
        <div className="h-full grid place-items-center text-white/80 text-sm">
          Finding a cached stream…
        </div>
      )}
    </div>
  );
};

export default VideoPane;
