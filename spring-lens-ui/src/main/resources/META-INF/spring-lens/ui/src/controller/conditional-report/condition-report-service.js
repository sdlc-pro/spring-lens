import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

/**
 * Service responsible for HTTP communication with backend Condition Report endpoints.
 */
export default class ConditionReportService {

    /**
     * @param {Object} endpoints
     * @param {string} endpoints.CONDITIONAL_REPORTS
     * @param {string} [endpoints.FIND_CONDITIONAL_REPORTS]
     * @param {string} [endpoints.SUMMARY_CONDITIONAL_REPORTS]
     */
    constructor(ENDPOINTS = {}) {
        this.endpoints = {
            conditions  : ENDPOINTS.CONDITIONAL_REPORTS,
            find        : ENDPOINTS.FIND_CONDITIONAL_REPORTS,
            summary     : ENDPOINTS.SUMMARY_CONDITIONAL_REPORTS
        };
    }

    /**
     * Alias for fetchSummary for backward compatibility.
     * @returns {Promise<Object>}
     */
    async fetchConditionalSummary() {
        return httpClient.get(this.endpoints.summary);
    }

    async fetchConditionEvaluations(criteria = {}) {
        const pageNum = typeof criteria.pageNumber === 'number'
            ? Math.max(0, criteria.pageNumber)
            : Math.max(0, (criteria.page || 1) - 1);

        const params = {
            pageNumber: pageNum,
            pageSize: criteria.pageSize || 10,
            sortBy: criteria.sortBy || 'source',
            sortDir: criteria.sortDir || 'ASC'
        };

        if (criteria.search) {
            params.search = criteria.search;
        }

        if (criteria.outcome) {
            params.outcome = criteria.outcome;
        }

        const query = QueryParam.build(params).toString();
        return httpClient.getWithQuery(this.endpoints.conditions, query);
    }

    /**
     * Fetches the total count of matching conditions across all outcomes for a search query.
     * @param {string} searchQuery
     * @returns {Promise<number|null>}
     */
    async fetchSearchTotalCount(searchQuery) {
        if (!searchQuery) return null;

        try {
            const query = QueryParam.build({
                search: searchQuery,
                pageNumber: 0,
                pageSize: 1
            }).toString();

            const responseData = await httpClient.getWithQuery(this.endpoints.conditions, query);
            return responseData?.totalElements ?? null;
        } catch (error) {
            console.warn('Could not fetch all-outcomes count for search query:', error);
            return null;
        }
    }

    /**
     * Alias for fetchSingleCondition for backward compatibility.
     * @param {string} contextId
     * @param {string} source
     * @returns {Promise<Object|null>}
     */
    async findConditionEvaluation(contextId, source) {
        if (!contextId || !source) return null;

        try {
            const query = QueryParam.build({ contextId, source }).toString();
            return await httpClient.getWithQuery(this.endpoints.find, query);
        } catch (err) {
            console.warn('Could not fetch single condition snapshot:', err);
            return null;
        }
    }
}
