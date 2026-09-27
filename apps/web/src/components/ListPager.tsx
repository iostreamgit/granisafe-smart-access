import styles from './ListPager.module.css';

type ListPagerProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export function ListPager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: ListPagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className={styles.pager}>
      <p className={styles.summary}>
        {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className={styles.controls}>
        {onPageSizeChange ? (
          <label className={styles.size}>
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className={styles.btn}
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>
        <span className={styles.pageLabel}>
          Page {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className={styles.btn}
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
