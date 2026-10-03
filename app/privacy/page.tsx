import type { Metadata } from 'next';
import { PRIVACY_BODY, LGL_CSS } from '../../lib/legalContent';

export const metadata: Metadata = {
  title: 'Privacy Policy | FreeDoc',
  description: 'The privacy policy for FreeDoc, a free AI symptom-triage tool that is not medical care.',
  alternates: { canonical: '/privacy' },
};

export default function Page() {
  return (
    <div className="wrap">
      <div className="article">
        <div className="box er">
          <h2>FreeDoc is not for emergencies</h2>
          <p>If you think someone may be having a medical emergency, call 911 or go to the nearest emergency room now. For a mental health crisis, call or text 988. For a possible poisoning, call Poison Control at 1-800-222-1222.</p>
        </div>
        <div className="lgl"><style dangerouslySetInnerHTML={{ __html: LGL_CSS }} /><p className="lgl-nav"><a href="/terms">Terms of Use</a></p><div dangerouslySetInnerHTML={{ __html: PRIVACY_BODY }} /></div>
      </div>
    </div>
  );
}
