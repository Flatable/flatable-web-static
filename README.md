# flatable-web-static

Public static assets for the Flatable marketing site (flatable.ch, flatable-test.webflow.io).

Served via [jsDelivr](https://www.jsdelivr.com) CDN — no build step, just commit and the new version is live within ~5 min (or instantly when pinned to a commit SHA).

## Files

- **`FlatableBrowse.js`** — consolidated browse-flats interactivity (MapLibre map, markers, filters, sort, search geocoding, scroll polish). Loaded into the Webflow `/browse-flats` page via a registered hosted script.

## URLs

| Pin | URL pattern |
|---|---|
| Latest commit on default branch | `https://cdn.jsdelivr.net/gh/Flatable/flatable-web-static@main/FlatableBrowse.js` |
| Specific commit (immutable, recommended for production) | `https://cdn.jsdelivr.net/gh/Flatable/flatable-web-static@<commit-sha>/FlatableBrowse.js` |

## Updating

```bash
# Make your edits, then:
git add FlatableBrowse.js
git commit -m "FlatableBrowse: <what changed>"
git push origin main

# Get the new commit SHA + compute SRI hash:
git rev-parse HEAD
curl -sL "https://cdn.jsdelivr.net/gh/Flatable/flatable-web-static@$(git rev-parse HEAD)/FlatableBrowse.js" | openssl dgst -sha384 -binary | openssl base64 -A
```

Then in Webflow: register a new version of the hosted script with the new URL + new SRI hash, bind to the browse-flats page, publish the site.

## License

Internal Flatable code. Public visibility is required for jsDelivr access; do not put secrets here.
