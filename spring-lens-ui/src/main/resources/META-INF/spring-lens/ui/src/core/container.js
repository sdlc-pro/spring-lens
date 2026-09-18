import ENDPOINTS from '../helper/api-endpoints.js';
import ThemeManager from './theme-manager.js';
import { InstanceService } from '../controller/instance/index.js';
import { DashboardService } from '../controller/dashboard/index.js';
import { DefinitionService } from '../controller/definition/index.js';
import { DependencyGraphService } from '../controller/dependency-graph/index.js';
import { ConditionReportService } from '../controller/conditional-report/index.js';
import { ApplicationStateController } from '../controller/index.js';

export class Container {
    constructor() {
        this._bindings = new Map();
        this._instances = new Map();
        this._booted = false;

        this._registerDefaultServices();
    }

    _registerDefaultServices() {
        this.instance('endpoints', ENDPOINTS);

        const endpoints = () => this.make('endpoints') || ENDPOINTS;

        this.singleton('applicationState', () => new ApplicationStateController({
            healthApi: endpoints().APPLICATION_HEALTH,
            infoApi: endpoints().APPLICATION_INFO
        }));
        this.singleton('instanceService', () => new InstanceService(endpoints()));
        this.singleton('dashboardService', () => new DashboardService(endpoints()));
        this.singleton('definitionService', () => new DefinitionService(endpoints()));
        this.singleton('dependencyGraphService', () => new DependencyGraphService(endpoints()));
        this.singleton('conditionService', () => new ConditionReportService(endpoints()));
    }

    instance(abstract, instance) {
        this._instances.set(abstract, instance);
        return instance;
    }

    bind(abstract, factory, singleton = false) {
        this._bindings.set(abstract, { factory, singleton });
    }

    singleton(abstract, factory) {
        this.bind(abstract, factory, true);
    }

    has(abstract) {
        return this._instances.has(abstract) || this._bindings.has(abstract);
    }

    forget(abstract) {
        this._instances.delete(abstract);
        this._bindings.delete(abstract);
    }

    flush() {
        this._instances.clear();
        this._bindings.clear();
    }

    make(abstract) {
        if (!abstract) return null;

        if (typeof abstract === 'object') {
            return abstract;
        }

        if (this._instances.has(abstract)) {
            return this._instances.get(abstract);
        }

        if (this._bindings.has(abstract)) {
            const { factory, singleton } = this._bindings.get(abstract);
            const resolved = factory(this);
            if (singleton) {
                this._instances.set(abstract, resolved);
            }
            return resolved;
        }

        if (typeof abstract === 'function') {
            const endpoints = this.make('endpoints');
            const applicationState = this.make('applicationState');

            const instance = new abstract(endpoints, applicationState, this);
            this._instances.set(abstract, instance);
            return instance;
        }

        return null;
    }

    boot() {
        if (this._booted) return;
        this._booted = true;

        const appState = this.make('applicationState');
        appState?.start?.(10000);

        ThemeManager.init('#theme-toggle');
    }
}

const container = new Container();
export { container };
export default container;