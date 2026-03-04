'use client';

import styles from './QualificationQuestions.module.css';
import { QualificationQuestion } from '@/types/clinic';

/** Props for the QualificationQuestions component. */
interface QualificationQuestionsProps {
  questions: QualificationQuestion[];
  onChange: (questions: QualificationQuestion[]) => void;
}

/**
 * Checkbox list for enabling/disabling qualification questions.
 * Questions marked as required are shown with a "(Required)" label
 * and cannot be toggled off.
 */
export default function QualificationQuestions({ questions, onChange }: QualificationQuestionsProps) {
  /** Toggles the enabled state of a question by its ID. */
  const handleToggle = (id: string) => {
    const updated = questions.map((q) =>
      q.id === id && !q.required ? { ...q, enabled: !q.enabled } : q
    );
    onChange(updated);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Qualification Questions</h2>
      <div className={styles.questions}>
        {questions.map((question) => (
          <label key={question.id} className={styles.question}>
            <input
              type="checkbox"
              checked={question.enabled || question.required}
              onChange={() => handleToggle(question.id)}
              disabled={question.required}
              className={styles.checkbox}
            />
            <span className={styles.label}>
              {question.label}
              {question.required && (
                <span className={styles.required}> (Required)</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
