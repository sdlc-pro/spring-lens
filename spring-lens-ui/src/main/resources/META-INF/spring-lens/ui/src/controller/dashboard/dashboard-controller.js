import BaseController from '../base-controller.js';
import {
    BeanSearchEngine,
    BeanMetadataRules,
    QueryParam,
    container
} from '../../helper/index.js';
import {
    heroWidget,
    chartWidget,
    bottlenecksWidget,
    conditionsWidget,
    hubsWidget,
    radialTreeWidget
} from './index.js';

export class DashboardController extends BaseController {

    constructor() {
        super('dashboard');
        this.service = container.make('dashboardService');
        this.applicationState = container.make('applicationState');

        this.state = {
            loading: true,
            refreshing: false,
            appName: '',
            bootVersion: '--',
            frameworkVersion: '--',
            javaVersion: '--',
            javaVendor: '--',
            startupDuration: '--',
            startedAt: '--',
            profiles: ['default'],
            profilesLabel: 'Active Profiles',
            isActiveProfiles: false,
            isHealthIsUp: true,
            uptime: '--',

            // Quick Search State
            searchQuery: '',
            searchLoading: false,
            searchItems: [],
            searchEmpty: false,

            // 4 Executive Pillar KPIs State
            kpiDefinitionsCount: '--',
            kpiDefSingletons: '0',
            kpiDefPrototypes: '0',
            kpiInstancesCount: '--',
            kpiInstTotalCost: '--',
            kpiConditionsCount: '--',
            kpiCondMatched: '0',
            kpiCondMatchedPct: 0,
            kpiCondSkipped: '0',
            kpiDependenciesCount: '--',
            kpiDepEdges: '0',
            kpiDepBeans: '0',

            // Panel 1: Doughnut Chart State
            chartMode: 'scope', // 'scope' | 'role' | 'loading'
            chartTotalDefinitions: '--',
            chartFooterInfo: 'Showing scope breakdown',
            chartLegendItems: [],

            // Panel 2: Startup Bottlenecks State
            slowestBeans: [],
            slowestTotalCost: '--',
            slowestMaxLatency: '--',
            slowestBeansLoading: true,

            // Panel 3: Auto-Config Conditions State
            condMatchedLabel: '0 (0%)',
            condUnmatchedLabel: '0 (0%)',
            condMatchedPct: 0,
            condUnmatchedPct: 0,
            conditionsSamples: [],
            conditionsEvalCount: '--',

            // Panel 4: Dependency Hubs State
            dependencyHubs: [],
            dependencyGraphFooter: 'Graph topology telemetry',

            // Radial Force Tree State
            radialLoading: true,
            radialStats: 'Interactive Force Tree • Drag nodes to explore',
            radialTooltip: {
                visible: false,
                x: 0,
                y: 0,
                icon: 'extension',
                iconColor: '#60a5fa',
                title: '',
                scope: '',
                badgeClass: '',
                type: '',
                depth: '',
                directDeps: 0,
                subtree: 0,
                parent: ''
            }
        };

        // Data caches and internal lifecycle trackers
        this.summaryData = null;
        this.instancesData = null;
        this.conditionsData = null;
        this.dependenciesData = null;
        this.currentUptimeState = null;
        this.appStartDate = null;
        this.uptimeInterval = null;
        this._lastAppInfo = null;
        this._latestSearchQuery = '';

        // Subscribe to application health transitions
        this.applicationState?.onStateChange((isHealthIsUp) => {
            const wasDown = this.currentUptimeState === false;
            this.updateUptimeStatus(isHealthIsUp);

            if (isHealthIsUp && wasDown) {
                this.loadAllDashboardData();
            }
        });

        // Subscribe to application metadata transitions
        this.applicationState?.onAppInfoChange((appInfo) => {
            if (appInfo && appInfo !== this._lastAppInfo) {
                this.updateApplicationInfo(appInfo);
            }
        });
    }

    /**
     * Creates the Alpine reactive state and action delegates for the dashboard view.
     */
    createAlpineState() {
        return {
            ...this.state,
            get searchVisible() {
                return Boolean(this.searchLoading
                    || this.searchEmpty
                    || (this.searchItems && this.searchItems.length > 0)
                );
            },
            goTo: (route, name, contextId) => this.goTo(route, name, contextId),
            search: () => this.search(),
            radialReset: () => this.radialReset(),
            refreshData: () => this.reloadDashboardData(),
            resetSearch: () => this.resetSearch(),
            radialZoom: (factor) => this.radialZoom(factor),
            setChartMode: (mode) => this.setChartMode(mode),
            reloadDashboardData: () => this.reloadDashboardData(),
        };
    }

    /**
     * Enters dashboard route, sets up event listeners, and fetches all dashboard data.
     */
    async enter(params, context) {
        try {
            this.resetSearch();
            this.addDisposable(chartWidget);
            this.addDisposable(radialTreeWidget);
            this.addDisposable(() => this.stopUptimeTimer());

            this.applicationState?.checkHealth()?.catch(() => { });
            this._bindEventListeners();
            await this.loadAllDashboardData();
        } catch (error) {
            console.error('Error during Dashboard enter:', error);
        }
    }

    leave() {
        this.resetSearch();
        this.currentUptimeState = null;
        this.appStartDate = null;

        super.leave();
    }

    /**
     * Loads all dashboard dataset sections concurrently with graceful fallbacks.
     */
    async loadAllDashboardData() {
        this.applicationState?.checkHealth()
            ?.then(isHealthIsUp => this.updateUptimeStatus(isHealthIsUp));

        await this.service.fetchAll({
            onInstances: (data) => this.updateInstancesData(data),
            onConditions: (data) => this.updateConditionsData(data),
            onDependencies: (data) => this.updateDependenciesData(data),
            onApplicationInfo: (data) => this.updateApplicationInfo(data),
            onDefinitionsSummary: (data) => this.updateDefinitionsData(data),
            onApplicationFallback: () => this.updateApplicationFallback(),
        });
    }

    /**
     * Updates application runtime telemetry state and starts uptime tracker.
     * @param {Object} applicationInfo
     */
    updateApplicationInfo(applicationInfo) {
        if (!applicationInfo) {
            this.updateApplicationFallback();
            return;
        }

        this._lastAppInfo = applicationInfo;
        const application = heroWidget.extractViewModel(applicationInfo);

        this.applicationState?.setAppInfo(applicationInfo);
        this.appStartDate = application.startDate;

        if (this.currentUptimeState !== false) {
            this.updateUptimeStatus(true);
        }
        this._updateApplicationInformation(application);
    }

    /**
     * Sets fallback telemetry values when backend service is unreachable.
     */
    updateApplicationFallback() {
        this.updateUptimeStatus(false);
        this._updateApplicationInformation(heroWidget.getFallbackViewModel());
    }

    _updateApplicationInformation(application) {
        this.setState({
            loading             : false,
            appName             : application.name,
            profiles            : application.profiles,
            startedAt           : application.formattedStartedAt,
            javaVendor          : application.javaVendor,
            javaVersion         : application.javaVersion,
            bootVersion         : application.bootVersion,
            profilesLabel       : application.profilesLabel,
            startupDuration     : application.startupDuration,
            isActiveProfiles    : application.isActiveProfiles,
            frameworkVersion    : application.frameworkVersion,
        });
    }


    stopUptimeTimer() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
            this.uptimeInterval = null;
        }
    }

    updateUptimeStatus(isHealthIsUp) {
        this.stopUptimeTimer();

        this.currentUptimeState = isHealthIsUp;
        this.setState({ isHealthIsUp, isLive: isHealthIsUp });

        if (!isHealthIsUp || !this.appStartDate) return;

        const tick = () => this.setState({ uptime: heroWidget.calculateUptime(this.appStartDate) });
        tick();
        this.uptimeInterval = setInterval(tick, 1000);
    }

    // --- Quick Search Business Logic ---
    async search() {
        const query = (this.alpine?.searchQuery ?? this.state?.searchQuery ?? '').trim();
        if (query.length < 2) {
            this.resetSearch();
            return;
        }
        const currentQuery = query;
        this._latestSearchQuery = currentQuery;

        this.setState({ searchLoading: true, searchEmpty: false });

        try {
            const response = await this.service.searchDefinitions(query, { pageSize: 9 });

            if (this._latestSearchQuery !== currentQuery) return;

            const beanDefinitions = response?.content ?? [];
            const searchItems = beanDefinitions.map(bean => this._formatBeanChip(bean, query));

            this.setState({
                searchItems,
                searchEmpty: searchItems.length === 0
            });
        } catch (error) {
            if (this._latestSearchQuery !== currentQuery) return;

            console.warn('Dashboard quick search failed:', error);
            this.setState({ searchItems: [], searchEmpty: true });
        } finally {
            if (this._latestSearchQuery === currentQuery) {
                this.setState({ searchLoading: false });
            }
        }
    }

    /**
     * Clears search query and result chips.
     */
    resetSearch() {
        this.setState({
            searchQuery: '',
            searchItems: [],
            searchEmpty: false,
            searchLoading: false
        });
    }

    _formatBeanChip(bean, query) {
        const { beanName, type, contextId } = bean;
        const meta = BeanMetadataRules.resolveBeanMetadata({ beanName, type });
        return {
            name: beanName,
            highlightedName: BeanSearchEngine.highlight(beanName, query),
            icon: meta.icon,
            iconColor: meta.color,
            contextId
        };
    }

    /**
     * Navigates to target route with search parameters.
     */
    goTo(route, name, contextId) {
        const paramKey = route === 'graph' ? 'focus' : 'search';
        const params = { [paramKey]: name };
        if (contextId) params.contextId = contextId;
        const q = QueryParam.build(params).toString();
        this.resetSearch();
        window.location.hash = `#/${route}?${q}`;
    }

    // --- Definitions Chart & KPIs ---
    updateDefinitionsData(data) {
        if (!data) return;
        this.summaryData = data;
        const kpi = chartWidget.computeKpi(data);
        const legend = chartWidget.computeLegend(data, this.state.chartMode);

        chartWidget.renderChart(data, this.state.chartMode);

        this.setState({
            kpiDefinitionsCount: kpi.total,
            kpiDefSingletons: kpi.singletons,
            kpiDefPrototypes: kpi.prototypes,
            chartTotalDefinitions: legend.total,
            chartFooterInfo: legend.footerText,
            chartLegendItems: legend.legendItems
        });
    }

    setChartMode(mode) {
        if (this.state.chartMode === mode) return;
        const updates = { chartMode: mode };

        if (this.summaryData) {
            const legend = chartWidget.setMode(mode);
            if (legend) {
                updates.chartTotalDefinitions = legend.total;
                updates.chartFooterInfo = legend.footerText;
                updates.chartLegendItems = legend.legendItems;
            }
        }
        this.setState(updates);
    }

    // --- Runtime Instances & Bottlenecks ---
    updateInstancesData(data) {
        if (!data) return;
        this.instancesData = data;
        const metrics = bottlenecksWidget.computeMetrics(data);

        this.setState({
            kpiInstancesCount: metrics.count,
            kpiInstTotalCost: metrics.totalCost,
            slowestBeans: metrics.slowestBeans,
            slowestTotalCost: metrics.totalCost,
            slowestMaxLatency: metrics.maxLatency,
            slowestBeansLoading: false
        });
    }

    // --- Auto-Config Conditions ---
    updateConditionsData(data) {
        if (!data) return;
        this.conditionsData = data;
        const metrics = conditionsWidget.computeMetrics(data);

        this.setState({
            kpiConditionsCount: metrics.total,
            kpiCondMatched: metrics.matched,
            kpiCondMatchedPct: metrics.matchedPct,
            kpiCondSkipped: metrics.notMatched,
            condMatchedLabel: metrics.matchedLabel,
            condUnmatchedLabel: metrics.unmatchedLabel,
            condMatchedPct: metrics.matchedPct,
            condUnmatchedPct: metrics.notMatchedPct,
            conditionsSamples: metrics.samples,
            conditionsEvalCount: metrics.evaluatedCount
        });
    }

    // --- Dependency Topology & Hubs ---
    updateDependenciesData(data) {
        if (!data) return;
        this.dependenciesData = data;
        const metrics = hubsWidget.computeMetrics(data);

        this.setState({
            kpiDependenciesCount: metrics.totalBeans,
            kpiDepEdges: metrics.totalEdges,
            kpiDepBeans: metrics.dependedBeans,
            dependencyHubs: metrics.hubs,
            dependencyGraphFooter: metrics.footerStats
        });

        radialTreeWidget.render(data, this.setState.bind(this));
    }

    radialZoom(scaleFactor) {
        radialTreeWidget?.zoom(scaleFactor);
    }

    radialReset() {
        radialTreeWidget?.resetZoom();
    }

    _bindEventListeners() {
        const themeHandler = (event) => {
            const isDark = event.detail?.theme === 'dark';
            chartWidget.onThemeChanged(isDark);
            radialTreeWidget.onThemeChanged(isDark);
        };
        document.addEventListener('themechanged', themeHandler);
        this.addDisposable(() => document.removeEventListener('themechanged', themeHandler));

        this.on('#btn-refresh-dashboard', 'click', () => this.reloadDashboardData());
    }

    async reloadDashboardData() {
        if (this.state.refreshing) return;
        this.setState({ refreshing: true });
        try {
            await this.loadAllDashboardData();
        } finally {
            setTimeout(() => this.setState({ refreshing: false }), 600);
        }
    }
}
