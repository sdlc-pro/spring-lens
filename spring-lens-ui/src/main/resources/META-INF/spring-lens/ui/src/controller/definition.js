import httpClient from '../helper/http-client.js';
import GraphTreeBuilder from '../helper/graph-tree-builder.js';
import beanDataStore from '../helper/bean-data-store.js';
import {
    tree, tbLink, lrLink, capitalize, formatPercentage, resolveBeanMetadata, resolveScopeStyle, resolveScopeBadgeClass, NH, RX, NW,
    ICON, GAP_X, GAP_Y, CSS_CLASSES, ROLE_COLORS, SCOPE_COLORS, ZOOM_SCALE_EXTENT, GRAPH_NODE_THEMES, GRAPH_NODE_THEMES_TINT,
    GRAPH_NODE_THEMES_BADGE, LOADING_MODE_COLORS, CONTEXT_THEME_COLORS, downloadJson, TemplateEngine, QueryParam, Pagination, Sidebar,
    ToastNotification, BeanSearchEngine, debounce, resolveBeanLayer
} from '../helper/index.js';

export default class Definitions {
    // Private State Fields
    _hasFetchedTableData = false;
    _debouncedFetchTableData = null;

    constructor(endpoints = {}) {
        this.beanDefinitionEndpoint = endpoints.BEAN_DEFINITION;
        this.beanDefinitionSummaryEndpoint = endpoints.SUMMARY_BEAN_DEFINITION;
        this.beanDefinitionSearchEndpoint = endpoints.FIND_BEAN_DEFINITION;

        this.activeCharts = {
            scopeChart: null,
            roleChart: null,
            loadingModeChart: null
        };

        this.allBeans = [];
        this.beanDefinitionSummary = null;

        // Server-paginated data for current table view
        this.currentPageBeans = [];
        this.searchQuery = '';

        // API Pagination Metadata state
        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 20,
            isFirstPage: true,
            isLastPage: true
        };

        this.filterCriteria = {
            contextId: '',
            beanName: '',
            scope: '',
            role: '',
            isPrimary: '',
            isLazy: ''
        };

        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.sortColumn = '';
        this.sortDirection = 'asc';

        this.selectedBeanId = null;
        this.selectedBeanName = null;
        this.selectedContextId = null;
        this.activeSidebarTab = 'properties';

        this.modalGraphMode = 'tb';
        this.modalNodeTheme = localStorage.getItem('sl-node-theme') || 'tint';
        this.modalZoom = null;
        this.modalSvg = null;
        this.modalGraphRoot = null;
    }

    async enter(params) {
        try {
            this.bindEvents();

            // 1. Reset filter state to clean defaults
            this._resetFilterState();
            this.closeSidebar(true);

            const queryParams = QueryParam.parse(params);
            const targetBean = QueryParam.get(queryParams, 'search', 'beanName');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');
            const scope = queryParams.get('scope');
            const role = queryParams.get('role');

            if (targetBean) {
                this.searchQuery = targetBean;
                $('#bean-definition-search-input').val(targetBean);
            }
            if (targetContextId) {
                this.filterCriteria.contextId = targetContextId;
                $('#bean-definition-filter-context').val(targetContextId);
            }
            if (scope) {
                this.filterCriteria.scope = scope;
                $('#bean-definition-filter-scope').val(scope);
            }
            if (role) {
                this.filterCriteria.role = role;
                $('#bean-definition-filter-role').val(role);
            }

            await Promise.all([
                this.fetchSummaryData(this.beanDefinitionSummaryEndpoint),
                this.fetchTableData()
            ]);

            this._initSidebar();

            if (targetBean) {
                await this.selectBean(targetBean, targetContextId);
            }
        } catch (error) {
            console.error('Error entering BeanDefinitions view:', error);
        }
    }

    /**
     * Fetches summary distribution metrics from the summary API endpoint (/summary).
     */
    async fetchSummaryData(definitionSummaryApiUrl) {
        try {
            let beanSummary = await httpClient.get(definitionSummaryApiUrl);
            this.beanDefinitionSummary = beanSummary;
            this.refreshBeanSummaryStatistics(beanSummary);
            this.initializeScopeAndRoleDistributionCharts(beanSummary);
            this._populateContextDropdown(beanSummary);
            this._populateScopeDropdown(beanSummary);
        } catch (error) {
            console.error('Error fetching bean summary metrics:', error);
        }
    }

    /**
     * Computes and updates metrics cards (total counts, context distributions).
     */
    refreshBeanSummaryStatistics(beanSummaryData) {
        const { contextDistribution, totalBeanDefinitions } = beanSummaryData || {};
        this._updateTotalBeanCount(totalBeanDefinitions);
        this._updateContextDistribution(contextDistribution, totalBeanDefinitions);
    }

    _updateTotalBeanCount(totalBeanDefinitions) {
        $('#def-total-count').text(totalBeanDefinitions ?? 0);
    }

    _updateContextDistribution(contextDistribution, totalBeanDefinitions) {
        if (contextDistribution) {
            const $container = $('#def-context-list');
            $container.empty();
            const fragment = document.createDocumentFragment();

            Object.entries(contextDistribution).forEach(([contextId, count], index) => {
                const percentage = Math.round((count / totalBeanDefinitions) * 100);
                const colorClass = CONTEXT_THEME_COLORS[index % CONTEXT_THEME_COLORS.length];
                const clone = TemplateEngine.clone('tpl-context-list-item');
                if (clone) {
                    const $el = $(clone.firstElementChild);
                    $el.find('[data-field="contextId"]').text(contextId).attr('title', contextId);
                    $el.find('[data-field="bar"]').addClass(colorClass).css('width', `${percentage}%`);
                    $el.find('[data-field="pct"]').text(`${percentage}% (${count})`);
                    fragment.appendChild(clone);
                }
            });

            $container.append(fragment);
        }
    }

    initializeScopeAndRoleDistributionCharts(beanSummary) {
        this.destroyCharts();
        const { scopeDistribution, roleDistribution, loadingModeDistribution } = beanSummary;

        if (scopeDistribution) {
            this._createChartFromDistribution(
                'scopeChart',
                'scopeChart',
                '#def-scope-legend',
                scopeDistribution,
                key => capitalize(key),
                SCOPE_COLORS,
                '#a855f7'
            );
        }

        if (roleDistribution) {
            this._createChartFromDistribution(
                'roleChart',
                'roleChart',
                '#def-role-legend',
                roleDistribution,
                key => capitalize(key.replace(/^ROLE_/, '')),
                ROLE_COLORS,
                '#cbd5e1'
            );
        }

        if (loadingModeDistribution) {
            this._createChartFromDistribution(
                'loadingModeChart',
                'loadingModeChart',
                '#def-loading-mode-legend',
                loadingModeDistribution,
                key => capitalize(key),
                LOADING_MODE_COLORS,
                '#a855f7'
            );
        }
    }

    _createChartFromDistribution(chartKey, canvasId, legendContainerId, distributionObj, keyFormatter, colorMap, fallbackColor) {
        const itemFrequencies = {};
        let totalCount = 0;

        for (const [rawKey, count] of Object.entries(distributionObj)) {
            const formattedKey = keyFormatter(rawKey) || 'unknown';
            itemFrequencies[formattedKey] = (itemFrequencies[formattedKey] || 0) + count;
            totalCount += count;
        }

        const chartTitles = Object.keys(itemFrequencies);
        const chartData = Object.values(itemFrequencies);
        const segmentColors = chartTitles.map(label => colorMap[label] || fallbackColor);

        const $legend = $(legendContainerId);
        $legend.empty();
        const legendFragment = document.createDocumentFragment();

        chartTitles.forEach((label, index) => {
            const count = chartData[index];
            const pctStr = formatPercentage(count, totalCount);
            const color = segmentColors[index];
            const clone = TemplateEngine.clone('tpl-chart-legend-item');
            if (clone) {
                const $el = $(clone.firstElementChild);
                $el.find('[data-field="dot"]').css('background-color', color);
                $el.find('[data-field="label"]').text(`${label} (${count}) · ${pctStr}`).attr('title', label);
                legendFragment.appendChild(clone);
            }
        });

        $legend.append(legendFragment);

        this.activeCharts[chartKey] = this._instantiateDoughnutChart(
            canvasId,
            chartTitles,
            chartData,
            segmentColors
        );
    }

    _instantiateDoughnutChart(canvasId, labels, data, backgroundColor) {
        const canvasElement = document.getElementById(canvasId);
        if (!canvasElement) return null;

        const isDark = document.documentElement.classList.contains('dark');
        const total = data.reduce((sum, val) => sum + val, 0);

        return new Chart(canvasElement, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor,
                    borderWidth: 0,
                    borderRadius: 4,  // Sleek rounded arc ends
                    spacing: 2,       // Crisp gap separation between arcs
                    hoverOffset: 3
                }]
            },
            options: {
                cutout: '72%',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 700,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#334155',
                        borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.9)',
                        borderWidth: 1,
                        padding: 8,
                        boxPadding: 4,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        titleFont: { family: 'Inter, sans-serif', size: 11, weight: 'bold' },
                        bodyFont: { family: 'Inter, sans-serif', size: 11 },
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${context.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Fetches paginated bean definitions from backend API using active filters and pagination state.
     */
    async fetchTableData() {
        this._loadingBeanDefinitionTable();

        const queryParams = this._buildApiQueryParams();

        try {
            const beanData = await httpClient.getWithQuery(
                this.beanDefinitionEndpoint,
                queryParams.toString()
            );

            this._hasFetchedTableData = true;
            this._processPaginatedResponse(beanData);
            this._populateContextDropdown(this.beanDefinitionSummary);
            this._populateScopeDropdown(this.beanDefinitionSummary);
            this.renderTable();
            this.renderPagination();
            this.updateSortHeaderIcons();
        } catch (error) {
            console.error('Error fetching bean definitions table data:', error);
            this.renderTableError(error.message);
        }
    }

    _populateContextDropdown(beanSummary) {
        const $contextDropdown = $('#bean-definition-filter-context');
        if (!$contextDropdown.length || !beanSummary?.contextDistribution) return;

        const contextIds = Object.keys(beanSummary.contextDistribution);

        this._populateSelectDropdown(
            $contextDropdown,
            contextIds,
            'Context: All',
            contextId => contextId
        );
        $contextDropdown.val(this.filterCriteria.contextId);
    }

    _populateScopeDropdown(beanSummary) {
        const $scopeDropdown = $('#bean-definition-filter-scope');
        if (!$scopeDropdown.length || !beanSummary?.scopeDistribution) return;

        const scopes = Object.keys(beanSummary.scopeDistribution);

        this._populateSelectDropdown(
            $scopeDropdown,
            scopes,
            'Scope: All',
            scope => capitalize(scope)
        );
        $scopeDropdown.val(this.filterCriteria.scope);
    }

    _populateSelectDropdown($selectElement, optionsSet, defaultLabel, labelFormatter) {
        $selectElement.html(`<option value="">${defaultLabel}</option>`);
        Array.from(optionsSet).sort().forEach(value => {
            $selectElement.append(`<option value="${value}">${labelFormatter(value)}</option>`);
        });
    }

    _loadingBeanDefinitionTable() {
        const $tbody = $('#beanDefinitionTableBody');
        if (!$tbody.length) return;

        const clone = TemplateEngine.clone('tpl-bean-table-loading');
        if (clone) {
            $tbody.empty().append(clone);
        }
    }

    renderTableError(errorMessage) {
        const $tbody = $('#beanDefinitionTableBody');
        if ($tbody.length === 0) return;

        const clone = TemplateEngine.clone('tpl-bean-table-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(errorMessage);
            $tbody.empty().append(clone);
        }
    }

    _buildApiQueryParams() {
        return QueryParam.build({
            pageNumber: this.currentPage - 1,
            pageSize: this.itemsPerPage,
            search: this.searchQuery,
            contextId: this.filterCriteria.contextId,
            beanName: this.filterCriteria.beanName,
            scope: this.filterCriteria.scope,
            role: this.filterCriteria.role,
            primary: this.filterCriteria.primary,
            lazyInit: this.filterCriteria.lazyInit,
            sortBy: this.sortColumn || undefined,
            sortDir: this.sortColumn ? (this.sortDirection || 'asc').toUpperCase() : undefined
        });
    }


    _processPaginatedResponse(responseData) {
        const isPaginatedPayload = Array.isArray(responseData?.content);

        if (isPaginatedPayload) {
            this._applyPaginatedPayload(responseData);
        } else {
            this._resetPaginationState();
        }

        this.currentPage = this.paginationState.pageNumber + 1;
        this.itemsPerPage = this.paginationState.pageSize;
    }

    _applyPaginatedPayload(responseData) {
        const { content, totalElements, totalPages, pageNumber, pageSize, first, last } = responseData;
        const computedTotalPages = totalPages ?? 1;
        const computedPageNumber = pageNumber ?? 0;

        this.currentPageBeans = content || [];
        beanDataStore.addBeans(this.currentPageBeans);

        this.paginationState = {
            totalElements: totalElements ?? this.currentPageBeans.length,
            totalPages: computedTotalPages,
            pageNumber: computedPageNumber,
            pageSize: pageSize ?? this.itemsPerPage,
            isFirstPage: first ?? (computedPageNumber === 0),
            isLastPage: last ?? (computedPageNumber >= computedTotalPages - 1)
        };
    }

    _resetPaginationState() {
        this.currentPageBeans = [];
        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: this.itemsPerPage,
            isFirstPage: true,
            isLastPage: true
        };
    }

    /**
     * Renders the bean definitions list table for the current page.
     */
    renderTable() {
        const $tbody = $('#beanDefinitionTableBody');
        if (!$tbody.length) return;

        $tbody.empty();

        if (!this.currentPageBeans.length) {
            const emptyClone = TemplateEngine.clone('tpl-bean-table-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();
        this.currentPageBeans.forEach(bean => {
            const rowNode = this._createBeanRowNode(bean);
            if (rowNode) fragment.appendChild(rowNode);
        });

        $tbody.append(fragment);
    }

    _initSidebar() {
        const $sidebar = $('#def-details-sidebar');
        if ($sidebar.length && !$sidebar.children().length) {
            $sidebar.empty();
            const clone = TemplateEngine.clone('tpl-bean-details-sidebar');
            if (clone) {
                const footerClone = TemplateEngine.clone('tpl-bean-details-sidebar-footer');
                if (footerClone) {
                    $(clone).find('#sidebar-footer-container').replaceWith(footerClone);
                }
                $sidebar.append(clone);
            }
        }
    }

    _createBeanRowNode(beanInformation) {
        const { beanName, role, scope, type, primary, lazyInit, contextId } = beanInformation;
        const uniqueBeanId = this._generateBeanUniqueId(contextId, beanName);
        const isSelected = this.selectedBeanId === uniqueBeanId;

        const clone = TemplateEngine.clone('tpl-bean-definition-row');
        if (!clone) return null;

        const $row = $(clone.firstElementChild);
        if (isSelected) {
            $row.addClass(CSS_CLASSES.defRowActive);
        }

        const rowAttributes = {
            'data-bean-id': uniqueBeanId,
            'data-bean-name': beanName,
            'data-context-id': contextId || ''
        };
        $row.attr(rowAttributes);
        $row.find('[data-field="view-btn"]').attr(rowAttributes);

        // Metadata & Text Values
        const { icon, color } = resolveBeanMetadata(beanInformation);
        $row.find('[data-field="icon"]').css('color', color).text(icon);
        $row.find('[data-field="name"]').text(beanName).attr('title', beanName);

        // Category Subtitle
        const layer = resolveBeanLayer(beanInformation);
        const categoryLabel = layer?.label && layer.label !== 'Other' ? layer.label : 'Component';
        $row.find('[data-field="category"]').text(categoryLabel);

        // Dependencies & Dependents Counts
        const deps = Array.isArray(beanInformation.dependencies) ? beanInformation.dependencies : [];
        const dependents = Array.isArray(beanInformation.dependents) ? beanInformation.dependents : [];
        const depCountStr = `${deps.length} ${deps.length === 1 ? 'dep' : 'deps'}`;
        const usedByStr = `${dependents.length} used by`;
        $row.find('[data-field="depCount"]').text(depCountStr).parent().attr('title', `${deps.length} dependencies (Depends on)`);
        $row.find('[data-field="usedByCount"]').text(usedByStr).parent().attr('title', `${dependents.length} dependents (Used by)`);

        // Package Name Subtitle
        const pkg = type && type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : '';
        $row.find('[data-field="packageName"]').text(pkg || 'default package').attr('title', pkg || '');

        // Type
        const shortType = type && type.includes('.') ? type.substring(type.lastIndexOf('.') + 1) : (type || '-');
        $row.find('[data-field="type"]').text(shortType).attr('title', type || '');

        // Role Badge Styling
        const rawRole = (role ? role.replace(/^ROLE_/, '') : 'APPLICATION').toUpperCase();
        const $roleEl = $row.find('[data-field="role"]').text(rawRole);
        if (rawRole === 'INFRASTRUCTURE') {
            $roleEl.addClass('bg-gradient-to-r from-rose-500/20 via-pink-500/15 to-red-500/15 text-rose-900 dark:text-rose-200 border-rose-300/80 dark:border-rose-500/40');
        } else if (rawRole === 'SUPPORT') {
            $roleEl.addClass('bg-gradient-to-r from-teal-500/20 via-emerald-500/15 to-cyan-500/15 text-teal-900 dark:text-teal-200 border-teal-300/80 dark:border-teal-500/40');
        } else {
            $roleEl.addClass('bg-gradient-to-r from-blue-500/20 via-indigo-500/15 to-sky-500/15 text-blue-900 dark:text-blue-200 border-blue-300/80 dark:border-blue-500/40');
        }

        // Context
        $row.find('[data-field="context"]').text(contextId || '-').attr('title', contextId || '');

        // Scope Styling
        const rawScope = (scope ? scope : 'SINGLETON').toUpperCase();
        $row.find('[data-field="scope"]')
            .text(rawScope)
            .addClass(resolveScopeBadgeClass(scope));

        // 1. Inline Traits Micro-Badges (Beside Bean Name)
        const $inlineTraits = $row.find('[data-field="inlineTraits"]').empty();
        if (primary) {
            $inlineTraits.append(TemplateEngine.clone('tpl-trait-micro-primary'));
        }
        if (lazyInit) {
            $inlineTraits.append(TemplateEngine.clone('tpl-trait-micro-lazy'));
        }

        // 2. Traits Column Badges
        const $traitsContainer = $row.find('[data-field="traitsContainer"]').empty();
        if (lazyInit) {
            $traitsContainer.append(TemplateEngine.clone('tpl-trait-badge-lazy'));
        } else {
            $traitsContainer.append(TemplateEngine.clone('tpl-trait-badge-eager'));
        }

        return clone;
    }

    _generateBeanUniqueId(contextIdOrBean, beanName) {
        return `${contextIdOrBean}:${beanName}`;
    }

    renderPagination() {
        const { totalElements, pageNumber, pageSize } = this.paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'beans');
        $('#bean-definition-pagination-info').text(infoText);

        Pagination.renderPaginationButtons($('#bean-definition-pagination-buttons'), this.paginationState);
    }

    updateSortHeaderIcons() {
        $('.sort-icon').text('unfold_more').removeClass('text-primary font-bold');
        if (this.sortColumn) {
            const $sortIcon = $(`.sort-icon[data-col="${this.sortColumn}"]`);
            if ($sortIcon.length > 0) {
                const iconName = this.sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward';
                $sortIcon.text(iconName).addClass('text-primary font-bold');
            }
        }
    }

    /**
     * Binds all UI interactivity handlers using centralized event delegation.
     */
    bindEvents() {
        this._bindSearchInput();
        this._bindFilterChangeEvents();
        this._bindTableSorting();
        this._bindClickActionDelegation();
        this.bindModalControls();
    }

    _bindTableSorting() {
        this._on(document, 'click', '.th-sortable, th[data-sort]', (e) => {
            e.preventDefault();
            this._handleSortColumn($(e.currentTarget));
        });
    }

    _on(target, event, delegateOrHandler, maybeHandler) {
        const namespace = '.beanDefs';
        const namespacedEvent = `${event}${namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }
    }

    _bindSearchInput() {
        if (!this._debouncedFetchTableData) {
            this._debouncedFetchTableData = debounce(() => this.fetchTableData(), 200);
        }

        this._on('#bean-definition-search-input', 'input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.currentPage = 1;
            this._debouncedFetchTableData();
        });

        this._on('#bean-definition-search-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedFetchTableData.flush();
            } else if (e.key === 'Escape') {
                this._debouncedFetchTableData.cancel();
                this.searchQuery = '';
                $('#bean-definition-search-input').val('');
                this.currentPage = 1;
                this.fetchTableData();
            }
        });
    }

    _bindFilterChangeEvents() {
        const filterKeyMap = {
            '#bean-definition-filter-context': 'contextId',
            '#bean-definition-filter-scope': 'scope',
            '#bean-definition-filter-role': 'role',
            '#bean-definition-filter-primary': 'primary',
            '#bean-definition-filter-lazy': 'lazyInit'
        };

        const filterSelectors = Object.keys(filterKeyMap).join(', ');
        this._on(filterSelectors, 'change', (e) => {
            const key = filterKeyMap[`#${e.target.id}`];
            if (key) {
                this.filterCriteria[key] = e.target.value;
                this.currentPage = 1;
                this.fetchTableData();
            }
        });

        this._on('#bean-definition-filter-size', 'change', (e) => {
            this.itemsPerPage = parseInt(e.target.value, 10) || 20;
            this.currentPage = 1;
            this.fetchTableData();
        });
    }

    /**
     * Centralized click router using data-action attributes and element classes.
     */
    _bindClickActionDelegation() {
        this._actionHandlers = {
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage(),
            'view-graph': () => this._handleViewGraph(),
            'switch-tab': ($target) => this._handleSwitchTab($target),
            'select-bean': ($target) => this._handleSelectBean($target),
            'sort-column': ($target) => this._handleSortColumn($target),
            'export-data': () => this._downloadReport(),
            'change-page': ($target) => this._handleChangePage($target),
            'refresh-data': ($target) => this._handleRefreshData($target),
            'close-sidebar': () => this.closeSidebar(),
            'reset-filters': () => this._handleResetFilters(),
            'close-graph-modal': () => this.closeGraphModal(),
            'select-dependency': ($target) => this._handleSelectDependency($target),
        };

        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action');
            const handler = this._actionHandlers[action];

            if (handler) {
                e.preventDefault();
                handler($target);
            }
        });
    }

    async _handleRefreshData($target) {
        const $icon = $target.find('.material-symbols-outlined');
        $icon.addClass('animate-spin');
        try {
            await this.enter();
        } catch (err) {
            console.error('Error refreshing bean definitions:', err);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    _handleResetFilters() {
        this._resetFilterState();
        this.sortColumn = '';
        this.sortDirection = 'asc';
        this.fetchTableData();
    }

    _handleSortColumn($target) {
        const columnKey = $target.data('sort') || $target.attr('data-sort');
        if (!columnKey) return;

        this.sortDirection = (this.sortColumn === columnKey && this.sortDirection === 'asc') ? 'desc' : 'asc';
        this.sortColumn = columnKey;
        this.currentPage = 1;
        this.fetchTableData();
    }

    async _handleSelectBean($target) {
        const beanName = $target.data('bean-name');
        const contextId = $target.data('context-id');
        if (beanName) {
            const success = await this.selectBean(beanName, contextId);
            if (!success) {
                ToastNotification.show({
                    title: 'Bean Not Found',
                    message: `Bean definition for <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${beanName}</strong> could not be loaded or is not registered in the application context.`,
                    type: 'warning',
                    duration: 4000
                });
            }
        }
    }

    async _handleSelectDependency($target) {
        const dependencyName = $target.data('fullname') || $target.find('[data-field="name"]').text().trim();
        const contextId = $target.data('context-id') || this.selectedContextId;
        if (!dependencyName) return;

        const success = await this.selectBean(dependencyName, contextId);
        if (!success) {
            ToastNotification.show({
                title: 'Dependency Not Found',
                message: `The bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${dependencyName}</strong> is referenced as a dependency, but its definition is not registered or not found in the application context.`,
                type: 'warning',
                duration: 4500
            });
        }
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!isNaN(targetPage) && targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.fetchTableData();
        }
    }

    _handlePrevPage() {
        if (!this.paginationState.isFirstPage && this.paginationState.pageNumber > 0) {
            this.currentPage = this.paginationState.pageNumber;
            this.fetchTableData();
        }
    }

    _handleNextPage() {
        if (!this.paginationState.isLastPage && this.paginationState.pageNumber < (this.paginationState.totalPages - 1)) {
            this.currentPage = this.paginationState.pageNumber + 2;
            this.fetchTableData();
        }
    }

    _handleSwitchTab($target) {
        this.activeSidebarTab = $target.data('tab');
        this.renderActiveTab();
    }

    _handleViewGraph() {
        if (this.selectedBeanName) {
            this.openGraphModal();
        }
    }

    async selectBean(beanName, contextId = null) {
        if (!beanName) return false;

        const targetContextId = contextId || this.selectedContextId || '';
        const beanId = this._generateBeanUniqueId(targetContextId, beanName);
        let targetBean = this._getBeanByIdFromCache(beanId) || this._getBeanByNameFromCache(beanName, targetContextId);

        // Fetch from backend API if not already cached in memory
        if (!targetBean) {
            try {
                const queryParams = QueryParam.build({ contextId: targetContextId, beanName }).toString();
                const fetched = await httpClient.getWithQuery(this.beanDefinitionSearchEndpoint, queryParams);

                if (fetched) {
                    beanDataStore.addBeans([fetched]);
                    targetBean = fetched;
                }
            } catch (err) {
                console.warn('Failed to fetch bean definition details:', beanName, err);
            }
        }

        if (!targetBean) return false;

        const resolvedContextId = targetBean.contextId || targetContextId;
        this.selectedBeanId = this._generateBeanUniqueId(resolvedContextId, targetBean.beanName);
        this.selectedBeanName = targetBean.beanName;
        this.selectedContextId = resolvedContextId;

        this._updateRowSelectionStyles(this.selectedBeanId);
        this.openSidebar();
        this._populateSidebarDetails(targetBean);
        this._populateSidebarLists(targetBean);
        this.renderActiveTab();
        return true;
    }

    _updateRowSelectionStyles(activeBeanId) {
        $('.bean-row').each((_, element) => {
            const $row = $(element);
            const rowBeanId = $row.attr('data-bean-id');
            const isSelected = rowBeanId === activeBeanId;
            $row.toggleClass(CSS_CLASSES.defRowActive, isSelected);
        });
    }

    _getBeanByIdFromCache(beanId) {
        return this.currentPageBeans?.find(bean => this._generateBeanUniqueId(bean) === beanId)
            ?? beanDataStore.findBeanById(beanId)
            ?? this.allBeans?.find(bean => this._generateBeanUniqueId(bean) === beanId);
    }

    _getBeanByNameFromCache(beanName, contextId = null) {
        return beanDataStore.findBeanByName(beanName, contextId)
            ?? this.currentPageBeans?.find(bean => bean.beanName === beanName)
            ?? this.allBeans?.find(bean => bean.beanName === beanName);
    }

    _populateSidebarDetails(beanInformation) {
        Sidebar.populateDetails(beanInformation);
        Sidebar.updateSidebarIcon(beanInformation);
    }

    _populateSidebarLists(bean) {
        const { dependencies = [], dependents = [], contextId = '' } = bean;

        $('#detail-deps-count').text(dependencies.length);
        $('#detail-dependents-count').text(dependents.length);

        Sidebar.renderDependencyList($('#detail-deps-list'), dependencies, {
            contextId,
            action: 'select-dependency'
        });
        Sidebar.renderDependencyList($('#detail-dependents-list'), dependents, {
            contextId,
            action: 'select-dependency'
        });
    }

    /**
     * Refreshes the active tab button style and toggles visible tab pane.
     */
    renderActiveTab() {
        Sidebar.switchTab(this.activeSidebarTab);
    }

    _resetFilterState() {
        this.searchQuery = '';
        this.filterCriteria = {
            contextId: '',
            scope: '',
            role: '',
            isPrimary: '',
            isLazy: '',
            beanName: ''
        };
        this.itemsPerPage = 20;
        this.currentPage = 1;
        this.sortColumn = '';
        this.sortDirection = 'asc';

        $('#bean-definition-search-input').val('');
        $('#bean-definition-filter-context').val('');
        $('#bean-definition-filter-scope').val('');
        $('#bean-definition-filter-role').val('');
        $('#bean-definition-filter-primary').val('');
        $('#bean-definition-filter-lazy').val('');
        $('#bean-definition-filter-size').val('20');
    }

    /**
     * Destroys existing charts to avoid memory leaks or canvas drawing conflicts.
     */
    destroyCharts() {
        for (const [key, chartInstance] of Object.entries(this.activeCharts)) {
            if (chartInstance) {
                chartInstance.destroy();
                this.activeCharts[key] = null;
            }
        }
    }

    async openGraphModal() {
        const $beanGraphModalContainer = $("#bean-dependency-graph-modal");
        const $beanNameModalGraphContainer = $('#modal-graph-bean-name');
        const $modalCard = $('#modal-graph-card');

        if (!this.selectedBeanName) return;

        let targetBean = this._getBeanByIdFromCache(this.selectedBeanId) || this._getBeanByNameFromCache(this.selectedBeanName, this.selectedContextId);
        if (!targetBean && this.selectedBeanName) {
            try {
                const queryParams = QueryParam.build({ contextId: this.selectedContextId, beanName: this.selectedBeanName }).toString();
                const fetched = await httpClient.getWithQuery(this.beanDefinitionSearchEndpoint, queryParams);
                if (fetched) {
                    beanDataStore.addBeans([fetched]);
                    targetBean = fetched;
                }
            } catch (e) {
                console.warn('Failed to fetch missing target bean:', e);
            }
        }
        if (!targetBean) return;

        $beanNameModalGraphContainer.text(targetBean.beanName).attr('title', targetBean.beanName);
        $beanGraphModalContainer.removeClass('hidden');

        // Sync node theme button state
        this.setModalNodeTheme(this.modalNodeTheme, false);

        requestAnimationFrame(() => {
            $beanGraphModalContainer.removeClass('opacity-0 pointer-events-none').addClass('opacity-100');
            $modalCard.removeClass('scale-95 opacity-0').addClass('scale-100 opacity-100');
        });

        this._bindGraphModalDismissEvents($beanGraphModalContainer);

        // Ensure child dependencies and dependents details (type, scope, role) are loaded into beanDataStore
        const ctxId = targetBean.contextId || this.selectedContextId || '';
        const relatedNames = [...(targetBean.dependencies || []), ...(targetBean.dependents || [])];
        const missingNames = relatedNames.filter(name => !this._getBeanByNameFromCache(name, ctxId));
        if (missingNames.length > 0) {
            try {
                const fetchPromises = missingNames.map(name => {
                    const query = QueryParam.build({ contextId: ctxId, beanName: name });
                    return httpClient.getWithQuery(this.beanDefinitionSearchEndpoint, query.toString());
                });

                const results = await Promise.allSettled(fetchPromises);

                const fetchedBeans = results.flatMap(r =>
                    (r.status === 'fulfilled' && r.value) ? [r.value] : []
                );

                if (fetchedBeans.length) {
                    beanDataStore.addBeans(fetchedBeans);
                }
            } catch (error) {
                console.warn('Failed to pre-fetch related bean details:', error);
            }
        }

        this.renderModalGraph(targetBean);
    }

    _bindGraphModalDismissEvents($container) {
        this._on(document, 'keydown', (e) => {
            if (e.key === 'Escape') this.closeGraphModal();
        });

        this._on($container, 'click', (e) => {
            if (e.target.id === 'bean-dependency-graph-modal' || e.target.id === 'def-graph-modal') {
                this.closeGraphModal();
            }
        });
    }

    closeGraphModal() {
        const $beanGraphModalContainer = $("#bean-dependency-graph-modal");
        const $modalCard = $('#modal-graph-card');

        $beanGraphModalContainer.removeClass('opacity-100').addClass('opacity-0 pointer-events-none');
        $modalCard.removeClass('scale-100 opacity-100').addClass('scale-95 opacity-0');

        $(document).off('keydown.graphModal');
        const $tip = $('#tip');
        if ($tip.length > 0) $tip.removeClass('show');

        setTimeout(() => {
            $beanGraphModalContainer.addClass('hidden');
        }, 250);
    }

    _buildModalGraphHierarchy(targetBean) {
        return GraphTreeBuilder.buildModalGraphHierarchy(
            targetBean,
            (depName, ctxId) => this._getBeanByNameFromCache(depName, ctxId)
        );
    }

    renderModalGraph(targetBean) {
        const svg = d3.select('#modal-tree-svg');
        if (!svg.node()) return;

        svg.selectAll('*').remove();

        svg.append('defs')
            .append('marker')
            .attr('id', 'modal-dot')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 9)
            .attr('refY', 5)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', 10)
            .attr('markerHeight', 10)
            .attr('orient', 'auto')
            .append('circle')
            .attr('cx', 5)
            .attr('cy', 5)
            .attr('r', 4)
            .attr('fill', '#94a3b8');

        const gMain = svg.append('g').attr('id', 'modal-g-main');
        const gLink = gMain.append('g').attr('class', 'links');
        const gNode = gMain.append('g').attr('class', 'nodes');

        const zoom = d3.zoom()
            .scaleExtent(ZOOM_SCALE_EXTENT || [0.05, 4])
            .on('zoom', ({ transform }) => gMain.attr('transform', transform));

        svg.call(zoom);
        this.modalZoom = zoom;
        this.modalSvg = svg;

        const rawData = this._buildModalGraphHierarchy(targetBean);
        const root = d3.hierarchy(rawData);

        this.modalGraphRoot = root;
        this.modalGraphMode = this.modalGraphMode || 'tb';

        this._drawModalTree(root, gNode, gLink, svg, zoom);
    }

    _drawModalTree(root, gNode, gLink, svg, zoom) {
        if (!gNode || !gLink) return;
        gNode.selectAll('*').remove();
        gLink.selectAll('*').remove();

        const isTB = this.modalGraphMode === 'tb';
        const descendants = root.descendants();

        descendants.forEach((node, i) => {
            node.id = i;
            const nameLen = node.data.name?.length || 0;
            node.width = Math.max(180, nameLen * 7.8 + 64);
        });

        const maxWidth = d3.max(descendants, d => d.width) || NW;
        tree.nodeSize(isTB ? [maxWidth + GAP_X, NH + GAP_Y] : [NH + 36, maxWidth + GAP_Y]);
        tree(root);

        const isDark = document.documentElement.classList.contains('dark');
        const isBadge = (this.modalNodeTheme === 'badge');

        const getModalNodeStyle = (node) => {
            const kind = node?.data?.meta?.kind || 'default';
            const mode = isDark ? 'dark' : 'light';
            const themeMap = (isBadge ? GRAPH_NODE_THEMES_BADGE : GRAPH_NODE_THEMES_TINT) || GRAPH_NODE_THEMES;

            const modeMap = themeMap?.[mode] || (isDark ? GRAPH_NODE_THEMES_TINT.dark : GRAPH_NODE_THEMES_TINT.light);
            return modeMap[kind] || modeMap.default || { fill: '#eff6ff', stroke: '#3b82f6', icon: '#2563eb', text: '#1d4ed8' };
        };

        const linkFn = isTB ? tbLink : lrLink;
        gLink.selectAll('path.link')
            .data(root.links(), d => d.target.id)
            .join('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', isDark ? '#334155' : '#cbd5e1')
            .attr('stroke-width', 1.6)
            .attr('marker-end', 'url(#modal-dot)')
            .attr('d', linkFn);

        const getNodePos = ({ x, y }) => isTB ? `translate(${x},${y})` : `translate(${y},${x})`;

        const nodes = gNode.selectAll('g.node')
            .data(descendants, d => d.id)
            .join('g')
            .attr('class', 'node')
            .attr('cursor', 'pointer')
            .attr('transform', getNodePos);

        nodes.append('rect')
            .attr('class', 'node-rect')
            .attr('x', d => -d.width / 2)
            .attr('y', -NH / 2)
            .attr('width', d => d.width)
            .attr('height', NH)
            .attr('rx', RX)
            .attr('fill', d => getModalNodeStyle(d).fill)
            .attr('stroke', d => getModalNodeStyle(d).stroke)
            .attr('stroke-width', d => d.data.meta?.kind === 'target' ? 2.5 : 2);

        nodes.append('rect')
            .attr('class', 'node-icon-bg')
            .style('display', isBadge ? 'block' : 'none')
            .attr('x', d => -d.width / 2 + 8)
            .attr('y', -14)
            .attr('width', 28)
            .attr('height', 28)
            .attr('rx', 8)
            .attr('fill', d => getModalNodeStyle(d).iconBg ?? 'rgba(0,0,0,0.05)');

        nodes.append('g')
            .attr('class', 'node-icon')
            .attr('transform', d => isBadge
                ? `translate(${-d.width / 2 + 12}, -10)`
                : `translate(${-d.width / 2 + 14}, -10)`)
            .append('path')
            .attr('d', ICON)
            .attr('stroke', d => getModalNodeStyle(d).icon)
            .attr('stroke-width', 1.8)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('fill', 'none');

        nodes.append('text')
            .attr('class', 'node-text')
            .attr('x', d => isBadge ? -d.width / 2 + 44 : -d.width / 2 + 42)
            .attr('y', 1)
            .attr('dy', '0.35em')
            .attr('font-size', 13)
            .attr('font-weight', 600)
            .attr('font-family', 'Inter, -apple-system, sans-serif')
            .attr('fill', d => getModalNodeStyle(d).text)
            .text(d => d.data.name);

        const $tip = $('#tip');
        if (!$tip.length) {
            const clone = TemplateEngine.clone('tpl-tooltip');
            if (clone) $('body').append(clone);
        }

        nodes
            .on('click', async (event, node) => {
                event.stopPropagation();
                if (node.data.fullName && node.data.fullName !== this.selectedBeanName) {
                    const success = await this.selectBean(node.data.fullName);
                    if (success) {
                        await this.openGraphModal();
                    } else {
                        ToastNotification.show({
                            title: 'Bean Definition Not Found',
                            message: `Bean definition for <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${node.data.fullName}</strong> is unavailable or not registered.`,
                            type: 'warning',
                            duration: 4000
                        });
                    }
                }
            })
            .on('mouseenter', (event, node) => {
                const { name, fullName, meta = {} } = node.data;
                const { type, scope, role, kind } = meta;

                const shortType = (type && type !== 'N/A')
                    ? (type.includes('.') ? type.slice(type.lastIndexOf('.') + 1) : type)
                    : (type || 'N/A');
                const typeLabel = `Type: ${shortType}`;

                const cleanRole = (role && role !== 'N/A') ? role.replace(/^ROLE_/, '') : '';
                const displayScope = (scope && scope !== 'N/A') ? scope : 'N/A';
                const scopeLabel = `Scope: ${displayScope}${cleanRole ? ` · ${cleanRole}` : ''}`;
                const kindLabel = kind ? `Role in view: ${kind.toUpperCase()}` : '';

                $('#tip-name').text(fullName || name);
                $('#tip-type').text(typeLabel);
                $('#tip-scope').text(scopeLabel);
                $('#tip-meta').text(kindLabel);
                $tip.addClass('show').css({ left: event.pageX + 14, top: event.pageY + 16 });
            })
            .on('mousemove', (event) => $tip.css({ left: event.pageX + 14, top: event.pageY + 16 }))
            .on('mouseleave', () => $tip.removeClass('show'));

        setTimeout(() => this.fitModalView(), 50);
    }

    fitModalView() {
        if (!this.modalSvg || !this.modalZoom || !this.modalGraphRoot) return;
        const svgNode = this.modalSvg.node();
        if (!svgNode || !svgNode.isConnected) return;

        const container = $('#modal-graph-container');
        const width = container.width() || 800;
        const height = container.height() || 500;

        const nodes = this.modalGraphRoot.descendants();
        if (!nodes || nodes.length === 0) return;
        const isTB = this.modalGraphMode === 'tb';

        const minX = d3.min(nodes, d => isTB ? d.x - (d.width || 180) / 2 : d.y - (d.width || 180) / 2) ?? 0;
        const maxX = d3.max(nodes, d => isTB ? d.x + (d.width || 180) / 2 : d.y + (d.width || 180) / 2) ?? 800;
        const minY = d3.min(nodes, d => isTB ? d.y - NH / 2 : d.x - NH / 2) ?? 0;
        const maxY = d3.max(nodes, d => isTB ? d.y + NH / 2 : d.x + NH / 2) ?? 500;

        const graphWidth = maxX - minX || 1;
        const graphHeight = maxY - minY || 1;

        let scale = Math.min(0.9, Math.min(width / graphWidth, height / graphHeight));
        if (isNaN(scale) || !isFinite(scale) || scale <= 0) scale = 1;

        const translateX = width / 2 - ((minX + maxX) / 2) * scale;
        const translateY = height / 2 - ((minY + maxY) / 2) * scale;

        if (isNaN(translateX) || isNaN(translateY) || !isFinite(translateX) || !isFinite(translateY)) return;

        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
        this.modalSvg.transition().duration(400).call(this.modalZoom.transform, transform);
    }

    bindModalControls() {
        const actions = {
            '#modal-btn-tb': () => this.setGraphMode('tb'),
            '#modal-btn-lr': () => this.setGraphMode('lr'),
            '#modal-btn-theme-tint': () => this.setModalNodeTheme('tint'),
            '#modal-btn-theme-badge': () => this.setModalNodeTheme('badge'),
            '#modal-btn-zoom-in': () => this.zoomModal(1.25),
            '#modal-btn-zoom-out': () => this.zoomModal(0.8),
            '#modal-btn-reset, #modal-btn-fit': () => this.fitModalView(),
        };

        Object.entries(actions).forEach(([selector, handler]) => {
            this._on(selector, 'click', handler);
        });
    }

    setGraphMode(mode) {
        if (this.modalGraphMode === mode) return;
        this.modalGraphMode = mode;

        const isTb = mode === 'tb';
        const activeClasses = 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white shadow-xs font-bold';
        const inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium';

        $('#modal-btn-tb')
            .toggleClass(activeClasses, isTb)
            .toggleClass(inactiveClasses, !isTb);

        $('#modal-btn-lr')
            .toggleClass(activeClasses, !isTb)
            .toggleClass(inactiveClasses, isTb);

        if (this.modalGraphRoot && this.modalSvg) {
            this._drawModalTree(
                this.modalGraphRoot,
                this.modalSvg.select('g.nodes'),
                this.modalSvg.select('g.links'),
                this.modalSvg,
                this.modalZoom
            );
        }
    }

    setModalNodeTheme(theme, shouldUpdate = true) {
        this.modalNodeTheme = theme;
        localStorage.setItem('sl-node-theme', theme);

        const isTint = theme === 'tint';
        const activeClasses = 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white shadow-xs font-bold';
        const inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium';

        $('#modal-btn-theme-tint')
            .toggleClass(activeClasses, isTint)
            .toggleClass(inactiveClasses, !isTint);

        $('#modal-btn-theme-badge')
            .toggleClass(activeClasses, !isTint)
            .toggleClass(inactiveClasses, isTint);

        if (shouldUpdate && this.modalGraphRoot && this.modalSvg) {
            this._drawModalTree(
                this.modalGraphRoot,
                this.modalSvg.select('g.nodes'),
                this.modalSvg.select('g.links'),
                this.modalSvg,
                this.modalZoom
            );
        }
    }

    zoomModal(scaleFactor) {
        if (this.modalSvg && this.modalZoom) {
            this.modalSvg.transition().duration(300).call(this.modalZoom.scaleBy, scaleFactor);
        }
    }

    openSidebar() {
        const $sidebar = $('#def-details-sidebar');
        if (!$sidebar.length) return;
        this._initSidebar();
        $sidebar.removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0')
            .addClass('w-[380px] max-w-[380px] opacity-100 mr-0 border');
    }

    closeSidebar(immediate = false) {
        const $sidebar = $('#def-details-sidebar');
        this.selectedBeanId = null;
        this.selectedBeanName = null;
        this.selectedContextId = null;
        $('.bean-row').removeClass(CSS_CLASSES.defRowActive);

        if (!$sidebar.length) return;

        $sidebar.removeClass('w-[380px] max-w-[380px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0');
    }

    _downloadReport() {
        const reportData = {
            title: 'SpringLens Bean Definitions Report',
            timestamp: new Date().toISOString(),
            totalElements: this.paginationState.totalElements || this.currentPageBeans.length,
            summary: this.beanDefinitionSummary,
            definitions: this.currentPageBeans
        };

        downloadJson(`spring-lens-definitions-${Date.now()}.json`, reportData);
    }

    /**
     * Cleans up resources (charts, timers) when transitioning away from the view.
     */
    leave() {
        this.destroyCharts();
        this.closeGraphModal();
        this.closeSidebar(true);
        this._resetFilterState();
        this._debouncedFetchTableData?.cancel();
    }
}