import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

/**
 * Service responsible for HTTP communication with backend Bean Definition endpoints.
 */
export default class DefinitionService {

    /**
     * @param {Object} endpoints
     * @param {string} endpoints.BEAN_DEFINITION
     * @param {string} [endpoints.SUMMARY_BEAN_DEFINITION]
     * @param {string} [endpoints.FIND_BEAN_DEFINITION]
     */
    constructor(ENDPOINTS = {}) {
        this.endpoints = {
            definitions         : ENDPOINTS.BEAN_DEFINITION,
            summary             : ENDPOINTS.SUMMARY_BEAN_DEFINITION,
            find                : ENDPOINTS.FIND_BEAN_DEFINITION
        };
    }

    /**
     * Fetches bean definition summary metrics and distributions.
     * @returns {Promise<Object|null>}
     */
    async fetchSummary() {
        try {
            return await httpClient.get(this.endpoints.summary);
        } catch (err) {
            console.error('Failed to fetch bean definitions summary:', err);
            throw err;
        }
    }

    /**
     * Fetches paginated bean definitions based on filter and sorting criteria.
     * @param {Object} criteria
     * @returns {Promise<Object>}
     */
    async fetchTableData(criteria = {}) {
        const pageNumber = criteria.pageNumber !== undefined
            ? criteria.pageNumber
            : Math.max(0, (criteria.currentPage || 1) - 1);
        const pageSize = criteria.pageSize || criteria.itemsPerPage || 20;
        const search = criteria.search || criteria.searchQuery || undefined;

        const filters = criteria.filterCriteria || {};
        const contextId = criteria.contextId || filters.contextId || undefined;
        const beanName = criteria.beanName || filters.beanName || undefined;
        const scope = criteria.scope || filters.scope || undefined;
        const role = criteria.role || filters.role || undefined;
        const primary = criteria.primary !== undefined ? criteria.primary : (filters.primary || undefined);
        const lazyInit = criteria.lazyInit !== undefined ? criteria.lazyInit : (filters.lazyInit || undefined);

        const sortBy = criteria.sortBy || criteria.sortColumn || undefined;
        const sortDir = sortBy
            ? (criteria.sortDir || criteria.sortDirection || 'asc').toUpperCase()
            : undefined;

        const queryParams = QueryParam.build({
            pageNumber,
            pageSize,
            search,
            contextId,
            beanName,
            scope,
            role,
            primary,
            lazyInit,
            sortBy,
            sortDir
        });

        return httpClient.getWithQuery(this.endpoints.definitions, queryParams.toString());
    }

    /**
     * Searches a single bean definition by name and contextId.
     * @param {string} beanName
     * @param {string} [contextId]
     * @returns {Promise<Object|null>}
     */
    async findBeanDefinition(beanName, contextId = '') {
        if (!beanName) return null;

        try {
            const queryParams = QueryParam.build({ contextId, beanName }).toString();
            return await httpClient.getWithQuery(this.endpoints.find, queryParams);
        } catch (err) {
            console.warn('Failed to fetch bean definition details:', beanName, err);
            return null;
        }
    }
}

