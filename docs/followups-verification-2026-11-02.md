# Concern responses, SMART follow-ups and phone notifications

Implemented for the existing school Supabase project and https://daltonhcas.vercel.app.

## Verified

- 48 automated tests pass, including existing staff permissions, student visibility restrictions, points and calendar behavior.
- Live authenticated API tests with four temporary fictional accounts: concern response propagation to original recipients and author; independent read state; two concurrent responsibility acceptances both retained; request retry deduplication.
- Actual concern IDs and types link SMART plans to records. Unrelated/unknown links and unauthorized plan changes are rejected.
- Multiple check-ins, responsible-staff notifications, cancelled dates, final reviews and student-only reflection editing verified against the school API. Reminders preserve reflection text; students can revise after submission. Academic/SEL/private concern details remain excluded from student API responses.
- Mobile browser viewport at 390 × 844: dashboard fits without page overflow, relevant tier options replace incompatible choices, unrelated description text survives tier changes, specific concern dropdown works, and the student saves a final reflection from their profile. Staff reflection editing controls are absent. A mobile staff logout control is available alongside the account name in the mobile menu.
- With the test browser closed, the scheduled worker generated one due check-in; subsequent runs kept the count at one. Cron HTTP requests returned 202 and scheduled database runs succeeded.
- A real encrypted push attempt to Google's push service using an intentionally invalid fictional device returned HTTP 410. The device subscription was automatically disabled, and its delivery job retained that result. Delivery uniqueness includes device, account and notification.
- Private push tables and credentials cannot be read directly with a student session. Generic service-worker/manifest/icons are publicly loadable; the app and school data retain preview and account protection.

## Device limitations

No physical iPhone or Android device was available. The automated Chromium browser granted notification permission but rejected push registration, so it did not demonstrate actual receipt. The transport test proves an outbound delivery attempt and invalid-device handling, not a successful notification arriving on a phone.

iPhone/iPad: Safari → Share → Add to Home Screen, open the installed app on iOS/iPadOS 16.4+, log in, then enable notifications in the dashboard. Android: install using a supported browser, log in, then enable notifications. Test a received alert with the installed app closed, and test its tap/login/deep link on each intended device before relying on phone delivery.

Notifications are retained in the dashboard if push is denied or fails. Lock-screen text is generic and contains no student/concern/IEP/SEL detail. Immediate-help instructions still direct students to approach an adult.

No avatar/economy, parent access, automatic tier escalation, new staffing policy, or permission redesign was added.
