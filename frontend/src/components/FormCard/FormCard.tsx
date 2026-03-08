import styles from './FormCard.module.css';

interface FormCardProps {
  title: string;
  children: React.ReactNode;
}

/** Bordered card wrapper used for grouping related form fields. */
export default function FormCard({ title, children }: FormCardProps) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <div className={styles.fieldGroup}>{children}</div>
    </section>
  );
}
