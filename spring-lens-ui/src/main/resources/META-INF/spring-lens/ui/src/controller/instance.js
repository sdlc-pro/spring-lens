import httpClient from '../helper/http-client.js';
import beanDataStore from '../helper/bean-data-store.js';
import GraphTreeBuilder from '../helper/graph-tree-builder.js';
import {
    ALL_ADVICE_FROZEN_CLASSES,
    ALL_DEFINITION_STATUS_CLASSES,
    ALL_PROXY_PILL_CLASSES,
    ALL_PROXY_TAB_CLASSES,
    ALL_TAB_BUTTON_CLASSES,
    calculateTimeTicks,
    capitalize,
    debounce,
    downloadJson,
    formatDuration,
    formatDateTime,
    Pagination,
    QueryParam,
    resolveAdviceFrozenClass,
    resolveBeanLayer,
    resolveBeanMetadata,
    resolveDefinitionStatusBadgeClass,
    resolveDurationColor,
    resolveProxyBadgeStyles,
    resolveScopeBadgeClass,
    resolveTabButtonClass,
    TemplateEngine
} from '../helper/index.js';

export default class Instance {
    constructor(endpoints = {}) {
        this.instances = [];
        this.filteredInstances = [];
        this.selectedBeanInstance = null;

        this.currentPage = 1;
        this.pageSize = 20;
        this.searchQuery = '';
        this.minDurationMs = 0;
        this.quickFilter = 'all'; // 'all', 'bottlenecks', 'slow', 'fast'
        this.sortBy = 'createdAt';
        this.sortDir = 'ASC';
        this.activeView = 'instance'; // 'instance' or 'table'
        this.activeSidebarTab = 'telemetry'; // 'telemetry' or 'proxy'
        this.zoomLevel = 1;

        const savedThreshold = parseInt(localStorage.getItem('sl-bottleneck-threshold-nanos'), 10);
        this.bottleneckThresholdNanos = Number.isFinite(savedThreshold) && savedThreshold > 0 ? savedThreshold : 500000;

        this.selectedBeanName = null;
        this.selectedContextId = null;

        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 20,
            isFirstPage: true,
            isLastPage: true
        };

        this.maxTimeMs = 100;
        this.instanceSummary = null;

        this._debouncedSearch = debounce(() => this._resetPageAndFetch(), 250);

        this.beanInstanceApi = endpoints.BEAN_INSTANCE;
        this.beanInstanceFindApi = endpoints.FIND_BEAN_INSTANCE;
        this.beanInstanceSummaryApi = endpoints.SUMMARY_BEAN_INSTANCE;
        this.beanInstanceProxyApi = endpoints.PROXY_BEAN_INSTANCE;
    }

    async enter(params) {
        try {
            this._resetFilterState();
            this._handleCloseSidebar(true);

            const queryParams = QueryParam.parse(params);
            const targetBean = QueryParam.get(queryParams, 'search', 'bean');
            const targetContextId = QueryParam.get(queryParams, 'contextId', 'context');

            if (targetBean) {
                this.searchQuery = targetBean;
                $('#time-search-input').val(targetBean);
                $('#time-search-clear').removeClass('hidden');
            }

            this.initEvents();
            await Promise.all([
                this.fetchSummaryData(),
                this.fetchInstanceData()
            ]);

            if (targetBean && this.instances && this.instances.length > 0) {
                const match = this.instances.find(i => i.beanName === targetBean) || this.instances[0];
                if (match) {
                    await this.selectBean(targetContextId || match.contextId, match.beanName);
                }
            }
        } catch (error) {
            console.error('Error in Instance enter:', error);
        }
    }

    /**
     * Fetches application-wide bean instance summary metrics directly from endpoint.
     */
    async fetchSummaryData() {
        if (!this.beanInstanceSummaryApi) return;
        try {
            const summaryData = await httpClient.get(this.beanInstanceSummaryApi);
            this.instanceSummary = summaryData;
            this.renderKpiSummary(summaryData);
        } catch (error) {
            console.error('Error fetching bean instance summary:', error);
        }
    }

    /**
     * Renders KPI metrics from backend summary endpoint without calculating locally.
     */
    renderKpiSummary(summaryData) {
        if (!summaryData) return;
        const {
            totalCreatedInstances = 0,
            instancesWithDefinition = 0,
            instancesWithoutDefinition = 0,
            maxInitializationDurationNanos = 0,
            totalInitializationDurationNanos = 0,
            averageInitializationDurationNanos = 0
        } = summaryData;

        $('#time-kpi-total-instances').text(totalCreatedInstances.toLocaleString());
        $('#time-kpi-with-def').text(instancesWithDefinition.toLocaleString());
        $('#time-kpi-without-def').text(`${instancesWithoutDefinition} dynamic`);

        $('#time-kpi-total-duration').text(this.formatDuration(totalInitializationDurationNanos));
        $('#time-kpi-total-duration-nanos').text(`${totalInitializationDurationNanos.toLocaleString()} ns`);

        $('#time-kpi-max-duration').text(this.formatDuration(maxInitializationDurationNanos));
        $('#time-kpi-max-duration-nanos').text(`${maxInitializationDurationNanos.toLocaleString()} ns`);

        $('#time-kpi-avg-duration').text(this.formatDuration(averageInitializationDurationNanos));
        $('#time-kpi-avg-duration-nanos').text(`${averageInitializationDurationNanos.toLocaleString()} ns`);
    }

    /**
     * Fetches bean instance page data from backend REST API (/instances).
     */
    async fetchInstanceData(append = false) {
        if (!append) {
            this.renderLoadingState();
        }

        const queryParams = this._buildApiQueryParams();

        try {
            const responseData = await httpClient.getWithQuery(
                this.beanInstanceApi,
                queryParams.toString()
            );

            this.processPaginatedResponse(responseData, append);
            this.computeInstanceMetrics();
            this.applyLocalFilters();
            this._populateContextDropdown();
            this.renderCurrentView();
        } catch (error) {
            console.error('Error fetching bean instance data:', error);
            this.renderErrorState(error.message || 'Unknown network error');
        }
    }

    _buildApiQueryParams() {
        return QueryParam.build({
            pageNumber: this.currentPage - 1,
            pageSize: this.pageSize,
            search: this.searchQuery,
            sortBy: this.sortBy,
            sortDir: this.sortDir
        });
    }

    processPaginatedResponse(responseData, append = false) {
        const content = Array.isArray(responseData?.content) ? responseData.content : [];
        if (append) {
            this.instances = [...this.instances, ...content];
        } else {
            this.instances = content;
        }
        beanDataStore.addBeans(content);

        const totalElements = responseData?.totalElements ?? this.instances.length;
        const totalPages = Math.max(1, responseData?.totalPages ?? 1);
        const pageNumber = responseData?.pageNumber ?? 0;
        const pageSize = responseData?.pageSize ?? this.pageSize;

        this.paginationState = {
            totalElements,
            totalPages,
            pageNumber,
            pageSize,
            isFirstPage: responseData?.first ?? (pageNumber === 0),
            isLastPage: responseData?.last ?? (pageNumber >= totalPages - 1)
        };
    }

    formatDuration(nanos) {
        return formatDuration(nanos);
    }

    getDurationColor(initDurationNanos, maxDurationNanos = 0) {
        return resolveDurationColor(initDurationNanos, maxDurationNanos, this.bottleneckThresholdNanos);
    }

    getBeanLayer(bean) {
        return resolveBeanLayer(bean);
    }

    computeInstanceMetrics() {
        if (!this.instances || this.instances.length === 0) {
            this.maxTimeMs = 10;
            this.maxDurationNanos = 0;
            return;
        }

        let maxDurationNanos = 0;

        this.instances.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            const initDurationMs = nanos / 1e6;

            inst.initDurationMs = initDurationMs;
            inst.relativeStartMs = 0;
            inst.relativeEndMs = initDurationMs;
            inst.layer = this.getBeanLayer(inst);

            if (nanos > maxDurationNanos) {
                maxDurationNanos = nanos;
            }
        });

        this.maxDurationNanos = maxDurationNanos;
        const maxDurationMs = maxDurationNanos / 1e6;
        this.maxTimeMs = maxDurationMs > 0 ? (maxDurationMs * 1.08) : 10;
    }

    applyLocalFilters() {
        let result = [...this.instances];

        // 1. Quick Filters
        if (this.quickFilter === 'bottlenecks') {
            result = result.filter(inst => {
                const dur = this.getDurationColor(inst.initDurationNanos, this.maxDurationNanos);
                return dur.isBottleneck || dur.tier === 'bottleneck';
            });
        } else if (this.quickFilter === 'slow') {
            result = result.filter(inst => {
                const dur = this.getDurationColor(inst.initDurationNanos, this.maxDurationNanos);
                return dur.tier === 'high' || dur.tier === 'medium' || dur.tier === 'heavy' || dur.tier === 'slow' || dur.tier === 'elevated' || dur.tier === 'notable';
            });
        } else if (this.quickFilter === 'fast') {
            result = result.filter(inst => {
                const dur = this.getDurationColor(inst.initDurationNanos, this.maxDurationNanos);
                return dur.tier === 'submicro' || dur.tier === 'ultrafast' || dur.tier === 'optimal' || dur.tier === 'fast' || dur.tier === 'moderate';
            });
        }

        // 2. Minimum Duration Filter
        if (this.minDurationMs > 0) {
            result = result.filter(inst => (inst.initDurationMs || 0) >= this.minDurationMs);
        }

        this.filteredInstances = result;
        $('#time-visible-count-badge').text(this.filteredInstances.length.toLocaleString());
    }

    renderCurrentView() {
        if (this.activeView === 'instance') {
            $('#instance-gantt-card').removeClass('hidden');
            $('#instance-table-card').addClass('hidden');
            this.renderGanttView();
        } else {
            $('#instance-gantt-card').addClass('hidden');
            $('#instance-table-card').removeClass('hidden');
            this.renderTableRows();
            this.renderPagination();
        }
    }

    renderGanttView() {
        this.renderTimeRulerAndGrid();
        this.renderGanttRows();
        this.renderLoadMore();
    }

    renderTimeRulerAndGrid() {
        const $ruler = $('#instance-ruler-ticks');
        const $grid = $('#instance-grid-lines');
        if (!$ruler.length || !$grid.length) return;

        $ruler.empty();
        $grid.empty();

        const ticks = this._calculateTimeTicks(this.maxTimeMs);
        const rulerFragment = document.createDocumentFragment();
        const gridFragment = document.createDocumentFragment();

        ticks.forEach((tick) => {
            const pct = (tick.ms / this.maxTimeMs) * 100;
            if (pct > 100) return;

            // 1. Tick container on ruler
            const tickClone = TemplateEngine.clone('tpl-instance-ruler-tick');
            if (tickClone?.firstElementChild) {
                const $tick = $(tickClone.firstElementChild);
                $tick.css('left', `${pct}%`);

                const $mark = $tick.find('[data-field="tickMark"]');
                const $label = $tick.find('[data-field="tickLabel"]');

                if (tick.isMajor) {
                    $mark.addClass('ruler-tick-major');
                    $label.addClass('font-bold text-gray-700 dark:text-gray-200').text(tick.label);
                } else {
                    $label.addClass('text-gray-400 dark:text-gray-500');
                }

                rulerFragment.appendChild(tickClone);
            }

            // 2. Vertical dashed/dotted grid line
            const gridClone = TemplateEngine.clone('tpl-instance-grid-line');
            if (gridClone?.firstElementChild) {
                const $gridLine = $(gridClone.firstElementChild);
                $gridLine.css('left', `calc(${pct}% + 340px)`);

                if (tick.isMajor) {
                    $gridLine.addClass('border-dashed border-gray-300/80 dark:border-slate-700/80');
                } else {
                    $gridLine.addClass('border-dotted border-gray-200/60 dark:border-slate-800/60');
                }

                gridFragment.appendChild(gridClone);
            }
        });

        $ruler.append(rulerFragment);
        $grid.append(gridFragment);
    }

    _calculateTimeTicks(maxMs) {
        return calculateTimeTicks(maxMs);
    }

    renderGanttRows() {
        const $container = $('#instance-waterfall-rows');
        if (!$container.length) return;

        // Keep grid overlay and scrubber needle, remove previous rows / loading spinner
        $container.children().not('#instance-grid-lines, #instance-scrubber-needle').remove();

        if (!this.filteredInstances || this.filteredInstances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-instance-empty');
            if (emptyClone) $container.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        this.filteredInstances.forEach((inst) => {
            const node = this._createWaterfallRowNode(inst);
            if (node) fragment.appendChild(node);
        });

        $container.append(fragment);
    }

    _createWaterfallRowNode(inst) {
        const clone = TemplateEngine.clone('tpl-waterfall-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationMs = 0, initDurationNanos = 0, layer } = inst;

        const isSelected = (this.selectedBeanName === beanName) && (this.selectedContextId === contextId);
        if (isSelected) {
            $row.addClass('gantt-row-selected');
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-bean-name': beanName || ''
        });

        const durationStyle = this.getDurationColor(initDurationNanos, this.maxDurationNanos);
        const barColor = durationStyle.color;

        $row.css({
            '--row-accent-color': barColor
        });

        // Category Icon Container
        const $iconContainer = $row.find('[data-field="iconContainer"]');
        const $icon = $row.find('[data-field="icon"]');
        $icon.text(layer.icon || 'deployed_code').css('color', layer.color);
        $iconContainer.css({
            backgroundColor: `${layer.color}15`,
            borderColor: `${layer.color}35`
        });

        // Name
        const displayName = GraphTreeBuilder._displayName(beanName);
        $row.find('[data-field="name"]').text(displayName).attr('title', beanName);

        // Duration Text & Badge Styling
        const formattedDuration = this.formatDuration(initDurationNanos);
        const $duration = $row.find('[data-field="duration"]');
        $duration.text(formattedDuration)
            .addClass(durationStyle.badgeClass)
            .css({
                color: durationStyle.color,
                backgroundColor: `${durationStyle.color}15`,
                borderColor: `${durationStyle.color}35`
            });

        // Waterfall Bar Layout (Left-aligned from 0, width scaled to init duration)
        const maxTime = this.maxTimeMs || 1;
        const widthPct = Math.min(Math.max((initDurationMs / maxTime) * 100, 0.6), 100);

        const $bar = $row.find('[data-field="bar"]');
        $bar.css({
            left: '0%',
            width: `${widthPct}%`,
            background: durationStyle.gradient,
            border: `1px solid ${barColor}`,
            '--bar-glow': durationStyle.glow,
            '--layer-color': barColor
        });

        // Bottleneck Flame Indicator
        if (durationStyle.isBottleneck) {
            $bar.addClass('gantt-bar-bottleneck');
            const $flame = $row.find('[data-field="bottleneckBadge"]');
            $flame.removeClass('hidden').css('left', `calc(${widthPct}% + 6px)`);
        }

        // Bar Label
        const $barLabel = $row.find('[data-field="barLabel"]');
        if (widthPct > 6) {
            $barLabel.text(formattedDuration);
        } else {
            $barLabel.empty();
        }

        return clone;
    }

    renderLoadMore() {
        const totalElements = this.paginationState?.totalElements || 0;
        const currentCount = this.instances.length;
        const remaining = Math.max(0, totalElements - currentCount);

        const $btn = $('#time-btn-load-more');
        const $text = $('#time-load-more-text');

        if (remaining > 0) {
            $text.text(`+ ${remaining.toLocaleString()} more beans`);
            $btn.removeClass('hidden opacity-60 cursor-default pointer-events-none').show();
        } else {
            $text.text(`All ${totalElements.toLocaleString()} beans loaded`);
            $btn.addClass('opacity-60 cursor-default pointer-events-none');
        }

        $('#time-loaded-summary-text').text(`Showing ${currentCount.toLocaleString()} of ${totalElements.toLocaleString()} instances (max latency ${this.formatDuration((this.maxTimeMs || 0) * 1e6)})`);
    }

    renderTableRows() {
        const $tbody = $('#beanInstanceTableBody').length ? $('#beanInstanceTableBody') : $('#time-table-body');
        if (!$tbody.length) return;

        $tbody.empty();

        if (!this.filteredInstances || this.filteredInstances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-instance-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        this.filteredInstances.forEach((inst) => {
            const rowNode = this._createTableRowNode(inst);
            if (rowNode) fragment.appendChild(rowNode);
        });

        $tbody.append(fragment);
    }

    _createTableRowNode(inst) {
        const clone = TemplateEngine.clone('tpl-instance-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationNanos, scope, type, layer, createdAt } = inst;

        const isSelected = (this.selectedBeanName === beanName) && (this.selectedContextId === contextId);
        if (isSelected) {
            $row.addClass('bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary font-semibold');
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-bean-name': beanName || '',
            'data-bean': beanName || ''
        });

        // Icon Container & Icon
        const $iconContainer = $row.find('[data-field="beanIconContainer"], [data-field="iconContainer"]');
        const $icon = $row.find('[data-field="beanIcon"], [data-field="icon"]');

        $icon.text(layer?.icon || 'deployed_code').css('color', layer?.color || '#8b5cf6');
        $iconContainer.css({
            backgroundColor: `${layer?.color || '#8b5cf6'}15`,
            borderColor: `${layer?.color || '#8b5cf6'}30`
        });

        // Bean Name
        $row.find('[data-field="beanName"], [data-field="displayName"]')
            .text(GraphTreeBuilder._displayName(beanName))
            .attr('title', beanName);

        // Created At
        const formattedCreated = formatDateTime(createdAt);
        const createdTooltip = createdAt ? `Created at: ${createdAt}` : '';
        $row.find('[data-field="createdAt"], [data-field="created"]')
            .text(formattedCreated)
            .attr('title', createdTooltip);
        $row.find('[data-field="createdAtContainer"]').attr('title', createdTooltip);

        // Type & Package Name
        const simpleType = type && type.includes('.') ? type.substring(type.lastIndexOf('.') + 1) : (type || '-');
        const packagePart = type && type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : '';
        $row.find('[data-field="typeName"], [data-field="type"]').text(simpleType).attr('title', type || '');
        $row.find('[data-field="packageName"]').text(packagePart || 'default package').attr('title', type || '');

        // Scope badge
        $row.find('[data-field="scopeBadge"], [data-field="scope"]')
            .text((scope || 'singleton').toUpperCase())
            .addClass(resolveScopeBadgeClass(scope));

        // Duration formatted & latency badge
        const durationStyle = this.getDurationColor(initDurationNanos, this.maxDurationNanos);
        const formattedDuration = this.formatDuration(initDurationNanos);
        const $durationBadge = $row.find('[data-field="durationBadge"]');
        const $durationFormatted = $row.find('[data-field="durationFormatted"]');
        const $durationIcon = $row.find('[data-field="durationIcon"]');
        const $bottleneckFlame = $row.find('[data-field="bottleneckFlame"]');

        $durationFormatted.text(formattedDuration).css('color', durationStyle.color);
        $durationIcon.css('color', durationStyle.color);

        if ($durationBadge.length) {
            $durationBadge
                .addClass(durationStyle.badgeClass || '')
                .css({
                    color: durationStyle.color,
                    backgroundColor: `${durationStyle.color}15`,
                    borderColor: `${durationStyle.color}35`
                })
                .attr('title', `${(initDurationNanos || 0).toLocaleString()} ns (${durationStyle.tier || 'duration'})`);

            if (durationStyle.isBottleneck) {
                $durationBadge.addClass('font-extrabold ring-1').css('--tw-ring-color', `${durationStyle.color}50`);
                $bottleneckFlame.removeClass('hidden').css('color', durationStyle.color);
            } else {
                $bottleneckFlame.addClass('hidden');
            }
        } else {
            $durationFormatted
                .addClass(durationStyle.textClass || 'text-gray-800 dark:text-gray-200')
                .attr('title', `${(initDurationNanos || 0).toLocaleString()} ns`);
            $durationIcon.addClass(durationStyle.textClass || 'text-gray-400');
        }

        // Context ID
        const resolvedContext = contextId || 'root';
        $row.find('[data-field="contextId"]').text(resolvedContext).attr('title', resolvedContext);

        return clone;
    }

    renderPagination() {
        const $instPaginationInfo = $('#inst-pagination-info');
        const $instPaginationButtons = $('#inst-pagination-buttons');

        const { totalElements, pageNumber, pageSize } = this.paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'instances');
        const $info = $instPaginationInfo.length ? $instPaginationInfo : $('#time-pagination-info');
        $info.text(infoText);

        const $buttons = $instPaginationButtons.length ? $instPaginationButtons : $('#time-pagination-buttons');
        Pagination.renderPaginationButtons($buttons, this.paginationState);
    }

    renderLoadingState() {
        const $beanInstanceTableBody = $('#beanInstanceTableBody');

        if (this.activeView === 'instance') {
            const $container = $('#instance-waterfall-rows');
            $container.children().not('#instance-grid-lines, #instance-scrubber-needle').remove();
            const clone = TemplateEngine.clone('tpl-instance-loading');
            if (clone) $container.append(clone);
        } else {
            const $tbody = $beanInstanceTableBody.length ? $beanInstanceTableBody : $('#time-table-body');
            if (!$tbody.length) return;
            const clone = TemplateEngine.clone('tpl-instance-loading');
            if (clone) $tbody.empty().append(clone);
        }
    }

    renderErrorState(errorMessage) {
        const $beanInstanceTableBody = $('#beanInstanceTableBody');

        if (this.activeView === 'instance') {
            const $container = $('#instance-waterfall-rows');
            $container.children().not('#instance-grid-lines, #instance-scrubber-needle').remove();
            const clone = TemplateEngine.clone('tpl-instance-error');
            if (clone) {
                $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instance: ${errorMessage}`);
                $container.append(clone);
            }
        } else {
            const $tbody = $beanInstanceTableBody.length ? $beanInstanceTableBody : $('#time-table-body');
            if (!$tbody.length) return;
            const clone = TemplateEngine.clone('tpl-instance-error');
            if (clone) {
                $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instances: ${errorMessage}`);
                $tbody.empty().append(clone);
            }
        }
    }

    async selectBean(contextId, beanName) {
        if (!contextId || !beanName) return;

        this.selectedContextId = contextId;
        this.selectedBeanName = beanName;

        $('.waterfall-row, .instance-table-row').removeClass('gantt-row-selected bg-primary/10 dark:bg-purple-950/30 border-l-4 border-primary font-semibold');
        $(`.waterfall-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass('gantt-row-selected');
        $(`.instance-table-row[data-context-id="${contextId}"][data-bean-name="${beanName}"]`).addClass('bg-primary/10 dark:bg-purple-950/30 font-semibold');

        const localInstance = this.instances.find(i => i.contextId === contextId && i.beanName === beanName);
        if (localInstance) {
            this.renderSidebarDetails(localInstance);
        }

        const fetchDetailsPromise = (async () => {
            try {
                const queryParams = QueryParam.build({ contextId, beanName });
                const instanceDetails = await httpClient.getWithQuery(
                    this.beanInstanceFindApi,
                    queryParams.toString()
                );

                if (this.selectedContextId === contextId && this.selectedBeanName === beanName) {
                    this.selectedBeanInstance = instanceDetails;
                    this.renderSidebarDetails(instanceDetails);
                }
            } catch (error) {
                console.warn('Could not fetch single bean instance details:', error);
                if (this.selectedContextId === contextId && this.selectedBeanName === beanName) {
                    const fallback = this.instances.find(i => i.contextId === contextId && i.beanName === beanName);
                    if (fallback) this.renderSidebarDetails(fallback);
                }
            }
        })();

        const fetchProxyPromise = this.fetchProxyInfo(contextId, beanName);

        await Promise.allSettled([fetchDetailsPromise, fetchProxyPromise]);
    }

    /**
     * Fetches runtime AOP & CGLIB proxy info for the selected bean instance.
     */
    async fetchProxyInfo(contextId, beanName) {
        const $timeSidebarProxyLoading = $('#time-sidebar-proxy-loading');

        if (!this.beanInstanceProxyApi) return;

        // Reset and show loading state
        $('#time-sidebar-proxy-type').addClass('hidden').hide();
        $('#time-sidebar-proxy-content').addClass('hidden').hide();
        $('#time-sidebar-proxy-empty').addClass('hidden').hide();
        $timeSidebarProxyLoading.removeClass('hidden').show();

        try {
            const queryParams = QueryParam.build({ contextId, beanName });
            const proxyInfo = await httpClient.getWithQuery(
                this.beanInstanceProxyApi,
                queryParams.toString()
            );

            this.renderProxyInfo(proxyInfo);
        } catch (error) {
            console.warn('Failed to fetch or render proxy info:', error);
            // 404 not found
            this.renderProxyEmptyState();
        } finally {
            $timeSidebarProxyLoading.addClass('hidden').hide();
        }
    }

    /**
     * Renders AOP Proxy metadata details when proxy info is available.
     */
    renderProxyInfo(proxyInfo) {
        const { targetClass, advices = [], proxiedInterfaces = [], adviceFrozen, proxyType } = proxyInfo;

        const proxyStyles = resolveProxyBadgeStyles(proxyType);
        const proxyTypeText = proxyType || 'CGLIB';

        const $typeBadge = $('#time-sidebar-proxy-type');
        const $tabBadge = $('#time-sidebar-tab-proxy-badge');

        $typeBadge.text(proxyTypeText)
            .removeClass(ALL_PROXY_PILL_CLASSES)
            .addClass(proxyStyles.pill)
            .removeClass('hidden')
            .show();

        $tabBadge.text(proxyTypeText)
            .removeClass(ALL_PROXY_TAB_CLASSES)
            .addClass(proxyStyles.tab)
            .removeClass('hidden')
            .show();

        // Target Class
        const targetClassDisplay = targetClass || 'N/A';
        $('#time-sidebar-proxy-target-class')
            .text(targetClassDisplay)
            .attr('title', targetClassDisplay);

        // Advice Frozen
        $('#time-sidebar-proxy-frozen')
            .text(adviceFrozen ? 'TRUE' : 'FALSE')
            .removeClass(ALL_ADVICE_FROZEN_CLASSES)
            .addClass(resolveAdviceFrozenClass(adviceFrozen));

        // Advices list
        $('#time-sidebar-proxy-advices-count').text(advices.length);
        const $advicesList = $('#time-sidebar-proxy-advices-list');
        $advicesList.empty();
        if (advices.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-proxy-empty-item');
            if (emptyClone) {
                const $emptyItem = $(emptyClone.firstElementChild);
                $emptyItem.find('[data-field="message"]').text('No custom advices attached');
                $advicesList.append($emptyItem);
            }
        } else {
            advices.forEach(adv => {
                const shortName = adv.includes('.') ? adv.split('.').pop() : adv;
                const clone = TemplateEngine.clone('tpl-proxy-item');
                if (!clone) return;
                const $item = $(clone.firstElementChild);
                $item.find('[data-field="name"]').text(shortName).attr('title', adv);
                $item.find('[data-field="badge"]').text('Advice');
                $advicesList.append($item);
            });
        }

        // Interfaces list
        $('#time-sidebar-proxy-interfaces-count').text(proxiedInterfaces.length);
        const $interfacesList = $('#time-sidebar-proxy-interfaces-list');
        $interfacesList.empty();
        if (proxiedInterfaces.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-proxy-empty-item');
            if (emptyClone) {
                const $emptyItem = $(emptyClone.firstElementChild);
                $emptyItem.find('[data-field="message"]').text('No interfaces proxied (CGLIB class proxy)');
                $interfacesList.append($emptyItem);
            }
        } else {
            proxiedInterfaces.forEach(iface => {
                const shortName = iface.includes('.') ? iface.split('.').pop() : iface;
                const clone = TemplateEngine.clone('tpl-proxy-item');
                if (!clone) return;
                const $item = $(clone.firstElementChild);
                $item.find('[data-field="name"]').text(shortName).attr('title', iface);
                $item.find('[data-field="badge"]').text('Interface');
                $interfacesList.append($item);
            });
        }

        $('#time-sidebar-proxy-empty').addClass('hidden').hide();
        $('#time-sidebar-proxy-content').removeClass('hidden').show();
    }

    /**
     * Renders empty state card when bean is direct / non-proxied (e.g. 404 response).
     */
    renderProxyEmptyState() {
        $('#time-sidebar-proxy-type').addClass('hidden').hide();
        const directStyles = resolveProxyBadgeStyles('DIRECT');
        $('#time-sidebar-tab-proxy-badge')
            .text('Direct')
            .removeClass(ALL_PROXY_TAB_CLASSES)
            .addClass(directStyles.tab)
            .removeClass('hidden')
            .show();
        $('#time-sidebar-proxy-content').addClass('hidden').hide();
        $('#time-sidebar-proxy-empty').removeClass('hidden').show();
    }

    /**
     * Switches active tab in details sidebar between 'telemetry' and 'proxy'.
     */
    switchSidebarTab(tabName) {
        if (!tabName) return;
        this.activeSidebarTab = tabName;

        const isProxy = tabName === 'proxy';
        const $telemetryBtn = $('#time-sidebar-tab-telemetry');
        const $proxyBtn = $('#time-sidebar-tab-proxy');
        const $telemetryPane = $('#time-sidebar-pane-telemetry');
        const $proxyPane = $('#time-sidebar-pane-proxy');

        $proxyBtn
            .removeClass(ALL_TAB_BUTTON_CLASSES)
            .addClass(resolveTabButtonClass(isProxy));
        $telemetryBtn
            .removeClass(ALL_TAB_BUTTON_CLASSES)
            .addClass(resolveTabButtonClass(!isProxy));

        if (isProxy) {
            $telemetryPane.addClass('hidden').hide();
            $proxyPane.removeClass('hidden').show();
        } else {
            $proxyPane.addClass('hidden').hide();
            $telemetryPane.removeClass('hidden').show();
        }
    }

    renderSidebarDetails(instance) {
        if (!instance) return;

        const { beanName, type, scope, initDurationNanos, contextId, createdAt, hasDefinition } = instance;
        const metadata = resolveBeanMetadata(instance);

        const data = {
            name: GraphTreeBuilder._displayName(beanName),
            type: type || 'N/A',
            scope: capitalize(scope || 'singleton'),
            duration: this.formatDuration(initDurationNanos),
            context: contextId || 'root',
            created: formatDateTime(createdAt),
            nanos: (initDurationNanos || 0).toLocaleString() + ' ns',
            definitionStatus: hasDefinition ? 'DEFINED' : 'DYNAMIC'
        };

        const $sidebar = $('#time-details-sidebar');
        $sidebar.removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0')
            .addClass('w-[380px] max-w-[380px] opacity-100 mr-0 border');

        $('#time-sidebar-icon').text(metadata.icon || 'schema');
        $('#time-sidebar-icon-container').css({
            backgroundColor: `${metadata.color}15`,
            color: metadata.color,
            borderColor: `${metadata.color}30`
        });

        const titles = {
            name: beanName,
            type: type || 'N/A',
            scope: capitalize(scope || 'singleton'),
            duration: (initDurationNanos || 0).toLocaleString() + ' ns',
            context: contextId || 'root',
            created: createdAt || 'N/A',
            nanos: (initDurationNanos || 0).toLocaleString() + ' ns',
            definitionStatus: hasDefinition ? 'Defined in Application Context' : 'Dynamically Registered'
        };

        $sidebar.find('[data-field]').each((_, el) => {
            const field = el.dataset.field;
            if (data[field] != null) {
                $(el).text(data[field]);
            }
            if (titles[field] != null) {
                $(el).attr('title', titles[field]);
            }
        });

        const durationStyle = this.getDurationColor(initDurationNanos, this.maxDurationNanos);
        $('#time-sidebar-duration').css('color', durationStyle.color);

        $('#time-sidebar-definition-status')
            .removeClass(ALL_DEFINITION_STATUS_CLASSES)
            .addClass(resolveDefinitionStatusBadgeClass(hasDefinition));

        const $footer = $('#time-sidebar-footer');
        const $viewBtn = $('#time-btn-view-details');

        if (hasDefinition) {
            const href = `#/definitions?beanName=${encodeURIComponent(beanName)}${contextId ? `&contextId=${encodeURIComponent(contextId)}` : ''}`;
            $viewBtn.attr('href', href);
            $footer.removeClass('hidden').show();
        } else {
            $viewBtn.attr('href', '#/definitions');
            $footer.addClass('hidden').hide();
        }
    }

    initEvents() {
        this._initActionHandlers();
        this._bindSearchInput();
        this._bindFilterChangeEvents();
        this._bindSortHeaders();
        this._bindZoomEvents();
        this._bindScrubberEvents();
        this._bindClickActionDelegation();
        this._syncBottleneckDropdown();
        this._updateBottleneckUI();
    }

    _initActionHandlers() {
        this._clickActions = {
            'refresh-data': ($target) => this._handleRefreshData($target),
            'reset-filters': () => {
                this._resetFilterState(true);
                this._updateSortHeaderIcons();
                return this.fetchInstanceData();
            },
            'select-bean': ($target) => this._handleSelectBean($target),
            'select-instance': ($target) => this._handleSelectBean($target),
            'change-page': ($target) => this._handleChangePage($target),
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage(),
            'close-sidebar': () => this._handleCloseSidebar(),
            'download-report': () => this._downloadReport(),
            'switch-view': ($target) => this._handleSwitchView($target),
            'toggle-sort': () => this._handleToggleSort(),
            'load-more': () => this._handleLoadMore(),
            'zoom-in': () => this._setZoom(this.zoomLevel + 0.5),
            'zoom-out': () => this._setZoom(this.zoomLevel - 0.5),
            'zoom-reset': () => this._setZoom(1),
            'clear-search': () => this._handleClearSearch(),
            'quick-filter': ($target) => this._handleQuickFilter($target),
            'focus-slowest': () => this._handleFocusSlowest(),
            'switch-sidebar-tab': ($target) => {
                const tab = $target.data('tab') || $target.closest('[data-tab]').data('tab');
                this.switchSidebarTab(tab);
            }
        };

        this._filterChangeActions = {
            'time-filter-duration': (val) => this._handleSortFilter('initDurationNanos', val),
            'time-filter-created': (val) => this._handleSortFilter('createdAt', val),
            'time-filter-size': (val) => {
                this.pageSize = parseInt(val, 10) || 20;
                return this._resetPageAndFetch();
            },
            'time-filter-bottleneck': (val) => this._handleBottleneckThresholdChange(val)
        };
    }

    _bindSearchInput() {
        const handleInput = (val) => {
            this.searchQuery = (val || '').trim();
            if (this.searchQuery) {
                $('#time-search-clear').removeClass('hidden');
            } else {
                $('#time-search-clear').addClass('hidden');
            }
            this._debouncedSearch();
        };

        this._on('#time-search-input, #inst-search-input', 'input', (e) => {
            handleInput(e.target.value);
        });

        this._on('#time-search-input, #inst-search-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedSearch.flush();
            } else if (e.key === 'Escape') {
                this._handleClearSearch();
            }
        });
    }

    _handleClearSearch() {
        this._debouncedSearch.cancel();
        this.searchQuery = '';
        $('#time-search-input, #inst-search-input').val('');
        $('#time-search-clear').addClass('hidden');
        this._resetPageAndFetch();
    }

    _handleQuickFilter($target) {
        this.quickFilter = $target.data('filter') || 'all';

        $('.time-quick-filter-btn')
            .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .addClass('text-gray-600 dark:text-gray-400 font-semibold');

        $target
            .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .removeClass('text-gray-600 dark:text-gray-400 font-semibold');

        this.applyLocalFilters();
        this.renderCurrentView();
    }

    _handleFocusSlowest() {
        if (!this.instances || this.instances.length === 0) return;
        const slowest = this.instances.reduce((prev, current) =>
            ((prev?.initDurationNanos || 0) > (current?.initDurationNanos || 0)) ? prev : current
            , null);
        if (slowest) {
            const { contextId, beanName } = slowest;
            this.selectBean(contextId, beanName);
            const $targetRow = $(`.waterfall-row[data-bean-name="${beanName}"]`);
            if ($targetRow.length) {
                $targetRow[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    _bindFilterChangeEvents() {
        const filterSelectors = Object.keys(this._filterChangeActions)
            .map(id => `#${id}`)
            .join(', ');

        this._on(filterSelectors, 'change', (e) => {
            const handler = this._filterChangeActions[e.target.id];
            if (handler) {
                handler(e.target.value);
            }
        });
    }

    _handleSortFilter(field, dir) {
        if (dir) {
            this.sortBy = field;
            this.sortDir = dir;
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
        }
        this._syncSortDropdowns();
        this._updateSortHeaderIcons();
        return this._resetPageAndFetch();
    }

    _syncSortDropdowns() {
        $('#time-filter-duration').val(this.sortBy === 'initDurationNanos' ? this.sortDir : '');
        $('#time-filter-created').val(this.sortBy === 'createdAt' ? this.sortDir : '');

        if (this.sortBy === 'initDurationNanos') {
            $('#time-sort-label').text('Duration');
            $('#time-sort-icon').text(this.sortDir === 'ASC' ? 'arrow_upward' : 'arrow_downward');
        } else {
            $('#time-sort-label').text('Order');
            $('#time-sort-icon').text('swap_vert');
        }
    }

    _handleBottleneckThresholdChange(val) {
        if (val === 'custom') {
            const currentFormatted = this.formatDuration(this.bottleneckThresholdNanos);
            const input = prompt('Enter custom bottleneck threshold (e.g. "750µs", "2.5ms", "1000000ns", or number in µs):', currentFormatted);
            if (!input) {
                this._syncBottleneckDropdown();
                return;
            }

            const parsedNanos = this._parseDurationToNanos(input);
            if (!parsedNanos || parsedNanos <= 0) {
                alert('Invalid duration value. Please enter a duration like "800µs" or "3ms".');
                this._syncBottleneckDropdown();
                return;
            }

            this.bottleneckThresholdNanos = parsedNanos;
        } else {
            const nanos = parseInt(val, 10);
            if (Number.isFinite(nanos) && nanos > 0) {
                this.bottleneckThresholdNanos = nanos;
            }
        }

        localStorage.setItem('sl-bottleneck-threshold-nanos', this.bottleneckThresholdNanos);
        this._syncBottleneckDropdown();
        this._updateBottleneckUI();
        this.applyLocalFilters();
        this.renderCurrentView();

        if (this.selectedBeanName) {
            const selectedInst = this.instances?.find(i => i.beanName === this.selectedBeanName && (!this.selectedContextId || i.contextId === this.selectedContextId));
            if (selectedInst) {
                this.renderSidebarDetails(selectedInst);
            }
        }
    }

    _parseDurationToNanos(str) {
        if (!str) return null;
        const trimmed = String(str).trim().toLowerCase().replace(/\s+/g, '');
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const num = parseFloat(trimmed);
            return num < 10000 ? Math.round(num * 1000) : Math.round(num);
        }
        if (trimmed.endsWith('ns')) {
            return Math.round(parseFloat(trimmed));
        }
        if (trimmed.endsWith('us') || trimmed.endsWith('µs')) {
            return Math.round(parseFloat(trimmed) * 1000);
        }
        if (trimmed.endsWith('ms')) {
            return Math.round(parseFloat(trimmed) * 1e6);
        }
        if (trimmed.endsWith('s')) {
            return Math.round(parseFloat(trimmed) * 1e9);
        }
        return null;
    }

    _syncBottleneckDropdown() {
        const val = String(this.bottleneckThresholdNanos);
        const $select = $('#time-filter-bottleneck');
        if ($select.length === 0) return;

        let $opt = $select.find(`option[value="${val}"]`);
        if ($opt.length > 0) {
            $select.val(val);
        } else {
            let $customOpt = $select.find('option[data-custom="true"]');
            if ($customOpt.length === 0) {
                $customOpt = $('<option data-custom="true"></option>').insertBefore($select.find('option[value="custom"]'));
            }
            $customOpt.val(val).text(`Bottleneck: > ${this.formatDuration(this.bottleneckThresholdNanos)} (Custom)`).prop('selected', true);
            $select.val(val);
        }
    }

    _updateBottleneckUI() {
        const threshold = this.bottleneckThresholdNanos;
        const formatted = this.formatDuration(threshold);

        $('#time-legend-bottleneck').text(`>${formatted} (Bottleneck)`);
        $('#time-legend-high').text(`High ${this.formatDuration(threshold * 0.4)}-${formatted}`);
        $('#time-legend-medium').text(`Medium ${this.formatDuration(threshold * 0.1)}-${this.formatDuration(threshold * 0.4)}`);
        $('#time-legend-fast').text(`Fast <${this.formatDuration(threshold * 0.1)}`);

        $('[data-action="quick-filter"][data-filter="bottlenecks"]').attr('title', `Beans taking > ${formatted} to initialize`);
    }

    _bindSortHeaders() {
        this._on('.th-sortable', 'click', (e) => {
            const $th = $(e.currentTarget);
            const sortCol = $th.data('sort');
            if (!sortCol) return;

            if (this.sortBy === sortCol) {
                this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
            } else {
                this.sortBy = sortCol;
                this.sortDir = 'ASC';
            }

            this._syncSortDropdowns();
            this._updateSortHeaderIcons();
            this.currentPage = 1;
            this.fetchInstanceData();
        });
    }

    _updateSortHeaderIcons() {
        $('.th-sortable .sort-icon').text('unfold_more').removeClass('text-primary dark:text-purple-300').addClass('text-gray-400');

        if (this.sortBy) {
            const iconName = this.sortDir === 'ASC' ? 'expand_less' : 'expand_more';
            $(`.th-sortable[data-sort="${this.sortBy}"] .sort-icon`)
                .text(iconName)
                .removeClass('text-gray-400')
                .addClass('text-primary dark:text-purple-300 font-bold');
        }
    }

    _populateContextDropdown() {
        const $dropdown = $('#inst-filter-context');
        if (!$dropdown.length) return;

        const currentVal = $dropdown.val() || '';
        $dropdown.find('option:not(:first)').remove();

        const contexts = new Set();
        if (this.instanceSummary?.contextDistribution) {
            Object.keys(this.instanceSummary.contextDistribution).forEach(c => contexts.add(c));
        }
        this.instances.forEach(i => {
            if (i.contextId) contexts.add(i.contextId);
        });

        contexts.forEach(ctx => {
            $dropdown.append(`<option value="${ctx}">${ctx}</option>`);
        });

        if (currentVal) {
            $dropdown.val(currentVal);
        }
    }

    _bindZoomEvents() {
        this._on('#time-zoom-slider', 'input', (e) => {
            const val = parseFloat(e.target.value) || 1;
            this._setZoom(val, false);
        });
    }

    _setZoom(level, updateSlider = true) {
        this.zoomLevel = Math.max(1, Math.min(4, level));
        if (updateSlider) {
            $('#time-zoom-slider').val(this.zoomLevel);
        }

        const pct = Math.round(this.zoomLevel * 100);
        $('#time-zoom-level-badge').text(`${pct}%`);

        const widthPercent = this.zoomLevel * 100;
        $('#instance-inner-container').css('min-width', `${widthPercent}%`);
        this.renderTimeRulerAndGrid();
    }

    _bindScrubberEvents() {
        const $scrollContainer = $('#instance-scroll-container');
        const $waterfallRows = $('#instance-waterfall-rows');
        const $needle = $('#instance-scrubber-needle');
        const $badge = $('#instance-scrubber-badge');

        const updateScrubberPosition = (e) => {
            if (!e) return;
            const $inner = $('#instance-inner-container');
            const offset = $inner.offset();
            const rowsOffset = $waterfallRows.offset();
            if (!offset || !rowsOffset) return;

            // Do not show scrubber if mouse is hovering above the table rows (i.e. on the ruler header)
            if (e.pageY < rowsOffset.top) {
                $needle.css('opacity', 0);
                return;
            }

            const manifestWidth = 340;
            const mouseX = e.pageX - offset.left;

            if (mouseX >= manifestWidth && mouseX <= $inner.outerWidth()) {
                const trackX = mouseX - manifestWidth;
                const trackWidth = $inner.outerWidth() - manifestWidth;
                const timeRatio = Math.max(0, Math.min(1, trackX / trackWidth));
                const currentMs = timeRatio * this.maxTimeMs;
                const scrollTop = $scrollContainer.scrollTop() || 0;

                $needle.css({
                    left: `${mouseX}px`,
                    opacity: 1
                });
                $badge.css('top', `${scrollTop + 4}px`).text(this.formatDuration(currentMs * 1e6));
            } else {
                $needle.css('opacity', 0);
            }
        };

        // Mousemove scrubber needle
        this._on($scrollContainer, 'mousemove', (e) => {
            this._lastScrubberMouseEvent = e;
            updateScrubberPosition(e);
        });

        // Keep badge anchored to visible top when scrolling
        this._on($scrollContainer, 'scroll', () => {
            if (this._lastScrubberMouseEvent && $needle.css('opacity') !== '0') {
                updateScrubberPosition(this._lastScrubberMouseEvent);
            }
        });

        this._on($scrollContainer, 'mouseleave', () => {
            this._lastScrubberMouseEvent = null;
            $needle.css('opacity', 0);
        });
    }

    _bindClickActionDelegation() {
        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action') || $target.attr('data-action');
            const handler = this._clickActions[action];

            if (handler) {
                if ($target.is('a') && $target.attr('href') && !$target.attr('href').startsWith('javascript:')) {
                    // Normal link
                } else {
                    e.preventDefault();
                }
                handler($target, e);
            }
        });

        this._on(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this._handleCloseSidebar();
            }
        });
    }

    _handleSwitchView($target) {
        const view = $target.data('view') || 'instance';
        this.activeView = view;

        if (view === 'instance') {
            $('#time-view-btn-instance')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-table')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
        } else {
            $('#time-view-btn-table')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-instance')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
        }

        this.renderCurrentView();
    }

    _handleToggleSort() {
        if (this.sortBy === 'createdAt') {
            this.sortBy = 'initDurationNanos';
            this.sortDir = 'DESC';
        } else {
            this.sortBy = 'createdAt';
            this.sortDir = 'ASC';
        }

        this._syncSortDropdowns();
        this._updateSortHeaderIcons();
        this._resetPageAndFetch();
    }

    async _handleLoadMore() {
        if (this.currentPage < this.paginationState.totalPages) {
            this.currentPage++;
            await this.fetchInstanceData(true);
        }
    }

    async _handleRefreshData($target) {
        const $icon = $target.find('.material-symbols-outlined').addClass('animate-spin');
        try {
            await Promise.all([
                this.fetchSummaryData(),
                this.fetchInstanceData()
            ]);
        } catch (err) {
            console.error('Error refreshing bean instances:', err);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    async _handleSelectBean($target) {
        const $row = $target.closest('[data-bean-name]');
        const beanName = $row.data('bean-name') || $row.attr('data-bean-name');
        const contextId = $row.data('context-id') || $row.attr('data-context-id');

        if (beanName) {
            await this.selectBean(contextId, beanName);
        }
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!isNaN(targetPage) && targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.fetchInstanceData();
        }
    }

    _handlePrevPage() {
        if (!this.paginationState.isFirstPage && this.currentPage > 1) {
            this.currentPage--;
            this.fetchInstanceData();
        }
    }

    _handleNextPage() {
        if (!this.paginationState.isLastPage && this.currentPage < this.paginationState.totalPages) {
            this.currentPage++;
            this.fetchInstanceData();
        }
    }

    _handleCloseSidebar(immediate = false) {
        const $sidebar = $('#time-details-sidebar');
        $('#time-sidebar-footer').addClass('hidden').hide();
        $('#time-sidebar-proxy-type').addClass('hidden').hide();
        $('#time-sidebar-proxy-loading').addClass('hidden').hide();
        $('#time-sidebar-proxy-content').addClass('hidden').hide();
        $('#time-sidebar-proxy-empty').addClass('hidden').hide();
        $('#time-sidebar-tab-proxy-badge').addClass('hidden').hide();
        this.switchSidebarTab('telemetry');
        this.selectedBeanName = null;
        this.selectedContextId = null;
        this.selectedBeanInstance = null;
        $('.waterfall-row, .instance-table-row').removeClass('gantt-row-selected bg-primary/10 dark:bg-purple-950/30 font-semibold');

        if (!$sidebar.length) return;

        $sidebar.removeClass('w-[380px] max-w-[380px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0');
    }

    _on(target, event, delegateOrHandler, maybeHandler) {
        const namespace = '.instanceController';
        const namespacedEvent = `${event}${namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }
    }

    _resetPageAndFetch() {
        this.currentPage = 1;
        return this.fetchInstanceData();
    }

    _resetFilterState(preserveView = false) {
        const targetView = preserveView ? this.activeView : 'instance';

        Object.assign(this, {
            searchQuery: '',
            minDurationMs: 0,
            quickFilter: 'all',
            pageSize: 20,
            currentPage: 1,
            sortBy: 'createdAt',
            sortDir: 'ASC',
            zoomLevel: 1,
            activeView: targetView,
            activeSidebarTab: 'telemetry',
            selectedBeanName: null,
            selectedContextId: null,
            selectedBeanInstance: null
        });

        this.switchSidebarTab('telemetry');
        $('#time-sidebar-tab-proxy-badge').addClass('hidden').hide();

        const defaults = {
            '#time-search-input': '',
            '#inst-search-input': '',
            '#time-filter-created': 'ASC',
            '#time-filter-duration': '',
            '#time-filter-size': '20',
            '#time-zoom-slider': '1'
        };

        Object.entries(defaults).forEach(([selector, val]) => $(selector).val(val));
        $('#time-search-clear').addClass('hidden');
        $('#time-sort-label').text('Order');
        $('#time-sort-icon').text('swap_vert');
        $('#time-zoom-level-badge').text('100%');
        this._syncBottleneckDropdown();
        this._updateBottleneckUI();

        if (!preserveView) {
            // Reset View Toggle buttons & Card containers to default instance view
            $('#time-view-btn-instance')
                .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .removeClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#time-view-btn-table')
                .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
                .addClass('text-gray-500 dark:text-gray-400 font-medium');
            $('#instance-gantt-card').removeClass('hidden');
            $('#instance-table-card').addClass('hidden');
        }

        $('.time-quick-filter-btn')
            .removeClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .addClass('text-gray-600 dark:text-gray-400 font-semibold');
        $('.time-quick-filter-btn[data-filter="all"]')
            .addClass('bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs')
            .removeClass('text-gray-600 dark:text-gray-400 font-semibold');
    }

    _downloadReport() {
        const reportData = {
            appName: 'Spring Lens',
            reportType: 'Bean Instances Telemetry',
            timestamp: new Date().toISOString(),
            bottleneckThreshold: this.formatDuration(this.bottleneckThresholdNanos),
            bottleneckThresholdNanos: this.bottleneckThresholdNanos,
            summary: this.instanceSummary,
            totalElements: this.paginationState.totalElements,
            instances: this.instances
        };

        downloadJson(`spring-lens-instance-${Date.now()}.json`, reportData);
    }

    /**
     * Helper for namespaced event binding.
     * @private
     */
    _on(target, event, delegateOrHandler, maybeHandler, namespace = '.instanceController') {
        const namespacedEvent = `${event}${namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }
    }

    leave() {
        this._handleCloseSidebar(true);
        this._resetFilterState();
        this._debouncedSearch?.cancel();
        $(document).off('.instanceController');
        $(window).off('.instanceController');
        $('#time-search-input, #inst-search-input, #time-zoom-slider, #time-filter-created, #time-filter-size, #instance-scroll-container, #time-filter-duration, #time-filter-bottleneck, #time-sort-by, #time-details-sidebar').off('.instanceController');
    }
}
