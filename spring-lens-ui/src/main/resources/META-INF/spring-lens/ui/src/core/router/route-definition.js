export default class RouteDefinition {

    constructor(path, action = null, onNamed = null) {
        this.middlewares = [];
        this.template = null;
        this.routeName = null;
        this.customTitle = null;
        this.customOnLeave = null;
        this.customOnEnter = null;
        this.redirectTarget = null;
        this.targetAction = 'enter';
        this.targetController = null;
        this.onNamed = onNamed;
        this.path = this._normalizePath(path);

        if (action) {
            this._parseAction(action);
        }
    }

    _normalizePath(path) {
        return path ? String(path).replace(/^\/+/, '').replace(/\/+$/, '') : '';
    }

    _parseAction(action) {
        if (Array.isArray(action)) {
            const [controller, actionName = 'enter'] = action;
            this._setTargetController(controller, actionName);
            return;
        }

        if (this._isController(action)) {
            this._setTargetController(action);
            return;
        }

        if (typeof action === 'function') {
            this.customOnEnter = action;
        }
    }

    _isController(target) {
        if (!target || Array.isArray(target)) return false;
        if (typeof target === 'object') return true;
        if (typeof target === 'function') {
            return target.toString().startsWith('class ') || typeof target.prototype?.enter === 'function';
        }
        return false;
    }

    _setTargetController(controller, actionName = 'enter') {
        this.targetController = controller;
        this.targetAction = actionName;
        if (this.targetController) {
            this._extractControllerMetadata(this.targetController);
        }
    }

    _extractControllerMetadata(controller) {
        if (!controller) return;

        const source = typeof controller === 'function' ? controller : controller.constructor;
        const proto = typeof controller === 'function' ? controller.prototype : controller;
        const resolve = prop => source?.[prop] ?? proto?.[prop];

        const view = resolve('view');
        if (view && !this.template) {
            this.view(view);
        }

        const routeName = resolve('routeName') ?? source?.name;
        if (routeName && !this.routeName) {
            this.name(routeName);
        }

        const title = resolve('title');
        if (title && !this.customTitle) {
            this.title(title);
        }
    }

    view(templatePath) {
        this.template = templatePath;
        return this;
    }

    controller(controllerInstance, actionName = 'enter') {
        this._setTargetController(controllerInstance, actionName);
        return this;
    }

    name(name) {
        this.routeName = name;
        if (typeof this.onNamed === 'function') {
            this.onNamed(name, this);
        }
        return this;
    }

    title(title) {
        this.customTitle = title;
        return this;
    }

    redirectTo(targetUri) {
        this.redirectTarget = this._normalizePath(targetUri);
        return this;
    }

    middleware(...middlewares) {
        this.middlewares.push(...middlewares.flat().filter(Boolean));
        return this;
    }

    onEnter(callback) {
        this.customOnEnter = callback;
        return this;
    }

    onLeave(callback) {
        this.customOnLeave = callback;
        return this;
    }
}

export { RouteDefinition };

