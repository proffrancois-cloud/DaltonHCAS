# DaltonHCAS House Coin

A self-contained app for authenticated HCAS teachers to record 7C recognitions, behavior concerns based on the HCAS Student Behavior Code, and teacher-only academic concerns based on the school's MTSS references. It also includes a Dalton calendar for LAB, Level-Up, House, assembly, and special school events; student leader access for House and LAB activities; multi-student records; publication dates; student profiles; and a filterable school coin ranking.

The public GitHub Pages demo uses 11 fictional students and browser storage. The private school app at `https://daltonhcas.vercel.app` uses the school-owned Supabase project `zfedznaybchtukxjbdqt`: Supabase Auth verifies logins, an Edge API derives roles from canonical school data, and private database tables persist shared activity. Cloud mode never stores student records in localStorage. Session tokens are held in sessionStorage and refresh while the session is active.

The `private/` directory is ignored by Git and excluded from deployments. It contains the local roster and one-time school credential handoff files. Never publish these files. School accounts receive unique random temporary passwords and must replace them at first login. Super admins can provision accounts and reset temporary passwords in Administration. The simple username-equals-password behavior below applies only to the fictional demo.

## Teacher accounts

- Username `david`, password `david`
- Username `francois`, password `francois`

The login is intended only for this local demonstration. The credentials are checked in the browser and are not suitable for a public or production deployment.

## Student accounts and calendar access

When the private roster is present, a student's username is their first and last name without spaces or accents, and the prototype password is the same value. Students see only their own Grade 6–12 schedule and House. A normal student cannot edit events. A teacher can assign a House leader or LAB leader; those students can then update only the event descriptions, locations, links, and documents that belong to their assigned activity.

Teachers can see all Grade 6–12 calendar entries, filter by grade, assign student leaders, define LAB leader access, and publish additional school events. The official schedule comes from the 2026–27 Dalton Lab Calendar supplied for this project.

## Published app

[Open DaltonHCAS](https://proffrancois-cloud.github.io/DaltonHCAS/)

The GitHub Pages URL is the public demonstration and never receives the private roster. The private school preview is deployed separately on Vercel with server-side HTTP Basic authentication. Its username, password, and compressed roster are Vercel environment secrets and are not committed to this repository.

### Install on a phone

- iPhone/iPad: open the link in Safari, tap **Share**, then **Add to Home Screen**.
- Android: open the link in Chrome, open the browser menu, then tap **Install app** or **Add to Home screen**.

## Run locally

```bash
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Verify the data logic

```bash
npm run verify
```

No package installation is required. The app uses only browser APIs and Node's built-in local server.

## Private school backend

The Edge Function source is `supabase/edge.js`; include `supabase/push-server.js` as `push-server.js`, plus `data.js`, `calendar-data.js`, `concerns-data.js`, `support-rules.js`, `support-server.js`, `followup-rules.js`, `tier-rules.js`, and `push-rules.js`. Deploy it with its own authentication in the function body (`auth.getUser`), rather than the legacy JWT gateway. Privileged Supabase credentials come only from the Edge runtime environment, never the browser or repository. Public connection settings live in `cloud-config.js`.

`supabase/schema.sql` creates the private shared-state, account-mapping and audit tables. Apply `supabase/followups-push.sql` afterward for scheduled follow-ups and push. RLS is enabled and direct access for `anon`/`authenticated` is revoked deliberately; the authenticated Edge API is the only application access path. Revision comparisons prevent concurrent writes from overwriting one another. A secret-authenticated scheduled worker runs every minute using Asia/Taipei dates and the same rules as interactive requests. It replaces the earlier 15-minute deadline job. The dashboard refreshes shared data every 30 seconds while idle.

Concern notifications store individual staff responses separately from read receipts. Multiple responsibility acceptances are retained, and response request IDs make retries idempotent. Each response notifies original recipients and the author. The existing third-matching-concern alerts remain; no automatic tier escalation is introduced.

IEP PDFs live in the private `hcas-iep` Storage bucket. Only verified staff can upload/read PDFs through the API; document metadata is excluded from student responses. PDF responses are fetched with the staff session and displayed via a temporary blob URL in a native modal reader with download. Documents are limited to 10 MB and checked for a PDF extension and signature. Browser PDF viewing support varies by phone; download remains available.

SMART plans distinguish student-created goals from supervisor plans. Approved student fields lock individually on submission, can be reopened by supervisors, and preserve review outcomes and linked follow-ups. Students see only their own goals, notices and check-ins. Academic and SEL concerns, confidential notes, IEPs and links to other students are removed on the server before student responses are sent.

Plans link to actual concern IDs with a type selector, include a responsible staff member, multiple versioned check-in dates and a final review date. Edited or cancelled schedule notifications stop contributing to unread counts and pending pushes. Final reflections open when a goal ends or is due. Only the owning student can write/revise them, including after submission; supervising staff can send reminders without changing the text.

Push uses `web-push@3.6.7` on the Edge runtime. VAPID private keys, worker secrets, device subscriptions and the delivery outbox are server-only. Queue claims use row locks, per-account delivery uniqueness and retries; expired subscriptions are disabled. Notification payloads carry an opaque notice ID and generic text only. The service worker caches no school data. Generic worker/manifest/icon resources are exempt from preview Basic Auth so installation and background push can work; application pages and data remain protected. Logout unsubscribes this device before clearing the school session. A tap opens a record only after the account authenticates.

iPhone/iPad users need iOS/iPadOS 16.4+ and a Home Screen installation from Safari. Android users can install from a supported browser. Enable notifications from the dashboard after logging in. Permission denial or transport failure does not remove in-app notifications. Browser automation cannot establish real-phone delivery.

The initial provisioning endpoint is disabled after setup. Bootstrap tokens are retired; initial passwords remain only in ignored private handoff files. The public demo and cloud database are separate: historical browser-only prototype activity is retained in that browser and is not silently imported into the shared school database.

## Deployment note

Level-Up documents are stored in the private `hcas-levelup` bucket and catalogued in shared state. Include `levelup-resources.js` when deploying the Edge API. The `levelup-document-read` action derives the account's current type and grade from server data: students can read only their own grade's student workbook, while staff can read both editions. Grades 11 and 12 share the supplied documents. Teacher-guide metadata and storage paths are removed from student state. PDFs are fetched with the school session and opened through the shared `pdf-reader.js` viewer with a download option; they are excluded from the public build and offline caching.

School leadership assignments are held in the private shared state. `leadership-import.js` applies a reviewed import without replacing accounts or recognition/concern history. House Captains and LAB leaders keep scoped event editing. Teacher House leadership does not grant access to edit unrelated student records. Level-Up staff create/edit only their assigned grades’ Level-Up events.

House meeting locations are defaults; event-specific locations override them. Imported S1 LAB assignments are date-bounded. Teachers see the available LAB activities, while students see specific LABs only when assigned as a leader/member; otherwise they retain their existing generic LAB slot. Grade 11/12 leaders can see their named LAB even when the participant grade range is lower. Their grade timetable remains visible. House Captains have their Wednesday meeting on scheduled LAB Wednesdays. Level-Up calendar cards are separated by grade so one grade’s teacher cannot overwrite another grade’s instructions; earlier shared instructions remain available as the initial fallback.

GitHub Pages remains a fictional demonstration. Vercel is the private school app and retains its existing preview password in addition to individual school logins. The school deployment uses server-side account checks, private storage, shared persistence, and audit events. Enabled devices receive generic Web Push attempts; no email or SMS is sent. The existing instruction to approach an adult directly for immediate help remains in place.
