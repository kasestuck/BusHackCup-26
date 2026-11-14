import { isPlaceholderVideo, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/client/plan";
import { IconPlay } from "@/components/ui/icons";

/**
 * Technique video (SPEC §8): youtube-nocookie embed, lazy, no autoplay,
 * with a plain "Watch on YouTube" link underneath in case the embed fails.
 */
export function ExerciseVideo({ youtubeId, title }: { youtubeId: string; title: string }) {
  if (isPlaceholderVideo(youtubeId)) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-md border border-dashed border-warning/30 bg-bg/60 px-6 text-center">
        <div className="space-y-2">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-white/5 text-muted">
            <IconPlay size={16} />
          </span>
          <p className="text-sm font-medium text-ink">Mock video</p>
          <p className="max-w-xs text-xs text-muted">
            Real technique videos come from the backend&apos;s verified exercise catalog.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
        <iframe
          src={youtubeEmbedUrl(youtubeId)}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>
      <a
        href={youtubeWatchUrl(youtubeId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 py-1 text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Watch on YouTube
        <span aria-hidden="true">↗</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}
