import {
    Guard,
    Sidebar,
    BeanMetadataRules,
    GraphTreeBuilder,
    Formatter
} from '../../helper/index.js';

export class BeanSidebarWidget {

    constructor(options = {}) {
        this.options = options;
    }

    formatDetails(beanDetails) {
        if (Guard.isBlank(beanDetails)) return null;

        const {
            beanName,
            type,
            scope,
            role,
            primary,
            lazyInit,
            autowireCandidate,
            contextId,
            factoryBeanName,
            factoryMethodName,
            initMethodName,
            destroyMethodName
        } = beanDetails;

        return {
            beanName,
            type: type,
            scope: this._formatScope(scope),
            role: this._formatRole(role),
            contextId: contextId,
            primary: Boolean(primary),
            primaryLabel: primary ? 'TRUE' : 'FALSE',
            lazyInit: Boolean(lazyInit),
            lazyInitLabel: lazyInit ? 'TRUE' : 'FALSE',
            autowired: Boolean(autowireCandidate),
            autowiredLabel: autowireCandidate ? 'TRUE' : 'FALSE',
            factoryBean: factoryBeanName || '-',
            factoryMethod: factoryMethodName || '-',
            initMethod: initMethodName || '-',
            destroyMethod: destroyMethodName || '-',
            meta: BeanMetadataRules.resolveBeanMetadata(beanDetails)
        };
    }

    formatDependencyItems(names = [], contextId = '') {
        if (!Array.isArray(names)) return [];
        return names.map(depName => this.formatDependencyItem(depName, contextId));
    }

    formatDependencyItem(depName, contextId = '') {
        return {
            fullName: depName,
            name: GraphTreeBuilder._displayName(depName),
            categoryColor: Sidebar.resolveDependencyCategoryColor(depName, contextId) || 'blue',
            contextId
        };
    }

    _formatRole(role) {
        if (Guard.isBlank(role)) return 'Application';
        const cleanRole = String(role).replace(/^ROLE_/, '');
        return Formatter.capitalize(cleanRole) || 'Application';
    }

    _formatScope(scope) {
        return Guard.isPresent(scope) ? Formatter.capitalize(scope) : 'Singleton';
    }
}