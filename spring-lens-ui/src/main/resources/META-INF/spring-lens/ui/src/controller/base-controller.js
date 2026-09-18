/**
 * Base Controller providing standardized lifecycle management,
 * namespaced DOM event binding, and automatic resource cleanup.
 */
export default class BaseController {

    /**
     * @param {string} [namespace='baseController'] - Event namespace for jQuery/DOM listeners
     */
    constructor(namespace = 'baseController') {
        this.namespace = namespace;
        this.alpine = null;
        this._disposables = [];
        this._boundTargets = new Set();

        if (typeof window !== 'undefined' && typeof this.createAlpineState === 'function') {
            if (window.Alpine) {
                window.Alpine.data(this.namespace, () => this.createAlpineState());
            } else {
                document.addEventListener('alpine:init', () => {
                    window.Alpine.data(this.namespace, () => this.createAlpineState());
                }, { once: true });
            }
        }
    }

    /**
     * Called by the router to bind the active Alpine reactive component to this controller.
     * @param {Object} alpine - The Alpine $data reactive proxy.
     */
    bindAlpine(alpine) {
        this.alpine = alpine;
        if (this.alpine && this.state) {
            Object.assign(this.alpine, this.state);
        }
    }

    setState(patch) {
        if (!patch) return;
        if (this.state) {
            Object.assign(this.state, patch);
        }
        if (this.alpine) {
            Object.assign(this.alpine, patch);
        }
    }

    /**
     * Lifecycle hook invoked when navigating into this route/controller.
     * Subclasses should override this to trigger initialization.
     *
     * @param {Object|string} [params] - Route parameters
     * @param {Object|string} [context] - Route parameters
     */
    async enter(params = null, context = null) {
        // Subclass implementation
    }

    /**
     * Standard Laravel-style route entry action alias.
     * Delegates directly to enter(params, context).
     *
     * @param {Object|string} [params] - Route parameters
     * @param {Object} [context] - Routing context
     */
    async index(params, context) {
        return this.enter(params, context);
    }

    /**
     * Lifecycle hook invoked when navigating away from this route/controller.
     * Automatically unbinds all registered namespaced event listeners and disposes resources.
     */
    leave() {
        this.alpine = null;
        this.unbindEvents();
        this.disposeAll();
    }

    /**
     * Binds a namespaced jQuery event listener and tracks the target for cleanup.
     *
     * @param {string|jQuery|Element|Document|Window} target - Target selector or DOM/jQuery element
     * @param {string} event - Event name (e.g. 'click', 'input', 'keydown')
     * @param {string|Function} delegateOrHandler - Selector string for delegation or handler function
     * @param {Function} [maybeHandler] - Handler function when using delegation
     */
    on(target, event, delegateOrHandler, maybeHandler) {
        const namespacedEvent = `${event}.${this.namespace}`;
        const $target = $(target);

        if (typeof delegateOrHandler === 'string') {
            $target.off(namespacedEvent, delegateOrHandler).on(namespacedEvent, delegateOrHandler, maybeHandler);
        } else {
            $target.off(namespacedEvent).on(namespacedEvent, delegateOrHandler);
        }

        this._boundTargets.add($target);
    }

    /**
     * Unbinds all namespaced listeners registered via this.on() as well as document/window.
     */
    unbindEvents() {
        const ns = `.${this.namespace}`;
        $(document).off(ns);
        $(window).off(ns);

        for (const $target of this._boundTargets) {
            $target.off(ns);
        }
        this._boundTargets.clear();
    }

    /**
     * Registers a disposable resource (function, ResizeObserver, Timer, or object with destroy/disconnect/cancel).
     *
     * @param {Function|Object} disposable - Resource to dispose on leave()
     */
    addDisposable(disposable) {
        if (disposable) {
            this._disposables.push(disposable);
        }
    }

    /**
     * Disposes all registered resources.
     */
    disposeAll() {
        while (this._disposables.length > 0) {
            const item = this._disposables.pop();
            try {
                if (typeof item === 'function') {
                    item();
                } else if (typeof item?.destroy === 'function') {
                    item.destroy();
                } else if (typeof item?.disconnect === 'function') {
                    item.disconnect();
                } else if (typeof item?.cancel === 'function') {
                    item.cancel();
                }
            } catch (error) {
                console.warn(`Error disposing resource in ${this.namespace}:`, error);
            }
        }
    }
}
