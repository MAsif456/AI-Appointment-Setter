'use client';

import { useTheme } from '@/contexts/ThemeContext';
import styles from './AppearanceSettings.module.css';

/**
 * Appearance tab in the Settings page.
 * Allows users to toggle between light and dark mode.
 */
export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.title}>Appearance</h2>
        <p className={styles.description}>
          Customise how the application looks. Your preference is saved locally.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Theme</h3>
        <p className={styles.cardDescription}>
          Choose between light and dark mode for the interface.
        </p>

        <div className={styles.options}>
          <button
            className={`${styles.option} ${theme === 'light' ? styles.optionActive : ''}`}
            onClick={() => setTheme('light')}
            aria-pressed={theme === 'light'}
          >
            <div className={styles.preview}>
              <div className={styles.previewLight}>
                <div className={styles.previewSidebar} />
                <div className={styles.previewContent}>
                  <div className={styles.previewLine} />
                  <div className={styles.previewLineShort} />
                </div>
              </div>
            </div>
            <span className={styles.optionLabel}>Light</span>
          </button>

          <button
            className={`${styles.option} ${theme === 'dark' ? styles.optionActive : ''}`}
            onClick={() => setTheme('dark')}
            aria-pressed={theme === 'dark'}
          >
            <div className={styles.preview}>
              <div className={styles.previewDark}>
                <div className={styles.previewSidebarDark} />
                <div className={styles.previewContentDark}>
                  <div className={styles.previewLineDark} />
                  <div className={styles.previewLineShortDark} />
                </div>
              </div>
            </div>
            <span className={styles.optionLabel}>Dark</span>
          </button>
        </div>
      </div>
    </div>
  );
}
