import { ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons';
import styles from './ConversationList.module.css';

interface ConversationPaginationProps {
  currentPage: number;
  totalPages: number;
  startIdx: number;
  endIdx: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

/** Pagination controls with page numbers and prev/next arrows. */
export default function ConversationPagination({
  currentPage,
  totalPages,
  startIdx,
  endIdx,
  totalItems,
  onPageChange,
}: ConversationPaginationProps) {
  return (
    <div className={styles.pagination}>
      <span className={styles.pageInfo}>
        {`${startIdx + 1}–${endIdx} of ${totalItems}`}
      </span>
      <div className={styles.pageControls}>
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className={styles.pageBtnIcon} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={n === currentPage ? styles.pageBtnActive : styles.pageBtn}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon className={styles.pageBtnIcon} />
        </button>
      </div>
    </div>
  );
}
