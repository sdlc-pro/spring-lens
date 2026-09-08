import httpClient from '../helper/http-client.js';
import {
    CSS_CLASSES,
    CONDITION_STATUS_THEMES,
    TemplateEngine,
    QueryParam,
    Pagination,
    debounce
} from '../helper/index.js';


export default class ConditionalReport {

    constructor(endpoints = {}) {
        this.conditionEvaluationApiUrl = endpoints.CONDITIONAL_REPORTS;
        this.searchConditionalEvaluationApiUrl = endpoints.FIND_CONDITIONAL_REPORTS;
        this.summaryConditionApiUrl = endpoints.SUMMARY_CONDITIONAL_REPORTS;

        // Active data state
        this.conditions = [];
        this.selectedCondition = null;

        // View and filter criteria
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.outcomeFilter = '';
        this.groupBy = 'none';
        this.sortBy = 'source';
        this.sortDir = 'ASC';
        this.detailViewStyle = localStorage.getItem('condition_detail_view_style') || 'side-sheet';

        // Pagination metadata
        this.paginationState = {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize: 10,
            isFirstPage: true,
            isLastPage: true
        };

        // KPI metrics cache
        this.kpiMetrics = {
            total: 0,
            matched: 0,
            unmatched: 0,
            totalConditions: 0
        };

        this._debouncedSearch = debounce(() => {
            this.currentPage = 1;
            this.fetchConditionEvaluationData();
        }, 200);
    }

    _resetFilterState() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.outcomeFilter = '';
        this.groupBy = 'none';
        this.sortBy = 'source';
        this.sortDir = 'ASC';
        this.selectedCondition = null;

        $('#condition-search-input').val('');
        $('#condition-group-by').val('none');
        $('#condition-page-size').val('10');
        this.renderTabs();
    }

    /**
     * Initializes events and loads condition evaluation data when route is entered.
     */
    async enter(params) {
        try {
            this.closeDetail();
            this._resetFilterState();

            const queryParams = QueryParam.parse(params);
            const search = queryParams.get('search');
            const outcome = queryParams.get('outcome');

            if (search) {
                this.searchQuery = search;
                $('#condition-search-input').val(search);
            }
            if (outcome) {
                this.outcomeFilter = outcome;
            }
            this.renderTabs();

            this.initEvents();
            await Promise.all([
                this.fetchSummaryMetrics(),
                this.fetchConditionEvaluationData()
            ]);
        } catch (error) {
            console.error('Error entering ConditionalReport:', error);
        }
    }

    /**
     * Fetches overall dataset metrics across all auto-configurations for KPI cards and tab counters.
     */
    async fetchSummaryMetrics() {
        try {
            const responseData = await httpClient.get(this.summaryConditionApiUrl);
            const {totalConditionSources, matchedConditionSources, unmatchedConditionSources, totalEvaluatedConditions} = responseData

            this.kpiMetrics = {
                total : totalConditionSources,
                matched: matchedConditionSources,
                unmatched: unmatchedConditionSources,
                totalConditions: totalEvaluatedConditions
            };

            this.renderKpiCards();
            this.renderTabCounts();
        } catch (error) {
            console.warn('Could not fetch condition evaluation summary metrics:', error);
        }
    }

    /**
     * Fetches paginated condition evaluations from backend REST API.
     */
    async fetchConditionEvaluationData() {
        this.renderLoadingState();

        const queryParams = this._buildApiQueryParams();

        try {
            const responseData = await httpClient.getWithQuery(
                this.conditionEvaluationApiUrl,
                queryParams.toString()
            );

            this.processPaginatedResponse(responseData);

            this.renderKpiCards();
            this.renderTabs();
            this.renderTableRows();
            this.renderPagination();

            // Refresh selected condition if already open
            if (this.selectedCondition) {
                const refreshed = this.conditions.find(
                    c => c.contextId === this.selectedCondition.contextId && c.source === this.selectedCondition.source
                );
                if (refreshed) {
                    this.renderDetailPanel(refreshed);
                }
            }
        } catch (error) {
            console.error('Error fetching condition evaluations:', error);
            this.renderErrorState(error.message);
        }
    }

    /**
     * Builds standard URL query parameters for backend API request.
     * @private
     */
    _buildApiQueryParams() {
        const params = {
            pageNumber: Math.max(0, this.currentPage - 1),
            pageSize: this.pageSize,
            sortBy: this.sortBy,
            sortDir: this.sortDir
        };

        if (this.searchQuery) {
            params.search = this.searchQuery;
        }

        if (this.outcomeFilter) {
            params.outcome = this.outcomeFilter;
        }

        return QueryParam.build(params);
    }

    /**
     * Extracts content and pagination state from backend response.
     * @param {Object} responseData
     */
    processPaginatedResponse(responseData) {
        const content = Array.isArray(responseData?.content) ? responseData.content : [];
        this.conditions = content;

        const totalElements = responseData?.totalElements ?? content.length;
        const totalPages = Math.max(1, responseData?.totalPages ?? 1);
        const pageNumber = responseData?.pageNumber ?? (this.currentPage - 1);
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

    /**
     * Updates top 4 KPI metric cards in the UI.
     */
    renderKpiCards() {
        const { total, matched, unmatched, totalConditions } = this.kpiMetrics;

        $('#condition-kpi-total').text(total.toLocaleString());

        const matchedPct = total > 0 ? ((matched / total) * 100).toFixed(1) : '0';
        $('#condition-kpi-matched-count').text(matched.toLocaleString());
        $('#condition-kpi-matched-pct').text(`(${matchedPct}%)`);

        const unmatchedPct = total > 0 ? ((unmatched / total) * 100).toFixed(1) : '0';
        $('#condition-kpi-unmatched-count').text(unmatched.toLocaleString());
        $('#condition-kpi-unmatched-pct').text(`(${unmatchedPct}%)`);

        $('#condition-kpi-conditions-total').text(totalConditions > 0 ? totalConditions.toLocaleString() : '-');
    }

    /**
     * Updates tab counts across All, Matched, and Did Not Match tabs.
     */
    renderTabCounts() {
        const { total, matched, unmatched } = this.kpiMetrics;
        $('#condition-count-all').text(total.toLocaleString());
        $('#condition-count-matched').text(matched.toLocaleString());
        $('#condition-count-unmatched').text(unmatched.toLocaleString());
    }

    /**
     * Updates the active styles of the filter tabs.
     */
    renderTabs() {
        const activeOutcome = this.outcomeFilter;

        // Update active tab button styles
        $('#condition-tabs-container button').each((_, el) => {
            const $btn = $(el);
            const outcome = $btn.data('outcome') || '';
            const isActive = outcome === activeOutcome;

            $btn.toggleClass(CSS_CLASSES.pillActive, isActive)
                .toggleClass(CSS_CLASSES.pillInactive, !isActive);
        });

        this.renderTabCounts();
    }

    /**
     * Renders evaluation table rows, supporting grouping by package or status.
     */
    renderTableRows() {
        const $tbody = $('#condition-table-body');
        if (!$tbody.length) return;

        $tbody.empty();

        if (!this.conditions || this.conditions.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-condition-empty');
            if (emptyClone) $tbody.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        if (this.groupBy === 'package') {
            this._renderGroupedByPackage(fragment);
        } else if (this.groupBy === 'status') {
            this._renderGroupedByStatus(fragment);
        } else {
            for (const item of this.conditions) {
                const rowNode = this._createConditionRowNode(item);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }

        $tbody.append(fragment);
    }

    /**
     * Renders rows grouped by Java package name.
     * @private
     */
    _renderGroupedByPackage(fragment) {
        const packageGroups = new Map();

        for (const item of this.conditions) {
            const { packageName } = this._extractClassAndPackage(item.source);
            const groupKey = packageName || 'default';
            if (!packageGroups.has(groupKey)) {
                packageGroups.set(groupKey, []);
            }
            packageGroups.get(groupKey).push(item);
        }

        const sortedPackages = Array.from(packageGroups.keys()).sort();

        for (const pkg of sortedPackages) {
            const items = packageGroups.get(pkg);
            const headerClone = this._createGroupHeaderNode(pkg, items.length, 'folder');
            if (headerClone) fragment.appendChild(headerClone);

            for (const item of items) {
                const rowNode = this._createConditionRowNode(item);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }
    }

    /**
     * Renders rows grouped by evaluation outcome (Matched vs Did Not Match).
     * @private
     */
    _renderGroupedByStatus(fragment) {
        const matchedItems = this.conditions.filter(i => i.outcome === 'MATCHED');
        const unmatchedItems = this.conditions.filter(i => i.outcome === 'NOT_MATCHED');

        if (matchedItems.length > 0) {
            const headerClone = this._createGroupHeaderNode('Matched Auto-configurations', matchedItems.length, 'check_circle');
            if (headerClone) fragment.appendChild(headerClone);
            for (const item of matchedItems) {
                const rowNode = this._createConditionRowNode(item);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }

        if (unmatchedItems.length > 0) {
            const headerClone = this._createGroupHeaderNode('Did Not Match (Skipped)', unmatchedItems.length, 'cancel');
            if (headerClone) fragment.appendChild(headerClone);
            for (const item of unmatchedItems) {
                const rowNode = this._createConditionRowNode(item);
                if (rowNode) fragment.appendChild(rowNode);
            }
        }
    }

    /**
     * Creates a group header DOM element from template.
     * @private
     */
    _createGroupHeaderNode(title, count, icon = 'folder') {
        const clone = TemplateEngine.clone('tpl-condition-group-header');
        if (!clone?.firstElementChild) return null;

        const $header = $(clone.firstElementChild);
        $header.find('[data-field="groupIcon"]').text(icon);
        $header.find('[data-field="groupTitle"]').text(title);
        $header.find('[data-field="groupCount"]').text(`${count} items`);

        return clone;
    }

    /**
     * Creates a single table row DOM element from template.
     * @private
     */
    _createConditionRowNode(item) {
        const clone = TemplateEngine.clone('tpl-condition-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { source, contextId, outcome, matches = [] } = item;

        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = this._extractClassAndPackage(source);

        const isSelected = this.selectedCondition
            && this.selectedCondition.source === source
            && this.selectedCondition.contextId === contextId;

        if (isSelected) {
            $row.addClass(CSS_CLASSES.rowActive);
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-source': source || ''
        });

        // Set Class Name & Package
        const displayClassName = memberName ? `${className}#${memberName}` : className;
        $row.find('[data-field="className"]').text(displayClassName).attr('title', source);
        $row.find('[data-field="packageName"]').text(packageName).attr('title', packageName);

        // Set Status Badge
        const statusTheme = isMatched ? CONDITION_STATUS_THEMES.matched : CONDITION_STATUS_THEMES.notMatched;
        $row.find('[data-field="statusBadge"]').addClass(statusTheme.badge);
        $row.find('[data-field="statusIcon"]').text(statusTheme.icon);
        $row.find('[data-field="statusText"]').text(statusTheme.label);
        if (statusTheme.rowBg) {
            $row.addClass(statusTheme.rowBg);
        }

        // Set Conditions Ratio & Progress Bar
        const totalMatches = matches.length;
        const matchedCount = matches.filter(m => m.matched).length;
        const percentage = totalMatches > 0 ? Math.round((matchedCount / totalMatches) * 100) : (isMatched ? 100 : 0);

        $row.find('[data-field="conditionRatio"]').text(`${matchedCount} / ${totalMatches}`);

        const $progressBar = $row.find('[data-field="progressBar"]');
        $progressBar.css('width', `${percentage}%`);
        if (isMatched || percentage === 100) {
            $progressBar.addClass('bg-emerald-500');
        } else if (percentage === 0) {
            $progressBar.addClass('bg-red-500 w-0');
        } else {
            $progressBar.addClass('bg-amber-500');
        }

        // Set Outcome Summary / Reason
        const outcomeSummary = this._getOutcomeSummary(item);
        $row.find('[data-field="outcomeSummary"]')
            .text(outcomeSummary)
            .attr('title', outcomeSummary);

        const $outcomeDot = $row.find('[data-field="outcomeDot"]');
        if (isMatched) {
            $outcomeDot.addClass('bg-emerald-500');
            $row.find('[data-field="outcomeSummary"]').addClass('text-gray-700 dark:text-gray-300');
        } else {
            $outcomeDot.addClass('bg-red-500');
            $row.find('[data-field="outcomeSummary"]').addClass('text-red-600 dark:text-red-400 font-medium');
        }

        // Expand Icon
        if (isSelected && this.detailViewStyle === 'inline') {
            $row.find('[data-field="expandIcon"]').addClass('rotate-90 text-primary dark:text-purple-300');
        }

        return clone;
    }

    /**
     * Extracts human-readable outcome summary or failure reason snippet.
     * @private
     */
    _getOutcomeSummary(item) {
        if (item.outcome === 'MATCHED') {
            return 'All conditions matched';
        }

        const matches = Array.isArray(item.matches) ? item.matches : [];
        const failedMatch = matches.find(m => !m.matched);

        if (failedMatch?.message) {
            return failedMatch.message;
        }

        return 'Condition did not match';
    }

    /**
     * Splits full Java qualified name into class name, package name, and optional member method.
     * @private
     */
    _extractClassAndPackage(sourceStr) {
        if (!sourceStr || typeof sourceStr !== 'string') {
            return { className: 'Unknown', packageName: '', memberName: '' };
        }

        let mainSource = sourceStr;
        let memberName = '';

        if (sourceStr.includes('#')) {
            const parts = sourceStr.split('#');
            mainSource = parts[0];
            memberName = parts[1] || '';
        }

        const lastDotIndex = mainSource.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return { className: mainSource, packageName: '', memberName };
        }

        const packageName = mainSource.substring(0, lastDotIndex);
        const className = mainSource.substring(lastDotIndex + 1);

        return { className, packageName, memberName };
    }

    /**
     * Formats condition names like 'OnPropertyCondition' -> '@ConditionalOnProperty'.
     * @private
     */
    _formatConditionName(condition) {
        if (!condition) return '@Condition';
        if (condition.startsWith('@')) return condition;

        // If it starts with "On" like "OnBeanCondition" -> "@ConditionalOnBean"
        if (condition.startsWith('On') && condition.endsWith('Condition')) {
            const core = condition.substring(2, condition.length - 'Condition'.length);
            return `@ConditionalOn${core}`;
        }

        if (condition.endsWith('Condition')) {
            const core = condition.substring(0, condition.length - 'Condition'.length);
            return `@Conditional${core}`;
        }

        return `@${condition}`;
    }

    /**
     * Selects an auto-configuration evaluation item and displays its detail panel.
     * Supports both Option 2 (Side-Sheet Modal) and Option 3 (Inline Accordion).
     * @param {string} contextId
     * @param {string} source
     */
    async selectCondition(contextId, source) {
        if (!contextId || !source) return;

        // Check if clicking currently selected item to toggle close
        if (this.selectedCondition?.contextId === contextId && this.selectedCondition?.source === source) {
            this.closeDetail();
            return;
        }

        // Close any prior open detail views
        this.closeDetail();

        // Highlight active row in table
        const $targetRow = $(`.condition-row[data-context-id="${contextId}"][data-source="${source}"]`);
        $targetRow.addClass(CSS_CLASSES.rowActive);

        if (this.detailViewStyle === 'inline') {
            $targetRow.find('[data-field="expandIcon"]').addClass('rotate-90 text-primary dark:text-purple-300');
        }

        // Find from loaded list or fetch from API
        let condition = this.conditions.find(c => c.contextId === contextId && c.source === source);

        if (!condition && this.searchConditionalEvaluationApiUrl) {
            try {
                const queryParams = QueryParam.build({ contextId, source });
                condition = await httpClient.getWithQuery(this.searchConditionalEvaluationApiUrl, queryParams.toString());
            } catch (err) {
                console.warn('Could not fetch single condition snapshot:', err);
            }
        }

        if (condition) {
            this.selectedCondition = condition;
            this.renderDetailPanel(condition);
        }
    }

    /**
     * Renders detailed breakdown using the chosen view style (side-sheet or inline accordion).
     * @param {Object} condition
     */
    renderDetailPanel(condition) {
        if (this.detailViewStyle === 'inline') {
            this._renderInlineAccordion(condition);
        } else {
            this._renderSideSheet(condition);
        }
    }

    /**
     * Option 2: Renders detailed breakdown inside the Sliding Side-Sheet Modal (Overlay Flyout).
     * @private
     * @param {Object} condition
     */
    _renderSideSheet(condition) {
        const $overlay = $('#condition-detail-overlay');
        const $backdrop = $('#condition-detail-backdrop');
        const $panel = $('#condition-detail-panel');
        const $conditionDetailsClassName = $('#condition-detail-class-name');

        if (!$panel.length) return;

        const { source, contextId, outcome, matches = [] } = condition;
        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = this._extractClassAndPackage(source);
        const displayClassName = memberName ? `${className}#${memberName}` : className;

        // Populate Header
        $conditionDetailsClassName.text(displayClassName);
        $('#condition-detail-package-name').text(packageName || 'default package');
        $('#condition-detail-context-badge').text(contextId || 'SpringContext');
        $('#condition-detail-context-id').text(contextId || '-');
        $('#condition-detail-source-full').text(source);

        // Status Badge
        const statusTheme = isMatched ? CONDITION_STATUS_THEMES.matched : CONDITION_STATUS_THEMES.notMatched;
        $('#condition-detail-status-badge')
            .removeClass()
            .addClass(`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 shadow-xs ${statusTheme.badge}`);
        $('#condition-detail-status-icon').text(statusTheme.icon);
        $('#condition-detail-status-text').text(statusTheme.label);

        // Summary Icon & Reason Text
        const failedMatch = matches.find(m => !m.matched);
        const $reasonIcon = $('#condition-detail-reason-icon');
        const $reasonText = $('#condition-detail-reason-text');

        if (isMatched) {
            $reasonIcon.text('check_circle').removeClass('text-red-500').addClass('text-emerald-500');
            $reasonText.text('All condition evaluations satisfied. Configuration applied.');
            $('#condition-detail-diagnostic-msg').text(
                matches.map(m => `• ${this._formatConditionName(m.condition)}: ${m.message}`).join('\n') || 'Configuration evaluated successfully.'
            );
        } else {
            $reasonIcon.text('cancel').removeClass('text-emerald-500').addClass('text-red-500');
            const failureReason = failedMatch?.message || 'One or more required conditions did not match.';
            $reasonText.text(failureReason);
            $('#condition-detail-diagnostic-msg').text(failureReason);
        }

        // Render Condition Outcomes List
        const $matchesList = $('#condition-detail-matches-list');
        $matchesList.empty();
        $('#condition-detail-matches-count').text(`${matches.length} conditions`);

        if (matches.length === 0) {
            $matchesList.html('<p class="text-xs text-gray-400 italic py-4">No individual condition checks recorded.</p>');
        } else {
            const matchesFrag = document.createDocumentFragment();

            for (const match of matches) {
                const matchClone = TemplateEngine.clone('tpl-condition-match-item');
                if (matchClone?.firstElementChild) {
                    const $item = $(matchClone.firstElementChild);
                    const isItemMatched = match.matched;

                    const $icon = $item.find('[data-field="matchIcon"]');
                    const $name = $item.find('[data-field="conditionName"]');
                    const $msg = $item.find('[data-field="matchMessage"]');
                    const $badge = $item.find('[data-field="matchStatusBadge"]');

                    $name.text(this._formatConditionName(match.condition));
                    $msg.text(match.message || 'No additional message');

                    if (isItemMatched) {
                        $icon.text('check_circle').addClass('text-emerald-500');
                        $badge.text('Matched')
                            .addClass('bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40');
                    } else {
                        $icon.text('cancel').addClass('text-red-500');
                        $badge.text('Did Not Match')
                            .addClass('bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40');
                        $item.addClass('bg-red-50/30 dark:bg-red-950/20 border-red-100 dark:border-red-900/30');
                    }

                    matchesFrag.appendChild(matchClone);
                }
            }

            $matchesList.append(matchesFrag);
        }

        // Open Side-Sheet with smooth flyout animation
        $overlay.removeClass('hidden pointer-events-none');
        $backdrop.removeClass('opacity-0 pointer-events-none').addClass('opacity-100 pointer-events-auto');
        if ($panel.length) {
            void $panel[0].offsetWidth;
        }
        requestAnimationFrame(() => {
            $panel.removeClass('translate-x-full').addClass('translate-x-0');
        });
    }

    /**
     * Option 3: Renders detailed breakdown into an expandable inline table row (Accordion).
     * @private
     * @param {Object} condition
     */
    _renderInlineAccordion(condition) {
        // Remove any prior expanded row immediately
        $('.condition-expanded-row').remove();

        const { source, contextId, outcome, matches = [] } = condition;
        const $targetRow = $(`.condition-row[data-context-id="${contextId}"][data-source="${source}"]`);
        if (!$targetRow.length) return;

        const clone = TemplateEngine.clone('tpl-condition-expanded-row');
        if (!clone || !clone.firstElementChild) return;

        const $expandedRow = $(clone.firstElementChild);
        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = this._extractClassAndPackage(source);
        const displayClassName = memberName ? `${className}#${memberName}` : className;

        // Header info
        $expandedRow.find('[data-field="className"]').text(displayClassName);
        $expandedRow.find('[data-field="contextBadge"]').text(contextId || 'SpringContext');
        $expandedRow.find('[data-field="sourceFull"]').text(source);

        // Status Badge
        const statusTheme = isMatched ? CONDITION_STATUS_THEMES.matched : CONDITION_STATUS_THEMES.notMatched;
        $expandedRow.find('[data-field="statusBadge"]')
            .addClass(`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 shadow-xs ${statusTheme.badge}`);
        $expandedRow.find('[data-field="statusIcon"]').text(statusTheme.icon);
        $expandedRow.find('[data-field="statusText"]').text(statusTheme.label);

        // Summary Icon & Reason Text
        const failedMatch = matches.find(m => !m.matched);
        const $reasonIcon = $expandedRow.find('[data-field="reasonIcon"]');
        const $reasonText = $expandedRow.find('[data-field="reasonText"]');
        const $diagMsg = $expandedRow.find('[data-field="diagnosticMsg"]');

        if (isMatched) {
            $reasonIcon.text('check_circle').addClass('text-emerald-500');
            $reasonText.text('All condition evaluations satisfied. Configuration applied.');
            $diagMsg.text(
                matches.map(m => `• ${this._formatConditionName(m.condition)}: ${m.message}`).join('\n') || 'Configuration evaluated successfully.'
            );
        } else {
            $reasonIcon.text('cancel').addClass('text-red-500');
            const failureReason = failedMatch?.message || 'One or more required conditions did not match.';
            $reasonText.text(failureReason);
            $diagMsg.text(failureReason);
        }

        // Render Condition Outcomes List
        const $matchesList = $expandedRow.find('[data-field="matchesList"]');
        $matchesList.empty();
        $expandedRow.find('[data-field="matchesCount"]').text(`${matches.length} conditions`);

        if (matches.length === 0) {
            $matchesList.html('<p class="text-xs text-gray-400 italic py-3">No individual condition checks recorded.</p>');
        } else {
            const matchesFrag = document.createDocumentFragment();

            for (const match of matches) {
                const matchClone = TemplateEngine.clone('tpl-condition-match-item');
                if (matchClone?.firstElementChild) {
                    const $item = $(matchClone.firstElementChild);
                    const isItemMatched = match.matched;

                    const $icon = $item.find('[data-field="matchIcon"]');
                    const $name = $item.find('[data-field="conditionName"]');
                    const $msg = $item.find('[data-field="matchMessage"]');
                    const $badge = $item.find('[data-field="matchStatusBadge"]');

                    $name.text(this._formatConditionName(match.condition));
                    $msg.text(match.message || 'No additional message');

                    if (isItemMatched) {
                        $icon.text('check_circle').addClass('text-emerald-500');
                        $badge.text('Matched')
                            .addClass('bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40');
                    } else {
                        $icon.text('cancel').addClass('text-red-500');
                        $badge.text('Did Not Match')
                            .addClass('bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40');
                        $item.addClass('bg-red-50/30 dark:bg-red-950/20 border-red-100 dark:border-red-900/30');
                    }

                    matchesFrag.appendChild(matchClone);
                }
            }

            $matchesList.append(matchesFrag);
        }

        // Insert expanded row directly underneath target row and animate smoothly via CSS Grid
        $targetRow.after($expandedRow);
        const $wrapper = $expandedRow.find('.condition-accordion-wrapper');
        // Force browser layout reflow to guarantee smooth transition from 0fr
        if ($wrapper.length) {
            void $wrapper[0].offsetHeight;
        }
        requestAnimationFrame(() => {
            $wrapper.addClass('open');
        });
    }

    /**
     * Closes the detail panel and clears selection smoothly across both modes.
     * @param {Function} [callback]
     */
    closeDetail(callback) {
        // Clear active row highlight and reset rotated arrow icons
        $('.condition-row')
            .removeClass(CSS_CLASSES.rowActive)
            .find('[data-field="expandIcon"]')
            .removeClass('rotate-90 text-primary dark:text-purple-300');
        this.selectedCondition = null;

        // 1. Close Side-Sheet flyout if open
        const $overlay = $('#condition-detail-overlay');
        const $backdrop = $('#condition-detail-backdrop');
        const $panel = $('#condition-detail-panel');

        if ($panel.hasClass('translate-x-0')) {
            $panel.removeClass('translate-x-0').addClass('translate-x-full');
            $backdrop.removeClass('opacity-100 pointer-events-auto').addClass('opacity-0 pointer-events-none');
            setTimeout(() => {
                $overlay.addClass('hidden pointer-events-none');
                if (typeof callback === 'function') callback();
            }, 300);
            return;
        }

        // 2. Close Inline Accordion row if open
        const $existing = $('.condition-expanded-row');
        if ($existing.length) {
            const $wrapper = $existing.find('.condition-accordion-wrapper');
            $wrapper.removeClass('open');
            setTimeout(() => {
                $existing.remove();
                if (typeof callback === 'function') callback();
            }, 550);
            return;
        }

        if (typeof callback === 'function') {
            callback();
        }
    }

    /**
     * Renders pagination metadata and page navigation buttons.
     */
    renderPagination() {
        const { totalElements, pageNumber, pageSize } = this.paginationState;

        const infoText = Pagination.formatInfoText(totalElements, pageNumber, pageSize, 'auto-configurations');
        $('#condition-pagination-info').text(infoText);

        Pagination.renderPaginationButtons($('#condition-pagination-buttons'), this.paginationState);
    }

    /**
     * Shows loading placeholder in table.
     */
    renderLoadingState() {
        const $tbody = $('#condition-table-body');
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-condition-loading');
        if (clone) $tbody.empty().append(clone);
    }

    /**
     * Shows error state in table.
     * @param {string} errorMessage
     */
    renderErrorState(errorMessage) {
        const $tbody = $('#condition-table-body');
        if (!$tbody.length) return;
        const clone = TemplateEngine.clone('tpl-condition-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch condition evaluations: ${errorMessage}`);
            $tbody.empty().append(clone);
        }
    }

    /**
     * Initializes action router and event listeners.
     */
    initEvents() {
        this._initActionHandlers();
        this._bindSearchInput();
        this._bindSelectFilters();
        this._bindClickActionDelegation();
        this._bindGlobalKeydown();
        this.renderViewStyleButtons();
    }

    /**
     * Registers actions for data-action clicks.
     * @private
     */
    _initActionHandlers() {
        this._clickActions = {
            'refresh-data': ($target) => this._handleRefreshData($target),
            'filter-outcome': ($target) => this._handleFilterOutcome($target),
            'select-condition': ($target) => this._handleSelectCondition($target),
            'toggle-view-style': ($target) => this.setViewStyle($target.data('style') || 'side-sheet'),
            'close-detail': () => this.closeDetail(),
            'change-page': ($target) => this._handleChangePage($target),
            'prev-page': () => this._handlePrevPage(),
            'next-page': () => this._handleNextPage()
        };
    }

    /**
     * Changes the detail view style between 'side-sheet' and 'inline' accordion.
     * @param {'side-sheet'|'inline'} style
     */
    setViewStyle(style) {
        if (this.detailViewStyle === style) return;
        this.closeDetail();
        this.detailViewStyle = style;
        localStorage.setItem('condition_detail_view_style', style);
        this.renderViewStyleButtons();
    }

    /**
     * Synchronizes the visual state of the view style segmented buttons.
     */
    renderViewStyleButtons() {
        const isSideSheet = this.detailViewStyle === 'side-sheet';
        const activeClass = 'bg-white dark:bg-slate-900 text-primary dark:text-purple-300 font-bold shadow-xs';
        const inactiveClass = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';

        $('#btn-view-style-side-sheet')
            .removeClass(`${activeClass} ${inactiveClass}`)
            .addClass(isSideSheet ? activeClass : inactiveClass);

        $('#btn-view-style-inline')
            .removeClass(`${activeClass} ${inactiveClass}`)
            .addClass(!isSideSheet ? activeClass : inactiveClass);
    }

    /**
     * Binds global keyboard shortcuts (Esc to close detail).
     * @private
     */
    _bindGlobalKeydown() {
        this._on(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDetail();
            }
        });
    }

    /**
     * Debounced search input handler.
     * @private
     */
    _bindSearchInput() {
        this._on('#condition-search-input', 'input', (e) => {
            this.searchQuery = e.target.value.trim();
            this._debouncedSearch();
        });

        this._on('#condition-search-input', 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedSearch.flush();
            } else if (e.key === 'Escape') {
                this._debouncedSearch.cancel();
                this.searchQuery = '';
                $('#condition-search-input').val('');
                this.currentPage = 1;
                this.fetchConditionEvaluationData();
            }
        });
    }

    /**
     * Binds dropdown change events (group by, page size).
     * @private
     */
    _bindSelectFilters() {
        this._on('#condition-group-by', 'change', (e) => {
            this.groupBy = e.target.value;
            this.renderTableRows();
        });

        this._on('#condition-page-size', 'change', (e) => {
            this.pageSize = parseInt(e.target.value, 10) || 10;
            this.currentPage = 1;
            this.fetchConditionEvaluationData();
        });
    }

    /**
     * Centralized click delegation for [data-action] elements.
     * @private
     */
    _bindClickActionDelegation() {
        this._on(document, 'click', '[data-action]', (e) => {
            const $target = $(e.currentTarget);
            const action = $target.data('action');
            const handler = this._clickActions[action];

            if (handler) {
                e.preventDefault();
                handler($target, e);
            }
        });
    }

    async _handleRefreshData($target) {
        const $icon = $target.find('.material-symbols-outlined').addClass('animate-spin');
        try {
            await Promise.all([
                this.fetchSummaryMetrics(),
                this.fetchConditionEvaluationData()
            ]);
        } catch (err) {
            console.error('Error refreshing condition evaluations:', err);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 500);
        }
    }

    _handleFilterOutcome($target) {
        const outcome = $target.data('outcome') || '';
        this.outcomeFilter = outcome;
        this.renderTabs();
        this.currentPage = 1;
        this.fetchConditionEvaluationData();
    }

    _handleSelectCondition($target) {
        const { source, contextId } = $target.data();
        if (source && contextId) {
            this.selectCondition(contextId, source);
        }
    }

    _handleChangePage($target) {
        const targetPage = parseInt($target.data('page'), 10);
        if (!isNaN(targetPage) && targetPage !== this.currentPage) {
            this.currentPage = targetPage;
            this.fetchConditionEvaluationData();
        }
    }

    _handlePrevPage() {
        if (!this.paginationState.isFirstPage && this.currentPage > 1) {
            this.currentPage--;
            this.fetchConditionEvaluationData();
        }
    }

    _handleNextPage() {
        if (!this.paginationState.isLastPage && this.currentPage < this.paginationState.totalPages) {
            this.currentPage++;
            this.fetchConditionEvaluationData();
        }
    }

    /**
     * Helper for namespaced jQuery event binding.
     * @private
     */
    _on(target, event, delegateOrHandler, maybeHandler) {
        const namespace = '.conditionReports';
        const namespacedEvent = `${event}${namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }
    }

    /**
     * Cleans up event listeners and debounce timer on route leave.
     */
    leave() {
        this.closeDetail();
        this._resetFilterState();
        this._debouncedSearch?.cancel();
        $(document).off('.conditionReports');
        $('#condition-search-input, #condition-group-by, #condition-page-size').off('.conditionReports');
    }
}