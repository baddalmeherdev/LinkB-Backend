// Handler Registry
// Handlers are checked in order — first match wins.
// GenericHandler is the final fallback and always matches.

import type { PlatformHandler } from "./base.js";
import { YouTubeHandler } from "./youtube.js";
import { InstagramHandler } from "./instagram.js";
import { TikTokHandler } from "./tiktok.js";
import { TwitterHandler } from "./twitter.js";
import { FacebookHandler } from "./facebook.js";
import { GenericHandler } from "./generic.js";

const handlers: PlatformHandler[] = [
  new YouTubeHandler(),
  new InstagramHandler(),
  new TikTokHandler(),
  new TwitterHandler(),
  new FacebookHandler(),
  new GenericHandler(), // must be last
];

/**
 * Returns the best handler for the given URL.
 * Always returns a handler (falls back to GenericHandler).
 */
export function getHandler(url: string): PlatformHandler {
  for (const h of handlers) {
    if (h.matches(url)) {
      return h;
    }
  }
  return new GenericHandler();
}
