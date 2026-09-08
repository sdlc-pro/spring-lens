import TemplateEngine from './template-engine.js';

/**
 * Enterprise PageHeader Presentation Utility.
 * Provides dynamic header generation with action strategies, reactive breadcrumbs, and decoupled state.
 */
export default class PageHeader {
    static appName = 'SpringLens';
    static _stateUnsubscribe = null;

    /**
     * Action render strategies for header action toolbar.
     * Open for extension via `registerActionRenderer`.
     */
    static actionRenderers = {
        /**
         * Standard Search Bar Action
         */
        search: (action) => {
            const searchClone = TemplateEngine.clone('tpl-page-header-search');
            if (!searchClone) return null;
            const $input = $(searchClone).find('input');
            if (action.id) $input.attr('id', action.id);
            if (action.placeholder) $input.attr('placeholder', action.placeholder);
            if (action.cssClass) $input.addClass(action.cssClass);
            return searchClone;
        },

        /**
         * Standard Button Action
         */
        button: (action) => {
            const btnClone = TemplateEngine.clone('tpl-page-header-btn');
            if (!btnClone) return null;
            const $btn = $(btnClone.firstElementChild);
            if (action.id) $btn.attr('id', action.id);
            if (action.action) $btn.attr('data-action', action.action);
            if (action.title) $btn.attr('title', action.title);

            if (action.icon) {
                $btn.find('[data-btn-field="icon"]').text(action.icon);
            } else {
                $btn.find('[data-btn-field="icon"]').remove();
            }

            if (action.label) {
                $btn.find('[data-btn-field="label"]').text(action.label);
            } else {
                $btn.find('[data-btn-field="label"]').remove();
            }

            if (action.cssClass) {
                $btn.addClass(action.cssClass);
            }
            return $btn[0];
        },

        /**
         * Custom element action provider
         */
        custom: (action) => {
            if (typeof action.render === 'function') {
                return action.render();
            }
            return action.element || null;
        }
    };

    /**
     * Registers a new action renderer strategy for extensibility.
     * @param {string} type
     * @param {function(Object): (HTMLElement|DocumentFragment|null)} renderer
     */
    static registerActionRenderer(type, renderer) {
        if (typeof type === 'string' && typeof renderer === 'function') {
            this.actionRenderers[type] = renderer;
        }
    }

    /**
     * Connects PageHeader to the central ApplicationState instance for reactive breadcrumbs.
     * @param {Object} applicationState
     */
    static init(applicationState) {
        if (!applicationState) return;

        if (this._stateUnsubscribe) {
            this._stateUnsubscribe();
            this._stateUnsubscribe = null;
        }

        const initialName = applicationState.getAppName?.();
        if (initialName) {
            this.setAppName(initialName);
        }

        if (typeof applicationState.onAppInfoChange === 'function') {
            this._stateUnsubscribe = applicationState.onAppInfoChange((info) => {
                if (info?.name) {
                    this.setAppName(info.name);
                }
            });
        }
    }

    /**
     * Sets the application name and updates the root breadcrumb in the active header DOM.
     * @param {string} name
     */
    static setAppName(name) {
        if (!name || typeof name !== 'string') return;
        this.appName = name;
        $('[data-header-field="breadcrumbs"] [data-breadcrumb-root]').text(name);
    }

    /**
     * Returns the current root application name for breadcrumbs.
     * @returns {string}
     */
    static getAppName() {
        return this.appName || 'SpringLens';
    }

    /**
     * Renders a page header DOM element from the given configuration.
     * @param {Object} headerConfig
     * @returns {HTMLElement|null}
     */
    static render(headerConfig) {
        if (!headerConfig) return null;

        const clone = TemplateEngine.clone('tpl-page-header');
        if (!clone) return null;

        const $header = $(clone.firstElementChild);

        // 1. Icon
        if (headerConfig.icon) {
            $header.find('[data-header-field="icon"]').text(headerConfig.icon);
        } else {
            $header.find('[data-header-field="iconContainer"]').remove();
        }

        // 2. Title
        if (headerConfig.title) {
            $header.find('[data-header-field="title"]').text(headerConfig.title);
        }

        // 3. Badge
        const $badge = $header.find('[data-header-field="badge"]');
        if (headerConfig.badge) {
            $badge.text(headerConfig.badge).removeClass('hidden');
        } else {
            $badge.remove();
        }

        // 4. Breadcrumbs (First item is always the dynamic Spring Boot Application Name)
        const $breadcrumbs = $header.find('[data-header-field="breadcrumbs"]').empty();
        const rootName = this.getAppName();
        const pageCrumbs = Array.isArray(headerConfig.breadcrumbs) ? headerConfig.breadcrumbs : [];
        const fullCrumbs = [rootName, ...pageCrumbs];

        if (fullCrumbs.length > 0) {
            fullCrumbs.forEach((crumb, idx) => {
                if (idx > 0) {
                    $breadcrumbs.append('<span class="material-symbols-outlined text-[12px] opacity-60">chevron_right</span>');
                }
                const isLast = idx === fullCrumbs.length - 1;
                const $crumbSpan = $('<span>').text(crumb);
                if (idx === 0) {
                    $crumbSpan.attr('data-breadcrumb-root', 'true');
                }
                if (isLast) {
                    $crumbSpan.addClass('text-gray-700 dark:text-gray-300 font-semibold');
                }
                $breadcrumbs.append($crumbSpan);
            });
        } else {
            $breadcrumbs.remove();
        }

        // 5. Action Toolbar using Strategy Factory
        const $actions = $header.find('[data-header-field="actions"]').empty();
        if (Array.isArray(headerConfig.actions) && headerConfig.actions.length > 0) {
            headerConfig.actions.forEach(action => {
                const rendererType = action.type || 'button';
                const renderer = this.actionRenderers[rendererType];
                if (renderer) {
                    const actionNode = renderer(action);
                    if (actionNode) {
                        $actions.append(actionNode);
                    }
                } else {
                    console.warn(`[PageHeader] Unknown action type: ${rendererType}`, action);
                }
            });
        } else {
            $actions.remove();
        }

        return $header[0];
    }
}
