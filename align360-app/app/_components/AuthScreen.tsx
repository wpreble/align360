import { Suspense } from 'react';
import AuthForm from './AuthForm';
import AlignMark from './AlignMark';

// Split-screen auth layout shared by /login and /signup: a deep-fig brand panel
// on the left, the form card on the right. The aside collapses on mobile and a
// compact brand lockup appears above the card instead.
export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="auth-aside-top">
          <AlignMark white />
          <span className="auth-wordmark">Align</span>
        </div>

        <div className="auth-aside-body">
          <h2 className="auth-aside-head">Clarity for who you&rsquo;re becoming.</h2>
          <p className="auth-aside-text">
            Honest self-assessment, turned into a living map of your strengths, values, and next moves.
          </p>
          <ul className="auth-aside-list">
            <li>Guided assessments built around you</li>
            <li>Personalized insight reports</li>
            <li>An AI guide that knows your profile</li>
          </ul>
        </div>

        <div className="auth-aside-foot">Align360</div>
      </aside>

      <main className="auth-main">
        <div className="auth-main-inner">
          <div className="auth-brand-mobile">
            <AlignMark />
            <span className="auth-wordmark dark">Align</span>
          </div>
          <Suspense fallback={<div className="auth-card" />}>
            <AuthForm mode={mode} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
