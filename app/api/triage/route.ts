import OpenAI from 'openai';
import { detectEmergency } from '@/lib/emergency';
import { WHO, isLevel, type Who, type Question, type Verdict } from '@/lib/triage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODELS = [process.env.OPENAI_MODEL, 'gpt-4.1', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4o-mini'].filter(Boolean) as string[];

const BASE = `You are FreeDoc, an automated AI health-information tool. You help people think through how soon someone may want to seek care.
You are not a doctor, nurse, or any licensed clinician, and you never claim or imply to be one. You never diagnose, and you never say that care is unnecessary. You speak in plain, short, complete sentences at a 6th-grade reading level.
Safety rules you always follow:
- When in doubt, choose the MORE urgent level.
- Infants under 3 months with a temperature of 100.4°F (38°C) or higher: "er".
- Any sign of stroke, heart attack, trouble breathing, confusion, fainting, severe bleeding, severe allergic reaction, stiff neck with fever, severe dehydration, or a purple/non-blanching rash with fever: "er".
- Older adults with new confusion, a fall with head strike, or blood thinners with an injury: at least "urgent".
- Never recommend prescription drugs or doses, and never name a specific medicine or brand. If relevant, say "an over-the-counter pain or fever reducer, used as the label directs" and to ask a pharmacist first, especially for children, pregnancy, older adults, or people taking other medicines.
- Never state or guess a single diagnosis; offer at most three "possible causes" framed as possibilities.
- Never tell someone they are fine, safe, or do not need care. For "home", say home care may be reasonable for now and name clear reasons to seek care.
- Never refer to yourself as a nurse, doctor, or clinician.`;

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function askJSON(system: string, user: string): Promise<any> {
  const ai = client();
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const r = await ai.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      return JSON.parse(r.choices[0]?.message?.content || '{}');
    } catch (e: any) {
      lastErr = e;
      const code = e?.code || e?.error?.code || '';
      const status = e?.status;
      if (status === 404 || code === 'model_not_found' || /model/i.test(String(e?.message))) continue;
      throw e;
    }
  }
  throw lastErr;
}

function clean(s: unknown, max = 400) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Safety net for AI output only (never for what the user typed): results never name a specific
// medicine or brand, even if the model slips.
function scrub(s: unknown, max = 400) {
  return clean(s, max + 60)
    .replace(/\b(an? |your |the )?epi-?pens?\b/gi, (_m: string, d?: string) => `${!d || /^an? $/i.test(d) ? 'an ' : d}epinephrine auto-injector`)
    .replace(/\b(an? )?(some )?(acetaminophen|paracetamol|tylenol|ibuprofen|advil|motrin|naproxen|aleve|aspirin|bayer|excedrin|benadryl|diphenhydramine|claritin|loratadine|zyrtec|cetirizine|allegra|fexofenadine|pepto(-bismol)?|imodium|loperamide|tums|mylanta|prilosec|omeprazole|pepcid|famotidine|sudafed|pseudoephedrine|mucinex|guaifenesin|dayquil|nyquil|robitussin|dextromethorphan|neosporin|hydrocortisone|cortisone|amoxicillin|augmentin|penicillin|azithromycin|z-?pack|cephalexin|keflex|ciprofloxacin|doxycycline|prednisone|zofran|ondansetron|miralax|dramamine|midol)\b/gi, 'an over-the-counter medicine (ask a pharmacist first)')
    .replace(/(an over-the-counter medicine \(ask a pharmacist first\))(,? (or|and|,) an over-the-counter medicine \(ask a pharmacist first\))+/gi, '$1')
    .slice(0, max);
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  const who: Who = (['me', 'kid', 'parent', 'someone'] as const).includes(body.who) ? body.who : 'me';
  const text = clean(body.text, 1500);
  const answers: { q: string; a: string }[] = Array.isArray(body.answers)
    ? body.answers.slice(0, 8).map((x: any) => ({ q: clean(x?.q, 200), a: clean(x?.a, 300) }))
    : [];

  if (!text) return Response.json({ error: 'Please describe what is going on.' }, { status: 400 });

  const allText = [text, ...answers.map((a) => a.a)].join(' \n ');
  const emergency = detectEmergency(allText);
  if (emergency) return Response.json({ type: 'emergency', kind: emergency });

  const patient = WHO[who].phrase;

  try {
    if (body.step === 'questions') {
      const sys = `${BASE}
Task: Ask 3 to 5 short follow-up questions that help decide how soon someone may want care, based on standard public triage guidance.
Each question must be answerable by tapping one option. Options are short (1–5 words), 2 to 5 per question.
- If age is unknown, the first question asks for an age range suited to the patient (for a child: "Under 3 months", "3–12 months", "1–5 years", "6–12 years", "13–17 years").
- Ask about how long it has been going on, and how severe it is.
- One question must be a red-flag checklist with multi=true: list 3–5 danger signs specific to this complaint, and always end with the option "None of these".
Return JSON: {"questions":[{"id":"q1","text":"...","options":["..."],"multi":false}]}`;
      const out = await askJSON(sys, `Patient: ${patient}.\nWhat they said: "${text}"`);
      const qs: Question[] = (Array.isArray(out.questions) ? out.questions : [])
        .slice(0, 5)
        .map((q: any, i: number) => ({
          id: clean(q.id || `q${i + 1}`, 20),
          text: clean(q.text, 160),
          options: (Array.isArray(q.options) ? q.options : []).slice(0, 6).map((o: any) => clean(o, 60)).filter(Boolean),
          multi: !!q.multi,
        }))
        .filter((q: Question) => q.text && q.options.length >= 2);
      return Response.json({ type: 'questions', questions: qs });
    }

    const sys = `${BASE}
Task: Decide the triage level and explain it.
Levels: "home" (home care may be reasonable for now), "doctor" (see a doctor within 1–2 days), "urgent" (urgent care or video visit today), "er" (emergency room now).
Return JSON with exactly these keys:
{"level":"home|doctor|urgent|er",
 "headline":"a 3–8 word plain verdict with no names, ages, or personal details",
 "summary":"2–3 complete sentences explaining why, speaking to the user",
 "doNow":["3–5 short, specific steps to take right now"],
 "watchFor":["3–5 genuine red-flag signs, appropriate for this person's age, that mean go to the ER or call 911; do not list ordinary or mild symptoms"],
 "possibleCauses":[{"name":"common possibility","note":"one sentence"}],
 "askDoctor":["2–3 questions to ask the doctor"],
 "topic":"a 1–3 word general health topic to look up, e.g. \\"fever\\""}`;
    const qa = answers.map((a) => `- ${a.q} → ${a.a}`).join('\n');
    const out = await askJSON(sys, `Patient: ${patient}.\nWhat they said: "${text}"\nFollow-up answers:\n${qa || '(none)'}`);
    const arr = (x: any, n: number, m = 200) => (Array.isArray(x) ? x : []).slice(0, n).map((s: any) => scrub(s, m)).filter(Boolean);
    const verdict: Verdict = {
      level: isLevel(out.level) ? out.level : 'urgent',
      headline: scrub(out.headline, 80),
      summary: scrub(out.summary, 600),
      doNow: arr(out.doNow, 5),
      watchFor: arr(out.watchFor, 5),
      possibleCauses: (Array.isArray(out.possibleCauses) ? out.possibleCauses : [])
        .slice(0, 3)
        .map((c: any) => ({ name: scrub(c?.name, 60), note: scrub(c?.note, 200) }))
        .filter((c: any) => c.name),
      askDoctor: arr(out.askDoctor, 3),
      topic: clean(out.topic, 40) || 'symptoms',
    };
    return Response.json({ type: 'verdict', verdict });
  } catch (e) {
    console.error('triage error', e);
    return Response.json({ error: 'FreeDoc is busy right now. Please try again in a moment.' }, { status: 502 });
  }
}
