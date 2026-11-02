import { ACADEMIC_CONCERN_EXAMPLES, ACADEMIC_PROFILES, BEHAVIOR_STRATEGY_GROUPS, SEL_CONCERN_OPTIONS, TIER_ONE_INSTRUCTIONAL_STRATEGIES, TIER_TWO_ACADEMIC_INTERVENTIONS } from "./concerns-data.js";

export function academicStrategies(tier, profileId = "") {
  if (Number(tier) === 3) return ACADEMIC_PROFILES.find(p => p.id === profileId)?.strategies ?? [...new Set(ACADEMIC_PROFILES.flatMap(p => p.strategies))];
  return Number(tier) === 1 ? TIER_ONE_INSTRUCTIONAL_STRATEGIES : TIER_TWO_ACADEMIC_INTERVENTIONS;
}
export const behavioralStrategies = tier => BEHAVIOR_STRATEGY_GROUPS.filter(g => g.id === `tier-${tier}-behavioral`);
export const selOptions = tier => SEL_CONCERN_OPTIONS.filter(o => o.tier === Number(tier));
export function validateConcernTier(type, input) {
  const tier = Number(input.tier);
  if (type === "academic") {
    if (input.profileId && tier !== 3) throw new Error("Academic profiles belong to Tier 3");
    if ((input.issueIds ?? []).some(id => !(ACADEMIC_CONCERN_EXAMPLES[tier] ?? []).includes(id))) throw new Error("Select academic issues from the selected tier");
    if ((input.strategies ?? []).some(s => !academicStrategies(tier, input.profileId).includes(s))) throw new Error("Select interventions from the selected academic tier");
  } else if (type === "behavior") {
    if ((input.strategies ?? []).some(s => !behavioralStrategies(tier).some(g => g.options.includes(s)))) throw new Error("Select behavioral strategies from the selected tier");
  } else if (type === "sel" && input.tier != null) {
    if (![1, 2, 3].includes(tier) || (input.concernIds ?? []).some(id => !selOptions(tier).some(o => o.id === id))) throw new Error("Select SEL concerns from the selected tier");
  }
}
