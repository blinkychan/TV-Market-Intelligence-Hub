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
      }
    ]
  }
] as const;
