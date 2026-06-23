import { Suspense } from 'react';
import '../login/auth.css';
import AuthForm from '../_components/AuthForm';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-card" />}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
