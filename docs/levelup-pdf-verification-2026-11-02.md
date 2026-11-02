# Level-Up PDF attachments

The twelve supplied PDF files are retained unchanged in a private school Storage bucket. A shared Grade 11–12 pair is used for both grades, as requested. File size and SHA-256 checks verify the uploaded originals; no PDF files are included in the public app bundle or repository.

Level-Up event popups show one student workbook to students and both editions to staff. The server independently validates canonical account type and grade before returning PDF bytes. Student API state excludes teacher editions and private storage paths. Public and direct student Storage downloads are blocked.

Verification includes 59 passing automated tests, 19 authenticated PDF downloads checked byte-for-byte against the supplied files, and 84 denied student-access checks covering teacher editions, other grades, forged client roles/grades, and direct Storage requests. Anonymous API access and public-bucket downloads were also denied. Browser tests check event attachments, the embedded reader and the downloaded workbook on a mobile-sized screen. Temporary verification accounts are removed after testing.

The reader shares the existing IEP viewing mechanism, revokes its temporary document URL when closed, and closes when the school session ends. A delayed download cannot reopen a PDF after the user changes accounts or logs out.
