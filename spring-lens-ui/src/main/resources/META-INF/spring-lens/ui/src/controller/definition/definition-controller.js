import BaseController from '../base-controller.js';
import {
    definitionChartsWidget,
    definitionTableWidget,
    definitionSidebarWidget,
    definitionGraphModalWidget,
    beanDataStore,
    DomUtils,
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

            selectedBeanId: null,
            selectedBeanName: null,
            selectedContextId: null,
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
            selectedBeanId: null,
            selectedBeanName: null,
            selectedContextId: null,
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

            selectBean: (bean) => this.selectBean(bean),
            isSelected: (bean) => this.isSelected(bean),
            closeSidebar: () => this.closeSidebar(),
            setSidebarTab: (tab) => this.setSidebarTab(tab),
            selectDependency: (depName) => this.selectDependency(depName),

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
        if (!targetBean) return;

        const success = await this.selectBeanByNameAndContextId(targetBean, targetContextId);
        if (!success) {
            ToastNotification.show({
                title: 'Bean Definition',
                message: `Bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${targetBean}</strong> definition details could not be found.`,
                type: 'warning',
                duration: 4000
            });
        }
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

    async selectBean(beanOrName, contextId = null, preloadedBean = null) {
        if (!beanOrName) return false;

        const isObject = typeof beanOrName === 'object';
        const beanName = isObject ? (beanOrName.beanName || beanOrName.raw?.beanName) : beanOrName;
        const ctxId = isObject ? (beanOrName.contextId ?? beanOrName.raw?.contextId ?? '') : contextId;
        const preloaded = isObject ? (beanOrName.raw || beanOrName) : preloadedBean;

        return this.selectBeanByNameAndContextId(beanName, ctxId, preloaded);
    }

    async selectBeanByNameAndContextId(beanName, contextId = null, preloadedBean = null) {
        if (!beanName) return false;

        const resolvedContextId = contextId ?? this.state.selectedContextId ?? '';
        const bean = await this._resolveBean(beanName, resolvedContextId, preloadedBean);
        if (!bean) return false;

        this._applySelectedBean(bean, resolvedContextId);
        this.setState({ sidebarTab: 'properties' });

        if (!Array.isArray(bean.dependencies) || !Array.isArray(bean.dependents)) {
            await this._refreshBeanDetails(bean.beanName, resolvedContextId);
        }

        return true;
    }

    async _resolveBean(beanName, contextId, preloadedBean = null) {
        if (preloadedBean) return preloadedBean;

        const targetId = definitionTableWidget.generateBeanUniqueId(contextId, beanName);
        const local = this.rawBeans.find(b => definitionTableWidget.generateBeanUniqueId(b) === targetId || (b.beanName === beanName && (!contextId || b.contextId === contextId)))
            || beanDataStore.findBeanByName(beanName, contextId);
        if (local) return local;

        const remote = await this.service.fetchBeanDefinitionDetails(beanName, contextId);
        if (remote) beanDataStore.addBeans([remote]);
        return remote;
    }

    _applySelectedBean(bean, contextId) {
        const details = definitionSidebarWidget.formatDetails(bean);
        const resolvedContextId = contextId ?? bean.contextId ?? '';
        this.setState({
            selectedBeanId: definitionTableWidget.generateBeanUniqueId(resolvedContextId, bean.beanName),
            selectedBeanName: bean.beanName,
            selectedContextId: resolvedContextId,
            selectedBean: bean,
            selectedBeanMeta: details?.meta || { icon: 'schema', color: '#8b5cf6' },
            selectedBeanFormatted: details,
            sidebarDeps: definitionSidebarWidget.formatDependencyItems(bean.dependencies || [], resolvedContextId),
            sidebarDependents: definitionSidebarWidget.formatDependencyItems(bean.dependents || [], resolvedContextId),
            sidebarOpen: true
        });
    }

    async _refreshBeanDetails(beanName, contextId) {
        const fresh = await this.service.fetchBeanDefinitionDetails(beanName, contextId);
        const targetId = definitionTableWidget.generateBeanUniqueId(contextId, beanName);
        if (fresh && this.state.selectedBeanId === targetId) {
            beanDataStore.addBeans([fresh]);
            this._applySelectedBean(fresh, contextId);
        }
    }

    isSelected(bean) {
        if (!bean || !this.state.selectedBeanId) return false;
        if (typeof bean === 'string') {
            return bean === this.state.selectedBeanId || bean === this.state.selectedBeanName;
        }
        const id = bean.uniqueId || definitionTableWidget.generateBeanUniqueId(bean);
        return id === this.state.selectedBeanId;
    }

    closeSidebar() {
        this.setState({
            sidebarOpen: false,
            selectedBeanId: null,
            selectedBeanName: null,
            selectedContextId: null,
            selectedBean: null
        });
    }

    setSidebarTab(tab) {
        this.setState({ sidebarTab: tab });
    }

    async selectDependency(dependencyOrDependentName) {
        if (!dependencyOrDependentName) return;
        const success = await this.selectBeanByNameAndContextId(dependencyOrDependentName, this.state.selectedContextId);
        if (!success) {
            ToastNotification.show({
                title: 'Dependency details Not Found',
                message: `The bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${dependencyOrDependentName}</strong> is referenced, but its definition could not be located in the application context.`,
                type: 'warning',
                duration: 4500
            });
        }
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
        if (!column) return;
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
        if (!this.state.selectedBeanName) return;

        let beanData = this.state.selectedBean;
        if (!beanData || !beanData.dependencies) {
            beanData = await this.service.fetchBeanDefinitionDetails(this.state.selectedBeanName, this.state.selectedContextId);
        }

        if (beanData) {
            this._wireModalWidget();
            definitionGraphModalWidget.contextId = this.state.selectedContextId;
            this.setState({
                graphModalOpen: true,
                graphTargetBean: beanData,
                graphMode: 'lr'
            });
            await definitionGraphModalWidget.open(beanData);
        }
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
        if (this.state.isExportingGraph || !this.state.graphTargetBean) return;

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
        if (!beanName) return;

        const success = await this.selectBeanByNameAndContextId(beanName, this.state.selectedContextId);
        if (success && this.state.selectedBean) {
            definitionGraphModalWidget.contextId = this.state.selectedContextId;
            this.setState({ graphTargetBean: this.state.selectedBean });
            await definitionGraphModalWidget.open(this.state.selectedBean);
        } else if (!success) {
            ToastNotification.show({
                title: 'Bean Definition Not Found',
                message: `Bean definition for <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${beanName}</strong> is unavailable or not registered.`,
                type: 'warning',
                duration: 4000
            });
        }
    }

    async refreshData() {
        this.setState({ refreshing: true });
        await Promise.allSettled([
            this.fetchBeanDefinitions(),
            this.fetchBeanDefinitionSummary()
        ]);
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