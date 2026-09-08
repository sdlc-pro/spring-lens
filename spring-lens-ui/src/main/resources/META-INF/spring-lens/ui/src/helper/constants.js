const NW = 208;
const NH = 46;
const RX = 12;
const GAP_X = 36;
const GAP_Y = 80;
const ICON = 'M10 2l8 4v8l-8 4-8-4V6l8-4z M2 6l8 4 M18 6l-8 4 M10 10v8';
const ZOOM_SCALE_EXTENT = [0.05, 4];
const CONDITION_STATUS_THEMES = {
    matched: {
        badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
        icon: 'check',
        label: 'Matched'
    },
    notMatched: {
        badge: 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40',
        icon: 'close',
        label: 'Did Not Match',
        rowBg: 'bg-red-50/10 dark:bg-red-950/5'
    }
};

const NODE_STYLES_TINT = {
    root: { fill: '#eff6ff', stroke: '#3b82f6', icon: '#2563eb', text: '#1d4ed8' },
    context: { fill: '#eef2ff', stroke: '#6366f1', icon: '#4f46e5', text: '#4338ca' },
    leaf: { fill: '#fffbeb', stroke: '#f59e0b', icon: '#d97706', text: '#b45309' },
    intermediate: { fill: '#f0fdf4', stroke: '#22c55e', icon: '#16a34a', text: '#15803d' },
    adapter: { fill: '#faf5ff', stroke: '#a855f7', icon: '#9333ea', text: '#7e22ce' }
};

const NODE_STYLES_BADGE = {
    root: { fill: '#ffffff', stroke: '#3b82f6', icon: '#2563eb', iconBg: '#eff6ff', text: '#0f172a' },
    context: { fill: '#ffffff', stroke: '#6366f1', icon: '#4f46e5', iconBg: '#eef2ff', text: '#0f172a' },
    leaf: { fill: '#ffffff', stroke: '#f59e0b', icon: '#d97706', iconBg: '#fffbeb', text: '#0f172a' },
    intermediate: { fill: '#ffffff', stroke: '#10b981', icon: '#059669', iconBg: '#f0fdf4', text: '#0f172a' },
    adapter: { fill: '#ffffff', stroke: '#a855f7', icon: '#9333ea', iconBg: '#faf5ff', text: '#0f172a' }
};

const DEFAULT_NODE_STYLE = { fill: '#faf5ff', stroke: '#a855f7', icon: '#9333ea', text: '#7e22ce' };

const NAV_STYLES = {
    sublink: {
        active: 'bg-primary/10 dark:bg-purple-950/40 text-primary dark:text-purple-300 font-bold border border-primary/20 shadow-xs',
        inactive: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 font-medium'
    },
    parent: {
        active: 'bg-primary/10 dark:bg-purple-950/40 text-primary dark:text-purple-300 font-bold border border-primary/20 shadow-xs',
        inactive: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 font-medium'
    }
};

const CSS_CLASSES = {
    navActive: NAV_STYLES.parent.active,
    navInactive: NAV_STYLES.parent.inactive,
    subnavActive: NAV_STYLES.sublink.active,
    subnavInactive: NAV_STYLES.sublink.inactive,
    rowActive: 'bg-primary-light/40 dark:bg-primary/20 font-semibold border-l-4 border-primary',
    defRowActive: 'bg-primary-light/40 border-l-2 border-primary font-medium',
    toggleActive: 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-white shadow-sm',
    toggleInactive: 'text-gray-500 dark:text-gray-400',
    pillActive: 'bg-primary/10 dark:bg-purple-950/40 text-primary dark:text-purple-300 font-bold border border-primary/20 shadow-xs',
    pillInactive: 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold border border-transparent'
};

const BEAN_TYPE_RULES = [
    { keywords: ['datasource', 'connection'], icon: 'database', color: '#10b981' },
    { keywords: ['security', 'auth'], icon: 'lock', color: '#f59e0b' },
    { keywords: ['controller', 'rest'], icon: 'api', color: '#3b82f6' },
    { keywords: ['service'], icon: 'settings_input_component', color: '#8b5cf6' },
    { keywords: ['repository', 'dao'], icon: 'folder_open', color: '#ec4899' },
    { keywords: ['cache'], icon: 'memory', color: '#64748b' },
    { keywords: ['config', 'properties'], icon: 'settings', color: '#14b8a6' },
    { keywords: ['scheduler', 'task'], icon: 'schedule', color: '#06b6d4' },
    { keywords: ['mapper'], icon: 'transform', color: '#a855f7' },
    { keywords: ['client'], icon: 'hub', color: '#f43f5e' },
    { keywords: ['template'], icon: 'dashboard', color: '#3b82f6' },
    { keywords: ['filter'], icon: 'filter_list', color: '#64748b' },
    { keywords: ['converter', 'serializer'], icon: 'swap_horiz', color: '#8b5cf6' },
    { keywords: ['factory'], icon: 'factory', color: '#f59e0b' },
    { keywords: ['validator'], icon: 'verified_user', color: '#10b981' },
    { keywords: ['producer', 'consumer', 'listener'], icon: 'hearing', color: '#ec4899' }
];

const SCOPE_COLORS = {
    'Singleton': '#8b5cf6',
    'Prototype': '#06b6d4',
    'Request': '#f59e0b',
    'Session': '#10b981',
    'Refresh': '#ec4899',
    'Unknown': '#94a3b8'
};

const ROLE_COLORS = {
    'Application': '#3b82f6',
    'Infrastructure': '#f43f5e',
    'Support': '#14b8a6',
    'Unknown': '#94a3b8'
};

const LOADING_MODE_COLORS = {
    'Lazy': '#a855f7',
    'Eager': '#0ea5e9',
    'Unknown': '#94a3b8'
};

const SCOPE_STYLES = {
    singleton: {
        bg: '#f3e8ff', fg: '#7e22ce', border: '#d8b4fe',
        darkBg: 'rgba(126, 34, 206, 0.15)', darkFg: '#d8b4fe', darkBorder: 'rgba(126, 34, 206, 0.3)'
    },
    prototype: {
        bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe',
        darkBg: 'rgba(29, 78, 216, 0.15)', darkFg: '#93c5fd', darkBorder: 'rgba(29, 78, 216, 0.3)'
    },
    request: {
        bg: '#fffbeb', fg: '#b45309', border: '#fde68a',
        darkBg: 'rgba(180, 83, 9, 0.15)', darkFg: '#fde68a', darkBorder: 'rgba(180, 83, 9, 0.3)'
    },
    session: {
        bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0',
        darkBg: 'rgba(21, 128, 61, 0.15)', darkFg: '#86efac', darkBorder: 'rgba(21, 128, 61, 0.3)'
    }
};

const SCOPE_BADGE_CLASSES = {
    singleton: 'bg-gradient-to-r from-purple-500/15 via-purple-500/10 to-indigo-500/10 text-purple-900 dark:text-purple-200 border-purple-300/80 dark:border-purple-500/40',
    prototype: 'bg-gradient-to-r from-blue-500/15 via-sky-500/10 to-cyan-500/10 text-blue-900 dark:text-blue-200 border-blue-300/80 dark:border-blue-500/40',
    request: 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-yellow-500/10 text-amber-900 dark:text-amber-200 border-amber-300/80 dark:border-amber-500/40',
    session: 'bg-gradient-to-r from-emerald-500/15 via-green-500/10 to-teal-500/10 text-emerald-900 dark:text-emerald-200 border-emerald-300/80 dark:border-emerald-500/40',
    refresh: 'bg-gradient-to-r from-pink-500/15 via-rose-500/10 to-purple-500/10 text-pink-900 dark:text-pink-200 border-pink-300/80 dark:border-pink-500/40',
    default: 'bg-gradient-to-r from-slate-500/15 via-gray-500/10 to-zinc-500/10 text-slate-900 dark:text-slate-200 border-slate-300/80 dark:border-slate-500/40'
};

const DEFAULT_SCOPE_STYLE = {
    bg: '#f8fafc', fg: '#475569', border: '#e2e8f0',
    darkBg: 'rgba(71, 85, 105, 0.15)', darkFg: '#cbd5e1', darkBorder: 'rgba(71, 85, 105, 0.3)'
};

const DEPENDENCY_CATEGORY_COLORS = {
    root: 'blue',
    intermediate: 'green',
    leaf: 'yellow',
    adapter: 'purple'
};

const CONTEXT_THEME_COLORS = [
    'bg-primary',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-rose-500',
    'bg-teal-500'
];

const GRAPH_NODE_THEMES_TINT = {
    dark: {
        target: { fill: 'rgba(30, 58, 138, 0.32)', stroke: '#3b82f6', icon: '#60a5fa', text: '#93c5fd' },
        dependency: { fill: 'rgba(6, 78, 59, 0.32)', stroke: '#22c55e', icon: '#4ade80', text: '#86efac' },
        dependent: { fill: 'rgba(88, 28, 135, 0.32)', stroke: '#a855f7', icon: '#c084fc', text: '#e9d5ff' },
        default: { fill: 'rgba(30, 41, 59, 0.4)', stroke: '#94a3b8', icon: '#cbd5e1', text: '#f1f5f9' },
    },
    light: {
        target: { fill: '#eff6ff', stroke: '#3b82f6', icon: '#2563eb', text: '#1d4ed8' },
        dependency: { fill: '#f0fdf4', stroke: '#22c55e', icon: '#16a34a', text: '#15803d' },
        dependent: { fill: '#faf5ff', stroke: '#a855f7', icon: '#9333ea', text: '#7e22ce' },
        default: { fill: '#f8fafc', stroke: '#94a3b8', icon: '#64748b', text: '#334155' },
    },
};

const GRAPH_NODE_THEMES_BADGE = {
    dark: {
        target: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#3b82f6', icon: '#60a5fa', iconBg: 'rgba(59, 130, 246, 0.22)', text: '#f1f5f9' },
        dependency: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#22c55e', icon: '#4ade80', iconBg: 'rgba(34, 197, 94, 0.22)', text: '#f1f5f9' },
        dependent: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#a855f7', icon: '#c084fc', iconBg: 'rgba(168, 85, 247, 0.22)', text: '#f1f5f9' },
        default: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#94a3b8', icon: '#cbd5e1', iconBg: 'rgba(148, 163, 184, 0.22)', text: '#f1f5f9' },
    },
    light: {
        target: { fill: '#ffffff', stroke: '#3b82f6', icon: '#2563eb', iconBg: '#eff6ff', text: '#0f172a' },
        dependency: { fill: '#ffffff', stroke: '#22c55e', icon: '#16a34a', iconBg: '#f0fdf4', text: '#0f172a' },
        dependent: { fill: '#ffffff', stroke: '#a855f7', icon: '#9333ea', iconBg: '#faf5ff', text: '#0f172a' },
        default: { fill: '#ffffff', stroke: '#94a3b8', icon: '#64748b', iconBg: '#f8fafc', text: '#0f172a' },
    },
};

const GRAPH_NODE_THEMES = GRAPH_NODE_THEMES_TINT;

const DURATION_BAR_RULES = [
    { minDurationMs: 50, classes: 'bg-red-500 hover:bg-red-600' },
    { minDurationMs: 10, classes: 'bg-orange-500 hover:bg-orange-600' },
    { minDurationMs: 1, classes: 'bg-blue-500 hover:bg-blue-600' },
    { minDurationMs: 0, classes: 'bg-primary hover:bg-primary/95' }
];

const PROGRESS_BADGE_STYLES = {
    error: {
        badge: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/30',
        dot: 'bg-red-500'
    },
    complete: {
        badge: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30',
        dot: 'bg-emerald-500'
    },
    loading: {
        badge: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/30',
        dot: 'bg-amber-500 animate-pulse'
    }
};

const ALL_PROGRESS_BADGE_CLASSES = Object.values(PROGRESS_BADGE_STYLES).map(s => s.badge).join(' ');
const ALL_PROGRESS_DOT_CLASSES = Object.values(PROGRESS_BADGE_STYLES).map(s => s.dot).join(' ');

const LATENCY_THEME_RULES = [
    {
        minDurationMs: 50,
        bar: 'bg-red-500',
        badge: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
    },
    {
        minDurationMs: 10,
        bar: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
    },
    {
        minDurationMs: 0,
        bar: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
    }
];

const BEAN_LAYER_RULES = [
    {
        id: 'web',
        label: 'Web Layer',
        color: '#ef4444',
        icon: 'api',
        keywords: [
            'controller', 'rest', 'mapper', 'objectmapper', 'json', 'jackson',
            'serializer', 'deserializer', 'viewresolver', 'endpoint', 'router', 'feign', 'web'
        ]
    },
    {
        id: 'business',
        label: 'Business Logic',
        color: '#f59e0b',
        icon: 'settings_input_component',
        keywords: [
            'service', 'manager', 'handler', 'facade', 'usecase', 'logic', 'processor', 'validator'
        ]
    },
    {
        id: 'data',
        label: 'Data Access',
        color: '#10b981',
        icon: 'database',
        keywords: [
            'datasource', 'entitymanager', 'transaction', 'repository', 'dao', 'jpa',
            'hibernate', 'jdbc', 'connection', 'flyway', 'liquibase', 'sql'
        ]
    },
    {
        id: 'infra',
        label: 'Infrastructure',
        color: '#3b82f6',
        icon: 'memory',
        keywords: [
            'logging', 'logger', 'scheduler', 'task', 'security', 'auth', 'filter',
            'cache', 'meter', 'metrics', 'health', 'actuator', 'management', 'kafka', 'rabbit', 'jms', 'template'
        ]
    },
    {
        id: 'config',
        label: 'Configuration',
        color: '#8b5cf6',
        icon: 'settings',
        keywords: [
            'config', 'properties', 'postprocessor', 'initializer', 'environment',
            'autoconfiguration', 'factory', 'context', 'profile'
        ]
    }
];

const DEFAULT_BEAN_LAYER = {
    id: 'other',
    label: 'Other',
    color: '#94a3b8',
    icon: 'deployed_code'
};

const PROXY_BADGE_STYLES = {
    JDK_DYNAMIC: {
        pill: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50',
        tab: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
    },
    CGLIB: {
        pill: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/50',
        tab: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
    },
    DIRECT: {
        pill: '',
        tab: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
    }
};

const ADVICE_FROZEN_STYLES = {
    true: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40',
    false: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700'
};

const DEFINITION_STATUS_STYLES = {
    true: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40',
    false: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'
};

const TAB_BUTTON_STYLES = {
    active: 'bg-white dark:bg-slate-800 text-primary dark:text-purple-300 font-bold shadow-xs',
    inactive: 'text-gray-500 dark:text-gray-400 font-semibold'
};

const ALL_PROXY_PILL_CLASSES = Object.values(PROXY_BADGE_STYLES).map(s => s.pill).filter(Boolean).join(' ');
const ALL_PROXY_TAB_CLASSES = Object.values(PROXY_BADGE_STYLES).map(s => s.tab).filter(Boolean).join(' ');
const ALL_ADVICE_FROZEN_CLASSES = Object.values(ADVICE_FROZEN_STYLES).join(' ');
const ALL_DEFINITION_STATUS_CLASSES = Object.values(DEFINITION_STATUS_STYLES).join(' ');
const ALL_TAB_BUTTON_CLASSES = Object.values(TAB_BUTTON_STYLES).join(' ');

export {
    NW,
    NH,
    RX,
    GAP_X,
    GAP_Y,
    ICON,
    ZOOM_SCALE_EXTENT,
    CONDITION_STATUS_THEMES,
    NODE_STYLES_TINT,
    NODE_STYLES_BADGE,
    DEFAULT_NODE_STYLE,
    NAV_STYLES,
    CSS_CLASSES,
    BEAN_TYPE_RULES,
    BEAN_LAYER_RULES,
    DEFAULT_BEAN_LAYER,
    PROXY_BADGE_STYLES,
    ALL_PROXY_PILL_CLASSES,
    ALL_PROXY_TAB_CLASSES,
    ADVICE_FROZEN_STYLES,
    ALL_ADVICE_FROZEN_CLASSES,
    DEFINITION_STATUS_STYLES,
    ALL_DEFINITION_STATUS_CLASSES,
    TAB_BUTTON_STYLES,
    ALL_TAB_BUTTON_CLASSES,
    SCOPE_COLORS,
    ROLE_COLORS,
    LOADING_MODE_COLORS,
    SCOPE_STYLES,
    DEFAULT_SCOPE_STYLE,
    SCOPE_BADGE_CLASSES,
    DEPENDENCY_CATEGORY_COLORS,
    CONTEXT_THEME_COLORS,
    GRAPH_NODE_THEMES_TINT,
    GRAPH_NODE_THEMES_BADGE,
    GRAPH_NODE_THEMES,
    DURATION_BAR_RULES,
    PROGRESS_BADGE_STYLES,
    ALL_PROGRESS_BADGE_CLASSES,
    ALL_PROGRESS_DOT_CLASSES,
    LATENCY_THEME_RULES
};

