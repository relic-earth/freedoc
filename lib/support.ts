// Emotional, relationship and faith support. Runs alongside the health triage:
// if a message is about one of these topics, FreeDoc answers with a support guide instead of a care level.

export type SupportTopic = 'infidelity' | 'multiple' | 'faith' | 'relationship' | 'mental';

export interface SupportGuide {
  topic: SupportTopic;
  title: string;
  summary: string;
  reflect: string[]; // questions to think about
  steps: string[]; // gentle next steps
  say: string[]; // things that can help a hard conversation start
  reachOut: string[]; // who to talk to
}

const INFIDELITY = /\b(cheat(ed|ing|s)?|infidel|unfaithful|affair|had an affair|sleeping with|hooked up with|betray(ed|al)|caught (him|her|them|my (wife|husband|partner|girlfriend|boyfriend))|texting (another|someone)|emotional affair|secret (relationship|crush))\b/i;
const MULTIPLE = /\b(in love with (two|2|both|more than one|multiple|another|someone else|someone new)|love (two|2|more than one|multiple) (people|women|men|persons)|falling for (two|2|someone else|another)|polyamor|poly\b|open relationship|non-?monogam|throuple|more than one (partner|person|relationship)|multiple (partners|relationships|people)|two (girlfriends|boyfriends|partners|wives|husbands)|torn between (two|2|them|both)|feelings for (two|2|someone else|another|both))\b/i;
const FAITH = /\b(god|jesus|christ|church|pastor|priest|imam|rabbi|bible|quran|koran|torah|prayer|pray(ing)?|faith|religio|spiritual|sin(ned|ful)?|hell|heaven|soul|sacred|synagogue|mosque|temple|clergy|atheis|agnostic|doubt(ing)? my (faith|belief)|lost my (faith|belief)|crisis of faith|haram|forgive(n|ness)? (by )?god)\b/i;
const RELATIONSHIP = /\b(my (wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?|spouse|ex)\b.*\b(love|trust|fight|argu|leave|divorce|break up|lonely|unhappy)|break ?up|divorce|heartbroken|heartbreak|falling out of love|fell out of love|fall(ing)? in love|in love with|lonely|marriage (problems|is falling|trouble)|relationship (problems|advice|trouble|is falling)|can'?t trust|jealous)\b/i;

const MENTAL = /\b(anxi(ous|ety)|panic attacks?|depress(ed|ion|ive)|hopeless|worthless|burn(ed|t)? ?out|can'?t stop worrying|overthink|stress(ed|ful)? out|overwhelm(ed|ing)|grie(f|ving)|mourning|trauma(tized)?|ptsd|flashbacks?|ocd|intrusive thoughts|mood swings|numb|empty inside|no motivation|can'?t (focus|concentrate)|adhd|insomnia|can'?t sleep (because|from) (worry|stress)|mental health|therapy|therapist|lonely|loneliness|social anxiety|self[- ]esteem|angry all the time|rage|irritable)\b/i;

export function detectSupportTopic(raw: string): SupportTopic | null {
  if (!raw) return null;
  const t = raw.replace(/[‘’ʼ′`´]/g, "'").replace(/\s+/g, ' ');
  if (INFIDELITY.test(t)) return 'infidelity';
  if (MULTIPLE.test(t)) return 'multiple';
  if (FAITH.test(t)) return 'faith';
  if (RELATIONSHIP.test(t)) return 'relationship';
  if (MENTAL.test(t)) return 'mental';
  return null;
}

export const SUPPORT_LINES = [
  { label: 'Call or text 988', sub: 'Suicide & Crisis Lifeline, free, 24/7', href: 'tel:988' },
  { label: 'Text HOME to 741741', sub: 'Crisis Text Line, free, 24/7', href: 'sms:741741?&body=HOME' },
  { label: 'National Domestic Violence Hotline', sub: '1-800-799-7233, free, 24/7, if you feel unsafe at home', href: 'tel:18007997233' },
];

const COMMON_REACH = [
  'A licensed therapist or counselor (many offer video visits and sliding-scale fees)',
  'A friend or family member you trust, who can listen without taking sides',
];

export const STATIC_GUIDES: Record<SupportTopic, SupportGuide> = {
  infidelity: {
    topic: 'infidelity',
    title: 'Cheating and broken trust',
    summary:
      'Whether you were cheated on, you cheated, or you are tempted to, this is one of the most painful things a person can go through. Strong feelings like shock, guilt, anger, or shame are normal. You do not have to decide everything today.',
    reflect: [
      'What do I need most right now: safety, space, honesty, or time to think?',
      'What would I want to be true in six months, and what is one step toward that?',
      'If I am the one who strayed: what was I looking for, and what do I owe the other person?',
      'Can trust be rebuilt here, and is the other person willing to do that work too?',
    ],
    steps: [
      'Give yourself a little time before making big, permanent decisions.',
      'Take care of the basics: sleep, food, water, and one person you can talk to.',
      'If you are weighing a conversation, write down what you want to say first.',
      'Consider testing for sexually transmitted infections if there was sexual contact. A doctor or clinic can help privately.',
      'Many people find couples or individual counseling helpful, whether they stay or leave.',
    ],
    say: [
      '“I found out something that hurts, and I need us to talk honestly.”',
      '“I am not ready to decide anything yet. I need some time.”',
      '“I made a mistake that hurt you. I want to tell you the truth.”',
    ],
    reachOut: COMMON_REACH,
  },
  multiple: {
    topic: 'multiple',
    title: 'Loving or being drawn to more than one person',
    summary:
      'Having real feelings for more than one person is more common than people admit, and it can feel exciting and frightening at once. There is no single right answer here. Different people and relationships work differently, and what matters is honesty, consent, and care for everyone involved.',
    reflect: [
      'What do these feelings tell me I need or want that I am not getting now?',
      'What have I agreed to with my current partner, spoken or unspoken?',
      'Does everyone involved know, and would they choose this if they had the full picture?',
      'Am I able to be honest and fair to each person, including myself?',
    ],
    steps: [
      'Get clear on your own feelings before acting on them. Journaling can help.',
      'If you are in a committed relationship, think about how and when to be honest with your partner, rather than hiding it.',
      'If you are curious about open or polyamorous relationships, read from reputable sources and talk with a counselor who is experienced and non-judgmental about relationship styles.',
      'Go slowly. Nobody should be pressured into an arrangement they did not freely choose.',
      'Protect your health: be honest with partners about sexual health and get tested regularly.',
    ],
    say: [
      '“I have been having feelings I did not expect, and I want to be honest with you.”',
      '“I would like to talk about what we each want from this relationship.”',
      '“I care about you and I do not want to hide this from you.”',
    ],
    reachOut: [...COMMON_REACH, 'A counselor who works with non-monogamous and diverse relationship styles, if that is relevant to you'],
  },
  faith: {
    topic: 'faith',
    title: 'Faith, doubt, guilt and belief',
    summary:
      'Questions about faith, guilt, forgiveness, or what you believe can feel deeply personal and sometimes lonely, especially when they collide with family, a partner, or your community. Doubt and struggle are a normal part of many people’s spiritual lives. FreeDoc will not tell you what to believe. It can help you think it through.',
    reflect: [
      'What do I actually believe or hope for, apart from what others expect of me?',
      'What part of this is about belief, and what part is about guilt, fear, family, or belonging?',
      'Whose voices do I trust here, and do they help me feel more whole or more afraid?',
      'What would peace look like for me, even if the questions are not all answered?',
    ],
    steps: [
      'Give yourself permission to ask hard questions. Honest doubt is not the same as failure.',
      'Talk with someone from your own tradition whom you trust, such as a pastor, priest, imam, rabbi, chaplain, or mentor. Hospital chaplains are often open to people of any belief.',
      'If your community feels unsafe or controlling, look for a second perspective from a counselor or a trusted friend outside it.',
      'Make room for practices that steady you, like prayer, meditation, walks, music, or time in nature, in whatever form fits you.',
      'If guilt or fear feels overwhelming or is affecting sleep, eating, or daily life, a therapist can help. Many are comfortable working with faith.',
    ],
    say: [
      '“I am struggling with something about my faith and I would like to talk it through.”',
      '“I am not trying to argue. I am trying to understand what I believe.”',
      '“Can we talk about this without judging each other?”',
    ],
    reachOut: ['A trusted spiritual leader, chaplain, or mentor from your own tradition', ...COMMON_REACH],
  },
  mental: {
    topic: 'mental',
    title: 'Your mind, mood and stress',
    summary:
      'What you are feeling is real, and many people go through it. Mental health sits on a spectrum, so FreeDoc does not try to put you in a diagnostic box or give you a label. What matters most is how much this is affecting your sleep, relationships, work, and daily life, and what helps. There are well-tested things that help most people.',
    reflect: [
      'How long has this been going on, and is it getting better, staying the same, or worse?',
      'What is it getting in the way of: sleep, work, relationships, enjoying things?',
      'Did something happen, such as a loss, a change, or a stressful stretch, that this connects to?',
      'What has helped even a little in the past?',
    ],
    steps: [
      'Protect the basics, which have strong research behind them: regular sleep and wake times, daylight, movement most days, regular meals, and less alcohol.',
      'Do one small, doable thing each day that gives a sense of progress or pleasure, even when motivation is low. Starting before you feel like it is how mood often shifts.',
      'For worry, try writing it down, then sorting it into “can act on” and “cannot control.” Slow breathing with a long exhale can calm a racing body in a few minutes.',
      'Stay connected: tell one person how you are really doing instead of carrying it alone.',
      'Talking therapies such as cognitive behavioral therapy, behavioral activation, acceptance and commitment therapy, and trauma-focused therapy have the strongest evidence for common problems like anxiety, low mood, and trauma. Ask a clinician or counselor about these.',
      'See a doctor or mental health professional if this lasts more than a couple of weeks, is getting worse, or is limiting daily life. Also see a doctor soon for severe mood swings, hearing or seeing things others do not, or feeling very suspicious or disconnected from reality.',
    ],
    say: [
      '“I have not been feeling like myself lately and I would like to talk.”',
      '“I am having a hard time and I could use some support. Can you just listen?”',
      '“I would like to see someone about how I have been feeling. Can you help me find an appointment?”',
    ],
    reachOut: [
      'Your doctor or a nurse line, who can check for physical causes such as thyroid, sleep, or medicine effects and discuss options',
      'A licensed therapist, counselor or psychologist, including low-cost and video options',
      'Call or text 988 any time if you feel unsafe or hopeless',
      ...COMMON_REACH.slice(1),
    ],
  },
  relationship: {
    topic: 'relationship',
    title: 'Relationships, love and heartache',
    summary:
      'Love, loneliness, conflict, and loss are some of the hardest things we go through, and they are very real. Whatever you are feeling is valid. You do not have to have it all figured out to take a good next step.',
    reflect: [
      'What is the main thing I am feeling right now, and what do I need because of it?',
      'What is in my control here, and what is not?',
      'What does a healthy, respectful relationship look like for me?',
      'Who in my life makes me feel supported?',
    ],
    steps: [
      'Name what you feel in a sentence or two. It often makes the problem smaller.',
      'Reach out to one person today, even with a short message.',
      'Keep a simple routine: sleep, food, movement, and time outside.',
      'If you are deciding something big, give yourself a deadline to decide and a person to talk it over with.',
      'Counseling can help whether you want to repair a relationship, leave one, or heal after one ends.',
    ],
    say: [
      '“I have been feeling distant and I would like us to talk.”',
      '“I want to understand how you see this, and I will share how I do.”',
      '“I need some support right now. Can we talk tonight?”',
    ],
    reachOut: COMMON_REACH,
  },
};
