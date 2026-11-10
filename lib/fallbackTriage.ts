import { SYMPTOMS } from './symptoms';
import type { Level, Verdict } from './triage';

// Offline triage used when the AI provider is unavailable (no credits, outage, bad key).
// It never calls any API, so FreeDoc keeps answering. It leans toward the MORE urgent level.

const KEYWORDS: Record<string, RegExp> = {
  'headache-and-fever': /headache|migraine/i,
  'fever-in-child': /fever|temperature/i,
  'chest-pain': /chest/i,
  'sore-throat': /sore throat|throat|strep|tonsil/i,
  'stomach-pain': /stomach|belly|abdom|tummy/i,
  'cough-that-wont-stop': /cough/i,
  rash: /rash|hives|itch/i,
  vomiting: /vomit|throwing up|nausea|diarrhea/i,
  dizziness: /dizz|lightheaded|vertigo/i,
  'confusion-in-older-adult': /confus|disoriented|forgetful/i,
  'fall-in-older-adult': /\bfell\b|\bfall\b/i,
  'ankle-sprain': /ankle|sprain|twisted/i,
  cut: /\bcut\b|laceration|gash/i,
  burn: /\bburn/i,
  'ear-pain': /\bear\b|earache/i,
  uti: /\buti\b|urin|pee|bladder/i,
  'allergic-reaction': /allerg|swelling|swollen/i,
  'back-pain': /back pain|\bback\b|sciatica/i,
  toothache: /tooth|dental|gum/i,
  'pink-eye': /pink eye|\beye\b|conjunctiv/i,
};

export function fallbackVerdict(text: string, who: string): Verdict {
  const t = text.toLowerCase();
  const infantFever =
    /(newborn|infant|baby|\b[0-2] ?(weeks?|months?) old)/.test(t) && /(fever|temperature|100\.4|hot)/.test(t);

  let slug = Object.keys(KEYWORDS).find((s) => KEYWORDS[s].test(text));
  if (slug === 'fever-in-child' && who !== 'kid' && !/child|kid|baby|toddler|son|daughter/i.test(text)) slug = 'headache-and-fever';
  const page = SYMPTOMS.find((s) => s.slug === slug);

  const level: Level = infantFever ? 'er' : 'urgent';
  const redFlags = page?.er ?? [
    'Trouble breathing or chest pain',
    'Confusion, fainting, or very hard to wake',
    'Severe bleeding that will not stop',
    'A seizure, or sudden weakness or trouble speaking',
  ];

  return {
    level,
    headline: level === 'er' ? 'Go to the ER now' : 'Consider getting checked today',
    summary: infantFever
      ? 'A fever in a baby this young always needs care right away. Go to the emergency room now, or call 911 if you cannot get there safely.'
      : 'FreeDoc is in simple mode right now, so this is general guidance and not tailored to everything you wrote. When in doubt, it is safer to get checked soon. If any warning sign below appears, go to the ER or call 911.',
    doNow: (page?.home ?? ['Rest and drink fluids', 'Write down when it started and how it has changed', 'Call a nurse line or your doctor if you are unsure']).slice(0, 4).concat(
      level === 'er' ? [] : ['Consider urgent care or a video visit today'],
    ),
    watchFor: redFlags.slice(0, 5),
    possibleCauses: [],
    askDoctor: ['What could be causing this?', 'What should I watch for over the next day or two?'],
    topic: page?.name.toLowerCase() ?? 'symptoms',
  };
}
