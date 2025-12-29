# Known Issues

## TikTok profile links fail in ChatGPT Atlas
- **Impact:** Opening a saved creator’s TikTok profile from the app in the ChatGPT Atlas environment shows the TikTok “Something went wrong” error, while the same links work in Chrome.
- **Expected URL format:** `https://www.tiktok.com/@<handle>?lang=en` (handle sanitized: trims whitespace/zero-width chars, strips leading `@`, URL-encodes).
- **Attempts made:**
  - Sanitized handles on insert/load and URL build (strip zero-width/nbsp, remove whitespace, drop leading `@`, encodeURIComponent).
  - Switched to normalized platform mapping with explicit TikTok prefix.
  - Tried trailing slash and without trailing slash; current format omits trailing slash and appends `?lang=en`.
  - Added `referrerPolicy="no-referrer"` on profile links to reduce referrer blocking.
  - Verified generated URLs match the working format and open in Chrome.
- **Status:** Still failing in ChatGPT Atlas; likely environment-level or TikTok user-agent/referrer gating. Needs further investigation (e.g., user-agent spoofing, additional query params, or in-app webview handling).
