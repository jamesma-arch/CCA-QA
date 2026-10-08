# Harrow Bangkok — CCA Quality Assurance

A staff observation app for outside CCA providers, prepared for a private GitHub repository and Netlify hosting.

## English / Thai interface

Use **English / ไทย** in the top-right corner on the sign-in page or any app page. Your choice is remembered on the same device. Switching languages changes labels and guidance in place; it does not clear names, typed feedback, dates, selected checklist answers or scores. Provider/activity names and saved comments remain as entered. Thai characters are supported in all feedback fields.

Each of the ten checklist statements has a round **i** button. Select it to show what to look for and a practical example, in the selected language. These buttons work by click/tap or keyboard, and the guidance stays available until closed. **How to choose** explains the three checklist responses.

## What is included

- Separate staff and administrator access codes.
- Lower School and Upper School activity filters, provider search and weekday filters.
- Relevant activity information beside every observation form: activity, year groups, school, day, room, season, school lead, provider and contact, review-stage date, sessions observed, existing strengths, improvement priorities and follow-up context.
- All ten checks from the supplied drop-in summary, with Observed / Needs attention / Not observed choices.
- Observation name and date, 1–5 QA score, strengths, session review, follow-up level, actions, owner and due date.
- Administrator dashboard, action status tracking, CSV export and printable summaries.
- Add, edit or archive activities without changing the code.
- Shared records held on Netlify, rather than in each staff member's browser.
- Demo mode: temporary in-memory data only. Demo observations never enter the live database.

The one starting activity is transcribed from the supplied photo. Its review-stage date is interpreted as 3 April 2026. Check its room and staff/contact spellings before launch. The previous score and Priority label are historical context from the source; new observations have their own score and follow-up level.

## Quick start — preview first

Open `CCA_QA_Demo.html` in Chrome or Edge and choose **Explore the demo**. This is a self-contained preview: no installation or login needed. It is not the shared staff app.

To run the source preview instead, install Node.js 22 or later, open a terminal in this project and run:

```sh
npm ci
npm run preview
```

Visit `http://localhost:4173` and choose **Explore the demo**.

## Put it on GitHub and Netlify

1. Extract this ZIP. In GitHub Desktop, create a new repository named `Harrow-CCA-QA`, then copy the contents of the `cca-quality-assurance` folder into that repository folder. The repository root must contain `package.json`, `netlify.toml`, `public`, `netlify` and `scripts`.
2. Commit the files, select **Publish repository** and keep the repository **private**.
3. In Netlify, choose **Add new project → Import an existing project**, connect GitHub and select the repository. Wording may vary slightly.
4. Leave the base directory blank. Build command: `npm run build`. Publish directory: `dist`. The supplied configuration also sets the functions directory automatically.
5. Add the following environment variables in the Netlify project's environment settings, making them available to **Functions**. Use distinct, unpredictable values. Set these for the Production context.

| Variable | Set this to |
| --- | --- |
| `STAFF_ACCESS_CODE` | A staff-only code/passphrase, ideally at least 12 random characters |
| `ADMIN_ACCESS_CODE` | A different administrator-only code/passphrase |
| `SESSION_SECRET` | A random secret with at least 32 characters |
| `MS_TENANT_ID` | Microsoft Entra tenant ID for automatic reminders |
| `MS_CLIENT_ID` | Microsoft Entra application/client ID |
| `MS_CLIENT_SECRET` | Microsoft Entra client secret |
| `MAIL_SENDER` | School mailbox used to send QA reminders |
| `AUTO_REMINDER_ENABLED` | Set to `true` only after reminder setup has been tested |
| `QA_SITE_URL` | Optional explicit live QA site URL used in reminder emails |

To generate a session secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

6. Deploy the project. After adding or changing environment variables, trigger a new deploy so the functions receive them.
7. Open the Netlify address, enter the administrator code, go to **Manage activities**, verify the starting activity and add your other outside-provider activities. Archive the example if it is no longer offered.
8. Open the same address in a separate browser or on a phone. Sign in using the staff code, submit a test observation, then refresh **Observations & actions** in the administrator view to confirm it arrived.
9. Share the website address and staff code through your usual internal staff channel. Keep the administrator code separate.

**Use a Git-connected Netlify deployment.** Dragging only the HTML files into Netlify Drop will not install the shared-record functions.

## Automatic reminder emails

The administrator can manually open a prepared reminder email and mark it Sent. When Microsoft 365 automation is configured, a scheduled Netlify Function checks every day at 08:00 Bangkok time. It sends one reminder when an active activity reaches its Review stage date, no qualifying observation has been submitted since that date, a verified school-lead email is available, and the reminder is not already marked Sent.

Automatic sending uses Microsoft Graph application permission `Mail.Send`. IT should restrict the application's mailbox access to the intended sender mailbox where possible. Set `AUTO_REMINDER_ENABLED=true` only after the staff directory, review-stage dates and sender mailbox have been checked.

## Day-to-day use

Staff: sign in, find the activity, choose **Record observation**, complete the checklist and review, and submit. A submission is complete only when the saved confirmation appears. Observations are final submissions; staff do not edit or browse other staff feedback.

Administrators: refresh the dashboard to retrieve the latest observations. Filter for open follow-up or urgent feedback, update action statuses and export CSV when needed. Staff see the activity's existing context; update this in **Manage activities** after reviewing feedback if you want staff to see revised priorities. Activity edits do not change historical observation snapshots.

Use **Archived** to stop new submissions for an activity while preserving earlier observations. Print summaries can be saved as PDF through your browser's print window. CSV exports contain all observations, even when a dashboard filter is selected.

## Access and storage

Access uses shared codes with self-entered reviewer names, not individual school accounts. A name is not an independently verified identity. Staff may submit observations; administrators manage activities and view all feedback. Codes stay on the server, and sessions use signed, Secure, HttpOnly cookies with an eight-hour expiry. Changing an access code invalidates sessions for that role after the new environment value is active.

The app uses a site-wide Netlify Blobs store with strong consistency. Production deploys share `cca-qa-production`; non-production contexts use a separate store. Records survive new code deployments on the same Netlify project. They do not automatically move to a new Netlify project. Storage is configured in Singapore. Export CSV regularly for a readable backup; it is not a restore/import format.

Do not enter pupil names or sensitive pupil information. Urgent safeguarding reporting follows school procedures; this app does not send emergency notifications. The app can send routine QA reminder emails through Microsoft Graph when the optional Microsoft 365 mail configuration is enabled. It does not use email for safeguarding alerts and it does not contain a SOCS integration.

Review the hosting/access arrangement with the school before collecting actual staff/provider feedback. Shared-code access can be replaced with school SSO in a later version.

## Technical checks

```sh
npm test
npm run build
npm run demo
```

Nine automated server-side tests cover authentication, permissions, validation, concurrent submissions, shared administrator reads, archived activities, action status, code rotation and fail-closed configuration. The Netlify function imports successfully with the installed SDK. A live Netlify storage round-trip needs to be checked after deployment; it cannot be verified using the standalone demo. Browser visual QA was blocked in the build environment. DOM-based interaction checks passed for English/Thai switching, all ten guidance panels, form-value retention, Thai submissions and action-status updates.

The source has responsive mobile/desktop CSS, keyboard-accessible native form controls, escaped rendered text, required fields, length limits, same-origin write checks and CSV formula escaping. Netlify's function rate-limit configuration allows 60 requests per minute per IP; availability depends on the project's platform support. A whole school may share one outbound IP, so review that setting if staff see rate-limit errors.

## Troubleshooting

- **Staff access has not been configured:** check all three function environment variables, use different staff/admin codes and a secret at least 32 characters long, then redeploy.
- **Shared service unavailable:** ensure the Git-connected deploy installed dependencies and deployed `netlify/functions/api.mjs`; do not use a static-only upload.
- **Feedback does not appear:** check the staff saved confirmation, then refresh the administrator dashboard. Demo observations are never shared.
- **Access code changed but old code works:** redeploy after editing function environment variables.

Documentation: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) · [Functions API](https://docs.netlify.com/build/functions/api/)

## Staff and Admin areas
The welcome page has separate Staff and Admin sign-in forms. Use the staff code for observations and the administrator code for analytics, feedback/action management and activity imports. The server rejects a code used in the wrong area.

Admin → QA analytics shows date, provider, school and season filters; average scores, score distribution, checklist concerns, outstanding/overdue actions, provider comparisons and active activities awaiting observation. Not observed/N/A is excluded from assessed checklist counts.

Admin → Upload activities accepts Excel `.xlsx` (first worksheet) and CSV files, up to 5 MB and 1,000 rows. Download the CSV template or match your own headings. Required fields are activity name, provider, year groups, day, school and season; school and season can use selected defaults. Preview and correct invalid rows before importing. Matches on activity name, provider, year groups, day, school and season are updated; unmatched rows are added. Blank optional cells clear those details on matches. Existing activities outside the upload and all historic QA snapshots are retained. Imports are saved in batches; interrupted uploads can be retried without creating matching duplicates.

In Netlify, configure STAFF_ACCESS_CODE and ADMIN_ACCESS_CODE (different values), plus SESSION_SECRET (at least 32 characters), for Production/Functions, then redeploy. Never commit access codes to GitHub.

### Harrow season schedule
Upload the original Activities Season workbook directly. The importer searches worksheets for the ACTIVITIES / Year(s) schedule header, reads day section headings and season labels, and ignores the cover tracker, room allocation, cover staff and contact notes sheets. Outside providers only is selected by default, using (External) in the Staff Leader column. Turn this off to include school-led activity rows. Duty rows are never imported. Staff Support becomes the school contact for externally led activities. Session times, muster and pick-up points, backup rooms, capacity and current pupil counts are retained; these pupil counts are a snapshot of the upload, not live attendance. Review the preview before saving. No workbook data is included in this repository.
