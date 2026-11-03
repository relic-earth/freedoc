'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="FreeDoc home">
      <span className="logo-mark">+</span>
      <span className="logo-name">FreeDoc</span>
    </Link>
  );
}

const CHANNELS = [
  { href: '/', name: 'triage', topic: 'Should I go to the ER? A suggested next step in about 60 seconds.' },
  { href: '/insurance', name: 'free-insurance', topic: 'See if you may qualify for free or low-cost health insurance.' },
  { href: '/symptoms', name: 'symptom-guides', topic: 'Warning signs that mean ER, urgent care, or home care.' },
  { href: '/plus', name: 'freedoc-plus', topic: 'Family health history tools, coming soon. Join the waitlist.' },
  { href: '/advertise', name: 'sponsors', topic: 'Sponsor a page, with no personal or health-based targeting.' },
  { href: '/privacy', name: 'privacy', topic: 'Privacy, health data, and terms. FreeDoc is built to collect as little as possible.' },
];

function useChannel() {
  const path = usePathname() || '/';
  const hit = [...CHANNELS].reverse().find((c) => (c.href === '/' ? path === '/' || path.startsWith('/v') : c.href === '/privacy' ? /^\/(privacy|health-data|terms)/.test(path) : path.startsWith(c.href)));
  return hit || CHANNELS[0];
}

function ChannelLinks({ className }: { className: string }) {
  const ch = useChannel();
  return (
    <>
      {CHANNELS.map((c) => (
        <Link key={c.href} href={c.href} className={`${className} ${ch.href === c.href ? 'on' : ''}`} aria-current={ch.href === c.href ? 'page' : undefined}>
          <span className="hash" aria-hidden>
            #
          </span>
          {c.name}
        </Link>
      ))}
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="side" aria-label="FreeDoc channels">
      <div className="side-ws">
        <Logo />
        <p className="side-status">
          <span className="dot" aria-hidden /> Free · No account
        </p>
      </div>
      <nav className="side-nav">
        <p className="side-h">Channels</p>
        <ChannelLinks className="side-link" />
        <p className="side-h">Direct messages</p>
        <Link href="/#check" className="side-link dm">
          <span className="dm-av" aria-hidden />
          FreeDoc AI <span className="app-tag">APP</span>
        </Link>
        <p className="side-h alert">Emergency lines</p>
        <a href="tel:911" className="side-link em">
          <span className="em-dot" aria-hidden /> Call 911
        </a>
        <a href="tel:988" className="side-link em2">
          <span className="em-dot amber" aria-hidden /> Crisis line 988
        </a>
        <a href="tel:18002221222" className="side-link em2">
          <span className="em-dot amber" aria-hidden /> Poison Control
        </a>
      </nav>
      <div className="side-foot">
        <p className="hud-mono">Not medical advice</p>
        <p className="hud-mono">Emergency? Call 911</p>
      </div>
    </aside>
  );
}

export function Header() {
  const ch = useChannel();
  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="mob-logo">
          <Logo />
        </div>
        <div className="chan">
          <p className="chan-name">
            <span className="hash" aria-hidden>
              #
            </span>
            {ch.name}
          </p>
          <p className="chan-topic">{ch.topic}</p>
        </div>
        <nav className="nav">
          <Link href="/#check" className="search" aria-label="Describe your symptoms">
            <span aria-hidden>⌕</span> Describe symptoms
          </Link>
          <a href="tel:911" className="call911">
            Call 911
          </a>
        </nav>
      </div>
      <nav className="mchan" aria-label="Channels">
        <ChannelLinks className="mchan-link" />
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Logo />
            <p className="foot-note">A free AI tool that shares general health information and suggests how soon to seek care. It is not a doctor or nurse, and it does not diagnose or treat.</p>
          </div>
          <div className="foot-links">
            <Link href="/insurance">Free health insurance</Link>
            <Link href="/symptoms">Symptom guides</Link>
            <Link href="/plus">FreeDoc Plus</Link>
            <Link href="/advertise">Sponsor a section</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/health-data">Health Data Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
        <p className="foot-emerg">
          Emergency: call <a href="tel:911">911</a>. Crisis or suicidal thoughts: call or text <a href="tel:988">988</a>. Poison Control:{' '}
          <a href="tel:18002221222">1‑800‑222‑1222</a>.
        </p>
        <p className="foot-legal">FreeDoc provides general health information for educational purposes. It is not medical advice, diagnosis, or treatment, and using it does not create a clinician–patient relationship. Always follow the advice of a licensed clinician. FreeDoc is not a government agency, an insurance company, or a licensed insurance agent or broker, and it is not affiliated with Medicaid, CHIP, Medicare, or HealthCare.gov. © 2026 Island Global Company.</p>
      </div>
    </footer>
  );
}

/** Slack-style message header for the FreeDoc AI bot. */
export function BotLine({ note = 'just now' }: { note?: string }) {
  return (
    <div className="bot-line">
      <span className="bot-av" aria-hidden>
        <span />
      </span>
      <span className="bot-name">FreeDoc AI</span>
      <span className="app-tag">APP</span>
      <span className="ts">{note}</span>
    </div>
  );
}

/** Iron Man style arc-reactor HUD graphic (decorative). */
export function Reactor() {
  return (
    <svg className="reactor" viewBox="0 0 200 200" aria-hidden>
      <defs>
        <radialGradient id="rc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8fbff" />
          <stop offset="35%" stopColor="#7eeeff" />
          <stop offset="100%" stopColor="#38e1ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" className="r-ring thin" />
      <g className="spin slow">
        <circle cx="100" cy="100" r="86" className="r-ring dash1" />
      </g>
      <g className="spin rev">
        <circle cx="100" cy="100" r="72" className="r-ring dash2" />
      </g>
      <g className="spin">
        <circle cx="100" cy="100" r="58" className="r-ring dash3" />
      </g>
      <circle cx="100" cy="100" r="44" className="r-ring gold" />
      <circle cx="100" cy="100" r="34" fill="url(#rc)" className="core" />
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i} x1="100" y1="6" x2="100" y2="16" className="tick" transform={`rotate(${i * 30} 100 100)`} />
      ))}
    </svg>
  );
}
