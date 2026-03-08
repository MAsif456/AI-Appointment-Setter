'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
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
  
  // Hide sidebar on login page
  const showSidebar = pathname !== '/login';

  if (!showSidebar) {
    // Login page - no sidebar, no wrapper
    return <>{children}</>;
  }

  // Dashboard pages - with sidebar
  return (
    <div className={styles.layoutWrapper}>
      <Sidebar />
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}