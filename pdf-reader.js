// Shared authenticated PDF viewer; no document is cached or given a public URL.
export function openPdfReader(blob, { name, label }) {
  document.querySelector("#school-pdf-reader")?.close();
  const previousFocus = document.activeElement;
  const objectUrl = URL.createObjectURL(blob);
  const dialog = document.createElement("dialog");
  dialog.id = "school-pdf-reader";
  dialog.className = "iep-reader";
  dialog.setAttribute("aria-labelledby", "school-pdf-reader-title");
  const header = document.createElement("header"), heading = document.createElement("div");
  const badge = document.createElement("small"), title = document.createElement("h2");
  badge.textContent = label; title.textContent = name; title.id = "school-pdf-reader-title";
  heading.append(badge, title);
  const close = document.createElement("button"); close.type = "button"; close.className = "secondary-button"; close.textContent = "×"; close.setAttribute("aria-label", "Close PDF reader"); close.addEventListener("click", () => dialog.close());
  header.append(heading, close);
  const frame = document.createElement("iframe"); frame.title = name; frame.src = `${objectUrl}#toolbar=1`;
  const footer = document.createElement("footer"), download = document.createElement("a");
  download.className = "secondary-button"; download.href = objectUrl; download.download = name; download.textContent = "Download PDF";
  footer.append(download);
  dialog.append(header, frame, footer);
  dialog.addEventListener("close", () => { URL.revokeObjectURL(objectUrl); dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); }, { once: true });
  document.body.append(dialog); dialog.showModal();
}
