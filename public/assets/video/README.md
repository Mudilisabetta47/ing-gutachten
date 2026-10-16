# Showcase media

Real clips go here after review, e.g. begutachtung.mp4, schadenaufnahme.mp4,
auswertung.mp4, beratung.mp4. These files are NOT included yet.

In src/lib/showcase.ts add each existing file to its scene's sources:
[{ src: '/assets/video/begutachtung.mp4', type: 'video/mp4' }]
Optional WebM may be listed first, followed by MP4 as the fallback.

Deliver 16:9, H.264 MP4 with fast-start, 1080p (720p variant if needed),
24/25 fps, 6–8 seconds, no audio track. Aim for 2–4 MB per clip.
Keep the poster until an approved scene-specific WebP is available. The image
and video share a fixed aspect ratio. Do not include client data or logos.
Keep the visible AI/illustration disclosure. Full prompts: docs/VEO-PROMPTS.md.
