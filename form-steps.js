export function rememberFormSteps(root, state) {
  for (const step of root.querySelectorAll(".form-step")) state.set(step.dataset.stepKey, step.open);
}

export function enhanceFormSteps(root, view, state) {
  const fields = root.querySelectorAll("#award-form .award-form-panel > fieldset, #behavior-concern-form > fieldset, #academic-concern-form > fieldset, #sel-concern-form > fieldset");
  fields.forEach((field, index) => {
    const legend = field.querySelector(":scope > legend");
    if (!legend) return;
    const key = `${view}:${index}`;
    const title = legend.cloneNode(true);
    const number = title.querySelector(":scope > span:first-child");
    if (number && /^\d+$/.test(number.textContent.trim())) number.remove();
    const step = document.createElement("details");
    step.className = "form-step";
    step.dataset.stepKey = key;
    step.open = state.has(key) ? state.get(key) : index === 0;
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="step-number">${index + 1}</span><span class="step-title">${title.innerHTML.trim()}</span>`;
    const content = document.createElement("div");
    content.className = "step-content";
    field.before(step);
    legend.classList.add("sr-only");
    content.append(field);
    step.append(summary, content);
  });
}

export function revealInvalidField(field) {
  let parent = field.parentElement;
  while (parent) {
    if (parent.tagName === "DETAILS") parent.open = true;
    parent = parent.parentElement;
  }
}
