import { redirect } from 'next/navigation';
import { getAdminSession, adminConfigured } from '@/lib/admin/auth';
import AdminDashboard from './AdminDashboard';
import './admin.css';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  if (!adminConfigured()) {
    return (
      <div className="adm-login-wrap">
        <div className="adm-login">
          <div className="adm-login-brand">Align360 <span>Admin</span></div>
          <p className="adm-login-sub">Admin access isn&apos;t configured in this environment yet.</p>
        </div>
      </div>
    );
  }
  const session = getAdminSession();
  if (!session) redirect('/admin/login');
  return <AdminDashboard email={session.email} role={session.role} />;
}
