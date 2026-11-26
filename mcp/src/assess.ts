import { NEXT_ACTIONS, type NextAction } from "./remediation.js";
import { ALL_PRACTICE_IDS, LAYERS, TEAM_GUIDES, type Level, type LayerId, type TeamSize } from "./data.js";

/**
 * Practice-coverage assessment.
 *
 * This is a structured self-assessment, not a measurement of accessibility. Levels are
 * reported by the team. The tool turns them into coverage per layer and tells the team
 * which evidence to check before trusting a level. The 0.5 weight for "partial" is a
 * convention, not an empirically derived value.
 */

export const LEVEL_WEIGHT: Record<Level, number> = { absent: 0, partial: 0.5, enforced: 1 };

export const ASSESSMENT_LIMITS =
  "This reports coverage of documented practices from self-reported levels. It is not a WCAG conformance result, " +
  "not a measure of user experience, and not validated against audit outcomes. A weak layer means the checklist " +
  "has gaps there, not that the product fails users. Confirm each 'enforced' level with its verification step.";

export interface PracticeResult {
  id: string;
  text: string;
  level: Level;
  /** Present when the level is not enforced: what would move it forward. */
  toReachEnforced?: string;
  /** Present when the team reports enforced: how to confirm it. */
  confirmBy?: string;
  /** Present when the level is not enforced: a first step, with linked artifacts and patterns. */
  nextAction?: NextAction;
}

export interface LayerResult {
  layer: LayerId;
  name: string;
  coverage: number; // 0..1, weighted
  enforced: number;
  partial: number;
  absent: number;
  total: number;
  relevant: boolean;
  riskIfWeak: string;
  practices: PracticeResult[];
}

export interface AssessmentResult {
  measure: "practice coverage (self-reported)";
  teamSize: TeamSize;
  unknownPracticeIds: string[];
  /** Practices not mentioned in the input; they are treated as absent. */
  unreported: string[];
  layers: LayerResult[];
  priorities: { layer: LayerId; name: string; coverage: number; nextSteps: string[]; actions: { practice: string; nextAction?: NextAction }[]; why: string }[];
  summary: string;
  limits: string;
}

export function assess(teamSize: TeamSize, reported: Record<string, Level>): AssessmentResult {
  const guide = TEAM_GUIDES[teamSize];
  const known = new Set(ALL_PRACTICE_IDS);
  const unknownPracticeIds = Object.keys(reported).filter((k) => !known.has(k));
  const unreported = ALL_PRACTICE_IDS.filter((id) => !(id in reported));

  const layers: LayerResult[] = LAYERS.map((layer) => {
    const practices: PracticeResult[] = layer.practices.map((pr) => {
      const level: Level = reported[pr.id] ?? "absent";
      return {
        id: pr.id,
        text: pr.text,
        level,
        ...(level === "enforced"
          ? { confirmBy: pr.verify }
          : {
              toReachEnforced: level === "partial" ? pr.enforced : `${pr.text}. Enforced looks like: ${pr.enforced}`,
              nextAction: NEXT_ACTIONS[pr.id],
            }),
      };
    });
    const weight = practices.reduce((n, x) => n + LEVEL_WEIGHT[x.level], 0);
    return {
      layer: layer.id,
      name: layer.name,
      coverage: Math.round((weight / practices.length) * 100) / 100,
      enforced: practices.filter((x) => x.level === "enforced").length,
      partial: practices.filter((x) => x.level === "partial").length,
      absent: practices.filter((x) => x.level === "absent").length,
      total: practices.length,
      relevant: guide.keyLayers.includes(layer.id),
      riskIfWeak: layer.whenAbsent,
      practices,
    };
  });

  // Priorities: recommended layers that are not fully enforced, weakest first; ties resolve by layer order.
  const priorities = layers
    .filter((l) => l.relevant && l.coverage < 1)
    .sort((a, b) => a.coverage - b.coverage || a.layer.localeCompare(b.layer))
    .map((l) => ({
      layer: l.layer,
      name: l.name,
      coverage: l.coverage,
      ...(() => {
        const top = l.practices
          .filter((x) => x.level !== "enforced")
          .sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level])
          .slice(0, 2);
        return {
          nextSteps: top.map((x) => x.toReachEnforced!),
          actions: top.map((x) => ({ practice: x.id, nextAction: x.nextAction })),
        };
      })(),
      why: l.riskIfWeak,
    }));

  const relevant = layers.filter((l) => l.relevant);
  const enforced = relevant.reduce((n, l) => n + l.enforced, 0);
  const total = relevant.reduce((n, l) => n + l.total, 0);
  const summary =
    priorities.length === 0
      ? `All practices in the layers recommended for ${guide.title} are reported as enforced (${enforced}/${total}). Confirm each with its verification step.`
      : `${enforced}/${total} practices reported as enforced across the ${relevant.length} layers recommended for ${guide.title}. ` +
        `Lowest practice coverage: ${priorities[0].name}.`;

  return {
    measure: "practice coverage (self-reported)",
    teamSize,
    unknownPracticeIds,
    unreported,
    layers,
    priorities,
    summary,
    limits: ASSESSMENT_LIMITS,
  };
}
