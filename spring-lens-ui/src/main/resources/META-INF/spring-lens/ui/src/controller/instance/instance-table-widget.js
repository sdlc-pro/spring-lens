import {
    GraphTreeBuilder,
    Formatter,
    BeanMetadataRules
} from '../../helper/index.js';

export class InstanceTableWidget {
    formatTableRows(instances = [], optionsOrSelectedBeanName = null, selectedContextId = null, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
        if (!Array.isArray(instances)) return [];

        const options = (typeof optionsOrSelectedBeanName === 'object' && optionsOrSelectedBeanName !== null)
            ? optionsOrSelectedBeanName
            : {
                selectedBeanName: optionsOrSelectedBeanName,
                selectedContextId,
                maxDurationNanos,
                bottleneckThresholdNanos
            };

        return instances.map(inst => this.formatTableRow(inst, options));
    }

    formatTableRow(inst, options = {}) {
        const {
            selectedBeanName = null,
            selectedContextId = null,
            maxDurationNanos = 0,
            bottleneckThresholdNanos = 500000
        } = options;

        const {
            beanName = '',
            contextId = '',
            initDurationNanos = 0,
            scope = 'singleton',
            type = '',
            layer,
            createdAt = ''
        } = inst || {};

        const resolvedLayer = layer || BeanMetadataRules.resolveBeanLayer(inst) || {};
        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
        const isSelected = selectedBeanName === beanName && selectedContextId === contextId;
        const { typeStr, simpleType, packageName } = this._resolveTypeInfo(type);
        const barColor = resolvedLayer.color || durationStyle.color || '#8b5cf6';
        const canonicalContextId = contextId || 'root';
        const id = `${canonicalContextId}::${beanName}`;

        return {
            id,
            beanName,
            displayName: GraphTreeBuilder._displayName(beanName),
            contextId: canonicalContextId,
            type: typeStr,
            simpleType,
            packageName,
            scope: (scope || 'singleton').toUpperCase(),
            scopeBadgeClass: BeanMetadataRules.resolveScopeBadgeClass(scope),
            createdAt,
            createdAtFormatted: Formatter.formatDateTime(createdAt),
            createdAtTooltip: createdAt ? `Created at: ${createdAt}` : '',
            durationFormatted: Formatter.formatDuration(initDurationNanos),
            durationNanos: `${(initDurationNanos || 0).toLocaleString()} ns`,
            durationStyle,
            layer: resolvedLayer,
            layerColor: barColor,
            layerIcon: resolvedLayer.icon || 'deployed_code',
            isSelected,
            isBottleneck: Boolean(durationStyle.isBottleneck),
            raw: inst
        };
    }

    getSortIcon(column, sortBy, sortDir) {
        if (sortBy !== column) return 'unfold_more';
        return sortDir === 'DESC' ? 'expand_more' : 'expand_less';
    }

    _resolveTypeInfo(type) {
        const typeStr = type || '-';
        const lastDotIndex = typeStr.lastIndexOf('.');

        if (lastDotIndex === -1) {
            return { typeStr, simpleType: typeStr, packageName: 'default package' };
        }

        return {
            typeStr,
            simpleType: typeStr.substring(lastDotIndex + 1),
            packageName: typeStr.substring(0, lastDotIndex)
        };
    }
}

export const instanceTableWidget = new InstanceTableWidget();
export default instanceTableWidget;
