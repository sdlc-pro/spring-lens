import httpClient from '../../helper/http-client.js';
import { QueryParam } from '../../helper/index.js';

export default class DefinitionService {

    constructor(ENDPOINTS = {}) {
        this.endpoints = {
            definitions   : ENDPOINTS.BEAN_DEFINITION,
            summary       : ENDPOINTS.SUMMARY_BEAN_DEFINITION,
            find          : ENDPOINTS.FIND_BEAN_DEFINITION
        };
    }

    async fetchBeanDefinitionSummary() {
        return httpClient.get(this.endpoints.summary).catch(err => {
            console.error('Failed to fetch bean definitions summary:', err);
            return null;
        });
    }

    async fetchBeanDefinitions(criteria = {}) {
        const { filterCriteria, ...rest } = criteria;
        const queryParams = QueryParam.build({ ...filterCriteria, ...rest });
        return httpClient.getWithQuery(this.endpoints.definitions, queryParams.toString()).catch(err => {
            console.error('Failed to fetch bean definitions table data:', err);
            return null;
        });
    }

    async fetchBeanDefinitionDetails(beanName, contextId) {
        if (!beanName) return null;

        const queryParams = QueryParam.build({ contextId, beanName }).toString();
        return httpClient.getWithQuery(this.endpoints.find, queryParams).catch(err => {
            console.warn('Failed to fetch bean definition details:', beanName, err);
            return null;
        });
    }
}

