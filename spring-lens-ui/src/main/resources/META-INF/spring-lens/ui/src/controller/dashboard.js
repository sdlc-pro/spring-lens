import httpClient from '../helper/http-client.js';
import GraphTreeBuilder from '../helper/graph-tree-builder.js';
import {
    resolveBeanMetadata,
    resolveLatencyTheme,
    capitalize,
    formatPercentage,
    SCOPE_COLORS,
    ROLE_COLORS,
    LOADING_MODE_COLORS,
    QueryParam,
    TemplateEngine,
    BeanSearchEngine,
    PageHeader,
    debounce
} from '../helper/index.js';

export default class Dashboard {

    constructor(ENDPOINTS = {}, applicationState = null) {
        this.endpoints = {
            application: ENDPOINTS.APPLICATION_INFO,
            definitions: ENDPOINTS.BEAN_DEFINITION,
            instances: ENDPOINTS.BEAN_INSTANCE,
            conditions: ENDPOINTS.CONDITIONAL_REPORTS,
            dependencies: ENDPOINTS.GRAPH_DEPENDENCIES,
            definitionsSummary: ENDPOINTS.SUMMARY_BEAN_DEFINITION
        };

        this.applicationState = applicationState;
        this.applicationState?.onStateChange((isHealthIsUp) => {
            const wasDown = this.currentUptimeState === false;
            this.renderUptimeStatus(isHealthIsUp);

            if (isHealthIsUp && wasDown) {
                this.loadAllDashboardData();
            }
        });

        this.applicationData = null;
        this.summaryData = null;
        this.instancesData = null;
        this.conditionsData = null;
        this.dependenciesData = null;

        this.currentUptimeState = null;
        this.appStartDate = null;

        this.chartInstance = null;
        this.activeChartMode = 'scope'; // 'scope' | 'role' | 'loading'
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;
        this.uptimeInterval = null;
        this._debouncedQuickSearch = debounce((query) => this.handleQuickSearch(query), 200);
        this._boundThemeHandler = null;
    }

    _resetQuickSearch() {
        $('#db-quick-search-input').val('');
        $('#db-quick-search-chips').empty();
        $('#db-quick-search-results').addClass('hidden');
    }

    /**
     * Called when the dashboard route is entered.
     */
    async enter() {
        try {
            this.currentUptimeState = null;
            this.appStartDate = null;
            this._resetQuickSearch();
            this._bindEventListeners();
            await this.loadAllDashboardData();
        } catch (error) {
            console.error('Failed to initialize Dashboard:', error);
        }
    }

    /**
     * Cleans up chart instances, D3 simulations, intervals, and event listeners.
     */
    leave() {
        // 1. Destroy active charts & simulations
        this.chartInstance?.destroy();
        this.forceSimulation?.stop();
        this.chartInstance = null;
        this.forceSimulation = null;

        // 2. Clear D3 SVG / Zoom state
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;

        // 3. Clear timers
        clearInterval(this.uptimeInterval);
        this.uptimeInterval = null;
        this.currentUptimeState = null;
        this.appStartDate = null;
        this._debouncedQuickSearch?.cancel();

        // 4. Clean up native listeners
        if (this._boundThemeHandler) {
            document.removeEventListener('themechanged', this._boundThemeHandler);
            this._boundThemeHandler = null;
        }

        // 5. Unbind ALL dashboard delegated events in one call via namespace
        $(document).off('.dashboard');
    }

    /**
     * Binds DOM interaction handlers with the '.dashboard' namespace.
     * @private
     */
    _bindEventListeners() {
        const $doc = $(document);

        // 1. Unbind any previous dashboard listeners to avoid duplicates
        $doc.off('.dashboard');

        // 2. Setup standard click actions
        const clickActions = {
            '#db-btn-retry': () => this.enter(),
            '#btn-refresh-dashboard': () => this.enter(),
            '#btn-radial-zoom-in': () => this._zoomRadial(1.25),
            '#btn-radial-zoom-out': () => this._zoomRadial(0.8),
            '#btn-radial-reset': () => this._resetRadialZoom(),
            '#db-clear-search': () => this._resetQuickSearch()
        };

        // 3. Register click events with the '.dashboard' namespace
        Object.entries(clickActions).forEach(([selector, handler]) => {
            $doc.on('click.dashboard', selector, handler);
        });

        // 4. Debounced Search Input with the '.dashboard' namespace
        $doc.on('input.dashboard', '#db-quick-search-input', (e) => {
            const query = (e.target?.value ?? '').trim();
            this._debouncedQuickSearch(query);
        });

        $doc.on('keydown.dashboard', '#db-quick-search-input', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._debouncedQuickSearch.flush();
            } else if (e.key === 'Escape') {
                this._debouncedQuickSearch.cancel();
                this._resetQuickSearch();
            }
        });

        // 5. Chart Mode Toggle Handler with the '.dashboard' namespace
        $doc.on('click.dashboard', '#chart-mode-toggle [data-chart-mode]', (e) => {
            const mode = $(e.currentTarget).data('chart-mode') || $(e.currentTarget).attr('data-chart-mode');
            if (mode) {
                this._setChartMode(mode);
            }
        });

        // 6. Theme Change Listener (safe duplicate prevention)
        if (this._boundThemeHandler) {
            document.removeEventListener('themechanged', this._boundThemeHandler);
        }
        this._boundThemeHandler = () => {
            if (this.summaryData) this.renderDefinitionChart(this.summaryData);
            if (this.dependenciesData) this.renderRadialTidyTree(this.dependenciesData);
        };
        document.addEventListener('themechanged', this._boundThemeHandler);
    }

    /**
     * Helper to smoothly scale the radial D3 SVG zoom
     */
    _zoomRadial(scaleFactor) {
        if (this.radialSvg && this.radialZoom) {
            this.radialSvg.transition().duration(250).call(this.radialZoom.scaleBy, scaleFactor);
        }
    }

    /**
     * Helper to reset the radial D3 SVG zoom to its initial transform
     */
    _resetRadialZoom() {
        if (this.radialSvg && this.radialZoom && this.radialInitialTransform) {
            this.radialSvg.transition().duration(300).call(this.radialZoom.transform, this.radialInitialTransform);
            if (this.forceSimulation) {
                this.forceSimulation.alpha(0.3).restart();
            }
        }
    }

    /**
     * Fetches all required endpoints in parallel with resilient fallback.
     */
    async loadAllDashboardData() {
        await Promise.allSettled([
            this.applicationState?.checkHealth()
                .then(isHealthIsUp => this.renderUptimeStatus(isHealthIsUp)),

            httpClient.get(this.endpoints.application)
                .then(data => this.renderApplicationInfo(this.applicationData = data))
                .catch(err => {
                    console.warn('Could not fetch Application Info:', err);
                    this.renderApplicationInfoFallback();
                }),

            httpClient.get(this.endpoints.definitionsSummary)
                .then(data => {
                    this.summaryData = data;
                    this.renderDefinitionKpi(data);
                    this.renderDefinitionChart(data);
                }),

            httpClient.getWithQuery(
                this.endpoints.instances,
                QueryParam.build({ pageSize: 100, sortBy: 'initDurationNanos', sortDir: 'DESC' }).toString()
            ).then(data => this.renderInstancesKpiAndBottlenecks(this.instancesData = data)),

            httpClient.getWithQuery(
                this.endpoints.conditions,
                QueryParam.build({ pageSize: 100 }).toString()
            ).then(data => this.renderConditionsKpiAndSummary(this.conditionsData = data)),

            httpClient.getWithQuery(
                this.endpoints.dependencies,
                QueryParam.build({ pageSize: 100 }).toString()
            ).then(data => {
                this.dependenciesData = data;
                this.renderDependenciesKpiAndHubs(data);
                this.renderRadialTidyTree(data);
            })
        ]);
    }

    /**
     * Renders the application hero metrics and starts the live ticker.
     */
    renderApplicationInfo(app) {
        const vm = this._extractAppViewModel(app);
        const $hero = $('#hero-application-banner');

        const fieldMap = {
            appName: vm.name ? vm.name.toUpperCase() : '',
            bootVersion: `v${vm.bootVersion}`,
            frameworkVersion: `v${vm.frameworkVersion}`,
            javaVersion: `Java ${vm.javaVersion}`,
            javaVendor: vm.javaVendor,
            startupDuration: vm.formattedDuration,
            startedAt: vm.formattedStartedAt
        };

        this._bindDataFields($hero, fieldMap);
        this._renderProfileBadges(vm.activeProfiles, vm.defaultProfiles);
        if (this.applicationState) {
            this.applicationState.setAppInfo(app);
        } else {
            PageHeader.setAppName(vm.name);
        }

        this.appStartDate = vm.startDate;
        if (vm.startDate && this.currentUptimeState !== false) {
            this._startUptimeTracker(vm.startDate);
        }
    }

    _bindDataFields($container, fieldMap = {}) {
        Object.entries(fieldMap).forEach(([field, value]) => {
            const $target = $container.find(`[data-field="${field}"]`);
            if ($target.length && value != null) {
                $target.text(value);
                if (field === 'javaVendor' || field === 'startedAt') {
                    $target.attr('title', String(value));
                }
            }
        });
    }

    _renderProfileBadges(activeProfiles = [], defaultProfiles = []) {
        const $hero = $('#hero-application-banner');
        const $container = $('#hero-profiles-list').empty();
        const isActive = activeProfiles.length > 0;
        const profiles = isActive ? activeProfiles : defaultProfiles;

        $hero.find('[data-field="profilesLabel"]').text(isActive ? 'Active Profiles' : 'Default Profiles');

        if (!profiles.length || (!isActive && profiles.length === 1 && profiles[0] === 'default')) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-profile-empty');
            if (emptyClone) {
                $container.append(emptyClone);
                return;
            }
        }

        const fragment = document.createDocumentFragment();
        profiles.forEach(profileName => {
            const clone = TemplateEngine.clone(isActive ? 'tpl-dashboard-profile-badge' : 'tpl-dashboard-profile-empty');
            if (!clone) return;

            const badge = clone.firstElementChild;
            const nameEl = badge.querySelector('[data-field="name"]') || badge;
            nameEl.textContent = profileName;

            if (!isActive) {
                badge.setAttribute('title', 'Default profile');
            }

            fragment.appendChild(clone);
        });

        $container.append(fragment);
    }

    _extractAppViewModel(app = {}) {
        const {
            name = 'Spring Application',
            spring = {},
            java = {},
            startup = {},
            activeProfiles = [],
            defaultProfiles = [],
        } = app;

        let startDate = null;
        let formattedStartedAt = '--';

        if (startup.startedAt) {
            const parsedDate = new Date(startup.startedAt);
            if (!Number.isNaN(parsedDate.getTime())) {
                startDate = parsedDate;
                formattedStartedAt = parsedDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        }

        return {
            name,
            bootVersion: spring.bootVersion ?? '3.x',
            frameworkVersion: spring.frameworkVersion ?? '6.x',
            javaVersion: java.version ?? '21',
            javaVendor: java.vendor ?? 'OpenJDK',
            rawDuration: startup.startupDuration,
            formattedDuration: this._formatStartupDuration(startup.startupDuration),
            rawStartedAt: startup.startedAt ?? '',
            formattedStartedAt,
            startDate,
            activeProfiles: Array.isArray(activeProfiles) ? activeProfiles : [],
            defaultProfiles: Array.isArray(defaultProfiles) && defaultProfiles.length > 0
                ? defaultProfiles
                : ['default'],
        };
    }

    renderApplicationInfoFallback() {
        this.renderUptimeStatus(false);
        const $hero = $('#hero-application-banner');
        const fallbackMap = {
            appName: 'Spring Boot Application',
            bootVersion: 'Active',
            frameworkVersion: 'Detected',
            javaVersion: 'Runtime',
            javaVendor: 'Standard',
            startupDuration: 'Ready',
            startedAt: 'Live',
            profilesLabel: 'Active Profiles'
        };

        this._bindDataFields($hero, fallbackMap);

        const $container = $('#hero-profiles-list').empty();
        const emptyClone = TemplateEngine.clone('tpl-dashboard-profile-empty');
        if (emptyClone) {
            $container.append(emptyClone);
        }
    }

    /**
     * Renders either the active uptime counter or the Service Down chip.
     */
    renderUptimeStatus(isLive) {
        const $container = $('#hero-uptime-container');
        if (!$container.length) return;

        if (this.currentUptimeState === isLive) return;
        this.currentUptimeState = isLive;

        const templateId = isLive ? 'tpl-dashboard-uptime-active' : 'tpl-dashboard-uptime-down';
        const clone = TemplateEngine.clone(templateId);
        if (clone) {
            $container.empty().append(clone);
        }

        if (isLive) {
            if (this.appStartDate) {
                this._startUptimeTracker(this.appStartDate);
            }
        } else {
            clearInterval(this.uptimeInterval);
            this.uptimeInterval = null;
        }
    }

    /**
     * Renders Bean Definitions KPI and prepares summary counts.
     */
    renderDefinitionKpi(summary) {
        if (!summary) return;

        const total = summary.totalBeanDefinitions || 0;
        $('#kpi-definitions-count').text(total.toLocaleString());

        const scopes = summary.scopeDistribution || {};
        const singletons = scopes.singleton || 0;
        const prototypes = scopes.prototype || 0;

        $('#kpi-def-singletons').text(singletons.toLocaleString());
        $('#kpi-def-prototypes').text(prototypes.toLocaleString());
    }

    /**
     * Renders Chart.js Doughnut for Bean Definition breakdown.
     */
    renderDefinitionChart(summary) {
        if (!summary) return;

        const total = summary.totalBeanDefinitions || 0;
        $('#db-chart-total').text(total.toLocaleString());

        let labels = [];
        let data = [];
        let colors = [];
        let footerText = '';

        const isDark = document.documentElement.classList.contains('dark');
        const borderColor = isDark ? '#0f172a' : '#ffffff';

        const CHART_CONFIGS = {
            scope: {
                getDistribution: (s) => s?.scopeDistribution,
                formatLabel: (k) => capitalize(k),
                getColor: (l) => SCOPE_COLORS[l] || '#a855f7',
                getFooter: (len) => `Showing ${len} active scope distributions`,
            },
            role: {
                getDistribution: (s) => s?.roleDistribution,
                formatLabel: (k) => capitalize(k.replace('ROLE_', '')),
                getColor: (l) => ROLE_COLORS[l] || '#3b82f6',
                getFooter: (len) => `Showing ${len} Spring bean roles`,
            },
            loading: {
                getDistribution: (s) => s?.loadingModeDistribution,
                formatLabel: (k) => capitalize(k),
                getColor: (l) => LOADING_MODE_COLORS[l] || '#3b82f6',
                getFooter: () => 'Showing Lazy vs Eager loading modes',
            },
        };

        const config = CHART_CONFIGS[this.activeChartMode];
        if (config) {
            const rawMap = config.getDistribution(summary) || {};
            const entries = Object.entries(rawMap);

            labels = entries.map(([key]) => config.formatLabel(key));
            data = entries.map(([, val]) => val);
            colors = labels.map((label) => config.getColor(label));
            footerText = config.getFooter(labels.length);
        }

        $('#db-chart-footer-info').text(footerText);

        // Render Custom Legend using TemplateEngine
        const $legend = $('#db-definition-legend').empty();
        const fragment = document.createDocumentFragment();

        labels.forEach((label, idx) => {
            const val = data[idx] || 0;
            const pct = formatPercentage(val, total);
            const col = colors[idx] || '#6366f1';

            const clone = TemplateEngine.clone('tpl-dashboard-chart-legend-item');
            if (!clone) return;

            const $item = $(clone.firstElementChild);
            $item.find('[data-field="dot"]').css('background-color', col);
            $item.find('[data-field="label"]').text(label).attr('title', label);
            $item.find('[data-field="val"]').text(val);
            $item.find('[data-field="pct"]').text(pct);

            fragment.appendChild(clone);
        });

        $legend.append(fragment);

        // Render Chart.js
        const canvas = document.getElementById('dbDefinitionChart');
        if (!canvas) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        if (typeof Chart === 'undefined') return;

        this.chartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: data.length > 0 ? data : [1],
                    backgroundColor: data.length > 0 ? colors : ['#94a3b8'],
                    borderWidth: 0,
                    borderRadius: 6,
                    spacing: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                cutout: '74%',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 800,
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
                        padding: 10,
                        boxPadding: 5,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        titleFont: { family: 'Inter, sans-serif', size: 12, weight: 'bold' },
                        bodyFont: { family: 'Inter, sans-serif', size: 12 },
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw || 0;
                                const pct = formatPercentage(val, total);
                                return ` ${ctx.label}: ${val} (${pct})`;
                            }
                        }
                    }
                }
            }
        });
    }

    _setChartMode(mode) {
        if (this.activeChartMode === mode && this.chartInstance) return;
        this.activeChartMode = mode;

        const activeCls = 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm';
        const inactiveCls = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white';

        $('#chart-mode-toggle [data-chart-mode]').each(function () {
            const btnMode = $(this).data('chart-mode') || $(this).attr('data-chart-mode');
            const isCurrent = btnMode === mode;
            $(this)
                .toggleClass(activeCls, isCurrent)
                .toggleClass(inactiveCls, !isCurrent)
                .attr('aria-pressed', String(isCurrent));
        });

        if (this.summaryData) {
            this.renderDefinitionChart(this.summaryData);
        }
    }

    /**
     * Renders Bean Instances KPI and top 5 slowest initializing beans.
     */
    renderInstancesKpiAndBottlenecks(instancesResponse) {
        if (!instancesResponse) return;

        const items = instancesResponse?.content ?? [];
        const total = instancesResponse?.totalElements ?? items.length;
        $('#kpi-instances-count').text(total.toLocaleString());

        // Compute total startup cost
        let totalNanos = 0;
        let maxNanos = 0;
        items.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            totalNanos += nanos;
            if (nanos > maxNanos) maxNanos = nanos;
        });

        const formattedTotalCost = this._formatNanos(totalNanos);
        const formattedMaxLatency = this._formatNanos(maxNanos);

        $('#kpi-inst-total-cost').text(formattedTotalCost);
        $('#db-slowest-cost-val').text(formattedTotalCost);
        $('#db-slowest-max-val').text(formattedMaxLatency);

        // Sort items by initDurationNanos descending and pick top 5
        const sorted = [...items].sort((a, b) => (b.initDurationNanos || 0) - (a.initDurationNanos || 0));
        const top5 = sorted.slice(0, 5);
        const topMaxNanos = top5.length > 0 ? (top5[0].initDurationNanos || 1) : 1;

        const $list = $('#db-slowest-beans-list').empty();

        if (top5.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
            if (emptyClone) {
                $(emptyClone).find('[data-field="message"]').text('No instance initialization records found.');
                $list.append(emptyClone);
            }
            return;
        }

        const fragment = document.createDocumentFragment();

        top5.forEach((item, index) => {
            const clone = TemplateEngine.clone('tpl-dashboard-slowest-row');
            if (!clone) return;

            const $row = $(clone.firstElementChild);
            const durationNanos = item.initDurationNanos || 0;
            const durationMs = durationNanos / 1_000_000;
            const formattedDuration = this._formatNanos(durationNanos);
            const meta = resolveBeanMetadata(item);
            const pct = Math.max(8, Math.min(100, Math.round((durationNanos / topMaxNanos) * 100)));

            $row.attr('data-bean-name', item.beanName || '');
            $row.find('[data-field="rank"]').text(index + 1);
            $row.find('[data-field="icon"]')
                .css('color', meta.color)
                .text(meta.icon);
            $row.find('[data-field="name"]').text(item.beanName || '--');
            $row.find('[data-field="type"]').text(item.type || '--');

            const $bar = $row.find('[data-field="latency-bar"]').css('width', `${pct}%`);
            const $badge = $row.find('[data-field="latency-badge"]').text(formattedDuration);

            // Apply latency theme classes cleanly via helper
            const theme = resolveLatencyTheme(durationMs);
            $bar.addClass(theme.bar);
            $badge.addClass(theme.badge);

            // Click to navigate to instances
            $row.on('click', () => {
                if (item.beanName) {
                    const query = QueryParam.build({ search: item.beanName, contextId: item.contextId || '' }).toString();
                    window.location.hash = `#/instances?${query}`;
                } else {
                    window.location.hash = '#/instances';
                }
            });

            fragment.appendChild(clone);
        });

        $list.append(fragment);
    }

    /**
     * Renders Condition evaluations KPI, match ratio progress bar, and notable auto-configs.
     */
    renderConditionsKpiAndSummary(conditionsResponse) {
        if (!conditionsResponse) return;

        const items = conditionsResponse?.content ?? [];
        const total = conditionsResponse?.totalElements ?? items.length;

        let matched = 0;
        let notMatched = 0;

        items.forEach(c => {
            if (c.outcome === 'MATCHED') matched++;
            else notMatched++;
        });

        // Extrapolate or calculate percentages
        const evaluatedTotal = matched + notMatched || total || 1;
        const matchedPct = Math.round((matched / evaluatedTotal) * 100);
        const notMatchedPct = 100 - matchedPct;

        $('#kpi-conditions-count').text(total.toLocaleString());
        $('#kpi-cond-matched').text(matched.toLocaleString());
        $('#kpi-cond-matched-pct').text(matchedPct);
        $('#kpi-cond-skipped').text(notMatched.toLocaleString());

        // Update Progress Bar
        $('#db-cond-matched-label').text(`${matched} (${matchedPct}%)`);
        $('#db-cond-unmatched-label').text(`${notMatched} (${notMatchedPct}%)`);
        $('#db-cond-matched-bar').css('width', `${matchedPct}%`);
        $('#db-cond-unmatched-bar').css('width', `${notMatchedPct}%`);

        $('#db-conditions-eval-count').text(`${total} Total Checked`);

        // Render Recent Samples
        const $list = $('#db-conditions-sample-list').empty();

        if (items.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
            if (emptyClone) {
                $(emptyClone).find('[data-field="message"]').text('No condition reports available.');
                $list.append(emptyClone);
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        const sample = items.slice(0, 4);

        sample.forEach(cond => {
            const clone = TemplateEngine.clone('tpl-dashboard-condition-row');
            if (!clone) return;

            const $row = $(clone.firstElementChild);
            const isMatch = cond.outcome === 'MATCHED';
            const shortSource = cond.source?.split('.').pop() || cond.source || '--';

            $row.find('[data-field="dot"]')
                .addClass(isMatch ? 'bg-emerald-500' : 'bg-slate-400');
            $row.find('[data-field="source"]')
                .text(shortSource)
                .attr('title', cond.source || '');

            const $badge = $row.find('[data-field="outcome-badge"]');
            $badge.text(cond.outcome || 'UNKNOWN');

            if (isMatch) {
                $badge.addClass('bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800');
            } else {
                $badge.addClass('bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700');
            }

            fragment.appendChild(clone);
        });

        $list.append(fragment);
    }

    /**
     * Renders Dependency Graph KPI and top hub beans (highest fan-in).
     */
    renderDependenciesKpiAndHubs(dependenciesResponse) {
        if (!dependenciesResponse) return;

        const items = dependenciesResponse?.content ?? [];
        const totalBeans = dependenciesResponse?.totalElements ?? items.length;

        // Build dependent fan-in counts
        const dependentCounts = new Map();
        let totalEdges = 0;

        items.forEach(item => {
            const deps = item.dependencies || [];
            totalEdges += deps.length;
            deps.forEach(dep => {
                const count = dependentCounts.get(dep) || 0;
                dependentCounts.set(dep, count + 1);
            });
        });

        $('#kpi-dependencies-count').text(totalBeans.toLocaleString());
        $('#kpi-dep-edges').text(totalEdges.toLocaleString());
        $('#kpi-dep-beans').text(dependentCounts.size.toLocaleString());

        $('#db-graph-footer-stats').text(`${totalBeans} Beans • ${totalEdges} Connections`);

        // Sort Top Hub Beans by fan-in count
        const sortedHubs = Array.from(dependentCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const $list = $('#db-dependency-hubs-list').empty();

        if (sortedHubs.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
            if (emptyClone) {
                $(emptyClone).find('[data-field="message"]').text('No dependency connections detected.');
                $list.append(emptyClone);
            }
            return;
        }

        const fragment = document.createDocumentFragment();

        sortedHubs.forEach(([beanName, count], idx) => {
            const clone = TemplateEngine.clone('tpl-dashboard-hub-row');
            if (!clone) return;

            const $row = $(clone.firstElementChild);
            const meta = resolveBeanMetadata({ beanName });

            $row.find('[data-field="rank"]').text(idx + 1);
            $row.find('[data-field="icon"]')
                .css('color', meta.color)
                .text(meta.icon);
            $row.find('[data-field="name"]').text(beanName);
            $row.find('[data-field="type"]').text('Referenced by other beans');
            $row.find('[data-field="dependents-count"]').text(`${count} dependents`);

            $row.on('click', () => {
                const query = QueryParam.build({ search: beanName }).toString();
                window.location.hash = `#/definitions?${query}`;
            });

            fragment.appendChild(clone);
        });

        $list.append(fragment);
    }

    /**
     * Quick search handler using backend API.
     */
    async handleQuickSearch(query) {
        const $resultsContainer = $('#db-quick-search-results');
        const $chipsContainer = $('#db-quick-search-chips').empty();

        if (!query || query.length < 2) {
            $resultsContainer.addClass('hidden');
            return;
        }

        try {
            const queryParams = QueryParam.build({
                search: query,
                pageSize: 9
            }).toString();

            const response = await httpClient.getWithQuery(this.endpoints.definitions, queryParams);
            const items = response?.content ?? [];

            if (items.length === 0) {
                const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
                if (emptyClone) {
                    const $emptyEl = $(emptyClone.firstElementChild);
                    $emptyEl.addClass('col-span-full')
                        .find('[data-field="message"]')
                        .text('No matching beans found for query.');
                    $chipsContainer.append($emptyEl);
                }
                $resultsContainer.removeClass('hidden');
                return;
            }

            const fragment = document.createDocumentFragment();

            items.forEach(b => {
                const clone = TemplateEngine.clone('tpl-dashboard-search-chip');
                if (!clone) return;

                const $chip = $(clone.firstElementChild);
                const beanName = b.beanName || b.name || '--';
                const beanType = b.beanType || b.type || b.className || '';
                const contextId = b.contextId || '';
                const meta = resolveBeanMetadata({ beanName, type: beanType });

                $chip.find('[data-field="icon"]')
                    .css('color', meta.color)
                    .text(meta.icon);
                $chip.find('[data-field="name"]')
                    .html(BeanSearchEngine.highlight(beanName, query))
                    .attr('title', beanName);

                // Def button & chip body -> Definitions page with URL params
                $chip.find('.btn-goto-def').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = QueryParam.build({ search: beanName, contextId }).toString();
                    window.location.hash = `#/definitions?${q}`;
                });

                // Graph button -> Dependency Graph page with URL params
                $chip.find('.btn-goto-graph').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = QueryParam.build({ focus: beanName, contextId }).toString();
                    window.location.hash = `#/graph?${q}`;
                });

                // Inst button -> Bean Instances page with URL params
                $chip.find('.btn-goto-inst').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = QueryParam.build({ search: beanName, contextId }).toString();
                    window.location.hash = `#/instances?${q}`;
                });

                fragment.appendChild(clone);
            });

            $chipsContainer.append(fragment);
            $resultsContainer.removeClass('hidden');
        } catch (err) {
            console.warn('Error during dashboard quick search:', err);
            $chipsContainer.append('<div class="col-span-full text-xs text-red-400 py-2">Error searching beans.</div>');
            $resultsContainer.removeClass('hidden');
        }
    }

    /**
     * Starts interval to calculate live uptime.
     */
    _startUptimeTracker(startDate) {
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);
        this.appStartDate = startDate;

        const update = () => {
            const $heroAppUptime = $('#hero-app-uptime');
            if (!$heroAppUptime.length) return;

            const diffMs = Date.now() - startDate.getTime();
            if (diffMs < 0) {
                $heroAppUptime.text('Just started');
                return;
            }

            const totalSec = Math.floor(diffMs / 1000);
            const hrs = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            const secs = totalSec % 60;

            let formatted = '';
            if (hrs > 0) {
                formatted = `${hrs}h ${mins}m ${secs}s`;
            } else if (mins > 0) {
                formatted = `${mins}m ${secs}s`;
            } else {
                formatted = `${secs}s`;
            }

            $heroAppUptime.text(formatted);
        };

        update();
        this.uptimeInterval = setInterval(update, 1000);
    }

    /**
     * Formats startup duration string or object into human-readable seconds/millis.
     */
    _formatStartupDuration(val) {
        if (!val) return '--';

        if (typeof val === 'number') {
            return `${val.toFixed(2)}s`;
        }

        if (typeof val === 'string') {
            // ISO-8601 duration: PT1.854S or PT2M1.5S
            if (val.startsWith('PT')) {
                const secondsMatch = val.match(/([\d.]+)S/);
                const minutesMatch = val.match(/(\d+)M/);

                let res = '';
                if (minutesMatch) res += `${minutesMatch[1]}m `;
                if (secondsMatch) res += `${parseFloat(secondsMatch[1]).toFixed(2)}s`;
                return res.trim() || val;
            }
            return val;
        }

        if (typeof val === 'object' && val.seconds !== undefined) {
            const sec = (val.seconds || 0) + ((val.nano || 0) / 1e9);
            return `${sec.toFixed(2)}s`;
        }

        return String(val);
    }

    /**
     * Formats nanoseconds into µs, ms, or s.
     */
    _formatNanos(nanos) {
        if (!nanos || isNaN(nanos)) return '0 ms';

        if (nanos < 1_000_000) {
            return `${(nanos / 1_000).toFixed(1)} µs`;
        }
        if (nanos < 1_000_000_000) {
            return `${(nanos / 1_000_000).toFixed(2)} ms`;
        }
        return `${(nanos / 1_000_000_000).toFixed(2)} s`;
    }

    /**
     * Renders Interactive D3 Force-Directed Tree with Precision Spring Root Core and Natural 3D Glass Orbs.
     * Node labels are removed from canvas and presented via floating glass morphia tooltips.
     */
    renderRadialTidyTree(dependenciesResponse) {
        if (!dependenciesResponse) return;

        const $dbRadialLoading = $('#db-radial-loading');

        const items = dependenciesResponse?.content ?? [];

        const $svg = $('#db-radial-tree-svg');
        const svgNode = $svg[0];
        if (!svgNode) return;

        if (items.length === 0) {
            $dbRadialLoading.addClass('hidden');
            $('#db-radial-stats').text('No dependencies found');
            return;
        }

        try {
            if (this.forceSimulation) {
                this.forceSimulation.stop();
                this.forceSimulation = null;
            }
            const treeData = GraphTreeBuilder.buildByContext(items);
            if (!treeData) {
                $dbRadialLoading.addClass('hidden');
                return;
            }

            const width = svgNode.clientWidth || 400;
            const height = svgNode.clientHeight || 340;

            const isDark = document.documentElement.classList.contains('dark');
            const defaultLinkStroke = isDark ? '#334155' : '#cbd5e1';
            const rootLinkStroke = '#10b981';

            const hierarchy = d3.hierarchy(treeData);
            const nodes = hierarchy.descendants();
            const links = hierarchy.links();
            const totalNodes = nodes.length;
            const treeDepth = hierarchy.height;
            $('#db-radial-stats').text(`${totalNodes} Beans • ${treeDepth} Levels • Hover or drag nodes`);

            const svg = d3.select(svgNode);
            svg.selectAll('*').remove();

            const getNodeColor = (d) => {
                if (d.depth === 0) return '#10b981';
                const text = `${d.data?.name || ''} ${d.data?.meta?.type || d.data?.type || ''}`.toLowerCase();
                if (/service/.test(text)) return '#34d399';
                if (/repo|data|entity|repository/.test(text)) return '#fbbf24';
                if (/controller|web|rest|endpoint/.test(text)) return '#f472b6';
                if (/config|security|filter|properties/.test(text)) return '#c084fc';
                return '#60a5fa';
            };

            // Main Zoomable SVG Group
            const g = svg.append('g');

            // Zoom Handling (with default zoomed-in view)
            const zoom = d3.zoom()
                .scaleExtent([0.25, 5.0])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });

            const initialScale = 1.30;
            const initialTransform = d3.zoomIdentity
                .translate((width / 2) * (1 - initialScale), (height / 2) * (1 - initialScale))
                .scale(initialScale);

            this.radialZoom = zoom;
            this.radialSvg = svg;
            this.radialInitialTransform = initialTransform;

            svg.call(zoom).call(zoom.transform, initialTransform);

            // 1. Render Links Group (Clean, thin linear lines)
            const linksGroup = g.append('g').attr('class', 'tree-links');
            const linkSelection = linksGroup.selectAll('line')
                .data(links)
                .join('line')
                .attr('class', 'tree-link')
                .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                .attr('stroke-opacity', 0.45)
                .attr('stroke-width', 0.75)
                .attr('stroke-linecap', 'round');

            // 2. Render Nodes Group (Clean, flat, natural solid colors with zero text clutter)
            const nodesGroup = g.append('g').attr('class', 'tree-nodes');
            const nodeGroups = nodesGroup.selectAll('g')
                .data(nodes)
                .join('g')
                .attr('class', 'tree-node select-none');

            // Node Rendering (Simple clean solid dots for all nodes including root)
            nodeGroups.each(function (d) {
                const nodeEl = d3.select(this);
                const hasChildren = Boolean(d.children && d.children.length > 0);
                const isRoot = d.depth === 0;
                const nodeColor = getNodeColor(d);
                const radius = isRoot ? 6.2 : (hasChildren ? 5.4 : 4.2);

                // Clean Solid Colored Circle
                nodeEl.append('circle')
                    .attr('class', 'node-dot')
                    .attr('r', radius)
                    .attr('fill', nodeColor)
                    .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                    .attr('stroke-width', 1.0);
            });

            // 3. Force Simulation Setup
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links)
                    .id(d => d.id)
                    .distance(d => d.depth === 1 ? 58 : (d.target.children ? 40 : 28))
                    .strength(0.85)
                )
                .force('charge', d3.forceManyBody()
                    .strength(d => d.depth === 0 ? -190 : (d.children ? -135 : -58))
                    .distanceMax(270)
                )
                .force('collide', d3.forceCollide()
                    .radius(d => (d.depth === 0 ? 11 : (d.children ? 9 : 7)) + 3)
                    .iterations(2)
                )
                .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
                .force('x', d3.forceX(width / 2).strength(0.04))
                .force('y', d3.forceY(height / 2).strength(0.04));

            this.forceSimulation = simulation;

            // Tick updates
            simulation.on('tick', () => {
                linkSelection
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);
            });

            // 4. Drag & Drop Interaction
            const drag = d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                });

            nodeGroups.call(drag);

            // 5. Interactive Hover & Path Tracing
            const $tooltip = $('#db-radial-tooltip');

            const getAncestors = (node) => {
                const ancestors = [];
                let curr = node;
                while (curr) {
                    ancestors.push(curr);
                    curr = curr.parent;
                }
                return ancestors;
            };

            const getDescendants = (node) => {
                const descendants = [];
                const traverse = (n) => {
                    descendants.push(n);
                    if (n.children) n.children.forEach(traverse);
                };
                traverse(node);
                return descendants;
            };

            nodeGroups.on('mouseenter', (event, d) => {
                const ancestors = new Set(getAncestors(d));
                const descendants = new Set(getDescendants(d));

                // 1. Highlight connected links with slim normal color (no yellow/orange)
                const hoverActiveColor = isDark ? '#94a3b8' : '#475569';
                linkSelection
                    .transition().duration(150)
                    .attr('stroke', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) {
                            return hoverActiveColor;
                        }
                        return defaultLinkStroke;
                    })
                    .attr('stroke-width', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) return 0.95;
                        return 0.5;
                    })
                    .attr('stroke-opacity', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) return 0.9;
                        return 0.15;
                    });

                // 2. Highlight active nodes & dim others
                nodeGroups
                    .transition().duration(150)
                    .attr('opacity', (node) => {
                        if (ancestors.has(node) || descendants.has(node)) return 1;
                        return 0.2;
                    });

                // Subtle scale for hovered element
                d3.select(event.currentTarget).selectAll('circle.node-dot')
                    .transition().duration(150)
                    .attr('transform', 'scale(1.3)')
                    .attr('stroke', isDark ? '#ffffff' : '#0f172a')
                    .attr('stroke-width', 1.5);

                // 3. Render Rich Glass morphia Tooltip Card
                const isRootNode = d.depth === 0;
                const meta = resolveBeanMetadata(d.data);
                const titleName = isRootNode ? contextName : d.data.name;
                const type = isRootNode ? 'Root Context' : (d.data.meta?.type || d.data.type || 'Spring Bean');
                const scope = isRootNode ? 'CONTEXT' : (d.data.meta?.scope || 'singleton');
                const directChildren = d.children ? d.children.length : 0;
                const totalSubtree = descendants.size - 1;
                const parentName = d.parent ? (d.parent.data.name || d.parent.data.fullName || 'Root') : 'None';

                const clone = TemplateEngine.clone('tpl-dashboard-radial-tooltip');
                if (clone) {
                    const $t = $(clone.firstElementChild);

                    // Resolve matching badge color
                    let badgeClass = 'bg-blue-400/20 text-blue-300';
                    let iconColor = '#60a5fa';
                    if (isRootNode) {
                        badgeClass = 'bg-emerald-500/20 text-emerald-300';
                        iconColor = '#10b981';
                    } else {
                        const color = getNodeColor(d);
                        if (color === '#34d399') { badgeClass = 'bg-emerald-400/20 text-emerald-300'; iconColor = '#34d399'; }
                        else if (color === '#fbbf24') { badgeClass = 'bg-amber-400/20 text-amber-300'; iconColor = '#fbbf24'; }
                        else if (color === '#f472b6') { badgeClass = 'bg-pink-400/20 text-pink-300'; iconColor = '#f472b6'; }
                        else if (color === '#c084fc') { badgeClass = 'bg-purple-400/20 text-purple-300'; iconColor = '#c084fc'; }
                    }

                    $t.find('[data-field="icon"]')
                        .css('color', iconColor)
                        .text(isRootNode ? 'account_tree' : meta.icon);
                    $t.find('[data-field="title"]').text(titleName);
                    $t.find('[data-field="scope-badge"]').addClass(badgeClass).text(scope);
                    $t.find('[data-field="type"]').text(type).attr('title', type);
                    $t.find('[data-field="depth"]').text(`L${d.depth}`);
                    $t.find('[data-field="direct-deps"]').text(directChildren);
                    $t.find('[data-field="subtree"]').text(totalSubtree);
                    $t.find('[data-field="parent"]').text(parentName);
                    $t.find('[data-field="parent-container"]').attr('title', parentName);

                    $tooltip.empty().append($t).removeClass('hidden');
                }
            })
                .on('mousemove', (event) => {
                    const containerRect = svgNode.getBoundingClientRect();
                    const x = event.clientX - containerRect.left + 14;
                    const y = event.clientY - containerRect.top - 20;
                    $tooltip.css({ left: `${Math.min(x, containerRect.width - 240)}px`, top: `${Math.max(10, y)}px` });
                })
                .on('mouseleave', (event, d) => {
                    linkSelection
                        .transition().duration(200)
                        .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                        .attr('stroke-width', 0.75)
                        .attr('stroke-opacity', 0.45);

                    nodeGroups
                        .transition().duration(200)
                        .attr('opacity', 1);

                    d3.select(event.currentTarget).selectAll('circle.node-dot')
                        .transition().duration(200)
                        .attr('transform', 'scale(1)')
                        .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                        .attr('stroke-width', 1.0);

                    $tooltip.addClass('hidden');
                });

            $dbRadialLoading.addClass('hidden');
        } catch (err) {
            console.error('Error rendering Force-Directed Tree:', err);
            $dbRadialLoading.addClass('hidden');
        }
    }
}
