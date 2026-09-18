import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

export default class DashboardService {

    constructor(ENDPOINTS = {}) {
        this.endpoints = {
            application         : ENDPOINTS.APPLICATION_INFO,
            instances           : ENDPOINTS.BEAN_INSTANCE,
            conditions          : ENDPOINTS.CONDITIONAL_REPORTS,
            dependencies        : ENDPOINTS.GRAPH_DEPENDENCIES,
            definitions         : ENDPOINTS.BEAN_DEFINITION,
            definitionsSummary  : ENDPOINTS.SUMMARY_BEAN_DEFINITION
        };
    }

    /**
     * Fetches application runtime information.
     * @returns {Promise<Object>}
     */
    async fetchApplicationInfo() {
        return httpClient.get(this.endpoints.application);
    }

    /**
     * Fetches bean definitions summary metrics.
     * @returns {Promise<Object>}
     */
    async fetchDefinitionsSummary() {
        return httpClient.get(this.endpoints.definitionsSummary);
    }

    /**
     * Fetches runtime bean instances sorted by startup initialization latency.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async fetchInstances(options = {}) {
        const { pageSize = 100, sortBy = 'initDurationNanos', sortDir = 'DESC' } = options;
        const query = QueryParam.build({ pageSize, sortBy, sortDir }).toString();
        return httpClient.getWithQuery(this.endpoints.instances, query);
    }

    /**
     * Fetches autoconfiguration condition reports.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async fetchConditions(options = {}) {
        const { pageSize = 100 } = options;
        const query = QueryParam.build({ pageSize }).toString();
        return httpClient.getWithQuery(this.endpoints.conditions, query);
    }

    /**
     * Fetches bean dependency graph data.
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async fetchDependencies(options = {}) {
        const { pageSize = 100 } = options;
        const query = QueryParam.build({ pageSize }).toString();
        return httpClient.getWithQuery(this.endpoints.dependencies, query);
    }

    /**
     * Searches bean definitions for quick search bar.
     * @param {string} query
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async searchDefinitions(query, options = {}) {
        if (!query) return { content: [] };
        const { pageSize = 9 } = options;
        const queryParams = QueryParam.build({
            search: query,
            pageSize
        }).toString();
        return httpClient.getWithQuery(this.endpoints.definitions, queryParams);
    }

    /**
     * Executes parallel loading of all dashboard datasets using Promise.allSettled.
     * @param {Object} callbacks
     * @returns {Promise<void>}
     */
    async fetchAll(callbacks = {}) {
        const {
            onInstances,
            onConditions,
            onDependencies,
            onApplicationInfo,
            onDefinitionsSummary,
            onApplicationFallback,
        } = callbacks;

        await Promise.allSettled([
            this.fetchApplicationInfo()
                .then(data => onApplicationInfo?.(data))
                .catch(err => {
                    console.warn('Could not fetch Application Info:', err);
                    onApplicationFallback?.();
                }),

            this.fetchDefinitionsSummary()
                .then(data => onDefinitionsSummary?.(data)),

            this.fetchInstances()
                .then(data => onInstances?.(data)),

            this.fetchConditions()
                .then(data => onConditions?.(data)),

            this.fetchDependencies()
                .then(data => onDependencies?.(data))
        ]);
    }
}
