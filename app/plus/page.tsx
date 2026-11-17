import type { Metadata } from 'next';
import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

export const metadata: Metadata = {
  title: 'FreeDoc Plus waitlist: family health history tools',
  description: 'FreeDoc Plus is in development. Join the free waitlist for family profiles, saved history, and visit summaries. The FreeDoc symptom check stays free.',
  alternates: { canonical: '/plus' },
};

type SP = Promise<{ welcome?: string }>;

export default async function Plus({ searchParams }: { searchParams: SP }) {
  const { welcome } = await searchParams;
  return (
    <div className="wrap">
      <div className="article" style={{ maxWidth: 1000 }}>
        {welcome && (
          <div className="box home" role="status">
            <h2>Thanks for your support.</h2>
            <p>Plus features are still in development. If you were charged and would like a full refund, email info@island.contact and we will cancel and refund you the same day.</p>
          </div>
        )}
        <h1>FreeDoc Plus</h1>
        <p className="intro">FreeDoc Plus is in development and is not available for purchase yet. Join the free waitlist, and we will email you before it launches with the final features and price. Nothing is charged by joining.</p>

        <div className="price-grid">
          <div className="price">
            <h3>Free</h3>
            <div className="amt">
              $0 <small>available now</small>
            </div>
            <ul>
              <li>AI symptom checks: $1 each, or $25/month for unlimited</li>
              <li>Four suggested care levels</li>
              <li>Share and send summaries</li>
              <li>Emergency shortcuts</li>
            </ul>
          </div>
          <div className="price hot">
            <h3>Plus · coming soon</h3>
            <div className="amt">
              Waitlist <small>no charge to join</small>
            </div>
            <p className="step-label" style={{ marginTop: 10 }}>Features we are planning</p>
            <ul>
              <li>Profiles for family members</li>
              <li>Saved symptom history and timelines</li>
              <li>Visit summaries to bring to a clinician</li>
              <li>Medicine reminders you set yourself</li>
            </ul>
            <p className="plus-note">Planned features may change before launch. Plus will not diagnose or replace a clinician.</p>
            <LeadForm
              kind="plus"
              fields={[{ name: 'email', label: 'Your email', type: 'email', required: true }]}
              button="Join the free waitlist"
              done="You’re on the list. We will email you before Plus launches."
            />
            <p className="fine">
              We use your email only to tell you about FreeDoc Plus. See the <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        </div>
        <p className="src">We never sell your health information and never use it for advertising.</p>
      </div>
    </div>
  );
}
