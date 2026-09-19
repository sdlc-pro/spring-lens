import BaseController from '../base-controller.js';
import { container } from '../../helper/index.js';
import {
    heroWidget,
    chartWidget,
    bottlenecksWidget,
    conditionsWidget,
    hubsWidget,
    radialTreeWidget,
    quickSearchWidget
} from './index.js';

const whenPresent = (action) => (payload) => {
    if (payload) action(payload);
};

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
            get whenFoundSearchedValue() {
                return Boolean(this.searchLoading
                    || this.searchEmpty
                    || (this.searchItems && this.searchItems.length > 0)
                );
            },
            goTo                : (route, name, contextId) => this.goTo(route, name, contextId),
            search              : () => this.search(),
            radialReset         : () => this.radialReset(),
            refreshData         : () => this.reloadDashboardData(),
            resetSearch         : () => this.resetSearch(),
            radialZoom          : (factor) => this.radialZoom(factor),
            setChartMode        : (mode) => this.setChartMode(mode),
            reloadDashboardData : () => this.reloadDashboardData(),
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
            onInstances: whenPresent((data) => this.updateInstancesData(data)),
            onConditions: whenPresent((data) => this.updateConditionsData(data)),
            onDependencies: whenPresent((data) => this.updateDependenciesData(data)),
            onApplicationInfo: (data) => this.updateApplicationInfo(data),
            onDefinitionsSummary: whenPresent((data) => this.updateDefinitionsData(data)),
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

    async search() {
        const query = this._resolveSearchQuery();
        if (query.length < 2) {
            this.resetSearch();
            return;
        }

        this.setState({ searchLoading: true, searchEmpty: false });

        try {
            const results = await quickSearchWidget.search(query, this.service);
            if (!results) return;

            this.setState({
                searchItems: results.items,
                searchEmpty: results.empty,
                searchLoading: false
            });
        } catch (error) {
            console.warn('Dashboard quick search failed:', error);
            this.setState({ searchItems: [], searchEmpty: true, searchLoading: false });
        }
    }

    _resolveSearchQuery() {
        return (this.alpine?.searchQuery ?? this.state?.searchQuery ?? '').trim();
    }

    resetSearch() {
        quickSearchWidget.cancel();
        this.setState({
            searchQuery: '',
            searchItems: [],
            searchEmpty: false,
            searchLoading: false
        });
    }

    goTo(route, name, contextId) {
        this.resetSearch();
        window.location.hash = quickSearchWidget.resolveTargetUrl(route, name, contextId);
    }

    // --- Definitions Chart & KPIs ---
    updateDefinitionsData(beanDefinitionsData) {
        this.summaryData = beanDefinitionsData;
        const kpi = chartWidget.computeKpi(beanDefinitionsData);
        const legend = chartWidget.computeLegend(beanDefinitionsData, this.state.chartMode);

        chartWidget.renderChart(beanDefinitionsData, this.state.chartMode);

        this.setState({
            chartFooterInfo         : legend.footerText,
            kpiDefSingletons        : kpi.singletons,
            kpiDefPrototypes        : kpi.prototypes,
            chartLegendItems        : legend.legendItems,
            kpiDefinitionsCount     : kpi.total,
            chartTotalDefinitions   : legend.total,
        });
    }

    setChartMode(mode) {
        if (this.state.chartMode === mode) return;
        const updates = { chartMode: mode };

        if (this.summaryData) {
            const legend = chartWidget.setMode(mode);
            if (legend) {
                updates.chartTotalDefinitions   = legend.total;
                updates.chartFooterInfo         = legend.footerText;
                updates.chartLegendItems        = legend.legendItems;
            }
        }
        this.setState(updates);
    }

    // --- Runtime Instances & Bottlenecks ---
    updateInstancesData(beanInstanceData) {
        this.instancesData = beanInstanceData;
        const metrics = bottlenecksWidget.computeMetrics(beanInstanceData);

        this.setState({
            kpiInstancesCount   : metrics.count,
            kpiInstTotalCost    : metrics.totalCost,
            slowestBeans        : metrics.slowestBeans,
            slowestTotalCost    : metrics.totalCost,
            slowestMaxLatency   : metrics.maxLatency,
            slowestBeansLoading : false
        });
    }

    // --- Auto-Config Conditions ---
    updateConditionsData(autoConfigConditionData) {
        this.conditionsData = autoConfigConditionData;
        const metrics = conditionsWidget.computeMetrics(autoConfigConditionData);

        this.setState({
            kpiConditionsCount  : metrics.total,
            kpiCondMatched      : metrics.matched,
            kpiCondMatchedPct   : metrics.matchedPct,
            kpiCondSkipped      : metrics.notMatched,
            condMatchedLabel    : metrics.matchedLabel,
            condUnmatchedLabel  : metrics.unmatchedLabel,
            condMatchedPct      : metrics.matchedPct,
            condUnmatchedPct    : metrics.notMatchedPct,
            conditionsSamples   : metrics.samples,
            conditionsEvalCount : metrics.evaluatedCount
        });
    }

    // --- Dependency Topology & Hubs ---
    updateDependenciesData(dependencyGraphData) {
        this.dependenciesData = dependencyGraphData;
        const metrics = hubsWidget.computeMetrics(dependencyGraphData);

        this.setState({
            kpiDependenciesCount    : metrics.totalBeans,
            kpiDepEdges             : metrics.totalEdges,
            kpiDepBeans             : metrics.dependedBeans,
            dependencyHubs          : metrics.hubs,
            dependencyGraphFooter   : metrics.footerStats
        });

        radialTreeWidget.render(dependencyGraphData, this.setState.bind(this));
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
    }

    async reloadDashboardData() {
        if (this.state.refreshing) return;
        this.setState({ refreshing: true });

        try {
            await Promise.all([
                this.loadAllDashboardData(),
                new Promise(resolve => setTimeout(resolve, 600))
            ]);
        } finally {
            this.setState({ refreshing: false });
        }
    }
}