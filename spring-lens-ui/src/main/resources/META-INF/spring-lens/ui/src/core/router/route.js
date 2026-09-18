import Router from './router.js';
import container from '../container.js';

const defaultRouter = new Router();

export class Route {

    constructor() {
        throw new TypeError('Route is a static facade and cannot be instantiated.');
    }

    static create(config = {}) {
        return new Router(config);
    }

    static get instance() {
        return defaultRouter;
    }

    static get container() {
        return container;
    }

    static get(path, action = null) {
        return defaultRouter.get(path, action);
    }

    static view(path, templatePath) {
        return defaultRouter.view(path, templatePath);
    }

    static redirect(fromPath, toPath) {
        return defaultRouter.redirect(fromPath, toPath);
    }

    static group(options, callback) {
        return defaultRouter.group(options, callback);
    }

    static prefix(prefix) {
        return defaultRouter.prefix(prefix);
    }

    static middleware(...middlewares) {
        return defaultRouter.middleware(...middlewares);
    }

    static use(...middlewares) {
        return defaultRouter.use(...middlewares);
    }

    static to(path, queryParams = null) {
        defaultRouter.navigate(path, queryParams);
    }

    static navigate(path, queryParams = null) {
        defaultRouter.navigate(path, queryParams);
    }

    static init(config = {}) {
        defaultRouter.init(config);
    }

    static boot(config = {}) {
        this.init(config);
    }

    static resolve() {
        return defaultRouter.resolve();
    }
}

export { Router };
export default Route;
