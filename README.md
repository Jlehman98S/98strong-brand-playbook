# 98Strong Personal Brand Playbook: live workshop site

Athletes join from their phones during the Playbook sessions. Answers save as they type to a Google Sheet in Josh's Drive.

- `public/` is the website, hosted on Cloudflare Pages (no build step).
- `apps-script/Code.gs` is the backend. It runs as a Google Apps Script bound to the "Personal Brand Playbook Responses" Sheet.

## Setup

1. **Backend.** Open the Sheet, go to Extensions > Apps Script, and replace the default code with `apps-script/Code.gs`. Select `setup` in the function menu and click Run, then approve the permissions. The log prints your host key, and the Settings tab also shows it.
2. **Deploy the backend.** Go to Deploy > New deployment > Web app. Set Execute as: Me and Who has access: Anyone. Copy the Web app URL.
3. **Connect the site.** Paste that URL into `public/config.js` and commit. Until you do this, the site runs in demo mode and answers stay in the browser.
4. **Cloudflare Pages.** Create a project and connect this repo. Set the framework preset to None, leave the build command empty, and set the build output directory to `public`.

## Links
- Athletes: your Pages URL.
- Host view: your Pages URL + `?host=YOUR_KEY`. From here you can open sessions, follow progress, moderate the group wall, present the wall, and upload each athlete's baseline, visual PDF and roadmap.

## Changing the backend later
In Apps Script, go to Deploy > Manage deployments, edit the deployment, and choose Version: New version. The URL stays the same.

## Where data goes
The Sheet has these tabs: `Athletes`, `Group Wall`, `1 Discover`, `2 Define`, `3 Act` and `Settings`. A hidden `_data` tab holds the raw answers used to restore them. Photos and documents go into the Drive folder "Personal Brand Playbook uploads", with one subfolder per athlete.
