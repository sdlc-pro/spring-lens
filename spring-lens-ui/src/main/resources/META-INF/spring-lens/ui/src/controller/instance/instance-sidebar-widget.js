import {
    GraphTreeBuilder,
    Formatter,
    BeanMetadataRules
} from '../../helper/index.js';

export class InstanceSidebarWidget {
    formatDetails(instance, optionsOrMaxDurationNanos = 0, bottleneckThreshold = 500000) {
        if (!instance) return null;

        const options = (typeof optionsOrMaxDurationNanos === 'object' && optionsOrMaxDurationNanos !== null)
            ? optionsOrMaxDurationNanos
            : {
                maxDurationNanos: optionsOrMaxDurationNanos,
                bottleneckThresholdNanos
            };

        const {
            maxDurationNanos = 0,
            bottleneckThresholdNanos = 500000
        } = options;

        const {
            beanName = '',
            type = 'N/A',
            scope = 'singleton',
            initDurationNanos = 0,
            contextId = 'root',
            createdAt = '',
            hasDefinition = false
        } = instance;

        const metadata = BeanMetadataRules.resolveBeanMetadata(instance) || { icon: 'schema', color: '#8b5cf6' };
        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
        const definitionHref = this._buildDefinitionHref(beanName, contextId);
        const { simpleType, packageName } = this._resolveTypeInfo(type);
        const pctOfMax = this._calculatePctOfMax(initDurationNanos, maxDurationNanos);

        return {
            name: GraphTreeBuilder._displayName(beanName),
            fullName: beanName,
            type: type || 'N/A',
            simpleType,
            packageName,
            scope: Formatter.capitalize(scope || 'singleton'),
            duration: Formatter.formatDuration(initDurationNanos),
            initDurationNanos: initDurationNanos || 0,
            pctOfMax,
            isBottleneck: Boolean(durationStyle.isBottleneck),
            context: contextId || 'root',
            created: Formatter.formatDateTime(createdAt),
            rawCreated: createdAt || 'N/A',
            nanos: `${(initDurationNanos || 0).toLocaleString()} ns`,
            hasDefinition: Boolean(hasDefinition),
            definitionStatus: hasDefinition ? 'DEFINED' : 'DYNAMIC',
            definitionStatusTitle: hasDefinition ? 'Defined in Application Context' : 'Dynamically Registered',
            definitionStatusBadgeClass: BeanMetadataRules.resolveDefinitionStatusBadgeClass(hasDefinition),
            metadata,
            durationStyle,
            definitionHref
        };
    }

    formatProxyInfo(proxyInfo) {
        if (!proxyInfo || proxyInfo.isDirect || proxyInfo.proxyType === 'DIRECT') {
            return {
                isDirect: true,
                proxyType: 'Direct',
                badgeStyles: BeanMetadataRules.resolveProxyBadgeStyles('DIRECT'),
                targetClass: 'N/A',
                adviceFrozen: false,
                adviceFrozenClass: BeanMetadataRules.resolveAdviceFrozenClass(false),
                advices: [],
                proxiedInterfaces: []
            };
        }

        const {
            targetClass = 'N/A',
            advices = [],
            proxiedInterfaces = [],
            adviceFrozen = false,
            proxyType = 'CGLIB'
        } = proxyInfo;

        return {
            isDirect: false,
            proxyType,
            badgeStyles: BeanMetadataRules.resolveProxyBadgeStyles(proxyType),
            targetClass: targetClass || 'N/A',
            adviceFrozen: Boolean(adviceFrozen),
            adviceFrozenClass: BeanMetadataRules.resolveAdviceFrozenClass(adviceFrozen),
            advices: this._formatProxyMembers(advices, 'Advice'),
            proxiedInterfaces: this._formatProxyMembers(proxiedInterfaces, 'Interface')
        };
    }

    _buildDefinitionHref(beanName, contextId) {
        return `#/definitions?beanName=${encodeURIComponent(beanName || '')}${contextId ? `&contextId=${encodeURIComponent(contextId)}` : ''}`;
    }

    _calculatePctOfMax(initDurationNanos, maxDurationNanos) {
        if (!maxDurationNanos || maxDurationNanos <= 0) return 0;
        return Math.min(100, Math.max(1, Math.round(((initDurationNanos || 0) / maxDurationNanos) * 100)));
    }

    _resolveTypeInfo(type) {
        if (!type || type === 'N/A') {
            return { simpleType: 'N/A', packageName: '' };
        }

        const lastDotIndex = type.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return { simpleType: type, packageName: 'default package' };
        }

        return {
            simpleType: type.substring(lastDotIndex + 1),
            packageName: type.substring(0, lastDotIndex)
        };
    }

    _formatProxyMembers(items = [], badge) {
        if (!Array.isArray(items)) return [];
        return items.map(item => ({
            fullName: item,
            shortName: item.includes('.') ? item.split('.').pop() : item,
            badge
        }));
    }
}

export const instanceSidebarWidget = new InstanceSidebarWidget();
export default instanceSidebarWidget;
