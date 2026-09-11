import {
    NH, NW, NODE_STYLES_TINT, NODE_STYLES_BADGE, BEAN_TYPE_RULES, BEAN_LAYER_RULES, DEFAULT_BEAN_LAYER,
    PROXY_BADGE_STYLES, ADVICE_FROZEN_STYLES, DEFINITION_STATUS_STYLES, TAB_BUTTON_STYLES,
    SCOPE_STYLES, DEFAULT_SCOPE_STYLE, SCOPE_BADGE_CLASSES, LATENCY_THEME_RULES
} from "./constants.js";
import { debounce } from "./bean-search-engine.js";

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

const css = (variableName) =>
    getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatPercentage(count, total) {
    if (!total) return '0%';

    const pctVal = (count / total) * 100;

    if (pctVal > 0 && pctVal < 1) return '< 1%';
    if (pctVal > 99 && pctVal < 100) return '> 99%';

    return `${Math.round(pctVal)}%`;
}

function resolveScopeBadgeClass(scope) {
    const key = scope ? String(scope).toLowerCase() : 'singleton';
    return SCOPE_BADGE_CLASSES[key] || SCOPE_BADGE_CLASSES.default;
}

function resolveScopeStyle(scope) {
    const isDark = document.documentElement.classList.contains('dark');
    const style = SCOPE_STYLES[scope?.toLowerCase()] ?? DEFAULT_SCOPE_STYLE;
    return {
        backgroundColor: isDark ? (style.darkBg || 'rgba(71, 85, 105, 0.15)') : style.bg,
        color: isDark ? (style.darkFg || '#cbd5e1') : style.fg,
        borderColor: isDark ? (style.darkBorder || 'rgba(71, 85, 105, 0.3)') : style.border
    };
}

/**
 * Resolves metadata (icon and color) for a bean based on rule keyword matches or fallback styles.
 * @param {Object|null} bean - Target bean object.
 * @returns {{ icon: string, color: string }} Icon name and hex/CSS color.
 */
function resolveBeanMetadata(bean) {
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
    const style = nodeStyle({ fullName: beanName, meta: { type } });
    return {
        icon: 'extension',
        color: style.stroke ?? '#6b46c1'
    };
}

function getBeanCategory(node) {
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

    // 4. Fallback check for raw data objects using the global map
    const record = window.allBeansMap?.get(fullName);
    if (record) {
        const deps = record.dependencies;
        const dependents = record.dependents;

        if (dependents && dependents.length > 0 && deps && deps.length > 0) return 'intermediate';
        if (!deps || deps.length === 0) return 'leaf';
        if (!dependents || dependents.length === 0) return 'root';
    }

    return 'leaf';
}

function nodeStyle(node, theme = null) {
    const isDark = document.documentElement.classList.contains('dark');
    const category = getBeanCategory(node);
    const activeTheme = theme || localStorage.getItem('sl-node-theme') || 'tint';

    if (activeTheme === 'badge') {
        if (isDark) {
            return DARK_NODE_STYLES_BADGE[category] ?? DARK_NODE_STYLES_BADGE.adapter;
        }
        return NODE_STYLES_BADGE[category] ?? NODE_STYLES_BADGE.adapter;
    }

    if (isDark) {
        return DARK_NODE_STYLES_TINT[category] ?? DARK_NODE_STYLES_TINT.adapter;
    }
    return NODE_STYLES_TINT[category] ?? NODE_STYLES_TINT.adapter;
}

function tbLink({ source, target }) {
    const sx = source.x;
    const sy = source.y + NH / 2;
    const tx = target.x;
    const ty = target.y - NH / 2;
    const my = (sy + ty) / 2;

    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
}

function lrLink({ source, target }) {
    const sWidth = source.width ?? NW;
    const tWidth = target.width ?? NW;
    const sx = source.y + sWidth / 2;
    const sy = source.x;
    const tx = target.y - tWidth / 2;
    const ty = target.x;
    const mx = (sx + tx) / 2;

    return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

const tree = d3.tree();

function downloadJson(filename, data) {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function resolveLatencyTheme(durationMs) {
    const rule = LATENCY_THEME_RULES.find(r => durationMs >= r.minDurationMs);
    return rule ?? LATENCY_THEME_RULES[LATENCY_THEME_RULES.length - 1];
}

/**
 * Formats duration with clean, exact units (µs, ms, s).
 * 1 µs = 1,000 ns
 * 1 ms = 1,000,000 ns
 * 1 s  = 1,000,000,000 ns
 */
function formatDuration(nanos) {
    if (nanos === undefined || nanos === null || isNaN(nanos)) return '0µs';
    const n = Number(nanos);
    if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + 's';
    const ms = n / 1e6;
    if (ms >= 100) return Math.round(ms) + 'ms';
    if (ms >= 10) return ms.toFixed(1) + 'ms';
    if (ms >= 1) return ms.toFixed(2) + 'ms';
    if (n >= 100_000) return (n / 1e3).toFixed(0) + 'µs';
    if (n >= 10_000) return (n / 1e3).toFixed(1) + 'µs';
    if (n >= 1_000) return (n / 1e3).toFixed(2) + 'µs';
    return n + 'ns';
}

/**
 * Formats a date, timestamp, or ISO string into a clean, human-readable format.
 * e.g. "Sep 10, 2026, 13:27:49.123"
 */
function formatDateTime(val) {
    if (!val) return '-';
    let date;
    if (val instanceof Date) {
        date = val;
    } else if (typeof val === 'number') {
        date = new Date(val < 1e11 ? val * 1000 : val);
    } else if (typeof val === 'string') {
        date = new Date(val);
    } else {
        return String(val);
    }

    if (Number.isNaN(date.getTime())) {
        return String(val);
    }

    try {
        const datePart = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
        const timePart = date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${datePart}, ${timePart}.${ms}`;
    } catch {
        return date.toLocaleString();
    }
}

/**
 * Resolves dynamic latency heat-map color palette based on bean initialization duration.
 * Spectrum Hierarchy:
 * - > 500 µs (> 500,000 ns) -> Crimson Red / Bottleneck (#ef4444)
 * - 200 - 500 µs (200,000 - 500,000 ns) -> Warm Orange (#f97316)
 * - 50 - 200 µs (50,000 - 200,000 ns) -> Amber / Yellow (#f59e0b)
 * - 10 - 50 µs (10,000 - 50,000 ns) -> Lime / Chartreuse (#84cc16)
 * - 2 - 10 µs (2,000 - 10,000 ns) -> Emerald Green (#10b981)
 * - < 2 µs (< 2,000 ns) -> Luminous Cyan (#06b6d4)
 */
function resolveDurationColor(initDurationNanos, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
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
 * Categorizes bean into layer with color & icon matching the UI design.
 */
function resolveBeanLayer(bean) {
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
 * Formats tick label on instance axis.
 */
function formatTickLabel(ms) {
    if (ms === 0) return '0';
    if (ms < 0.1) return `${(ms * 1000).toFixed(0)}µs`;
    if (ms < 1) return `${ms.toFixed(2)}ms`;
    if (ms < 10) return `${ms.toFixed(1)}ms`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const sec = ms / 1000;
    return `${Number.isInteger(sec) ? sec : sec.toFixed(1)}s`;
}

/**
 * Calculates responsive time axis ticks (major and minor) for a given max duration.
 * @param {number} maxMs - Maximum time in milliseconds.
 * @returns {Array<{ ms: number, isMajor: boolean, label: string }>}
 */
function calculateTimeTicks(maxMs) {
    let majorStepMs;
    if (maxMs <= 0.05) majorStepMs = 0.01;
    else if (maxMs <= 0.1) majorStepMs = 0.02;
    else if (maxMs <= 0.25) majorStepMs = 0.05;
    else if (maxMs <= 0.5) majorStepMs = 0.1;
    else if (maxMs <= 1) majorStepMs = 0.2;
    else if (maxMs <= 2.5) majorStepMs = 0.5;
    else if (maxMs <= 5) majorStepMs = 1;
    else if (maxMs <= 10) majorStepMs = 2;
    else if (maxMs <= 25) majorStepMs = 5;
    else if (maxMs <= 50) majorStepMs = 10;
    else if (maxMs <= 100) majorStepMs = 20;
    else if (maxMs <= 250) majorStepMs = 50;
    else if (maxMs <= 500) majorStepMs = 100;
    else if (maxMs <= 1000) majorStepMs = 200;
    else if (maxMs <= 2000) majorStepMs = 400;
    else if (maxMs <= 5000) majorStepMs = 1000;
    else if (maxMs <= 10000) majorStepMs = 2000;
    else majorStepMs = Math.ceil(maxMs / 6 / 1000) * 1000;

    const minorStepMs = majorStepMs / 2;
    const ticks = [];
    const precision = majorStepMs < 1 ? (majorStepMs < 0.05 ? 3 : 2) : 0;

    for (let ms = 0; ms <= maxMs + (minorStepMs * 0.1); ms += minorStepMs) {
        const roundedMs = parseFloat(ms.toFixed(precision + 1));
        const isMajor = Math.abs(roundedMs % majorStepMs) < 1e-6 || Math.abs(roundedMs - Math.round(roundedMs / majorStepMs) * majorStepMs) < 1e-6 || roundedMs === 0;
        ticks.push({
            ms: roundedMs,
            isMajor,
            label: isMajor ? formatTickLabel(roundedMs) : ''
        });
    }
    return ticks;
}

/**
 * Resolves styles for proxy type pill and tab header badge.
 */
function resolveProxyBadgeStyles(proxyType) {
    const type = (proxyType || 'CGLIB').toUpperCase();
    return PROXY_BADGE_STYLES[type] || PROXY_BADGE_STYLES.CGLIB;
}

/**
 * Resolves CSS class for advice frozen status badge.
 */
function resolveAdviceFrozenClass(isFrozen) {
    return ADVICE_FROZEN_STYLES[Boolean(isFrozen)] || ADVICE_FROZEN_STYLES.false;
}

/**
 * Resolves CSS class for definition status badge (Defined vs Dynamic).
 */
function resolveDefinitionStatusBadgeClass(hasDefinition) {
    return DEFINITION_STATUS_STYLES[Boolean(hasDefinition)] || DEFINITION_STATUS_STYLES.false;
}

/**
 * Resolves CSS class for tab switcher buttons.
 */
function resolveTabButtonClass(isActive) {
    return isActive ? TAB_BUTTON_STYLES.active : TAB_BUTTON_STYLES.inactive;
}

export {
    debounce,
    css,
    capitalize,
    formatPercentage,
    resolveScopeStyle,
    resolveScopeBadgeClass,
    resolveBeanMetadata,
    getBeanCategory,
    nodeStyle,
    tbLink,
    lrLink,
    tree,
    downloadJson,
    resolveLatencyTheme,
    formatDuration,
    formatDateTime,
    resolveDurationColor,
    resolveBeanLayer,
    calculateTimeTicks,
    formatTickLabel,
    resolveProxyBadgeStyles,
    resolveAdviceFrozenClass,
    resolveDefinitionStatusBadgeClass,
    resolveTabButtonClass
};