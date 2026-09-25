import {
    GraphTreeBuilder,
    BeanMetadataRules,
    Formatter
} from '../../helper/index.js';

export class InstanceWaterfallWidget {
    calculateTicks(maxTimeMs) {
        const effectiveMax = maxTimeMs || 10;
        const ticks = BeanMetadataRules.calculateTimeTicks(effectiveMax);

        return ticks.map(tick => {
            const pct = (tick.ms / effectiveMax) * 100;
            return {
                ms: tick.ms,
                pct: Math.min(100, Math.max(0, pct)),
                label: tick.label || '',
                isMajor: Boolean(tick.isMajor)
            };
        }).filter(tick => tick.pct <= 100);
    }

    formatGanttRows(instances = [], optionsOrSelectedBeanName = null, selectedContextId = null, maxDurationNanos = 0, maxTimeMs = 10, bottleneckThresholdNanos = 500000) {
        if (!Array.isArray(instances)) return [];

        const options = (typeof optionsOrSelectedBeanName === 'object' && optionsOrSelectedBeanName !== null)
            ? optionsOrSelectedBeanName
            : {
                selectedBeanName: optionsOrSelectedBeanName,
                selectedContextId,
                maxDurationNanos,
                maxTimeMs,
                bottleneckThresholdNanos
            };

        return instances.map(inst => this.formatGanttRow(inst, options));
    }

    formatGanttRow(inst, options = {}) {
        const {
            selectedBeanName = null,
            selectedContextId = null,
            maxDurationNanos = 0,
            maxTimeMs = 10,
            bottleneckThresholdNanos = 500000
        } = options;

        const {
            beanName = '',
            contextId = '',
            initDurationNanos = 0,
            layer
        } = inst || {};

        const resolvedLayer = layer || BeanMetadataRules.resolveBeanLayer(inst) || {};
        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
        const isSelected = selectedBeanName === beanName && selectedContextId === contextId;
        const barColor = durationStyle.color || resolvedLayer.color || '#8b5cf6';
        const widthPct = this._calculateBarWidth(initDurationNanos, maxTimeMs);
        const canonicalContextId = contextId || 'root';
        const id = `${canonicalContextId}::${beanName}`;

        return {
            id,
            beanName,
            displayName: GraphTreeBuilder._displayName(beanName),
            contextId: canonicalContextId,
            layer: resolvedLayer,
            layerColor: resolvedLayer.color || '#8b5cf6',
            layerIcon: resolvedLayer.icon || 'deployed_code',
            durationFormatted: Formatter.formatDuration(initDurationNanos),
            durationStyle,
            barColor,
            widthPct,
            showBarLabel: widthPct > 6,
            isSelected,
            isBottleneck: Boolean(durationStyle.isBottleneck),
            raw: inst
        };
    }

    _calculateBarWidth(initDurationNanos, maxTimeMs) {
        const effectiveMax = maxTimeMs || 1;
        const initDurationMs = (initDurationNanos || 0) / 1e6;
        return Math.min(Math.max((initDurationMs / effectiveMax) * 100, 0.6), 100);
    }

    calculateScrubber(pageX, innerEl, scrollContainerEl, maxTimeMs = 10, manifestWidth = 340) {
        if (!innerEl || !scrollContainerEl) return null;

        const innerRect = innerEl.getBoundingClientRect();
        const mouseX = pageX - innerRect.left;
        const totalWidth = innerRect.width;

        if (mouseX >= manifestWidth && mouseX <= totalWidth) {
            const trackX = mouseX - manifestWidth;
            const trackWidth = totalWidth - manifestWidth;
            const timeRatio = trackWidth > 0 ? Math.max(0, Math.min(1, trackX / trackWidth)) : 0;
            const currentMs = timeRatio * maxTimeMs;
            const scrollTop = scrollContainerEl.scrollTop || 0;

            return {
                left: mouseX,
                badgeTop: scrollTop + 4,
                formattedTime: Formatter.formatDuration(currentMs * 1e6),
                visible: true
            };
        }

        return {
            left: 0,
            badgeTop: 0,
            formattedTime: '+0.00ms',
            visible: false
        };
    }
}

export const instanceWaterfallWidget = new InstanceWaterfallWidget();
export default instanceWaterfallWidget;
