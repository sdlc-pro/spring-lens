import BaseController from '../base-controller.js';
import {
    definitionChartsWidget,
    definitionTableWidget,
    definitionSidebarWidget,
    definitionGraphModalWidget,
    beanDataStore,
    DomUtils,
    Guard,
    Pagination,
    QueryParam,
    ToastNotification,
    container
} from './index.js';

export class DefinitionController extends BaseController {

    static DEFAULT_FILTER_CRITERIA = Object.freeze({
        contextId: '',
        scope: '',
        role: '',
        primary: '',
        lazyInit: ''
    });

    static DEFAULT_GRAPH_TOOLTIP = Object.freeze({
        visible: false,
        x: 0,
        y: 0,
        placement: 'bottom',
        name: '',
        type: '',
        scope: '',
        role: '',
        kind: '',
        kindClass: '',
        meta: '',
        loading: false
    });

    rawBeans = [];
    summaryData = null;
    _tableFetchSeq = 0;

    constructor() {
        super('definitions');
        this.service = container.make('definitionService');
        this.applicationState = container.make('applicationState');

        this._wireModalWidget();
        this.addDisposable(definitionChartsWidget);

        this.state = this._initialState();
    }

    _initialState() {
        return {
            appName: this.applicationState?.getAppName?.() || 'SpringLens',
            totalDefinitions: '--',
            contextDistributionList: [],
            scopeLegend: [],
            roleLegend: [],
            loadingModeLegend: [],
            contextOptions: [],
            scopeOptions: [],
            summaryLoading: true,

            searchQuery: '',
            filterCriteria: { ...DefinitionController.DEFAULT_FILTER_CRITERIA },
            itemsPerPage: 20,
            currentPage: 1,
            sortColumn: '',
            sortDirection: 'asc',

            beans: [],
            tableLoading: true,
            tableError: null,
            pagination: Pagination.defaultState(20),
            paginationInfo: Pagination.formatInfoText(0, 0, 20, 'beans'),
            pageButtons: [],

            selectedKey: null,
            selectedBean: null,
            selectedBeanMeta: { icon: 'schema', color: '#8b5cf6' },
            selectedBeanFormatted: {
                scope: 'Singleton',
                role: 'Application',
                contextId: '-'
            },
            sidebarDeps: [],
            sidebarDependents: [],
            sidebarOpen: false,
            sidebarTab: 'properties',
            sidebarLoading: false,

            graphModalOpen: false,
            graphMode: 'lr',
            graphTargetBean: null,
            graphTooltip: { ...DefinitionController.DEFAULT_GRAPH_TOOLTIP },
            isExportingGraph: false,
            refreshing: false
        };
    }

    _wireModalWidget() {
        definitionGraphModalWidget.onSelectBean = (beanName) => this.selectGraphNode(beanName);
        definitionGraphModalWidget.onTooltipChange = (tooltip) => {
            this.setState({
                graphTooltip: { ...this.state.graphTooltip, ...tooltip }
            });
        };
        if (this.service?.endpoints?.find) {
            definitionGraphModalWidget.findBeanEndpoint = this.service.endpoints.find;
        }
    }

    _getResetFilterState() {
        return {
            searchQuery: '',
            filterCriteria: { ...DefinitionController.DEFAULT_FILTER_CRITERIA },
            itemsPerPage: 20,
            currentPage: 1,
            sortColumn: '',
            sortDirection: 'asc',
            selectedKey: null,
            selectedBean: null
        };
    }

    _resetFilterState() {
        this.setState(this._getResetFilterState());
    }

    createAlpineState() {
        return {
            ...this.state,
            onSearchInput: (event) => this.onSearchInput(event),
            clearSearch: () => this.clearSearch(),
            onFilterChange: () => this.onFilterChange(),
            onPageSizeChange: (event) => this.onPageSizeChange(event),
            resetFilters: () => this.resetFilters(),
            sort: (column) => this.sort(column),
            getSortIcon: (column) => this.getSortIcon(column),

            prevPage: () => this.prevPage(),
            nextPage: () => this.nextPage(),
            goToPage: (page) => this.goToPage(page),

            selectBean: (beanName, contextId) => this.selectBean(beanName, contextId),
            isSelected: (id) => this.isSelected(id),
            closeSidebar: () => this.closeSidebar(),
            setSidebarTab: (tab) => this.setSidebarTab(tab),

            openGraphModal: () => this.openGraphModal(),
            closeGraphModal: () => this.closeGraphModal(),
            setGraphMode: (mode) => this.setGraphMode(mode),
            graphZoomIn: () => this.graphZoomIn(),
            graphZoomOut: () => this.graphZoomOut(),
            graphFitView: () => this.graphFitView(),
            exportModalGraph: () => this.exportModalGraph(),

            refreshData: () => this.refreshData(),
            exportData: () => this.exportData()
        };
    }

    _parseQueryParams(params) {
        const queryParams = QueryParam.parse(params);
        const targetBean = QueryParam.get(queryParams, 'search', 'bean', 'beanName') || '';
        const targetContextId = QueryParam.get(queryParams, 'contextId', 'context') || '';

        const patch = {};
        if (targetBean) patch.searchQuery = targetBean;
        if (targetContextId) {
            patch.filterCriteria = { ...this.state.filterCriteria, contextId: targetContextId };
        }
        if (Object.keys(patch).length > 0) {
            this.setState(patch);
        }

        return { targetBean, targetContextId };
    }

    async _handleDeepLink(targetBean, targetContextId) {
        if (Guard.isBlank(targetBean)) return;
        await this.selectBean(targetBean, targetContextId);
    }

    async enter(params, context) {
        await super.enter(params, context);

        this._wireModalWidget();
        this.closeSidebar();
        this._resetFilterState();
        this._bindEventListeners();

        const { targetBean, targetContextId } = this._parseQueryParams(params);

        await Promise.allSettled([
            this.fetchBeanDefinitions(),
            this.fetchBeanDefinitionSummary()
        ]);

        if (targetBean) {
            await this._handleDeepLink(targetBean, targetContextId);
        }
    }

    leave() {
        this.rawBeans = [];
        this._tableFetchSeq++;
        this.summaryData = null;
        this.closeSidebar();
        this.closeGraphModal();
        this._resetFilterState();
        definitionChartsWidget.destroyCharts();
        beanDataStore.clear();

        super.leave();
    }

    async fetchBeanDefinitionSummary() {
        this.setState({ summaryLoading: true });

        const summary = await this.service.fetchBeanDefinitionSummary();

        this.summaryData = summary;
        const metrics = definitionChartsWidget.computeMetrics(summary);
        this.setState({ ...metrics, summaryLoading: false });
        definitionChartsWidget.renderCharts(summary);
    }

    _buildTableQuery() {
        return {
            pageNumber     : Math.max(0, (this.state.currentPage || 1) - 1),
            pageSize       : Number(this.state.itemsPerPage) || 20,
            sortBy         : this.state.sortColumn,
            sortDir        : (this.state.sortDirection || 'asc').toUpperCase(),
            search         : this.state.searchQuery?.trim(),
            filterCriteria : this.alpine?.filterCriteria || this.state.filterCriteria || {}
        };
    }

    _applyTableResponse(response, pageNumber, pageSize) {
        const { content, pagination, pageButtons, paginationInfo } = Pagination.compute(response, pageNumber, pageSize, 'beans');
        this.rawBeans = content;
        beanDataStore.addBeans(content);

        this.setState({
            beans: definitionTableWidget.formatBeanRows(content),
            currentPage: pagination.pageNumber + 1,
            itemsPerPage: pagination.pageSize,
            pagination,
            pageButtons,
            paginationInfo,
            tableLoading: false,
            tableError: response ? null : 'Failed to load bean definitions'
        });
    }

    async fetchBeanDefinitions() {
        this.setState({ tableLoading: true, tableError: null });
        const seq = ++this._tableFetchSeq;
        const query = this._buildTableQuery();

        const response = await this.service.fetchBeanDefinitions(query);

        if (seq === this._tableFetchSeq) {
            this._applyTableResponse(response, query.pageNumber, query.pageSize);
        }
    }

    async selectBean(beanName, contextId) {
        if (Guard.isBlank(beanName)) return false;

        const selectedKey = `${contextId || ''}::${beanName}`;
        let bean = beanDataStore.findBeanByName(beanName, contextId);
        this.setState({
            selectedKey,
            selectedBean: bean || null
        });

        if (!Guard.hasDependencies(bean)) {
            const remote = await this.service.fetchBeanDefinitionDetails(beanName, contextId);
            if (remote) {
                beanDataStore.addBeans([remote]);
                bean = remote;
            }
        }
        if (Guard.isBlank(bean)) {
            this.setState({ selectedKey: null });
            ToastNotification.show({
                title: 'Bean Definition Not Found',
                message: `The bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${beanName}</strong> could not be located in the application context.`,
                type: 'warning',
                duration: 4000
            });
            return false;
        }

        const details = definitionSidebarWidget.formatDetails(bean);
        this.setState({
            selectedKey,
            selectedBean: bean,
            selectedBeanMeta: details?.meta || { icon: 'schema', color: '#8b5cf6' },
            selectedBeanFormatted: details,
            sidebarDeps: definitionSidebarWidget.formatDependencyItems(bean.dependencies || [], bean.contextId),
            sidebarDependents: definitionSidebarWidget.formatDependencyItems(bean.dependents || [], bean.contextId),
            sidebarTab: 'properties',
            sidebarOpen: true
        });

        return true;
    }

    isSelected(id) {
        if (Guard.isBlank(id)) return false;
        return (this.alpine?.selectedKey ?? this.state.selectedKey) === id;
    }

    closeSidebar() {
        this.setState({
            sidebarOpen: false,
            selectedBean: null,
            selectedKey: null
        });
    }

    setSidebarTab(tab) {
        this.setState({ sidebarTab: tab });
    }

    _updateTableQuery(patch = {}, resetPage = true) {
        if (resetPage) patch.currentPage = 1;
        this.setState(patch);
        return this.fetchBeanDefinitions();
    }

    onSearchInput(event) {
        const query = (event?.target?.value ?? this.alpine?.searchQuery ?? this.state?.searchQuery ?? '').trim();
        this._updateTableQuery({ searchQuery: query });
    }

    clearSearch() {
        this._updateTableQuery({ searchQuery: '' });
    }

    onFilterChange() {
        this._updateTableQuery();
    }

    onPageSizeChange(event) {
        const newSize = Number(event?.target?.value ?? this.alpine?.itemsPerPage ?? this.state?.itemsPerPage ?? 20);
        this._updateTableQuery({ itemsPerPage: newSize });
    }

    resetFilters() {
        this._updateTableQuery(this._getResetFilterState());
    }

    sort(column) {
        if (Guard.isBlank(column)) return;
        const direction = (this.state.sortColumn === column && this.state.sortDirection === 'asc') ? 'desc' : 'asc';
        this._updateTableQuery({ sortColumn: column, sortDirection: direction });
    }

    getSortIcon(column) {
        return definitionTableWidget.getSortIcon(column, this.state.sortColumn, this.state.sortDirection);
    }

    prevPage() {
        if (!this.state.pagination.isFirstPage) this.goToPage(this.state.currentPage - 1);
    }

    nextPage() {
        if (!this.state.pagination.isLastPage) this.goToPage(this.state.currentPage + 1);
    }

    goToPage(page) {
        const targetPage = Number(page);
        if (!targetPage || targetPage === this.state.currentPage) return;
        this._updateTableQuery({ currentPage: targetPage }, false);
    }

    async openGraphModal() {
        const bean = this.state.selectedBean;
        if (Guard.isBlank(bean)) return;

        this._wireModalWidget();
        definitionGraphModalWidget.contextId = bean.contextId;
        this.setState({
            graphModalOpen: true,
            graphTargetBean: bean,
            graphMode: 'lr'
        });
        await definitionGraphModalWidget.open(bean);
    }

    closeGraphModal() {
        this.setState({
            graphModalOpen: false,
            isExportingGraph: false,
            graphTooltip: { ...(this.state.graphTooltip || {}), visible: false }
        });
        definitionGraphModalWidget.close();
    }

    setGraphMode(mode) {
        this.setState({ graphMode: mode });
        definitionGraphModalWidget.setMode(mode);
    }

    graphZoomIn() {
        definitionGraphModalWidget.zoom(1.25);
    }

    graphZoomOut() {
        definitionGraphModalWidget.zoom(0.8);
    }

    graphFitView() {
        definitionGraphModalWidget.fitView();
    }

    async exportModalGraph() {
        if (this.state.isExportingGraph || Guard.isBlank(this.state.graphTargetBean)) return;

        this.setState({ isExportingGraph: true });

        const blob = await definitionGraphModalWidget.exportPNG({ pixelRatio: 2 }).catch(error => {
            console.error('Failed to export modal graph as PNG:', error);
            return null;
        });

        if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const bean = this.state.graphTargetBean;
            const contextSuffix = bean?.contextId ? `-${bean.contextId}` : '';
            const filename = `spring-lens-bean-${bean?.beanName || 'bean'}${contextSuffix}-graph-${timestamp}.png`;

            DomUtils.downloadBlob(filename, blob);
        }

        this.setState({ isExportingGraph: false });
    }

    async selectGraphNode(beanName) {
        if (Guard.isBlank(beanName)) return;

        const success = await this.selectBean(beanName, this.state.selectedBean?.contextId);
        if (success && this.state.selectedBean) {
            definitionGraphModalWidget.contextId = this.state.selectedBean.contextId;
            this.setState({ graphTargetBean: this.state.selectedBean });
            await definitionGraphModalWidget.open(this.state.selectedBean);
        }
    }

    async refreshData() {
        this.setState({ refreshing: true });
        beanDataStore.clear();
        await Promise.allSettled([
            this.fetchBeanDefinitions(),
            this.fetchBeanDefinitionSummary()
        ]);
        if (this.state.selectedBean) {
            await this.selectBean(this.state.selectedBean.beanName, this.state.selectedBean.contextId);
        }
        setTimeout(() => this.setState({ refreshing: false }), 500);
    }

    exportData() {
        const reportData = {
            title: 'SpringLens Bean Definitions Report',
            timestamp: new Date().toISOString(),
            totalElements: this.state.pagination.totalElements || this.rawBeans.length,
            summary: this.summaryData,
            definitions: this.rawBeans
        };

        DomUtils.downloadJson(`spring-lens-definitions-${Date.now()}.json`, reportData);
    }

    _bindEventListeners() {
        const themeHandler = (event) => {
            const isDark = event.detail?.theme === 'dark';
            definitionChartsWidget.onThemeChanged(isDark);
            if (this.state.graphModalOpen && this.state.graphTargetBean) {
                definitionGraphModalWidget.render(this.state.graphTargetBean);
            }
        };
        document.addEventListener('themechanged', themeHandler);
        this.addDisposable(() => document.removeEventListener('themechanged', themeHandler));

        const unsub = this.applicationState?.onAppInfoChange?.((info) => {
            if (info?.name) this.setState({ appName: info.name });
        });
        if (unsub) this.addDisposable(unsub);
    }
}