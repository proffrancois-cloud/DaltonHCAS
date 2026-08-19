# DaltonHCAS House Points

A self-contained local app for authenticated HCAS teachers to record 7C recognitions, choose 10, 20, 30, 40, or 50 points, filter the student emblem gallery by grade and house, view the four-house leaderboard, review student breakdowns, and unsend items from their personal award history.

The requested grade split totals 11 students, so the demo includes `random1` through `random11`: 2 in Grade 9 and 3 each in Grades 10, 11, and 12. Data is stored only in the browser's local storage, so recognitions remain after a refresh on the same browser. DaltonHCAS is also a Progressive Web App: once published over HTTPS, it can be installed from Safari or Chrome and opened from a phone's home screen.

## Teacher accounts

- Username `david`, password `david`
- Username `francois`, password `francois`

The login is intended only for this local demonstration. The credentials are checked in the browser and are not suitable for a public or production deployment.

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

This repository is a demonstration. Authentication and data storage are client-side: accounts, passwords, students, and recognitions are not protected by a server and data does not synchronize between devices. A production school deployment needs server-side authentication, a shared database, access control, and backups.
