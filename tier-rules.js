import { ACADEMIC_CONCERN_EXAMPLES, ACADEMIC_PROFILES, BEHAVIOR_STRATEGY_GROUPS, SEL_CONCERN_OPTIONS, TIER_ONE_INSTRUCTIONAL_STRATEGIES, TIER_TWO_ACADEMIC_INTERVENTIONS } from "./concerns-data.js";

export function academicStrategies(tier, profileId = "") {
  const profile = ACADEMIC_PROFILES.find(p => p.id === profileId);
  if (profile) return profile.strategies;
  if (Number(tier) === 3) return [...new Set(ACADEMIC_PROFILES.flatMap(p => p.strategies))];
  return Number(tier) === 1 ? TIER_ONE_INSTRUCTIONAL_STRATEGIES : TIER_TWO_ACADEMIC_INTERVENTIONS;
}
export const behavioralStrategies = tier => BEHAVIOR_STRATEGY_GROUPS.filter(g => g.id === `tier-${tier}-behavioral`);
export const selOptions = tier => [...SEL_CONCERN_OPTIONS.filter(o => o.listedExample && o.tier === Number(tier)), ...SEL_CONCERN_OPTIONS.filter(o => !o.listedExample && o.id !== "other" && o.tier === Number(tier)), { ...SEL_CONCERN_OPTIONS.find(o => o.id === "other"), tier: Number(tier) }];
export function validateConcernTier(type, input) {
  const tier = Number(input.tier);
  if (type === "academic") {
    if ((input.issueIds ?? []).some(id => id !== "other" && !(ACADEMIC_CONCERN_EXAMPLES[tier] ?? []).includes(id))) throw new Error("Select academic issues from the selected tier");
    if ((input.strategies ?? []).some(s => s !== "other" && !academicStrategies(tier, input.profileId).includes(s))) throw new Error("Select interventions from the selected academic tier");
  } else if (type === "behavior") {
    if ((input.strategies ?? []).some(s => !behavioralStrategies(tier).some(g => g.options.includes(s)))) throw new Error("Select behavioral strategies from the selected tier");
  } else if (type === "sel" && input.tier != null) {
    if (![1, 2, 3].includes(tier) || (input.concernIds ?? []).some(id => !SEL_CONCERN_OPTIONS.some(o => o.id === id && (id === "other" || o.tier === tier)))) throw new Error("Select SEL concerns from the selected tier");
  }
}
