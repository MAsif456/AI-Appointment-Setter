import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConditionalLayout from '@/components/ConditionalLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AppointHealth AI - Schedule appointments in an efficient and precise way",
  description: "AppointHealth AI is a platform for scheduling appointments in an efficient and precise way",
};

/**
 * Root layout shared by every page in the app.
 * Wraps content with a fixed Sidebar on the left and a scrollable main area on the right.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
