export const mockFeedEntries = [
  {
    publication: "Deadline",
    feedUrl: "https://deadline.com/feed/",
    items: [
      {
        title: "Netflix lands workplace comedy package from breakout creator",
        url: "https://mock-feed.example.com/netflix-workplace-comedy",
        publishedAt: "2026-04-28T15:00:00.000Z",
        summary: "A multi-camera comedy package lands at Netflix with strong auspices."
      },
      {
        title: "Broadcast procedural drama pilot ordered at ABC",
        url: "https://mock-feed.example.com/abc-procedural-pilot",
        publishedAt: "2026-04-28T16:00:00.000Z",
        summary: "ABC moves a procedural package to pilot with studio backing."
      },
      {
        title: "Studio chief gives keynote at leadership summit",
        url: "https://mock-feed.example.com/studio-leadership-summit",
        publishedAt: "2026-04-28T16:30:00.000Z",
        summary: "Executive remarks about the future of entertainment."
      }
    ]
  },
  {
    publication: "Variety",
    feedUrl: "https://variety.com/feed/",
    items: [
      {
        title: "Streamer series renewal sparks buyer interest in adjacent genre plays",
        url: "https://mock-feed.example.com/streamer-series-renewal",
        publishedAt: "2026-04-28T17:00:00.000Z",
        summary: "A renewal headline with broader buyer-signal implications."
      },
      {
        title: "Studio chief gives keynote at spring TV conference",
        url: "https://mock-feed.example.com/studio-keynote",
        publishedAt: "2026-04-28T18:00:00.000Z",
        summary: "General conference news that should be filtered out."
      },
      {
        title: "Apple TV+ acquires remake rights to Spanish thriller Red Valley",
        url: "https://mock-feed.example.com/red-valley-rights",
        publishedAt: "2026-04-28T19:00:00.000Z",
        summary: "A remake-rights deal that should be retained for review."
      },
      {
        title: "Awards red carpet recap: every look from last night",
        url: "https://mock-feed.example.com/awards-red-carpet",
        publishedAt: "2026-04-28T19:30:00.000Z",
        summary: "Purely unrelated style coverage."
      }
    ]
  },
  {
    publication: "TVLine",
    feedUrl: "https://tvline.com/feed/",
    items: [
      {
        title: "Fox sets fall premiere dates for returning dramas and new comedy",
        url: "https://mock-feed.example.com/fox-fall-premieres",
        publishedAt: "2026-04-28T20:00:00.000Z",
        summary: "Premiere-date roundup with multiple current TV scheduling signals."
      },
      {
        title: "Episode recap: shocking betrayal on Harbor Lights",
        url: "https://mock-feed.example.com/harbor-lights-recap",
        publishedAt: "2026-04-28T20:30:00.000Z",
        summary: "Recap coverage that should be excluded from the queue."
      }
    ]
  }
] as const;
