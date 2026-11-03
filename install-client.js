export function installationSteps({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (ios) return [
    "Open this page in Safari on your iPhone or iPad.",
    "Tap Share, then Add to Home Screen (you may need to scroll the menu).",
    "Keep Open as Web App enabled if shown, then tap Add.",
    "Open DaltonHCAS from its new icon and sign in."
  ];
  if (/Android/i.test(userAgent)) return [
    "Open this page in Chrome on your phone.",
    "Open the browser menu (⋮) and choose Install app or Add to Home screen.",
    "Confirm installation, then open DaltonHCAS from its icon and sign in."
  ];
  return [
    "Open this page in Chrome or Edge.",
    "Choose Install DaltonHCAS from the address bar or browser menu.",
    "On Safari for Mac, choose File → Add to Dock."
  ];
}

export function hasNewAppVersion(current, latest) {
  return /^[a-f0-9]{64}$/.test(current ?? "") && /^[a-f0-9]{64}$/.test(latest ?? "") && current !== latest;
}

export function initializeInstallation() {
  const dialog = document.querySelector("#app-install-dialog");
  const updateBar = document.querySelector("#app-update-bar");
  const standalone = matchMedia("(display-mode: standalone)");
  let promptEvent = null, installed = standalone.matches || navigator.standalone === true;
  let lastCheck = 0, checking = false, dismissedVersion = "";
  const currentVersion = document.querySelector('meta[name="app-build"]')?.content;
  const syncInstalled = () => document.body.classList.toggle("is-installed-app", installed);
  syncInstalled();
  standalone.addEventListener("change", () => { installed = standalone.matches || navigator.standalone === true; syncInstalled(); });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    promptEvent = null;
    syncInstalled();
    if (dialog.open) dialog.close();
  });

  function showInstructions() {
    const list = dialog.querySelector("ol");
    list.replaceChildren(...installationSteps(navigator).map(step => {
      const li = document.createElement("li"); li.textContent = step; return li;
    }));
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("click", async event => {
    if (event.target.closest("[data-install-app]")) {
      if (installed) return;
      if (!promptEvent) { showInstructions(); return; }
      const prompt = promptEvent;
      promptEvent = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") { installed = true; syncInstalled(); }
      } catch { showInstructions(); }
    } else if (event.target.closest("[data-close-install]")) dialog.close();
    else if (event.target.closest("[data-apply-app-update]")) location.reload();
    else if (event.target.closest("[data-dismiss-app-update]")) {
      dismissedVersion = updateBar.dataset.version;
      updateBar.hidden = true;
    }
  });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

  async function checkVersion() {
    if (document.hidden || !navigator.onLine || checking || Date.now() - lastCheck < 60_000 || !/^[a-f0-9]{64}$/.test(currentVersion ?? "")) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch("./app-version.json", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const { version } = await response.json();
      if (hasNewAppVersion(currentVersion, version) && dismissedVersion !== version) {
        updateBar.dataset.version = version;
        updateBar.hidden = false;
      }
    } catch { /* Keep the current screen and any unsent work during connection loss. */ }
    finally { checking = false; }
  }
  window.addEventListener("focus", checkVersion);
  window.addEventListener("online", checkVersion);
  document.addEventListener("visibilitychange", checkVersion);
  setInterval(checkVersion, 5 * 60_000);
  checkVersion();
}

if (typeof document !== "undefined") initializeInstallation();
