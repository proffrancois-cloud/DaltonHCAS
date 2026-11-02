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

The Edge Function source is `supabase/edge.js`; its dependencies are `data.js`, `calendar-data.js`, `concerns-data.js`, `support-rules.js`, and `support-server.js`. Deploy it with its own authentication enabled in the function body (`auth.getUser`), rather than the legacy JWT gateway. Privileged Supabase credentials come only from the Edge runtime environment, never the browser or repository. Public connection settings live in `cloud-config.js`.

`supabase/schema.sql` creates the private shared-state, account-mapping and audit tables. RLS is enabled and direct access for `anon`/`authenticated` is revoked deliberately; the authenticated Edge API is the only application access path. A revision comparison prevents concurrent writes from overwriting one another. The SQL deadline job checks active SMART goals every 15 minutes using the Asia/Taipei date; regular API reads also catch overdue goals. Staff notifications are generated after the third matching checklist concern across all authors. Read receipts are per recipient. The dashboard refreshes shared data every 30 seconds while idle.

IEP PDFs live in the private `hcas-iep` Storage bucket. Only verified staff can upload/read PDFs through the API; document metadata is excluded from student responses. PDF responses are fetched with the staff session and displayed via a temporary blob URL in a native modal reader with download. Documents are limited to 10 MB and checked for a PDF extension and signature. Browser PDF viewing support varies by phone; download remains available.

SMART plans distinguish student-created goals from supervisor plans. Approved student fields lock individually on submission, can be reopened by supervisors, and preserve review outcomes and linked follow-ups. Students see only their own goals, notices and check-ins. Academic and SEL concerns, confidential notes, IEPs and links to other students are removed on the server before student responses are sent.

The initial provisioning endpoint is disabled after setup. Bootstrap tokens are retired; initial passwords remain only in ignored private handoff files. The public demo and cloud database are separate: historical browser-only prototype activity is retained in that browser and is not silently imported into the shared school database.

## Deployment note

GitHub Pages remains a fictional demonstration. Vercel is the private school app and retains its existing preview password in addition to individual school logins. The school deployment uses server-side account checks, private storage, shared persistence, and audit events. The school remains responsible for its retention and backup policies and for ensuring staff monitor dashboard support requests; these notifications are in-app and do not send email, SMS or phone push alerts.
