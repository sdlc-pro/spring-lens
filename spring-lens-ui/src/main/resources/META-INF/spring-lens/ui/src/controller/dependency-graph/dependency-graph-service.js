import { httpClient, beanDataStore, QueryParam } from '../../helper/index.js';

/**
 * Service handling remote API communication and caching for the Dependency Graph.
 */
export class DependencyGraphService {

    /**
     * @param {Object} [endpoints] - API endpoints mapping
     */
    constructor(ENDPOINTS = {}) {
        this.endpoints = {
            dependencies    : ENDPOINTS.GRAPH_DEPENDENCIES,
            definitions     : ENDPOINTS.BEAN_DEFINITION,
            find            : ENDPOINTS.FIND_BEAN_DEFINITION
        };

        this.totalElements = 0;
        this.beanDependencies = null;
        this.accumulatedBeans = [];
        this.seenBeanKeys = new Set();
        this.beanDetailsCache = new Map();
        this.isLoadingRemaining = false;
    }

    /**
     * Fetches the initial batch of bean graph dependencies (default 500 beans).
     *
     * @param {number} [pageSize=500] - Number of beans to load initially
     * @param {Function} [onProgress] - Optional callback ({ loaded, total, isComplete, hasError, errorMsg })
     * @returns {Promise<Array<Object>>} Accumulated bean definitions
     */
    async fetchBeanGraphDependencies(pageSize = 500, onProgress) {
        if (typeof pageSize === 'function') {
            onProgress = pageSize;
            pageSize = 500;
        }
        onProgress?.({ loaded: 0, total: 0, isComplete: false });

        try {
            const searchParams = QueryParam.build({ pageNumber: 0, pageSize }).toString();
            const serverResponse = await httpClient.getWithQuery(this.endpoints.dependencies, searchParams);
            this.beanDependencies = serverResponse;

            const initialBeanDefinitions = Array.isArray(serverResponse)
                ? serverResponse
                : (serverResponse?.content ?? []);

            this.accumulatedBeans = [...initialBeanDefinitions];
            this.totalElements = serverResponse?.totalElements ?? initialBeanDefinitions.length;

            this.seenBeanKeys = new Set(
                initialBeanDefinitions.map(b => (b.contextId || '') + '::' + b.beanName)
            );

            beanDataStore.addBeans(initialBeanDefinitions);

            const isComplete = this.accumulatedBeans.length >= this.totalElements;

            onProgress?.({
                loaded: this.accumulatedBeans.length,
                total: this.totalElements,
                isComplete
            });

            return this.accumulatedBeans;
        } catch (error) {
            onProgress?.({
                loaded: this.accumulatedBeans.length,
                total: this.totalElements,
                hasError: true,
                errorMsg: error.message
            });
            throw error;
        }
    }

    /**
     * Fetches more bean graph dependencies from the server using pageNumber and pageSize.
     *
     * @param {number} [batchSize=100] - How many beans to load in this batch
     * @param {Function} [onProgress] - Optional callback
     * @returns {Promise<Object>} Result containing newly added beans and totals
     */
    async fetchMoreBeans(batchSize = 100, onProgress) {
        const currentCount = this.accumulatedBeans.length;
        if (currentCount >= this.totalElements) {
            return {
                newBeans: [],
                totalLoaded: currentCount,
                totalElements: this.totalElements,
                hasMore: false
            };
        }

        const countToFetch = Math.min(Math.max(1, parseInt(batchSize, 10) || 100), this.totalElements - currentCount);

        try {
            let fetchedRawBeans = [];

            // If countToFetch is large (> 1000), chunk by 1000 or 500 to respect backend MAX_PAGE_SIZE
            if (countToFetch > 1000) {
                const stepSize = (currentCount % 1000 === 0 && countToFetch % 1000 === 0) ? 1000 :
                                 (currentCount % 500 === 0 ? 500 : 100);
                const startPage = Math.floor(currentCount / stepSize);
                const endPage = Math.floor((currentCount + countToFetch - 1) / stepSize);
                const pagePromises = [];

                for (let p = startPage; p <= endPage; p++) {
                    const pageParams = QueryParam.build({ pageNumber: p, pageSize: stepSize }).toString();
                    pagePromises.push(httpClient.getWithQuery(this.endpoints.dependencies, pageParams));
                }

                const responses = await Promise.all(pagePromises);
                for (const res of responses) {
                    const list = res?.content ?? (Array.isArray(res) ? res : []);
                    fetchedRawBeans.push(...list);
                }
            } else if (currentCount % countToFetch === 0) {
                // If currentCount is evenly divisible by countToFetch, fetch in 1 clean request
                const pageNumber = Math.floor(currentCount / countToFetch);
                const pageParams = QueryParam.build({ pageNumber, pageSize: countToFetch }).toString();
                const response = await httpClient.getWithQuery(this.endpoints.dependencies, pageParams);
                fetchedRawBeans = response?.content ?? (Array.isArray(response) ? response : []);
            } else {
                // Determine best step size (500, 250, 200, 100, 50, 25, 10)
                let stepSize = 100;
                if (currentCount % 500 === 0 && countToFetch % 500 === 0) {
                    stepSize = 500;
                } else if (currentCount % 250 === 0 && countToFetch % 250 === 0) {
                    stepSize = 250;
                } else if (currentCount % 200 === 0 && countToFetch % 200 === 0) {
                    stepSize = 200;
                } else if (currentCount % 100 !== 0 || countToFetch % 100 !== 0) {
                    stepSize = (currentCount % 50 === 0 && countToFetch % 50 === 0) ? 50 :
                               ((currentCount % 25 === 0 && countToFetch % 25 === 0) ? 25 : 10);
                }

                const startPage = Math.floor(currentCount / stepSize);
                const endPage = Math.floor((currentCount + countToFetch - 1) / stepSize);
                const pagePromises = [];

                for (let p = startPage; p <= endPage; p++) {
                    const pageParams = QueryParam.build({ pageNumber: p, pageSize: stepSize }).toString();
                    pagePromises.push(httpClient.getWithQuery(this.endpoints.dependencies, pageParams));
                }

                const responses = await Promise.all(pagePromises);
                for (const res of responses) {
                    const list = res?.content ?? (Array.isArray(res) ? res : []);
                    fetchedRawBeans.push(...list);
                }
            }

            // Deduplicate newly fetched beans
            const newBeans = [];
            for (const bean of fetchedRawBeans) {
                if (!bean || !bean.beanName) continue;
                const key = (bean.contextId || '') + '::' + bean.beanName;
                if (!this.seenBeanKeys.has(key)) {
                    this.seenBeanKeys.add(key);
                    newBeans.push(bean);
                }
            }

            this.accumulatedBeans.push(...newBeans);
            beanDataStore.addBeans(newBeans);

            const hasMore = this.accumulatedBeans.length < this.totalElements;

            onProgress?.({
                loaded: this.accumulatedBeans.length,
                total: this.totalElements,
                isComplete: !hasMore
            });

            return {
                newBeans,
                totalLoaded: this.accumulatedBeans.length,
                totalElements: this.totalElements,
                hasMore
            };
        } catch (error) {
            console.error('Error loading more bean dependencies:', error);
            onProgress?.({
                loaded: this.accumulatedBeans.length,
                total: this.totalElements,
                hasError: true,
                errorMsg: error.message
            });
            throw error;
        }
    }

    /**
     * Fetches all remaining bean dependencies until totalElements is reached.
     *
     * @param {Function} [onProgress] - Optional callback
     * @returns {Promise<Object>} Result containing newly added beans and totals
     */
    async fetchAllRemainingBeans(onProgress) {
        const remaining = Math.max(0, this.totalElements - this.accumulatedBeans.length);
        if (remaining === 0) {
            return {
                newBeans: [],
                totalLoaded: this.accumulatedBeans.length,
                totalElements: this.totalElements,
                hasMore: false
            };
        }
        return this.fetchMoreBeans(remaining, onProgress);
    }

    /**
     * Fetches comprehensive details for a specific bean, with caching.
     *
     * @param {string} contextId - Context ID
     * @param {string} beanName - Full bean name
     * @returns {Promise<Object|null>} Bean details object
     */
    async fetchBeanDetails(contextId, beanName) {
        if (!beanName || !contextId) return null;

        const cacheKey = `${contextId}:${beanName}`;
        if (this.beanDetailsCache.has(cacheKey)) {
            return this.beanDetailsCache.get(cacheKey);
        }

        try {
            const queryParams = QueryParam.build({ contextId, beanName }).toString();
            const beanDetails = await httpClient.getWithQuery(this.endpoints.find, queryParams);
            if (!beanDetails) return null;

            this.beanDetailsCache.set(cacheKey, beanDetails);
            beanDataStore.addBeans([beanDetails]);
            return beanDetails;
        } catch (error) {
            console.warn(`Error fetching bean details for ${beanName}:`, error);
            this.beanDetailsCache.set(cacheKey, null);
            return null;
        }
    }

    /**
     * Queries the bean definitions endpoint for matching bean names.
     *
     * @param {string} query - Search query
     * @param {number} [pageSize=12] - Result page size
     * @returns {Promise<Array<Object>>} Matching bean items
     */
    async searchBeansApi(query, pageSize = 12) {
        const queryParams = QueryParam.build({
            search: query,
            pageSize
        }).toString();

        const response = await httpClient.getWithQuery(this.endpoints.definitions, queryParams);
        return response?.content ?? (Array.isArray(response) ? response : []);
    }

    /**
     * Clears cached details and accumulated beans.
     */
    clearCache() {
        this.beanDetailsCache.clear();
        this.accumulatedBeans = [];
        this.seenBeanKeys = new Set();
        this.totalElements = 0;
        this.beanDependencies = null;
    }
}
