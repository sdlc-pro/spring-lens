import TemplateEngine from './template-engine.js';

export default class Pagination {

    static getPageRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

        const visiblePages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
        const sorted = [...visiblePages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);

        return sorted.reduce((acc, page, idx) => {
            if (idx > 0 && page - sorted[idx - 1] > 1) {
                acc.push('...');
            }
            acc.push(page);
            return acc;
        }, []);
    }

    static formatInfoText(totalElements, pageNumber, pageSize, itemLabel = 'beans') {
        if (!totalElements) {
            return `Showing 0 to 0 of 0 ${itemLabel}`;
        }
        const start = (pageNumber * pageSize) + 1;
        const end = Math.min((pageNumber + 1) * pageSize, totalElements);
        return `Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${totalElements.toLocaleString()} ${itemLabel}`;
    }


    static renderPaginationButtons($container, paginationState) {
        if (!$container || !$container.length) return;
        $container.empty();

        const { totalElements, totalPages, pageNumber, isFirstPage, isLastPage } = paginationState || {};
        if (!totalElements) return;

        const currentPage = pageNumber + 1;
        const maxPages = Math.max(1, totalPages || 1);
        const pages = Pagination.getPageRange(currentPage, maxPages);

        const fragment = document.createDocumentFragment();

        // Prev button
        const prevClone = TemplateEngine.clone('tpl-pagination-btn-nav');
        if (prevClone) {
            const $btn = $(prevClone.firstElementChild);
            $btn.addClass('btn-prev').attr('data-action', 'prev-page');
            if (isFirstPage) $btn.prop('disabled', true).css('opacity', '0.5');
            $btn.find('.material-symbols-outlined').text('chevron_left');
            fragment.appendChild(prevClone);
        }

        // Page buttons / Ellipsis
        pages.forEach(p => {
            if (p === '...') {
                const ellipsisClone = TemplateEngine.clone('tpl-pagination-ellipsis');
                if (ellipsisClone) fragment.appendChild(ellipsisClone);
            } else {
                const pageClone = TemplateEngine.clone('tpl-pagination-btn-page');
                if (pageClone) {
                    const $btn = $(pageClone.firstElementChild);
                    const isActive = p === currentPage;
                    const activeClass = isActive
                        ? 'text-white bg-primary font-bold'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800';
                    $btn.addClass(activeClass)
                        .attr('data-page', p)
                        .text(p);
                    fragment.appendChild(pageClone);
                }
            }
        });

        // Next button
        const nextClone = TemplateEngine.clone('tpl-pagination-btn-nav');
        if (nextClone) {
            const $btn = $(nextClone.firstElementChild);
            $btn.addClass('btn-next').attr('data-action', 'next-page');
            if (isLastPage) $btn.prop('disabled', true).css('opacity', '0.5');
            $btn.find('.material-symbols-outlined').text('chevron_right');
            fragment.appendChild(nextClone);
        }

        $container.append(fragment);
    }
}
