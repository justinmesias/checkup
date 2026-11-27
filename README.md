# CheckUP · Bubble Sheet Grader (offline version)

© 2026 John Justin C. Mesias. All rights reserved. See `LICENSE.txt`. The code may not be copied, modified or redistributed without permission.

Print bubble answer sheets, scan them with a phone camera, and get scores and item analysis. Works without an account and without internet once installed.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The app |
| `engine.js` | Sheet layouts and the bubble scanner |
| `scanworker.js` | Runs the scanner in the background during live scanning |
| `sw.js`, `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | Make it installable and usable offline |
| `LICENSE.txt` | Copyright and terms of use |
| `libs/` | PDF, Excel and Word readers, bundled so nothing loads from the internet |

Upload **all** of these files, keeping the `libs` folder.

## Put it online with GitHub Pages (free, about 10 minutes)

1. Make a free account at **github.com**.
2. Click **+** (top right) → **New repository**. Name it `checkup`, set it to **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**. Drag in everything from this folder, including the `libs` folder, then click **Commit changes**.
   - If your browser won't let you drag a folder, upload the main files first, then click **Add file → Upload files** again and drag the five files from `libs` while you are inside a folder named `libs` (type `libs/` in the file name box to create it).
4. Go to **Settings → Pages**. Under **Branch**, pick `main` and `/ (root)`, then click **Save**.
5. After a minute or two, your app is at **`https://YOUR-USERNAME.github.io/checkup/`**. You can point a short link (e.g. bit.ly) at it.

## Install on a phone

Open the link once **with internet** in Safari (iPhone) or Chrome (Android):
- **iPhone:** Share → **Add to Home Screen**
- **Android:** ⋮ menu → **Install app** or **Add to Home screen**

After that, CheckUP opens from its icon and works offline.

## Updating

When you get new files, upload them to the same repository (same names) and commit. Phones pick up the new version the next time they open CheckUP with internet and show **"A new version of CheckUP is ready — Reload"**.

## Data and privacy

- Everything (classes, keys, scores, sheet photos) is stored **on each phone only**, in that browser. Nothing is sent to any server.
- Clearing the browser's data or uninstalling deletes it. Use **Classes → Download backup** after each scanning session, or copy scores to Google Sheets. Restore a backup with **Classes → Restore from backup**.
- Student names and scores are personal information under the Data Privacy Act. Keep backups somewhere safe.

## Differences from the online (Claude) version

- **Live camera scanning** is only in this version.
- Not available here (they need Claude): reading handwritten names, mixed-section sorting by name, and reading keys or class lists from **photos** or scanned PDFs. Typed Word, PDF, Excel, CSV and text files still import.
- Sheets are identical in both versions, so the same printed papers work with either.

## Licences of bundled libraries

jsPDF (MIT), PDF.js (Apache-2.0), SheetJS Community Edition (Apache-2.0), Mammoth (BSD-2-Clause).
