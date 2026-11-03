# Product

## Register

product

## Users

Authenticated HCAS teachers using a computer or phone during the school day. They need to recognize a student quickly, then return to teaching without navigating a complex system. Each teacher also needs a clear record of the points they personally gave.

## Product Purpose

Require a teacher login; record 10-to-50-point recognitions against one of the HCAS 7Cs; document behavior concerns using the HCAS Student Behavior Code; and document teacher-only academic concerns using the school's MTSS framework. Teachers can work with one or several students, review publication histories, filter the school coin ranking, and distinguish student-safe information from confidential teacher records. Success means a teacher can create an accurate record quickly and immediately see it in the relevant student profile.

## Brand Personality

Clear, friendly, and school-spirited. The product should feel recognizably HCAS through the official crest, house emblems, and the school's red, blue, and white identity.

## Anti-references

Avoid childish classroom-game styling, casino-like rewards, excessive animation, dense administration software, decorative dashboards, and controls that require explanation.

## Design Principles

1. Keep one obvious action on each screen.
2. Make every point change transparent and immediately visible.
3. Use authentic HCAS house identity, not generic substitutes.
4. Favor familiar controls and short labels over novel interactions.
5. Keep the same core workflow on phones and computers.
6. Make privacy status explicit wherever information is teacher-only or student-safe.

## Interface Direction

Keep the interface quiet and compact: system sans-serif, modest headings, white surfaces,
subtle dividers, and no decorative gradients or nested card backgrounds. Use official
school and House assets for identity. Reserve gold for the 7Cs, point badges, and selection;
use a deeper gold with white selection text for contrast. Put explanations beside the
field they clarify, and collapse secondary access details instead of repeating policy
under every record. Keep phone controls comfortable to tap and forms at least 16px on
mobile. Shared presentation rules live in `interface.css`; avoid adding another theme layer.

Student pickers, the roster and student rankings share a compact 112px crest with a
curved name above and grade below. Roster filters start unselected, beside the name
search; results appear after a search or explicit filter choice. Keep House points
and student ranking in equal dashboard columns and personal activity below them.
Profile creation actions belong in their corresponding record headers.

The desktop sidebar contains only the Dalton emblem, a 2×2 House counter grid,
navigation and account controls; the House header stays on phones. Use the full
content width with modest gutters. The dashboard has one personal activity timeline
beside Notifications, above the calendar. Recognition, concern and SMART actions
share that timeline and its filters. Form steps are native accordions: first open,
others closed initially, gold numbers and red titles. Additional record editors are
chosen from an inline + button and a surname-sorted, searchable staff dialog.

## Accessibility & Inclusion

Use clear contrast, readable type, large click targets, semantic buttons and labels, visible focus states, and reduced-motion support. Do not require users to configure accessibility settings before using the app.
