import '../login/auth.css';
import AuthScreen from '../_components/AuthScreen';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
