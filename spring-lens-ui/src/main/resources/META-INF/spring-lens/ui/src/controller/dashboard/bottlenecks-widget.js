import { BeanMetadataRules } from '../../helper/index.js';

class BottlenecksWidget {
    computeMetrics(instancesResponse) {
        const items = instancesResponse?.content ?? [];
        const total = instancesResponse?.totalElements ?? items.length;

        const sorted = [...items].sort((a, b) => (b.initDurationNanos || 0) - (a.initDurationNanos || 0));
        const maxNanos = sorted[0]?.initDurationNanos || 0;
        const totalNanos = items.reduce((sum, item) => sum + (item.initDurationNanos || 0), 0);

        const slowestBeans = sorted
            .slice(0, 5)
            .map((item, index) => this._formatSlowestBean(item, index, maxNanos));

        return {
            count: total.toLocaleString(),
            totalCost: this.formatNanos(totalNanos),
            maxLatency: this.formatNanos(maxNanos),
            slowestBeans
        };
    }

    _formatSlowestBean(item, index, maxNanos) {
        const durationNanos = item.initDurationNanos || 0;
        const durationMs = durationNanos / 1_000_000;
        const meta = BeanMetadataRules.resolveBeanMetadata(item);
        const theme = BeanMetadataRules.resolveLatencyTheme(durationMs);
        const latencyPercent = maxNanos > 0
            ? Math.max(8, Math.min(100, Math.round((durationNanos / maxNanos) * 100)))
            : 0;

        return {
            rank: index + 1,
            name: item.beanName || '--',
            type: item.type || '--',
            contextId: item.contextId || '',
            icon: meta.icon,
            iconColor: meta.color,
            durationNanos,
            formattedDuration: this.formatNanos(durationNanos),
            latencyPercent,
            barClass: theme.bar || '',
            badgeClass: theme.badge || ''
        };
    }

    render(instancesResponse) {
        return this.computeMetrics(instancesResponse);
    }

    /**
     * Formats nanoseconds into µs, ms, or s.
     * @param {number} nanos
     * @returns {string}
     */
    formatNanos(nanos) {
        if (!nanos || Number.isNaN(nanos)) return '0 ms';
        if (nanos < 1e6) return `${(nanos / 1e3).toFixed(1)} µs`;
        if (nanos < 1e9) return `${(nanos / 1e6).toFixed(2)} ms`;
        return `${(nanos / 1e9).toFixed(2)} s`;
    }
}

const bottlenecksWidget = new BottlenecksWidget();
export default bottlenecksWidget;
