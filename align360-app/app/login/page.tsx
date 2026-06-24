import { Suspense } from 'react';
import './auth.css';
import AuthForm from '../_components/AuthForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-card" />}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
