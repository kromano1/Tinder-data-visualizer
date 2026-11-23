# Swipe Stats

A static website that turns your Tinder data export into charts and stats. Everything runs in the
visitor's browser: the export file is read locally with JavaScript and is never uploaded to a server.

## What it shows

- Totals: matches, swipes, like rate, swipes per match, app opens, messages, conversations started, Super Likes
- Likes and passes per month, like rate per month, average swipes by weekday
- Matches per month and match rate per month
- Messages sent and received per month, the hours you send messages, conversation lengths
- Your most common opening words, and your busiest swiping days
- A period filter (all time, last 12 months, or a single year) and a monthly data table

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

Chart.js 4.4.1 and JSZip 3.10.1 are bundled in `js/vendor/` (MIT licensed; see the license files there),
so the site doesn't depend on any external CDN.

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
2. Upload `index.html`, `.htaccess`, `css/` and `js/` (or a zip of them and use **Extract**). Remove any default `index.php`/`default.php`.
3. Make sure an SSL certificate is active for the domain (hPanel → Security → SSL), since `.htaccess` redirects to HTTPS.
4. File Manager hides dotfiles by default; enable "show hidden files" to confirm `.htaccess` is there.

## Getting your Tinder data

Request it at account.gotinder.com/data. Tinder emails a download link, usually within a few days.

Not affiliated with Tinder or Match Group.
