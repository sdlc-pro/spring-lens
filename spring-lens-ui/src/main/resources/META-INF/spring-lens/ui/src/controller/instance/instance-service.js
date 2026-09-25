import httpClient from '../../helper/http-client.js';
import { QueryParam, DomUtils, Guard } from '../../helper/index.js';

export class InstanceService {
    constructor(ENDPOINTS = {}) {
        this.endpoints = {
            instances   : ENDPOINTS.BEAN_INSTANCE,
            find        : ENDPOINTS.FIND_BEAN_INSTANCE,
            summary     : ENDPOINTS.SUMMARY_BEAN_INSTANCE,
            proxy       : ENDPOINTS.PROXY_BEAN_INSTANCE
        };
    }

    async fetchBeanInstanceSummary() {
        return httpClient.get(this.endpoints.summary).catch(error => {
            console.error('Error fetching bean instance summary:', error);
            return null;
        });
    }

    async fetchInstanceData(queryOptions = {}) {
        const queryParams = QueryParam.build({
            pageNumber: queryOptions.pageNumber ?? 0,
            pageSize: queryOptions.pageSize ?? 20,
            search: queryOptions.search ?? '',
            sortBy: queryOptions.sortBy ?? 'createdAt',
            sortDir: queryOptions.sortDir ?? 'ASC'
        });

        return httpClient.getWithQuery(
            this.endpoints.instances,
            queryParams.toString()
        );
    }

    async findBeanInstance(contextId, beanName) {
        if (Guard.isBlank(beanName)) return null;
        const queryParams = QueryParam.build({ contextId, beanName });
        return httpClient.getWithQuery(
            this.endpoints.find,
            queryParams.toString()
        );
    }

    async fetchProxyInfo(contextId, beanName) {
        if (Guard.isBlank(beanName)) return null;
        const queryParams = QueryParam.build({ contextId, beanName });
        return httpClient.getWithQuery(
            this.endpoints.proxy,
            queryParams.toString()
        );
    }

    downloadReport(filename, reportData) {
        DomUtils.downloadJson(filename, reportData);
    }
}
