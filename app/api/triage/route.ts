import OpenAI from 'openai';
import { detectEmergency } from '@/lib/emergency';
import { fallbackVerdict } from '@/lib/fallbackTriage';
import { detectSupportTopic, STATIC_GUIDES } from '@/lib/support';
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

  // Emotional, relationship and faith topics get a support guide instead of a care level.
  const supportTopic = detectSupportTopic(allText);
  if (supportTopic) {
    const fallback = STATIC_GUIDES[supportTopic];
    try {
      const sys = `You are FreeDoc, an automated AI tool offering general emotional support information. You are not a therapist, counselor, clergy member, lawyer or doctor, and you never claim to be one. You do not diagnose.
Be warm, calm, non-judgmental and practical, in plain short sentences at a 6th-grade reading level. Speak directly to the user.
Rules:
- Do not tell the user what to believe, who to love, whether to stay or leave, or which religion, relationship style or moral view is right. Offer perspectives and reflective questions, and respect their values and traditions.
- For cheating or infidelity: take the pain seriously whichever side the user is on; do not shame; encourage honesty, safety, and time before big decisions; mention STI testing only if sexual contact is described.
- For loving or being drawn to more than one person: be even-handed between monogamy and consensual non-monogamy; stress honesty, consent and care for everyone, and never encourage deception.
- For faith or religious struggle: treat doubt and belief with equal respect; point to trusted clergy, chaplains or mentors from their own tradition, and to a counselor.
- If there is any sign of abuse, coercion, or fear for safety, say so gently and mention the National Domestic Violence Hotline 1-800-799-7233; if any sign of hopelessness, mention calling or texting 988.
- For mental health, mood, anxiety, stress, grief or trauma: do NOT use DSM-5 diagnostic categories, criteria, or labels, and never diagnose. Use the best current evidence instead: describe experiences on a spectrum in plain language, focus on how much it affects daily life, and draw on WHO and ICD-11 framing, NICE and WHO mhGAP guidance, and strong research on what helps (sleep, movement, daylight, connection, behavioral activation, CBT, ACT, trauma-focused therapy, problem-solving, slow breathing). Be trauma-informed and avoid pathologizing normal grief, stress or sadness. Suggest seeing a clinician when it lasts weeks, worsens, or limits life, and soon for hearing or seeing things others do not or losing touch with reality. Never name medicines or suggest starting or stopping any medicine.
- Never name medicines. Never give legal advice beyond suggesting a lawyer for legal questions.
Return JSON with exactly these keys:
{"title":"3–8 word heading","summary":"3–4 compassionate sentences","reflect":["3–4 questions to think about"],"steps":["3–5 gentle, concrete next steps"],"say":["2–3 sentences they could use to start a hard conversation"],"reachOut":["2–4 kinds of people or services who could help"]}`;
      const out = await askJSON(sys, `Patient: ${patient}.\nWhat they said: "${text}"`);
      const arr = (x: any, n: number, m = 260) => (Array.isArray(x) ? x : []).slice(0, n).map((s: any) => clean(s, m)).filter(Boolean);
      const guide = {
        topic: supportTopic,
        title: clean(out.title, 80) || fallback.title,
        summary: clean(out.summary, 700) || fallback.summary,
        reflect: arr(out.reflect, 4),
        steps: arr(out.steps, 5),
        say: arr(out.say, 3),
        reachOut: arr(out.reachOut, 4),
      };
      if (!guide.reflect.length) guide.reflect = fallback.reflect;
      if (!guide.steps.length) guide.steps = fallback.steps;
      if (!guide.say.length) guide.say = fallback.say;
      if (!guide.reachOut.length) guide.reachOut = fallback.reachOut;
      return Response.json({ type: 'support', guide });
    } catch (e) {
      console.error('support error', e);
      return Response.json({ type: 'support', guide: fallback });
    }
  }

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
    // Never leave people with a dead search box: if the AI provider is down or out of credits,
    // skip the follow-up questions and answer from the built-in symptom guidance.
    if (body.step === 'questions') return Response.json({ type: 'questions', questions: [] });
    return Response.json({ type: 'verdict', verdict: fallbackVerdict(text, who) });
  }
}
