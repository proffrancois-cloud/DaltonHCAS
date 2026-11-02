# DaltonHCAS House Coin

A self-contained app for authenticated HCAS teachers to record 7C recognitions, behavior concerns based on the HCAS Student Behavior Code, and teacher-only academic concerns based on the school's MTSS references. It also includes a Dalton calendar for LAB, Level-Up, House, assembly, and special school events; student leader access for House and LAB activities; multi-student records; publication dates; student profiles; and a filterable school coin ranking.

The public demo uses 11 fictional students. A local-only roster can be loaded from `private/roster.json`; that directory is ignored by Git so real student names and account identifiers are not published to GitHub Pages. Data is stored only in the browser's local storage, so coins, concerns, calendar edits, and leadership assignments remain after a refresh on the same browser. DaltonHCAS is also a Progressive Web App: once published over HTTPS, it can be installed from Safari or Chrome and opened from a phone's home screen.

## Teacher accounts

- Username `david`, password `david`
- Username `francois`, password `francois`

The login is intended only for this local demonstration. The credentials are checked in the browser and are not suitable for a public or production deployment.

## Student accounts and calendar access

When the private roster is present, a student's username is their first and last name without spaces or accents, and the prototype password is the same value. Students see only their own Grade 6–12 schedule and House. A normal student cannot edit events. A teacher can assign a House leader or LAB leader; those students can then update only the event descriptions, locations, links, and documents that belong to their assigned activity.

Teachers can see all Grade 6–12 calendar entries, filter by grade, assign student leaders, define LAB leader access, and publish additional school events. The official schedule comes from the 2026–27 Dalton Lab Calendar supplied for this project.

## Published app

[Open DaltonHCAS](https://proffrancois-cloud.github.io/DaltonHCAS/)

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

## Deployment note

This repository is a demonstration. Authentication and data storage are client-side: accounts, passwords, students, coins, calendar documents, confidential notes, and concern records are not protected by a server and data does not synchronize between devices. The interface separates teacher-only and student-safe information, but a production school deployment needs server-side authentication, a shared database, role-based access control, audit logs, encryption, retention rules, and backups before real student data is entered.
