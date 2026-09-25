import {
    NH, NW, NODE_STYLES_TINT, NODE_STYLES_BADGE, BEAN_TYPE_RULES, BEAN_LAYER_RULES, DEFAULT_BEAN_LAYER,
    PROXY_BADGE_STYLES, ADVICE_FROZEN_STYLES, DEFINITION_STATUS_STYLES, TAB_BUTTON_STYLES,
    SCOPE_STYLES, DEFAULT_SCOPE_STYLE, SCOPE_BADGE_CLASSES, LATENCY_THEME_RULES
} from './constants.js';
import Formatter from './formatters.js';
import beanDataStore from './bean-data-store.js';

// Style mappings for Tinted theme in dark mode
const DARK_NODE_STYLES_TINT = {
    root: { fill: 'rgba(30, 58, 138, 0.32)', stroke: '#3b82f6', icon: '#60a5fa', text: '#93c5fd' },
    context: { fill: 'rgba(67, 56, 202, 0.32)', stroke: '#6366f1', icon: '#818cf8', text: '#a5b4fc' },
    intermediate: { fill: 'rgba(6, 78, 59, 0.32)', stroke: '#22c55e', icon: '#4ade80', text: '#86efac' },
    leaf: { fill: 'rgba(120, 53, 15, 0.32)', stroke: '#f59e0b', icon: '#fbbf24', text: '#fde68a' },
    adapter: { fill: 'rgba(88, 28, 135, 0.32)', stroke: '#a855f7', icon: '#c084fc', text: '#e9d5ff' }
};

// Style mappings for Card/Badge theme in dark mode
const DARK_NODE_STYLES_BADGE = {
    root: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#3b82f6', icon: '#60a5fa', iconBg: 'rgba(59, 130, 246, 0.22)', text: '#f1f5f9' },
    context: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#6366f1', icon: '#818cf8', iconBg: 'rgba(99, 102, 241, 0.22)', text: '#f1f5f9' },
    intermediate: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#10b981', icon: '#34d399', iconBg: 'rgba(16, 185, 129, 0.22)', text: '#f1f5f9' },
    leaf: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#f59e0b', icon: '#fbbf24', iconBg: 'rgba(245, 158, 11, 0.22)', text: '#f1f5f9' },
    adapter: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#a855f7', icon: '#c084fc', iconBg: 'rgba(168, 85, 247, 0.22)', text: '#f1f5f9' }
};

// Granular step thresholds for calculateTimeTicks
const TIME_TICK_THRESHOLDS = [
    [0.05, 0.01],
    [0.1, 0.02],
    [0.25, 0.05],
    [0.5, 0.1],
    [1, 0.2],
    [2.5, 0.5],
    [5, 1],
    [10, 2],
    [25, 5],
    [50, 10],
    [100, 20],
    [250, 50],
    [500, 100],
    [1000, 200],
    [2000, 400],
    [5000, 1000],
    [10000, 2000]
];

/**
 * Domain Rule Engine for Spring Bean presentation, categorization, styling, and latency tiers.
 */
export class BeanMetadataRules {

    /**
     * D3 tree layout instance (if d3 is available globally).
     */
    static tree = typeof d3 !== 'undefined' ? d3.tree() : null;

    /**
     * Resolves scope badge CSS classes.
     * @param {string} scope
     * @returns {string}
     */
    static resolveScopeBadgeClass(scope) {
        const key = scope ? String(scope).toLowerCase() : 'singleton';
        return SCOPE_BADGE_CLASSES[key] || SCOPE_BADGE_CLASSES.default;
    }

    /**
     * Resolves dynamic background, foreground, and border styles for scope badges.
     * @param {string} scope
     * @returns {{ backgroundColor: string, color: string, borderColor: string }}
     */
    static resolveScopeStyle(scope) {
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const style = SCOPE_STYLES[scope?.toLowerCase()] ?? DEFAULT_SCOPE_STYLE;
        return {
            backgroundColor: isDark ? (style.darkBg || 'rgba(71, 85, 105, 0.15)') : style.bg,
            color: isDark ? (style.darkFg || '#cbd5e1') : style.fg,
            borderColor: isDark ? (style.darkBorder || 'rgba(71, 85, 105, 0.3)') : style.border
        };
    }

    /**
     * Resolves metadata (icon and color) for a bean based on keyword matches or fallback styles.
     * @param {Object|null} bean
     * @returns {{ icon: string, color: string }}
     */
    static resolveBeanMetadata(bean) {
        if (!bean) return { icon: 'extension', color: '#6b46c1' };

        const { beanName = '', type = '' } = bean;
        const lowerName = beanName.toLowerCase();
        const lowerType = type.toLowerCase();

        // Fast keyword lookup in BEAN_TYPE_RULES
        const rulesLength = BEAN_TYPE_RULES.length;
        for (let i = 0; i < rulesLength; i++) {
            const rule = BEAN_TYPE_RULES[i];
            const keywords = rule.keywords;
            const keywordsLength = keywords.length;

            for (let j = 0; j < keywordsLength; j++) {
                const keyword = keywords[j];
                if (lowerName.includes(keyword) || lowerType.includes(keyword)) {
                    return { icon: rule.icon, color: rule.color };
                }
            }
        }

        // Fallback node style resolution
        const style = BeanMetadataRules.nodeStyle({ fullName: beanName, meta: { type } });
        return {
            icon: 'extension',
            color: style.stroke ?? '#6b46c1'
        };
    }

    /**
     * Classifies a graph node or bean into a category: 'root', 'context', 'intermediate', 'adapter', or 'leaf'.
     * @param {Object} node
     * @returns {'root'|'context'|'intermediate'|'adapter'|'leaf'}
     */
    static getBeanCategory(node) {
        if (!node) return 'leaf';

        const nodeData = node.data ?? node;
        const fullName = nodeData.fullName ?? '';
        const type = nodeData.meta?.type ?? '';

        if (nodeData.meta?.type === 'context') return 'context';
        if (nodeData.meta?.type === 'root') return 'root';

        // 1. Root origin check (depth 0 is the root node)
        if (node.depth === 0) {
            return 'root';
        }

        const lowerName = fullName.toLowerCase();
        const lowerType = type.toLowerCase();

        // 2. Adapter check
        if (lowerName.includes('adapter') || lowerType.includes('adapter')) {
            return 'adapter';
        }

        // 3. Child node presence check for tree nodes
        const hasChildren = (node.children?.length ?? 0) > 0 || (node._children?.length ?? 0) > 0;
        if (hasChildren) {
            return 'intermediate';
        }

        // 4. Fallback check for raw data objects using BeanDataStore
        const record = beanDataStore.getBean(fullName) || (typeof window !== 'undefined' ? window.allBeansMap?.get(fullName) : null);
        if (record) {
            const deps = record.dependencies;
            const dependents = record.dependents;

            if (dependents && dependents.length > 0 && deps && deps.length > 0) return 'intermediate';
            if (!deps || deps.length === 0) return 'leaf';
            if (!dependents || dependents.length === 0) return 'root';
        }

        return 'leaf';
    }

    /**
     * Resolves node styling colors for D3 tree rendering.
     * @param {Object} node
     * @param {string} [theme='badge']
     * @returns {Object}
     */
    static nodeStyle(node, theme = 'badge') {
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const category = BeanMetadataRules.getBeanCategory(node);

        if (isDark) {
            return DARK_NODE_STYLES_BADGE[category] ?? DARK_NODE_STYLES_BADGE.adapter;
        }
        return NODE_STYLES_BADGE[category] ?? NODE_STYLES_BADGE.adapter;
    }

    /**
     * Top-to-bottom Bézier curve generator for tree links.
     */
    static tbLink({ source, target }) {
        const sx = source.x;
        const sy = source.y + NH / 2;
        const tx = target.x;
        const ty = target.y - NH / 2;
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
    }

    /**
     * Left-to-right Bézier curve generator for tree links.
     */
    static lrLink({ source, target }) {
        const sWidth = source.width ?? NW;
        const tWidth = target.width ?? NW;
        const sx = source.y + sWidth / 2;
        const sy = source.x;
        const tx = target.y - tWidth / 2;
        const ty = target.x;
        const mx = (sx + tx) / 2;
        return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
    }

    /**
     * Resolves latency theme rule based on duration in milliseconds.
     * @param {number} durationMs
     */
    static resolveLatencyTheme(durationMs) {
        const rule = LATENCY_THEME_RULES.find(r => durationMs >= r.minDurationMs);
        return rule ?? LATENCY_THEME_RULES.at(-1);
    }

    /**
     * Resolves dynamic latency heat-map color palette based on bean initialization duration.
     * @param {number} initDurationNanos
     * @param {number} [maxDurationNanos=0]
     * @param {number} [bottleneckThresholdNanos=500000]
     */
    static resolveDurationColor(initDurationNanos, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
        const nanos = initDurationNanos || 0;
        const threshold = bottleneckThresholdNanos && bottleneckThresholdNanos > 0 ? bottleneckThresholdNanos : 500000;

        // 1. Critical Bottleneck (> threshold)
        if (nanos > threshold) {
            return {
                color: '#ef4444',
                gradient: 'linear-gradient(135deg, #ef4444e6, #dc2626cc)',
                glow: 'rgba(239, 68, 68, 0.55)',
                tier: 'bottleneck',
                isBottleneck: true,
                textClass: 'text-rose-600 dark:text-rose-400',
                badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/50'
            };
        }

        // 2. High (0.4 * threshold to 1.0 * threshold) -> Warm Orange
        if (nanos >= threshold * 0.4) {
            return {
                color: '#f97316',
                gradient: 'linear-gradient(135deg, #f97316e6, #ea580ccc)',
                glow: 'rgba(249, 115, 22, 0.5)',
                tier: 'high',
                isBottleneck: false,
                textClass: 'text-orange-600 dark:text-orange-400',
                badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/40'
            };
        }

        // 3. Medium (0.1 * threshold to 0.4 * threshold) -> Amber
        if (nanos >= threshold * 0.1) {
            return {
                color: '#f59e0b',
                gradient: 'linear-gradient(135deg, #f59e0be6, #d97706cc)',
                glow: 'rgba(245, 158, 11, 0.5)',
                tier: 'medium',
                isBottleneck: false,
                textClass: 'text-amber-600 dark:text-amber-400',
                badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40'
            };
        }

        // 4. Fast (0.02 * threshold to 0.1 * threshold) -> Lime / Chartreuse
        if (nanos >= threshold * 0.02) {
            return {
                color: '#84cc16',
                gradient: 'linear-gradient(135deg, #84cc16e6, #65a30dcc)',
                glow: 'rgba(132, 204, 22, 0.5)',
                tier: 'fast',
                isBottleneck: false,
                textClass: 'text-lime-600 dark:text-lime-400',
                badgeClass: 'bg-lime-50 text-lime-700 border-lime-200/80 dark:bg-lime-950/40 dark:text-lime-400 dark:border-lime-800/40'
            };
        }

        // 5. Optimal (0.004 * threshold to 0.02 * threshold) -> Emerald Green
        if (nanos >= threshold * 0.004) {
            return {
                color: '#10b981',
                gradient: 'linear-gradient(135deg, #10b981e6, #059669cc)',
                glow: 'rgba(16, 185, 129, 0.5)',
                tier: 'optimal',
                isBottleneck: false,
                textClass: 'text-emerald-600 dark:text-emerald-400',
                badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
            };
        }

        // 6. Sub-Micro / Instant (< 0.004 * threshold) -> Cyan / Sky Blue
        return {
            color: '#06b6d4',
            gradient: 'linear-gradient(135deg, #06b6d4e6, #0284c7cc)',
            glow: 'rgba(6, 182, 212, 0.5)',
            tier: 'submicro',
            isBottleneck: false,
            textClass: 'text-cyan-600 dark:text-cyan-400',
            badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/40'
        };
    }

    /**
     * Categorizes bean into architecture layer with color & icon.
     * @param {Object} bean
     */
    static resolveBeanLayer(bean) {
        if (!bean) return DEFAULT_BEAN_LAYER;

        const name = (bean.beanName || '').toLowerCase();
        const type = (bean.type || '').toLowerCase();
        const combined = `${name} ${type}`;

        for (const rule of BEAN_LAYER_RULES) {
            if (rule.keywords.some(k => combined.includes(k))) {
                return { id: rule.id, label: rule.label, color: rule.color, icon: rule.icon };
            }
        }

        return DEFAULT_BEAN_LAYER;
    }

    /**
     * Calculates responsive time axis ticks (major and minor) for a given max duration.
     * @param {number} maxMs
     * @returns {Array<{ ms: number, isMajor: boolean, label: string }>}
     */
    static calculateTimeTicks(maxMs) {
        const majorStepMs = BeanMetadataRules._resolveMajorStepMs(maxMs);
        const minorStepMs = majorStepMs / 2;
        const precision = BeanMetadataRules._resolveTickPrecision(majorStepMs);
        const ticks = [];

        for (let ms = 0; ms <= maxMs + (minorStepMs * 0.1); ms += minorStepMs) {
            const roundedMs = Number.parseFloat(ms.toFixed(precision + 1));
            const isMajor = BeanMetadataRules._isMajorTick(roundedMs, majorStepMs);
            ticks.push({
                ms: roundedMs,
                isMajor,
                label: isMajor ? Formatter.formatTickLabel(roundedMs) : ''
            });
        }
        return ticks;
    }

    /**
     * Resolves the major step size in ms based on the maximum timeline duration.
     * @private
     * @param {number} maxMs
     * @returns {number}
     */
    static _resolveMajorStepMs(maxMs) {
        const entry = TIME_TICK_THRESHOLDS.find(([threshold]) => maxMs <= threshold);
        return entry ? entry[1] : Math.ceil(maxMs / 6000) * 1000;
    }

    /**
     * Determines rounding precision based on step size.
     * @private
     * @param {number} step
     * @returns {number}
     */
    static _resolveTickPrecision(step) {
        if (step >= 1) return 0;
        return step < 0.05 ? 3 : 2;
    }

    /**
     * Determines whether a given tick timestamp aligns with a major interval.
     * @private
     * @param {number} roundedMs
     * @param {number} majorStepMs
     * @returns {boolean}
     */
    static _isMajorTick(roundedMs, majorStepMs) {
        if (roundedMs === 0) return true;
        const delta = Math.abs(roundedMs - Math.round(roundedMs / majorStepMs) * majorStepMs);
        return delta < 1e-6 || Math.abs(roundedMs % majorStepMs) < 1e-6;
    }

    /**
     * Resolves styles for proxy type pill and tab header badge.
     */
    static resolveProxyBadgeStyles(proxyType) {
        const type = (proxyType || 'CGLIB').toUpperCase();
        return PROXY_BADGE_STYLES[type] || PROXY_BADGE_STYLES.CGLIB;
    }

    /**
     * Resolves CSS class for advice frozen status badge.
     */
    static resolveAdviceFrozenClass(isFrozen) {
        return ADVICE_FROZEN_STYLES[Boolean(isFrozen)] || ADVICE_FROZEN_STYLES.false;
    }

    /**
     * Resolves CSS class for definition status badge (Defined vs Dynamic).
     */
    static resolveDefinitionStatusBadgeClass(hasDefinition) {
        return DEFINITION_STATUS_STYLES[Boolean(hasDefinition)] || DEFINITION_STATUS_STYLES.false;
    }

    /**
     * Resolves CSS class for tab switcher buttons.
     */
    static resolveTabButtonClass(isActive) {
        return isActive ? TAB_BUTTON_STYLES.active : TAB_BUTTON_STYLES.inactive;
    }
}

export default BeanMetadataRules;
