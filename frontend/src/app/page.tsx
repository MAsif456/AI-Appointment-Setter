'use client';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user, loading } = useAuth();

    if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh' 
      }}>
        <p>Loading...</p>
      </div>
    );
  }

 return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        Good morning, {user?.name || 'Admin User'}
      </p>
      
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '0.5rem'
      }}>
        <p style={{ color: '#166534' }}>
          ✅ <strong>Welcome back!</strong> You are logged in as {user?.email}
        </p>
      </div>
    </div>
  );
}