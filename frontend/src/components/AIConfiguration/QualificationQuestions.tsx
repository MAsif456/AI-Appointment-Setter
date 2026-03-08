'use client';

import styles from './QualificationQuestions.module.css';
import { QualificationQuestion } from '@/types/clinic';

/** Props for the QualificationQuestions component. */
interface QualificationQuestionsProps {
  questions: QualificationQuestion[];
  onChange: (questions: QualificationQuestion[]) => void;
}

/**
 * Toggle list for enabling/disabling qualification questions.
 * Each question can be toggled on or off to control which
 * questions the AI asks during patient conversations.
 */
export default function QualificationQuestions({ questions, onChange }: QualificationQuestionsProps) {
  /** Toggles the enabled state of a question by its key. */
  const handleToggle = (key: string) => {
    const updated = questions.map((q) =>
      q.key === key ? { ...q, enabled: !q.enabled } : q,
    );
    onChange(updated);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Qualification Questions</h2>
      <div className={styles.questions}>
        {questions.map((question) => (
          <label key={question.key} className={styles.question}>
            <input
              type="checkbox"
              checked={question.enabled}
              onChange={() => handleToggle(question.key)}
              className={styles.checkbox}
            />
            <span className={styles.label}>{question.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
