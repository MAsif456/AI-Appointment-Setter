'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import { EscalationNotificationProvider } from '@/contexts/EscalationNotificationContext';
import styles from '@/app/layout.module.css';

/**
 * Conditionally renders sidebar based on current route
 * Hides sidebar on login page
 */
export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Check if current route is a public authentication route
  const isPublicRoute = pathname.startsWith('/login') ||
                       pathname.startsWith('/verify-email') ||
                       pathname.startsWith('/forgot-password') ||
                       pathname.startsWith('/reset-password');

  // If it's a public route, render children without sidebar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Dashboard pages - with sidebar.
  // The escalation provider is mounted unconditionally here; it's a
  // no-op for admins because the bell and stream hook both gate
  // themselves on `role === "staff"`.
  return (
    <EscalationNotificationProvider>
      <div className={styles.layoutWrapper}>
        <Sidebar />
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </EscalationNotificationProvider>
  );
}