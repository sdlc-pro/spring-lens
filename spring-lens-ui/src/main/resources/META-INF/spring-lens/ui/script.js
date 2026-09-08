import Route from './src/helper/route.js';
import { PageHeader } from './src/helper/index.js';
import Instance from './src/controller/instance.js';
import ENDPOINTS from './src/helper/api-endpoints.js';
import Dashboard from './src/controller/dashboard.js';
import BeanDefinitions from './src/controller/definition.js';
import DependencyGraph from './src/controller/dependency-graph.js';
import ConditionalReport from './src/controller/conditional-report.js';
import ApplicationState from './src/controller/application-state.js';

$(document).ready(() => {

    const applicationState = new ApplicationState({
        healthApi: ENDPOINTS.APPLICATION_HEALTH,
        infoApi: ENDPOINTS.APPLICATION_INFO
    });
    PageHeader.init(applicationState);

    const dashboard = new Dashboard(ENDPOINTS, applicationState);
    const beanInstance = new Instance(ENDPOINTS);
    const beanDefinitions = new BeanDefinitions(ENDPOINTS);
    const conditionReport = new ConditionalReport(ENDPOINTS);
    const dependencyGraph = new DependencyGraph(ENDPOINTS);

    const appRouter = new Route({
        container: '#main-content',
        defaultRoute: 'dashboard',
        routes: {
            'dashboard': {
                template: 'dashboard/dashboard',
                header: {
                    icon: 'dashboard',
                    title: 'Platform Overview',
                    badge: 'Dashboard',
                    breadcrumbs: ['Dashboard'],
                    actions: [
                        {
                            id: 'btn-refresh-dashboard',
                            action: 'refresh-data',
                            icon: 'refresh',
                            label: 'Refresh',
                            title: 'Refresh dashboard metrics'
                        }
                    ]
                },
                onEnter: (params) => {
                    dashboard.enter(params);
                    applicationState.checkHealth();
                },
                onLeave: () => dashboard.leave()
            },
            'definitions': {
                template: 'bean/definitions',
                header: {
                    icon: 'widgets',
                    title: 'Bean Definitions',
                    badge: 'Definitions Registry',
                    breadcrumbs: ['Bean', 'Definitions'],
                    actions: [
                        { id: 'def-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh bean definitions' },
                        { id: 'beans-btn-export', action: 'export-data', icon: 'file_download', label: 'Export', title: 'Export bean definitions' }
                    ]
                },
                onEnter: (params) => beanDefinitions.enter(params),
                onLeave: () => beanDefinitions.leave()
            },
            'conditions': {
                template: 'bean/condition-reports',
                header: {
                    icon: 'fact_check',
                    title: 'Condition Reports',
                    badge: 'Auto-Configuration',
                    breadcrumbs: ['Bean', 'Conditional Reports'],
                    actions: [
                        { id: 'condition-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh evaluations' },
                        { type: 'search', id: 'condition-search-input', placeholder: 'Search auto-configurations...' }
                    ]
                },
                onEnter: (params) => conditionReport.enter(params),
                onLeave: () => conditionReport.leave()
            },
            'instances': {
                template: 'bean/instances',
                header: {
                    icon: 'timelapse',
                    title: 'Bean Instances',
                    badge: 'Startup Waterfall & Profiler',
                    breadcrumbs: ['Bean', 'Instances'],
                    actions: [
                        { id: 'time-btn-refresh', action: 'refresh-data', icon: 'refresh', label: 'Refresh', title: 'Refresh bean instance data' },
                        { id: 'time-btn-download', action: 'download-report', icon: 'file_download', label: 'Export', title: 'Export bean instance as JSON' }
                    ]
                },
                onEnter: (params) => beanInstance.enter(params),
                onLeave: () => beanInstance.leave()
            },
            'instance': { redirectTo: 'instances' },
            'timeline': { redirectTo: 'instances' },
            'graph': {
                template: 'bean/graph',
                title: 'Dependency Graph',
                header: null,
                onEnter: (params) => dependencyGraph.enter(params),
                onLeave: () => dependencyGraph.leave()
            }
        }
    });

    // Start Route
    appRouter.init();

    applicationState.start(10000);

    // Theme toggle interaction handler
    $('#theme-toggle').on('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: isDark ? 'dark' : 'light' } }));
    });
});