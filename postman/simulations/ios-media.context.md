# iOS media recovery verification

This local simulation models media-file delivery, not a publisher API contract.
It uses a synthetic five-second WAV and needs no credentials or cloud workspace.
No owner mock was searched or downloaded: these controlled failure cases are
local fixtures, not an authoritative implementation of the public CDNs.

## Run

Start Metro and the MusicFree Debug app on iPhone 16e. From the repository:

```sh
postman simulation run postman/simulations/ios-media.sim.yaml --port 4510 --no-history --output ndjson
```

In another terminal, with Node 18.20.8 selected:

```sh
node postman/tests/ios-media.cjs
```

The client evaluates real app methods through the Debug inspector, exercising
RNFS and AVPlayer, then restores its own prior queue, progress, history and
playback setting. Run on an idle test simulator. Do not edit app modules during
a run: full reload discards its in-memory test context. An interrupted run may
need manual data restoration.

## Evidence, 2026-11-05

Environment: iPhone 16e / iOS 18.6, MusicFree 0.6.2 Debug, Postman CLI 1.76.0.

- The native range request to /requires-full.wav received 416, its fallback full
  GET received 200, and AVPlayer reached playing using a local file.
- HTTP 403, HTTP 503 and a zero-byte 200 were rejected with explicit errors.
  The misleading .mp3 URL and audio/mpeg MIME were identified as WAV from bytes.
- A separate downloader check rejected a forbidden item and completed the next
  valid item with .wav extension and download concurrency set to 1.
- Simulation request events confirmed those paths were actually exercised.
- The reusable client completed all five checks and reported restored: true.
  That restoration covers its own run, not separate manual/live-source tests.

Separate live-source checks confirmed qs full-file cache playback and seeking
to 60 seconds. kw FLAC end-overrun checks confirmed next track, single repeat
and finish-current sleep timer behavior. These observations do not establish
that every track, device or CDN works. The real qs server ignored a two-byte
Range request and returned the full file with 200. This fixture deliberately
rejects ranges with 416 to exercise recovery; it does not assert that qs returns
416.

An additional native cancellation check on 2026-11-05 used /slow.wav: cancellation
returned "Download has been aborted" after about 239 ms, and a following download
of /whole.wav completed successfully. This was separate from the reusable smoke
client's five checks. No real CDN cancellation guarantee is inferred from it.

Mocks run locally only; unmodeled routes return 501. Restart after handler
edits. No mock was deployed or pushed. The installed CLI does not recognize
postman status; local simulation creation/execution were independently verified.
