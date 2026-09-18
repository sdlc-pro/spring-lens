import TemplateEngine from '../../helper/template-engine.js';
import { NAV_STYLES } from '../../helper/constants.js';
import RouteDefinition from './route-definition.js';
import Pipeline from './pipeline.js';
import container from '../container.js';

export default class Router {

    constructor(config = {}) {
        this.routes = new Map();
        this.namedRoutes = new Map();
        this.globalMiddlewares = [];
        this.templateCache = new Map();

        this._groupStack = [];
        this.activeRouteKey = null;
        this.activeRoute = null;
        this.activeController = null;

        this.appTitle = config.appTitle ?? 'Spring Lens';
        this.pagesDir = config.pagesDir ?? './src/views/';
        this.titleSeparator = config.titleSeparator ?? ' | ';
        this.defaultRoute = config.defaultRoute ?? 'dashboard';
        this.containerSelector = config.container ?? '#main-content';

        if (config.routes) {
            this._registerLegacyRoutes(config.routes);
        }
    }

    get container() {
        return $(this.containerSelector);
    }

    init(config = {}) {
        container.boot();

        if (config.container) this.containerSelector = config.container;
        if (config.defaultRoute) this.defaultRoute = config.defaultRoute;
        if (config.pagesDir) this.pagesDir = config.pagesDir;

        $(window).off('hashchange.springLensRouter').on('hashchange.springLensRouter', () => {
            this.resolve().catch((error) => console.error('Hashchange route resolution failed:', error));
        });

        this._bindNavEvents();
        this.resolve().catch((error) => console.error('Initial route resolution failed:', error));
    }

    get(path, action = null) {
        const fullPath = this._applyGroupPrefix(path);
        const route = new RouteDefinition(fullPath, action, (name, r) => {
            this.namedRoutes.set(name, r);
        });

        const groupMiddlewares = this._getActiveGroupMiddlewares();
        if (groupMiddlewares.length > 0) {
            route.middleware(groupMiddlewares);
        }

        this.routes.set(route.path, route);

        if (route.routeName) {
            this.namedRoutes.set(route.routeName, route);
        }

        return route;
    }

    view(path, templatePath) {
        return this.get(path).view(templatePath);
    }

    redirect(fromPath, toPath) {
        return this.get(fromPath).redirectTo(toPath);
    }

    group(options, callback) {
        this._groupStack.push(options);
        try {
            callback(this);
        } finally {
            this._groupStack.pop();
        }
        return this;
    }

    prefix(prefix) {
        return {
            group: (callback) => this.group({ prefix }, callback)
        };
    }

    middleware(...middlewares) {
        return {
            group: (callback) => this.group({ middleware: middlewares.flat() }, callback)
        };
    }

    use(...middlewares) {
        this.globalMiddlewares.push(...middlewares.flat().filter(Boolean));
        return this;
    }

    navigate(path, queryParams = null) {
        const targetRoute = this.namedRoutes.get(path);
        const resolvedPath = targetRoute ? targetRoute.path : this._normalizePath(path);

        let query = '';
        if (queryParams) {
            const searchParams = new URLSearchParams(queryParams);
            const str = searchParams.toString();
            if (str) query = `?${str}`;
        }

        const targetHash = `#/${resolvedPath}${query}`;
        if (window.location.hash === targetHash) {
            this.resolve().catch((error) => console.error('Route resolution failed:', error));
        } else {
            window.location.hash = targetHash;
        }
    }

    async resolve() {
        const { path, queryString, params } = this._parseLocationHash();
        const route = this._findRoute(path);

        if (!route) {
            this._handleMissingRoute(path);
            return;
        }

        if (route.redirectTarget) {
            this._handleRedirect(route.redirectTarget, queryString);
            return;
        }

        const context = { path, params, queryString, route, router: this };
        await this._runPipeline(context);
    }

    _parseLocationHash() {
        const rawHash = window.location.hash.replace(/^#\/?/, '') || this.defaultRoute;
        const [rawPath, queryString = ''] = rawHash.split('?');
        const path = this._normalizePath(rawPath) || this.defaultRoute;
        const params = new URLSearchParams(queryString);

        return { path, queryString, params };
    }

    _findRoute(path) {
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }

        for (const [routePath, def] of this.routes.entries()) {
            if (this._isRouteMatch(routePath, path)) {
                return def;
            }
        }

        return null;
    }

    _isRouteMatch(routePath, targetPath) {
        if (routePath === targetPath) return true;
        return routePath.endsWith(`/${targetPath}`) || targetPath.endsWith(`/${routePath}`);
    }

    _handleMissingRoute(path) {
        console.warn(`Route not found for path: "${path}". Redirecting to default: ${this.defaultRoute}`);
        window.location.hash = `#/${this.defaultRoute}`;
    }

    _handleRedirect(target, queryString) {
        const query = queryString ? `?${queryString}` : '';
        window.location.hash = `#/${target}${query}`;
    }

    async _runPipeline(context) {
        return new Pipeline(this.globalMiddlewares, context.route.middlewares)
            .send(context)
            .thenRun(ctx => this._dispatchRoute(ctx));
    }

    async _dispatchRoute(context) {
        const { route, path, params } = context;
        const isSameRoute = this.activeRouteKey === path;

        if (!isSameRoute) {
            this._teardownActiveRoute();
        }

        const controller = this._resolveController(route.targetController);
        this._setActiveRouteState(path, route, controller);

        if (!isSameRoute || !this.container.children().length) {
            const rendered = await this._renderView(route, controller);
            if (!rendered) return;
        }

        await this._invokeController(controller, route, context);
        this._finalizeNavigation(route, controller);
    }

    _teardownActiveRoute() {
        if (!this.activeRouteKey) return;

        const teardownTasks = [
            () => this.container?.[0] && window?.Alpine?.destroyTree?.(this.container[0]),
            () => this.activeController?.leave?.(),
            () => this._clearGlobalControllerRef(),
            () => this.activeRoute?.customOnLeave?.()
        ];

        teardownTasks.forEach((task) => this._safeExecute(task, 'Teardown execution failed:'));
    }

    _clearGlobalControllerRef() {
        if (typeof window !== 'undefined' && window.__activeController === this.activeController) {
            window.__activeController = null;
        }
    }

    _safeExecute(action, contextMessage = 'Execution warning:') {
        try {
            action();
        } catch (error) {
            console.warn(contextMessage, error);
        }
    }

    _setActiveRouteState(path, route, controller) {
        this.activeRouteKey = path;
        this.activeRoute = route;
        this.activeController = controller;
        if (typeof window !== 'undefined') {
            window.__activeController = controller;
        }
    }

    async _renderView(route, controller) {
        if (!route.template) return true;

        this._showLoadingIndicator();

        try {
            const html = await this._loadTemplate(route.template);
            this.container.empty().append(html);
            this._bindAlpineToController(controller);
            return true;
        } catch (error) {
            console.error(`Routing error loading template for "${this.activeRouteKey}":`, error);
            this._renderError(error.message);
            return false;
        }
    }

    _showLoadingIndicator() {
        const loadingClone = TemplateEngine.clone('tpl-app-loading');
        if (loadingClone) {
            this.container.empty().append(loadingClone);
        }
    }

    _bindAlpineToController(controller) {
        const containerElement = this.container?.[0];
        if (!containerElement || !controller || typeof window === 'undefined') return;

        this._whenAlpineReady(() => {
            this._safeExecute(() => {
                window.Alpine?.initTree?.(containerElement);

                const alpineRoot = containerElement.querySelector('[x-data]');
                const alpineData = alpineRoot && window.Alpine?.$data?.(alpineRoot);

                if (alpineData) {
                    this._attachAlpineToController(controller, alpineData);
                }
            }, 'Alpine auto-wire warning:');
        });
    }

    _attachAlpineToController(controller, alpineData) {
        if (typeof controller.bindAlpine === 'function') {
            controller.bindAlpine(alpineData);
        } else {
            controller.alpine = alpineData;
        }
    }

    _whenAlpineReady(callback) {
        if (window.Alpine?.$data) {
            callback();
            return;
        }
        document.addEventListener('alpine:initialized', callback, { once: true });
    }

    async _invokeController(controller, route, context) {
        if (!controller) return;

        const actionMethod = this._resolveActionMethod(controller, route.targetAction);
        try {
            if (actionMethod) {
                await controller[actionMethod](context.params, context);
            }
            if (route.customOnEnter) {
                await route.customOnEnter(context.params, context);
            }
        } catch (error) {
            console.error(`Error executing controller action for route "${context.path}":`, error);
        }
    }

    _resolveActionMethod(controller, targetAction = 'enter') {
        const preferred = targetAction;
        const fallback = preferred === 'index' ? 'enter' : 'index';
        const candidates = [preferred, fallback];
        return candidates.find((method) => typeof controller?.[method] === 'function') || null;
    }

    _finalizeNavigation(route, controller) {
        this.updateSidebarVisuals(this.activeRouteKey);
        this._updateDocumentTitle(route, controller);
    }

    _resolveController(targetController) {
        if (!targetController) return null;
        return container.make(targetController);
    }

    _updateDocumentTitle(route, controller) {
        const pageTitle = route.customTitle || controller?.title || this._formatTitleFromName(route.routeName);
        if (pageTitle) {
            document.title = `${this.appTitle}${this.titleSeparator}${pageTitle}`;
        } else {
            document.title = this.appTitle;
        }
    }

    _formatTitleFromName(name) {
        if (!name) return null;
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[-_]+/g, ' ')
            .trim()
            .split(/\s+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async _loadTemplate(templateName) {
        if (this.templateCache.has(templateName)) {
            return this.templateCache.get(templateName);
        }

        const url = `${this.pagesDir}${templateName}.html`;
        const html = await $.get(url);
        this.templateCache.set(templateName, html);
        return html;
    }

    _renderError(message) {
        const errorClone = TemplateEngine.clone('tpl-app-error');
        if (errorClone) {
            $(errorClone).find('[data-field="message"]').text(message);
            this.container.empty().append(errorClone);
            this.container.find('#retry-load-btn').off('click').on('click', () => this.resolve());
        }
    }

    updateSidebarVisuals(activePage) {
        const normalizedActive = this._normalizePath(activePage);

        this._updateSubmenus(normalizedActive);
        this._updateStandaloneLinks(normalizedActive);
    }

    _updateSubmenus(normalizedActive) {
        const { sublink, parent } = NAV_STYLES;

        $('.submenu').each((_, element) => {
            const $submenu = $(element);
            const $parentLink = $submenu.prev('.parent-link');
            let hasActiveChild = false;

            $submenu.find('a').each((_, child) => {
                const $child = $(child);
                const isActive = this._isPathMatch($child.data('page'), normalizedActive);

                $child.toggleClass(sublink.active, isActive)
                    .toggleClass(sublink.inactive, !isActive);

                if (isActive) {
                    hasActiveChild = true;
                }
            });

            const isParentActive = hasActiveChild || this._isPathMatch($parentLink.data('page'), normalizedActive);
            $parentLink.toggleClass(parent.active, isParentActive)
                .toggleClass(parent.inactive, !isParentActive);

            this._toggleSubmenu($submenu, $parentLink, isParentActive);
        });
    }

    _updateStandaloneLinks(normalizedActive) {
        const { parent } = NAV_STYLES;

        $('aside nav [data-page]:not(.submenu [data-page])').each((_, element) => {
            const $link = $(element);
            const isActive = this._isPathMatch($link.data('page'), normalizedActive);

            $link.toggleClass(parent.active, isActive)
                .toggleClass(parent.inactive, !isActive);
        });
    }

    _isPathMatch(page, normalizedActive) {
        const normalized = this._normalizePath(page);
        if (!normalized || !normalizedActive) return false;
        return normalized === normalizedActive ||
            normalizedActive.endsWith(`/${normalized}`) ||
            normalizedActive.startsWith(`${normalized}/`);
    }

    _toggleSubmenu($submenu, $parentLink, shouldExpand) {
        if (!$submenu?.length) return;

        const isExpanded = $submenu.is(':visible');
        if (Boolean(shouldExpand) === isExpanded) return;

        $submenu.stop(true, true)[shouldExpand ? 'slideDown' : 'slideUp'](200);
        $parentLink.find('.chevron-icon').toggleClass('rotate-180', Boolean(shouldExpand));
    }

    _bindNavEvents() {
        $(document).off('click.springLensNav', '.parent-link, .nav-link')
            .on('click.springLensNav', '.parent-link, .nav-link', (event) => {
                event.preventDefault();
                this._handleNavClick($(event.currentTarget));
            });
    }

    _handleNavClick($target) {
        if ($target.hasClass('parent-link')) {
            const $submenu = $target.next('.submenu');
            if ($submenu.length) {
                this._toggleSubmenu($submenu, $target, !$submenu.is(':visible'));
            }
        }

        const page = $target.data('page');
        if (page) {
            this.navigate(page);
        }
    }

    _normalizePath(path) {
        return path ? String(path).replace(/^\/+/, '').replace(/\/+$/, '') : '';
    }

    _applyGroupPrefix(path) {
        const segments = this._groupStack
            .map((group) => this._normalizePath(group.prefix))
            .filter(Boolean);

        const normalizedPath = this._normalizePath(path);
        if (normalizedPath) {
            segments.push(normalizedPath);
        }

        return segments.join('/');
    }

    _getActiveGroupMiddlewares() {
        return this._groupStack
            .flatMap((group) => group.middleware || [])
            .filter(Boolean);
    }

    _registerLegacyRoutes(routesObj = {}) {
        Object.entries(routesObj).forEach(([path, config]) => {
            if (config.redirectTo) {
                this.redirect(path, config.redirectTo);
                return;
            }

            const route = this.get(path);
            if (config.template) route.view(config.template);
            if (config.title) route.title(config.title);
            if (config.onEnter) route.onEnter(config.onEnter);
            if (config.onLeave) route.onLeave(config.onLeave);
        });
    }
}

export { Router };