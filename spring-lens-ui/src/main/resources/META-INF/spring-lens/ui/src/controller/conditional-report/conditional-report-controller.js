import BaseController from '../base-controller.js';
import {
    conditionKpiWidget,
    conditionTabsWidget,
    conditionTableWidget,
    conditionDetailWidget,
    Pagination,
    QueryParam,
    AsyncUtils,
    container
} from './index.js';

export class ConditionalReportController extends BaseController {

    rawConditions = [];
    conditionReportMetrics = null;
    _tableFetchSeq = 0;

    constructor() {
        super('conditionReports');

        this.service = container.make('conditionService');
        this.applicationState = container.make('applicationState');

        this.state = {
            appName: this.applicationState?.getAppName?.() || 'SpringLens',
            kpiTotal: '--',
            kpiMatchedCount: '0',
            kpiMatchedPct: '0',
            kpiUnmatchedCount: '0',
            kpiUnmatchedPct: '0',
            kpiConditionsTotal: '--',
            summaryLoading: true,

            countAll: '0',
            countMatched: '0',
            countUnmatched: '0',

            searchQuery: '',
            searchTotalCount: null,
            outcomeFilter: '',
            groupBy: 'none',
            pageSize: 10,
            currentPage: 1,
            sortBy: 'source',
            sortDir: 'ASC',
            detailViewStyle: localStorage.getItem('condition_detail_view_style') || 'side-sheet',

            rows: [],
            tableLoading: true,
            tableError: null,
            pagination: Pagination.defaultState(10),
            paginationInfo: Pagination.formatInfoText(0, 0, 10, 'auto-configurations'),
            pageButtons: [],

            selectedCondition: null,
            selectedConditionDetails: null,
            refreshing: false
        };

        this._debouncedSearch = AsyncUtils.debounce(() => {
            this.setState({ currentPage: 1 });
            this.fetchConditionEvaluationData().then(() => {});
        }, 200);

        this.addDisposable(this._debouncedSearch);
    }

    createAlpineState() {
        return {
            ...this.state,
            onSearchInput: (event) => this.onSearchInput(event),
            onSearchEnter: () => this.onSearchEnter(),
            clearSearch: () => this.clearSearch(),
            filterOutcome: (outcome) => this.filterOutcome(outcome),
            onGroupByChange: (event) => this.onGroupByChange(event),
            onPageSizeChange: (event) => this.onPageSizeChange(event),
            switchDetailViewStyle: (style) => this.switchDetailViewStyle(style),
            sort: (column) => this.sort(column),
            getSortIcon: (column) => this.getSortIcon(column),

            prevPage: () => this.prevPage(),
            nextPage: () => this.nextPage(),
            goToPage: (page) => this.goToPage(page),

            selectCondition: (row) => this.selectCondition(row),
            isSelected: (row) => this.isSelected(row),
            closeDetail: () => this.closeDetail(),

            refreshData: () => this.refreshData()
        };
    }

    _resetFilterState() {
        const tabCounts = conditionTabsWidget.computeTabCounts(this.conditionReportMetrics, '', null);
        this.setState({
            currentPage: 1,
            pageSize: 10,
            searchQuery: '',
            searchTotalCount: null,
            outcomeFilter: '',
            groupBy: 'none',
            sortBy: 'source',
            sortDir: 'ASC',
            selectedCondition: null,
            selectedConditionDetails: null,
            countAll: tabCounts.allCount,
            countMatched: tabCounts.matchedCount,
            countUnmatched: tabCounts.unmatchedCount
        });

        const $searchInput = document.getElementById('condition-search-input');
        if ($searchInput) {
            $searchInput.value = '';
        }
    }

    async enter(params, context = null) {
        await super.enter(params, context);

        try {
            this.closeDetail();
            this._resetFilterState();

            const queryParams = QueryParam.parse(params);
            const targetCondition = QueryParam.get(queryParams, 'search', 'condition');
            const outcome = QueryParam.get(queryParams, 'outcome');

            const patch = {};
            if (targetCondition) {
                patch.searchQuery = targetCondition;
                const $searchInput = document.getElementById('condition-search-input');
                if ($searchInput) {
                    $searchInput.value = targetCondition;
                }
            }
            if (outcome) {
                patch.outcomeFilter = outcome;
            }
            if (Object.keys(patch).length > 0) {
                this.setState(patch);
            }

            this._bindEventListeners();

            if (this.applicationState?.onAppInfoChange) {
                const unsub = this.applicationState.onAppInfoChange((info) => {
                    if (info?.name) {
                        this.setState({ appName: info.name });
                    }
                });
                if (unsub) this.addDisposable(unsub);
            }

            await Promise.allSettled([
                this.fetchSummaryMetrics(),
                this.fetchConditionEvaluationData()
            ]);

            if (targetCondition && this.rawConditions && this.rawConditions.length > 0) {
                const match = this.rawConditions.find(c => c.source === targetCondition) || this.rawConditions[0];
                if (match) {
                    await this.selectCondition(match);
                }
            }
        } catch (error) {
            console.error('Error during ConditionalReport enter:', error);
        }
    }

    async fetchSummaryMetrics() {
        this.setState({ summaryLoading: true });
        try {
            const conditionReportSummary = await this.service.fetchConditionalSummary();
            this.conditionReportMetrics = conditionReportSummary || {};

            const kpi = conditionKpiWidget.computeMetrics(this.conditionReportMetrics);
            const tabCounts = conditionTabsWidget.computeTabCounts(
                this.conditionReportMetrics,
                this.state.searchQuery,
                this.state.searchTotalCount
            );

            this.setState({
                kpiTotal: kpi.total,
                kpiMatchedCount: kpi.matchedCount,
                kpiMatchedPct: kpi.matchedPct,
                kpiUnmatchedCount: kpi.unmatchedCount,
                kpiUnmatchedPct: kpi.unmatchedPct,
                kpiConditionsTotal: kpi.conditionsTotal,
                countAll: tabCounts.allCount,
                countMatched: tabCounts.matchedCount,
                countUnmatched: tabCounts.unmatchedCount,
                summaryLoading: false
            });
        } catch (error) {
            console.error('Error fetching condition summary metrics:', error);
            this.setState({ summaryLoading: false });
        }
    }

    _updateFormattedRows() {
        const rows = conditionTableWidget.formatTableRows(this.rawConditions, {
            groupBy: this.state.groupBy,
            selectedCondition: this.state.selectedCondition,
            detailViewStyle: this.state.detailViewStyle,
            selectedConditionDetails: this.state.selectedConditionDetails
        });
        this.setState({ rows });
    }

    _applyEvaluationsResponse(response) {
        const { content, pagination, pageButtons, paginationInfo } = Pagination.compute(
            response,
            this.state.currentPage - 1,
            this.state.pageSize,
            'auto-configurations'
        );

        this.rawConditions = content;

        if (this.state.searchQuery) {
            if (!this.state.outcomeFilter) {
                const totalElements = pagination.totalElements;
                const tabCounts = conditionTabsWidget.computeTabCounts(
                    this.conditionReportMetrics,
                    this.state.searchQuery,
                    totalElements
                );
                this.setState({
                    searchTotalCount: totalElements,
                    countAll: tabCounts.allCount
                });
            } else if (this.state.searchTotalCount === null) {
                this.service.fetchSearchTotalCount(this.state.searchQuery).then(count => {
                    if (count !== null) {
                        const tabCounts = conditionTabsWidget.computeTabCounts(
                            this.conditionReportMetrics,
                            this.state.searchQuery,
                            count
                        );
                        this.setState({
                            searchTotalCount: count,
                            countAll: tabCounts.allCount
                        });
                    }
                });
            }
        } else {
            if (!this.state.outcomeFilter && pagination?.totalElements !== undefined) {
                if (!this.conditionReportMetrics) {
                    this.conditionReportMetrics = { totalConditionSources: pagination.totalElements };
                } else if (!this.conditionReportMetrics.totalConditionSources) {
                    this.conditionReportMetrics.totalConditionSources = pagination.totalElements;
                }
            }
            const tabCounts = conditionTabsWidget.computeTabCounts(
                this.conditionReportMetrics,
                '',
                null
            );
            this.setState({
                searchTotalCount: null,
                countAll: tabCounts.allCount,
                countMatched: tabCounts.matchedCount,
                countUnmatched: tabCounts.unmatchedCount
            });
        }

        const rows = conditionTableWidget.formatTableRows(content, {
            groupBy: this.state.groupBy,
            selectedCondition: this.state.selectedCondition,
            detailViewStyle: this.state.detailViewStyle,
            selectedConditionDetails: this.state.selectedConditionDetails
        });

        this.setState({
            rows,
            currentPage: pagination.pageNumber + 1,
            pageSize: pagination.pageSize,
            pagination,
            pageButtons,
            paginationInfo,
            tableLoading: false
        });
    }

    async fetchConditionEvaluationData() {
        this.setState({ tableLoading: true, tableError: null });
        const seq = ++this._tableFetchSeq;

        try {
            const response = await this.service.fetchConditionEvaluations({
                pageNumber: Math.max(0, (this.state.currentPage || 1) - 1),
                pageSize: this.state.pageSize,
                search: this.state.searchQuery,
                outcome: this.state.outcomeFilter,
                sortBy: this.state.sortBy,
                sortDir: this.state.sortDir
            });

            if (seq === this._tableFetchSeq) {
                this._applyEvaluationsResponse(response);
            }
        } catch (error) {
            if (seq === this._tableFetchSeq) {
                console.error('Error fetching condition evaluations:', error);
                this.setState({
                    tableLoading: false,
                    tableError: error.message || 'Failed to fetch condition evaluations'
                });
            }
        }
    }

    async selectCondition(rowOrItem) {
        if (!rowOrItem) return;
        if (rowOrItem.isGroupHeader || rowOrItem.isDetailRow) return;

        const source = rowOrItem.source || rowOrItem.raw?.source;
        const contextId = rowOrItem.contextId !== undefined ? rowOrItem.contextId : (rowOrItem.raw?.contextId || '');
        if (!source) return;

        if (this.state.selectedCondition?.source === source && (this.state.selectedCondition?.contextId || '') === contextId) {
            this.closeDetail();
            return;
        }

        const selectedCondition = { contextId, source };
        const localMatch = this.rawConditions.find(c => c.source === source && (c.contextId || '') === contextId) || rowOrItem.raw || rowOrItem;
        const localDetails = localMatch ? conditionDetailWidget.formatDetails(localMatch) : null;

        this.setState({
            selectedCondition,
            selectedConditionDetails: localDetails
        });
        this._updateFormattedRows();

        try {
            const detailed = await this.service.findConditionEvaluation(contextId, source);
            if (detailed && this.state.selectedCondition?.source === source && (this.state.selectedCondition?.contextId || '') === contextId) {
                const formatted = conditionDetailWidget.formatDetails(detailed);
                this.setState({
                    selectedConditionDetails: formatted
                });
                this._updateFormattedRows();
            }
        } catch (error) {
            console.warn(`Failed to fetch full details for condition ${source}:`, error);
        }
    }

    closeDetail() {
        this.setState({
            selectedCondition: null,
            selectedConditionDetails: null
        });
        this._updateFormattedRows();
    }

    isSelected(row) {
        if (!row || row.isGroupHeader || row.isDetailRow || !this.state.selectedCondition) return false;
        const source = row.source || row.raw?.source;
        const contextId = row.contextId !== undefined ? row.contextId : (row.raw?.contextId || '');
        return this.state.selectedCondition.source === source && (this.state.selectedCondition.contextId || '') === contextId;
    }

    filterOutcome(outcome = '') {
        if (this.state.outcomeFilter === outcome) return;
        this.setState({
            outcomeFilter: outcome,
            currentPage: 1
        });
        this.fetchConditionEvaluationData();
    }

    onGroupByChange(event) {
        const groupBy = event?.target?.value ?? this.state.groupBy ?? 'none';
        this.setState({ groupBy });
        this._updateFormattedRows();
    }

    onPageSizeChange(event) {
        const pageSize = Number(event?.target?.value ?? this.state.pageSize ?? 10);
        this.setState({
            pageSize,
            currentPage: 1
        });
        this.fetchConditionEvaluationData();
    }

    switchDetailViewStyle(style) {
        if (this.state.detailViewStyle === style) return;
        this.setState({ detailViewStyle: style });
        localStorage.setItem('condition_detail_view_style', style);
        this._updateFormattedRows();
    }

    sort(column) {
        if (!column) return;
        let direction = 'ASC';
        if (this.state.sortBy === column) {
            direction = this.state.sortDir === 'ASC' ? 'DESC' : 'ASC';
        }
        this.setState({
            sortBy: column,
            sortDir: direction,
            currentPage: 1
        });
        this.fetchConditionEvaluationData();
    }

    getSortIcon(column) {
        return conditionTableWidget.getSortIcon(this.state.sortBy, this.state.sortDir, column);
    }

    prevPage() {
        if (!this.state.pagination.isFirstPage) {
            this.goToPage(this.state.currentPage - 1);
        }
    }

    nextPage() {
        if (!this.state.pagination.isLastPage) {
            this.goToPage(this.state.currentPage + 1);
        }
    }

    goToPage(page) {
        const targetPage = Number(page);
        if (!targetPage || targetPage === this.state.currentPage) return;
        this.setState({ currentPage: targetPage });
        this.fetchConditionEvaluationData();
    }

    onSearchInput(event) {
        const query = (event?.target?.value ?? this.state.searchQuery ?? '').trim();
        if (!query) {
            this._debouncedSearch?.cancel?.();
            const tabCounts = conditionTabsWidget.computeTabCounts(this.conditionReportMetrics, '', null);
            this.setState({
                searchQuery: '',
                searchTotalCount: null,
                currentPage: 1,
                countAll: tabCounts.allCount,
                countMatched: tabCounts.matchedCount,
                countUnmatched: tabCounts.unmatchedCount
            });
            this.fetchConditionEvaluationData();
            return;
        }

        this.setState({
            searchQuery: query,
            searchTotalCount: null
        });
        this._debouncedSearch();
    }

    onSearchEnter() {
        this._debouncedSearch?.flush?.();
    }

    clearSearch() {
        this._debouncedSearch?.cancel?.();
        const tabCounts = conditionTabsWidget.computeTabCounts(this.conditionReportMetrics, '', null);
        this.setState({
            searchQuery: '',
            searchTotalCount: null,
            currentPage: 1,
            countAll: tabCounts.allCount,
            countMatched: tabCounts.matchedCount,
            countUnmatched: tabCounts.unmatchedCount
        });
        const $searchInput = document.getElementById('condition-search-input');
        if ($searchInput) {
            $searchInput.value = '';
        }
        this.fetchConditionEvaluationData();
    }

    _bindEventListeners() {
        const keydownHandler = (e) => {
            if (e.key === 'Escape' && this.state.selectedCondition) {
                this.closeDetail();
            }
        };
        document.addEventListener('keydown', keydownHandler);
        this.addDisposable(() => document.removeEventListener('keydown', keydownHandler));
    }

    async refreshData() {
        this.setState({ refreshing: true });
        try {
            await Promise.allSettled([
                this.fetchSummaryMetrics(),
                this.fetchConditionEvaluationData()
            ]);
        } finally {
            setTimeout(() => this.setState({ refreshing: false }), 500);
        }
    }

    leave() {
        this.closeDetail();
        this._resetFilterState();
        this.rawConditions = [];
        super.leave();
    }
}