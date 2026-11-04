// One keyboard-accessible, highlighted choice style for all concern categories.
export function issueChoice({ name, value, title, description = "", id = "", checked = false }, esc) {
  return `<label class="issue-option"><input type="checkbox" name="${esc(name)}" value="${esc(value)}" ${id ? `id="${esc(id)}"` : ""} ${checked ? "checked" : ""} /><span><strong>${esc(title)}</strong>${description ? `<small>${esc(description)}</small>` : ""}</span></label>`;
}
export function selSupportChoices(options, selectedIds, selectedStrategies, esc) {
  const linked = new Map();
  for (const option of options.filter(o => selectedIds.includes(o.id))) for (const strategy of option.strategies) {
    if (!linked.has(strategy)) linked.set(strategy, []);
    linked.get(strategy).push(option.title);
  }
  return [...linked].map(([strategy, issues]) => issueChoice({ name: "strategies", value: strategy, title: strategy, description: [...new Set(issues)].join(", "), checked: selectedStrategies.includes(strategy) }, esc)).join("");
}
