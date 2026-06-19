type AdminMobileHubPagerProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function AdminMobileHubPager({
  page,
  pageCount,
  onPageChange,
}: AdminMobileHubPagerProps) {
  return (
    <div data-admin-mobile-hub-pager="true" className="admin-mobile-hub-pager">
      <button
        type="button"
        className="admin-mobile-hub-pager-button"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </button>
      <div className="admin-mobile-hub-pager-dots" aria-hidden="true">
        {Array.from({ length: pageCount }, (_, index) => (
          <span
            key={index}
            className="admin-mobile-hub-pager-dot"
            aria-current={index === page ? "page" : undefined}
          />
        ))}
      </div>
      <span className="admin-mobile-hub-pager-status" aria-live="polite">
        Página {page + 1} de {pageCount}
      </span>
      <button
        type="button"
        className="admin-mobile-hub-pager-button"
        disabled={page === pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}
