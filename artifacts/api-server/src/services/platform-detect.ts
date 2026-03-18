// Platform detection service
// Covers 100+ known platforms; unknown URLs fall back to "Web"
// yt-dlp may still support "Web" URLs — the label is just for display

const platformPatterns: Array<[RegExp, string]> = [
  // Top-tier video platforms
  [/youtube\.com|youtu\.be/, "YouTube"],
  [/instagram\.com/, "Instagram"],
  [/facebook\.com|fb\.watch|fb\.com/, "Facebook"],
  [/twitter\.com|x\.com/, "X (Twitter)"],
  [/tiktok\.com/, "TikTok"],
  [/vimeo\.com/, "Vimeo"],
  [/dailymotion\.com/, "Dailymotion"],
  [/twitch\.tv/, "Twitch"],
  [/reddit\.com|v\.redd\.it/, "Reddit"],
  [/pinterest\.com/, "Pinterest"],
  [/linkedin\.com/, "LinkedIn"],
  [/snapchat\.com/, "Snapchat"],
  [/bilibili\.com/, "Bilibili"],
  [/soundcloud\.com/, "SoundCloud"],
  [/rumble\.com/, "Rumble"],
  [/odysee\.com/, "Odysee"],
  [/kick\.com/, "Kick"],
  // Streaming / live
  [/streamable\.com/, "Streamable"],
  [/trovo\.live/, "Trovo"],
  [/floatplane\.com/, "Floatplane"],
  [/caffeine\.tv/, "Caffeine"],
  [/dlive\.tv/, "DLive"],
  [/nimo\.tv/, "Nimo TV"],
  // Short-form / GIF
  [/imgur\.com/, "Imgur"],
  [/gfycat\.com/, "Gfycat"],
  [/giphy\.com/, "Giphy"],
  [/9gag\.com/, "9GAG"],
  // Music / Podcasts
  [/mixcloud\.com/, "Mixcloud"],
  [/bandcamp\.com/, "Bandcamp"],
  [/spotify\.com/, "Spotify"],
  [/deezer\.com/, "Deezer"],
  [/audiomack\.com/, "Audiomack"],
  // News / Media
  [/bbc\.co\.uk|bbc\.com/, "BBC"],
  [/cnn\.com/, "CNN"],
  [/nbc\.com/, "NBC"],
  [/foxnews\.com/, "Fox News"],
  [/espn\.com/, "ESPN"],
  [/abcnews\.go\.com/, "ABC News"],
  [/cbsnews\.com/, "CBS News"],
  // Educational
  [/ted\.com/, "TED"],
  [/coursera\.org/, "Coursera"],
  [/udemy\.com/, "Udemy"],
  [/khanacademy\.org/, "Khan Academy"],
  // Hosting & tools
  [/loom\.com/, "Loom"],
  [/wistia\.com/, "Wistia"],
  [/brightcove\.com/, "Brightcove"],
  [/jwplayer\.com/, "JW Player"],
  // Asian platforms
  [/douyin\.com/, "Douyin"],
  [/kuaishou\.com/, "Kuaishou"],
  [/ixigua\.com/, "Xigua Video"],
  [/weibo\.com/, "Weibo"],
  [/naver\.com|naver\.tv/, "Naver"],
  [/kakao\.com/, "Kakao"],
  [/niconico\.jp|nicovideo\.jp/, "NicoNico"],
  [/meipai\.com/, "Meipai"],
  [/miaopai\.com/, "Miaopai"],
  [/likee\.video/, "Likee"],
  // Russian
  [/vk\.com/, "VKontakte"],
  [/ok\.ru/, "OK.ru"],
  [/coub\.com/, "Coub"],
  // Decentralised / Open
  [/peertube/, "PeerTube"],
  // Misc
  [/ifunny\.co/, "iFunny"],
  [/streamff\.com/, "StreamFF"],
  [/streamja\.com/, "Streamja"],
  [/medal\.tv/, "Medal.tv"],
  [/clips\.twitch\.tv/, "Twitch Clips"],
  [/vm\.tiktok\.com/, "TikTok"],
];

export function detectPlatform(url: string): string {
  for (const [pattern, name] of platformPatterns) {
    if (pattern.test(url)) return name;
  }
  return "Web";
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
