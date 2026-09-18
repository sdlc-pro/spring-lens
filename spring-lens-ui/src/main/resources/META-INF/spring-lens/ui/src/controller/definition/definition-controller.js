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
    constructor() {
        super('definitions');
        this.service = container.make('definitionService');
        this.applicationState = container.make('applicationState');
        this.chartsWidget = definitionChartsWidget;
        this.tableWidget = definitionTableWidget;
        this.sidebarWidget = definitionSidebarWidget;
        this.modalWidget = definitionGraphModalWidget;
        this._wireModalWidget();

        this.addDisposable(this.chartsWidget);

        this.state = {
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
            filterCriteria: {
                contextId: '',
                scope: '',
                role: '',
                primary: '',
                lazyInit: ''
            },
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
            graphTooltip: {
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
            },
            isExportingGraph: false,
            refreshing: false
        };

        this.rawBeans = [];
        this.summaryData = null;
        this._tableFetchSeq = 0;

        for (const key of Object.keys(this.state)) {
            Object.defineProperty(this, key, {
                get: () => (this.alpine ? this.alpine[key] : this.state[key]),
                set: (value) => this.setState({ [key]: value }),
                configurable: true,
                enumerable: true,
            });
        }
    }

    bindAlpine(alpine) {
        super.bindAlpine(alpine);
        if (this.alpine?.filterCriteria && this.state?.filterCriteria) {
            Object.assign(this.alpine.filterCriteria, this.state.filterCriteria);
        }
    }

    setState(patch) {
        if (!patch) return;
        if ((!this.alpine || !this.alpine.$el?.isConnected) && typeof window !== 'undefined' && window.Alpine?.$data) {
            const root = document.querySelector(`[x-data="${this.namespace}"]`) || document.querySelector('[x-data]');
            if (root && root.isConnected) {
                try {
                    this.bindAlpine(window.Alpine.$data(root));
                } catch (e) {
                }
            }
        }
        if (patch.filterCriteria && typeof patch.filterCriteria === 'object') {
            this.state.filterCriteria = {
                ...this.state.filterCriteria,
                ...patch.filterCriteria
            };
            if (this.alpine?.filterCriteria) {
                Object.assign(this.alpine.filterCriteria, patch.filterCriteria);
            }
        }
        Object.assign(this.state, patch);
        if (this.alpine) {
            Object.assign(this.alpine, patch);
        }
    }

    _wireModalWidget() {
        this.modalWidget.onSelectBean = (beanName) => this.selectGraphNode(beanName);
        this.modalWidget.onTooltipChange = (tooltip) => {
            this.setState({
                graphTooltip: { ...(this.state.graphTooltip || {}), ...tooltip }
            });
        };
        if (this.service?.endpoints?.find) {
            this.modalWidget.findBeanEndpoint = this.service.endpoints.find;
        }
    }

    _defaultFilterCriteria() {
        return {
            contextId: '',
            scope: '',
            role: '',
            primary: '',
            lazyInit: ''
        };
    }

    _resetFilterState() {
        this.setState({
            searchQuery: '',
            filterCriteria: this._defaultFilterCriteria(),
            itemsPerPage: 20,
            currentPage: 1,
            sortColumn: '',
            sortDirection: 'asc',
            selectedBeanId: null,
            selectedBeanName: null,
            selectedContextId: null,
            selectedBean: null
        });
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

    async enter(params) {
        await super.enter(params);

        try {
            this._wireModalWidget();
            this.closeSidebar();
            this._resetFilterState();
            this._bindEventListeners();
            const { targetBean, targetContextId } = this._parseQueryParams(params);

            if (this.applicationState?.onAppInfoChange) {
                const unsub = this.applicationState.onAppInfoChange((info) => {
                    if (info?.name) {
                        this.setState({ appName: info.name });
                    }
                });
                if (unsub) this.addDisposable(unsub);
            }

            await Promise.allSettled([
                this.fetchSummaryStatistics(),
                this.fetchTableData()
            ]);

            if (targetBean) {
                await this._handleDeepLink(targetBean, targetContextId);
            }
        } catch (error) {
            console.error('Error during Definitions enter:', error);
            this.setState({
                tableLoading: false,
                tableError: error.message || 'Failed to initialize view'
            });
        }
    }

    leave() {
        this._tableFetchSeq++;
        this.chartsWidget?.destroyCharts();
        this.closeGraphModal();
        this.closeSidebar();
        this.summaryData = null;
        this.rawBeans = [];
        this._resetFilterState();

        super.leave();
    }

    async fetchSummaryStatistics() {
        this.setState({ summaryLoading: true });
        try {
            const summary = await this.service.fetchSummary();
            this.summaryData = summary;

            if (summary) {
                const metrics = this.chartsWidget.computeMetrics(summary);
                this.setState({
                    totalDefinitions: metrics.totalDefinitions,
                    contextDistributionList: metrics.contextDistributionList,
                    scopeLegend: metrics.scopeLegend,
                    roleLegend: metrics.roleLegend,
                    loadingModeLegend: metrics.loadingModeLegend,
                    contextOptions: metrics.contextOptions,
                    scopeOptions: metrics.scopeOptions,
                    summaryLoading: false
                });

                this.chartsWidget.renderCharts(summary);
            } else {
                this.setState({ summaryLoading: false });
            }
        } catch (error) {
            console.error('Error fetching summary statistics:', error);
            this.setState({
                summaryLoading: false,
                totalDefinitions: '-'
            });
        }
    }

    _buildTableQuery() {
        const pageNumber = Math.max(0, (this.currentPage || 1) - 1);
        const pageSize = Number(this.itemsPerPage) || 20;

        return {
            pageNumber,
            pageSize,
            sortColumn: this.sortColumn || '',
            sortDirection: this.sortDirection || 'asc',
            filterCriteria: this.filterCriteria || {},
            searchQuery: this.searchQuery || ''
        };
    }

    _applyTableResponse(response, pageNumber, pageSize) {
        const { content, pagination, pageButtons, paginationInfo } = Pagination.compute(response, pageNumber, pageSize, 'beans');
        this.rawBeans = content;
        beanDataStore.addBeans(content);

        this.setState({
            beans: this.tableWidget.formatBeanRows(content),
            currentPage: pagination.pageNumber + 1,
            itemsPerPage: pagination.pageSize,
            pagination,
            pageButtons,
            paginationInfo,
            tableLoading: false
        });
    }

    async fetchTableData() {
        this.setState({ tableLoading: true, tableError: null });
        const seq = ++this._tableFetchSeq;

        try {
            const query = this._buildTableQuery();
            const response = await this.service.fetchTableData(query);

            if (seq === this._tableFetchSeq) {
                this._applyTableResponse(response, query.pageNumber, query.pageSize);
            }
        } catch (error) {
            if (seq === this._tableFetchSeq) {
                console.error('Error fetching bean definitions table data:', error);
                this.setState({
                    tableLoading: false,
                    tableError: error.message || 'Error loading bean definitions'
                });
            }
        }
    }

    async selectBean(beanOrName, contextId = null, preloadedBean = null) {
        if (!beanOrName) return false;

        let beanName;
        let ctxId;
        let preloaded;

        if (typeof beanOrName === 'object') {
            beanName = beanOrName.beanName || beanOrName.raw?.beanName;
            ctxId = beanOrName.contextId !== undefined ? beanOrName.contextId : (beanOrName.raw?.contextId || '');
            preloaded = beanOrName.raw || beanOrName;
        } else {
            beanName = beanOrName;
            ctxId = contextId;
            preloaded = preloadedBean;
        }

        return this.selectBeanByNameAndContextId(beanName, ctxId, preloaded);
    }

    async selectBeanByNameAndContextId(beanName, contextId = null, preloadedBean = null) {
        if (!beanName) return false;

        const resolvedContextId = (contextId !== null && contextId !== undefined)
            ? contextId
            : (this.selectedContextId || '');

        const bean = await this._resolveBean(beanName, resolvedContextId, preloadedBean);
        if (!bean) return false;

        this._applySelectedBean(bean, resolvedContextId);
        this.setState({ sidebarTab: 'properties' });

        if (!Array.isArray(bean.dependencies) || !Array.isArray(bean.dependents)) {
            this._refreshBeanDetails(bean.beanName, resolvedContextId);
        }

        return true;
    }

    async _resolveBean(beanName, contextId, preloadedBean = null) {
        if (preloadedBean) return preloadedBean;

        const targetId = this.tableWidget.generateBeanUniqueId(contextId, beanName);
        const local = this.rawBeans.find(b => this.tableWidget.generateBeanUniqueId(b) === targetId || (b.beanName === beanName && (!contextId || b.contextId === contextId)))
            || beanDataStore.findBeanByName(beanName, contextId);
        if (local) return local;

        try {
            const remote = await this.service.findBeanDefinition(beanName, contextId);
            if (remote) beanDataStore.addBeans([remote]);
            return remote;
        } catch (err) {
            console.warn(`Could not load definition details for ${beanName}:`, err);
            return null;
        }
    }

    _applySelectedBean(bean, contextId) {
        const details = this.sidebarWidget.formatDetails(bean);
        const resolvedContextId = contextId ?? bean.contextId ?? '';
        this.setState({
            selectedBeanId: this.tableWidget.generateBeanUniqueId(resolvedContextId, bean.beanName),
            selectedBeanName: bean.beanName,
            selectedContextId: resolvedContextId,
            selectedBean: bean,
            selectedBeanMeta: details?.meta || { icon: 'schema', color: '#8b5cf6' },
            selectedBeanFormatted: details,
            sidebarDeps: this.sidebarWidget.formatDependencyItems(bean.dependencies || [], resolvedContextId),
            sidebarDependents: this.sidebarWidget.formatDependencyItems(bean.dependents || [], resolvedContextId),
            sidebarOpen: true
        });
    }

    async _refreshBeanDetails(beanName, contextId) {
        try {
            const fresh = await this.service.findBeanDefinition(beanName, contextId);
            const targetId = this.tableWidget.generateBeanUniqueId(contextId, beanName);
            if (fresh && this.selectedBeanId === targetId) {
                beanDataStore.addBeans([fresh]);
                this._applySelectedBean(fresh, contextId);
            }
        } catch {
        }
    }

    isSelected(bean) {
        if (!bean || !this.selectedBeanId) return false;
        if (typeof bean === 'string') {
            return bean === this.selectedBeanId || bean === this.selectedBeanName;
        }
        const id = bean.uniqueId || this.tableWidget.generateBeanUniqueId(bean);
        return id === this.selectedBeanId;
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
                title: 'Dependency Not Found',
                message: `The bean <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold">${dependencyOrDependentName}</strong> is referenced, but its definition could not be located in the application context.`,
                type: 'warning',
                duration: 4500
            });
        }
    }

    onSearchInput(event) {
        const query = (event?.target?.value ?? this.alpine?.searchQuery ?? this.state?.searchQuery ?? '').trim();
        this.setState({
            searchQuery: query,
            currentPage: 1
        });
        this.fetchTableData();
    }

    clearSearch() {
        this.setState({
            searchQuery: '',
            currentPage: 1
        });
        this.fetchTableData();
    }

    onFilterChange() {
        this.setState({ currentPage: 1 });
        this.fetchTableData();
    }

    onPageSizeChange(event) {
        const newSize = Number(event?.target?.value ?? this.alpine?.itemsPerPage ?? this.state?.itemsPerPage ?? 20);
        this.setState({
            itemsPerPage: newSize,
            currentPage: 1
        });
        this.fetchTableData();
    }

    resetFilters() {
        this._resetFilterState();
        this.fetchTableData();
    }

    sort(column) {
        if (!column) return;
        let direction = 'asc';
        if (this.state.sortColumn === column) {
            direction = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        }
        this.setState({
            sortColumn: column,
            sortDirection: direction,
            currentPage: 1
        });
        this.fetchTableData();
    }

    getSortIcon(column) {
        return this.tableWidget.getSortIcon(column, this.state.sortColumn, this.state.sortDirection);
    }

    prevPage() {
        if (!this.pagination.isFirstPage) {
            this.goToPage(this.currentPage - 1);
        }
    }

    nextPage() {
        if (!this.pagination.isLastPage) {
            this.goToPage(this.currentPage + 1);
        }
    }

    goToPage(page) {
        const targetPage = Number(page);
        if (!targetPage || targetPage === this.state.currentPage) return;
        this.setState({ currentPage: targetPage });
        this.fetchTableData();
    }

    async openGraphModal() {
        if (!this.state.selectedBeanName) return;

        let beanData = this.state.selectedBean;
        if (!beanData || !beanData.dependencies) {
            beanData = await this.service.findBeanDefinition(this.state.selectedBeanName, this.state.selectedContextId);
        }

        if (beanData) {
            this._wireModalWidget();
            this.modalWidget.contextId = this.state.selectedContextId;
            this.setState({
                graphModalOpen: true,
                graphTargetBean: beanData,
                graphMode: 'lr'
            });
            await this.modalWidget.open(beanData);
        }
    }

    closeGraphModal() {
        this.setState({
            graphModalOpen: false,
            isExportingGraph: false,
            graphTooltip: { ...(this.state.graphTooltip || {}), visible: false }
        });
        this.modalWidget.close();
    }

    setGraphMode(mode) {
        this.setState({ graphMode: mode });
        this.modalWidget.setMode(mode);
    }

    graphZoomIn() {
        this.modalWidget.zoom(1.25);
    }

    graphZoomOut() {
        this.modalWidget.zoom(0.8);
    }

    graphFitView() {
        this.modalWidget.fitView();
    }

    async exportModalGraph() {
        if (this.state.isExportingGraph || !this.state.graphTargetBean) return;

        this.setState({ isExportingGraph: true });
        try {
            const blob = await this.modalWidget.exportPNG({ pixelRatio: 2 });
            if (!blob) return;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const beanName = this.state.graphTargetBean?.beanName || 'bean';
            const contextSuffix = this.state.graphTargetBean?.contextId ? `-${this.state.graphTargetBean.contextId}` : '';
            const filename = `spring-lens-bean-${beanName}${contextSuffix}-graph-${timestamp}.png`;

            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            console.error('Failed to export modal graph as PNG:', error);
        } finally {
            this.setState({ isExportingGraph: false });
        }
    }

    async selectGraphNode(beanName) {
        if (!beanName) return;

        const success = await this.selectBeanByNameAndContextId(beanName, this.selectedContextId);
        if (success && this.selectedBean) {
            this.modalWidget.contextId = this.selectedContextId;
            this.setState({ graphTargetBean: this.selectedBean });
            await this.modalWidget.open(this.selectedBean);
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
        try {
            await Promise.allSettled([
                this.fetchSummaryStatistics(),
                this.fetchTableData()
            ]);
        } finally {
            setTimeout(() => this.setState({ refreshing: false }), 500);
        }
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
            this.chartsWidget?.onThemeChanged(isDark);
            if (this.state.graphModalOpen && this.state.graphTargetBean) {
                this.modalWidget?.render(this.state.graphTargetBean);
            }
        };
        document.addEventListener('themechanged', themeHandler);
        this.addDisposable(() => document.removeEventListener('themechanged', themeHandler));

        const keydownHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.state.graphModalOpen) {
                    e.stopPropagation();
                    this.closeGraphModal();
                } else if (this.state.sidebarOpen) {
                    this.closeSidebar();
                }
            }
        };
        document.addEventListener('keydown', keydownHandler);
        this.addDisposable(() => document.removeEventListener('keydown', keydownHandler));
    }
}