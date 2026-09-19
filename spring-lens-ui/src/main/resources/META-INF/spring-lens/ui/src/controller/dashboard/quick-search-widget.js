import {
    BeanSearchEngine,
    BeanMetadataRules,
    QueryParam
} from '../../helper/index.js';

class QuickSearchWidget {

    async search(query, service) {
        const requestId = ++this._searchRequestId;
        const response = await service.searchDefinitions(query, {pageSize: 9});
        if (requestId !== this._searchRequestId) return null;

        const items = (response?.content ?? []).map(bean => this.formatBean(bean, query));
        return {
            items,
            empty: items.length === 0
        };
    }

    cancel() {
        this._searchRequestId++;
    }

    formatBean(bean, query) {
        const {beanName, type, contextId} = bean;
        const meta = BeanMetadataRules.resolveBeanMetadata({beanName, type});
        return {
            name: beanName,
            highlightedName: BeanSearchEngine.highlight(beanName, query),
            icon: meta.icon,
            iconColor: meta.color,
            contextId
        };
    }

    resolveTargetUrl(route, name, contextId) {
        const queryKey = route === 'graph' ? 'focus' : 'search';
        const query = QueryParam.build({[queryKey]: name, contextId}).toString();
        return query ? `#/${route}?${query}` : `#/${route}`;
    }

    _searchRequestId = 0;
}

const quickSearchWidget = new QuickSearchWidget();
export default quickSearchWidget;