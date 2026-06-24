import './auth.css';
import AuthScreen from '../_components/AuthScreen';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
