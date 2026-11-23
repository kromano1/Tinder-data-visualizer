# Swipe Stats

A static website that turns your Tinder data export into charts and stats. Everything runs in the
visitor's browser: the export file is read locally with JavaScript and is never uploaded to a server.

## What it shows

- Totals: matches, swipes, like rate, swipes per match, app opens, messages, conversations started, Super Likes
- Likes and passes per month, like rate per month, average swipes by weekday
- Matches per month and match rate per month
- Messages sent and received per month, the hours you send messages, conversation lengths
- Your most common opening words, and your busiest swiping days
- Percentage labels on every bar and point (rates, or each point's share of the total), also in tooltips and exports
- Super Likes per month, plus a chart for any other activity series Tinder includes in `Usage`
- An "About this export" summary: date range covered, all-time matches vs matches still in the file
  (Tinder drops unmatched/deleted matches from the Messages section), conversations, messages, photos, purchases
- Headline stats as big percentages with the real numbers underneath, plus jump links to every section
- "Your story": plain-English highlight cards, a full-screen story mode (tap, swipe or arrow keys),
  and a 1080x1350 share image for each card
- A light / dark / automatic theme switch
- A searchable browser of every conversation and message in the export
- Every other section of the file (profile, Spotify, purchases, photos, campaigns, …) shown as-is
- A period filter (all time, last 12 months, or a single year) and a monthly data table
- **Export** as a multi-page PDF report or a single JPEG image, choosing exactly which sections to include
  (profile details are off by default). Exports are drawn on a canvas in the browser and saved directly to downloads.

It accepts either the `.zip` Tinder emails you or the `data.json` file inside it.
A **Try it with sample data** button shows a demo with generated data.

## Hosting

There's no build step and no server code. Upload the whole folder (`index.html`, `css/`, `js/`) to any
static host:

- **GitHub Pages:** Settings → Pages → Deploy from a branch → choose the branch and `/ (root)`.
- **Netlify / Cloudflare Pages / Vercel:** drag and drop the folder, or connect the repo with no build command
  and the repo root as the output directory.
- **Any web host:** upload the files over FTP/SFTP into your public web folder.

To try it locally, run `python3 -m http.server` in this folder and open http://localhost:8000.

Chart.js 4.4.1, JSZip 3.10.1 and jsPDF 2.5.1 are bundled in `js/vendor/`, and the Inter font in `fonts/`
(see the license files there), so the site doesn't depend on any external CDN.

## Privacy and security

- The export is parsed in the browser. There is no backend, database, cookie, analytics or third-party script.
- A Content-Security-Policy with `connect-src 'none'` (in both `.htaccess` and a `<meta>` tag) stops the page
  from making any network request, so uploaded data cannot be sent anywhere even if a bug or a compromised
  script tried to.
- All scripts are served from the site itself (`script-src 'self'`), with no inline scripts or styles.
- `.htaccess` also forces HTTPS, sends HSTS, `nosniff`, `no-referrer` and anti-framing headers, disables
  directory listings, and blocks hidden or non-site files.
- Uploads are capped at 500 MB, and the zip entry's size is checked before it is unpacked.

## Deploying to Hostinger

1. In hPanel open **File Manager** for the site (for a subdomain such as `tinder.example.com`, use that subdomain's folder).
2. Upload `index.html`, `404.html`, `robots.txt`, `.htaccess`, `css/`, `js/` and `fonts/` (or a zip of them and use **Extract**). Remove any default `index.php`/`default.php`.
3. Make sure an SSL certificate is active for the domain (hPanel → Security → SSL), since `.htaccess` redirects to HTTPS.
4. File Manager hides dotfiles by default; enable "show hidden files" to confirm `.htaccess` is there.

## Getting your Tinder data

Request it at account.gotinder.com/data. Tinder emails a download link, usually within a few days.

Not affiliated with Tinder or Match Group.
