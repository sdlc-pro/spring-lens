import {
    Formatter,
    SCOPE_COLORS,
    ROLE_COLORS,
    LOADING_MODE_COLORS
} from '../../helper/index.js';

class DefinitionChartWidget {
    static STRATEGIES = Object.freeze({
        scope: {
            getDistribution: (summary) => summary?.scopeDistribution,
            formatLabel: (key) => Formatter.capitalize(key),
            getColor: (label) => SCOPE_COLORS[label] || '#a855f7',
            getFooter: (count) => `Showing ${count} active scope distributions`
        },
        role: {
            getDistribution: (summary) => summary?.roleDistribution,
            formatLabel: (key) => Formatter.capitalize(key.replace(/^ROLE_/i, '')),
            getColor: (label) => ROLE_COLORS[label] || '#3b82f6',
            getFooter: (count) => `Showing ${count} Spring bean roles`
        },
        loading: {
            getDistribution: (summary) => summary?.loadingModeDistribution,
            formatLabel: (key) => Formatter.capitalize(key),
            getColor: (label) => LOADING_MODE_COLORS[label] || '#3b82f6',
            getFooter: () => 'Showing Lazy vs Eager loading modes'
        }
    });

    constructor() {
        this.chartInstance = null;
        this.activeMode = 'scope';
        this.summaryData = null;
    }

    computeKpi(summary) {
        const total = summary?.totalBeanDefinitions || 0;
        const scope = summary?.scopeDistribution || {};

        return {
            total: total.toLocaleString(),
            singletons: (scope.singleton || 0).toLocaleString(),
            prototypes: (scope.prototype || 0).toLocaleString()
        };
    }

    computeLegend(summary = this.summaryData, mode = this.activeMode) {
        const total = summary?.totalBeanDefinitions || 0;
        const config = DefinitionChartWidget.STRATEGIES[mode] || DefinitionChartWidget.STRATEGIES.scope;
        const distribution = config.getDistribution(summary) || {};

        const legendItems = Object.entries(distribution).map(([key, value = 0]) => {
            const label = config.formatLabel(key);
            return {
                label,
                value,
                percentage: Formatter.formatPercentage(value, total),
                color: config.getColor(label) || '#6366f1'
            };
        });

        return {
            total: total.toLocaleString(),
            footerText: config.getFooter(legendItems.length),
            labels: legendItems.map(item => item.label),
            data: legendItems.map(item => item.value),
            colors: legendItems.map(item => item.color),
            legendItems
        };
    }

    render(summary, mode = this.activeMode) {
        if (!summary) return null;
        this.renderChart(summary, mode);
        return {
            kpi: this.computeKpi(summary),
            legend: this.computeLegend(summary, mode)
        };
    }

    renderChart(summary = this.summaryData, mode = this.activeMode) {
        if (!summary) return;
        this.summaryData = summary;
        this.activeMode = mode;

        const legend = this.computeLegend(summary, mode);
        const total = summary.totalBeanDefinitions || 0;

        this._renderCanvasChart(legend, total);
    }

    setMode(mode) {
        if (!DefinitionChartWidget.STRATEGIES[mode]) return null;
        this.activeMode = mode;

        if (this.summaryData) {
            this.renderChart(this.summaryData, mode);
            return this.computeLegend(this.summaryData, mode);
        }
        return null;
    }

    onThemeChanged() {
        if (this.summaryData) {
            this.renderChart(this.summaryData, this.activeMode);
        }
    }

    destroy() {
        this._destroyChart();
        this.summaryData = null;
    }

    _renderCanvasChart(legend, total) {
        const canvas = document.getElementById('dbDefinitionChart');
        if (!canvas || typeof Chart === 'undefined') return;

        this._destroyChart();
        const isDark = document.documentElement.classList.contains('dark');
        this.chartInstance = new Chart(canvas, this._buildChartConfig(legend, total, isDark));
    }

    _destroyChart() {
        this.chartInstance?.destroy();
        this.chartInstance = null;
    }

    _buildChartConfig({ labels, data, colors }, total, isDark) {
        return {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: data.length ? colors : ['#94a3b8'],
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
                    tooltip: this._buildTooltipConfig(total, isDark)
                }
            }
        };
    }

    _buildTooltipConfig(total, isDark) {
        return {
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
                    const pct = Formatter.formatPercentage(val, total);
                    return ` ${ctx.label}: ${val} (${pct})`;
                }
            }
        };
    }
}

const chartWidget = new DefinitionChartWidget();
export default chartWidget;
