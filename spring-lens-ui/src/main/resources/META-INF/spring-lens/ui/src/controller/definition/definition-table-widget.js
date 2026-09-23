import {
    BeanMetadataRules
} from '../../helper/index.js';

export default class DefinitionTableWidget {

    formatBeanRows(rawBeans = []) {
        return rawBeans.map(bean => this.formatBeanRow(bean));
    }

    formatBeanRow(bean) {
        const {
            beanName,
            contextId,
            type,
            role,
            scope,
            primary,
            lazyInit
        } = bean;

        const { typeStr, shortType, packageName } = this._resolveTypeInfo(type);
        const { depsCount, depsTooltip, usedByCount, usedByTooltip } = this._formatDependencies(bean.dependencies, bean.dependents);

        return {
            id: `${contextId}::${beanName}`,
            beanName,
            contextId,
            type: typeStr,
            shortType,
            packageName,
            role: this._cleanRole(role),
            scope: this._cleanScope(scope),
            primary: Boolean(primary),
            lazyInit: Boolean(lazyInit),
            depsCount,
            depsTooltip,
            usedByCount,
            usedByTooltip,
            meta: BeanMetadataRules.resolveBeanMetadata(bean),
            raw: bean
        };
    }

    getSortIcon(column, sortColumn, sortDirection) {
        if (sortColumn !== column) return 'unfold_more';
        return sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward';
    }

    _resolveTypeInfo(type) {
        const typeStr = type || '-';
        const lastDotIndex = typeStr.lastIndexOf('.');

        if (lastDotIndex === -1) {
            return { typeStr, shortType: typeStr, packageName: 'default package' };
        }

        return {
            typeStr,
            shortType: typeStr.substring(lastDotIndex + 1),
            packageName: typeStr.substring(0, lastDotIndex)
        };
    }

    _cleanRole(role) {
        return (role ? String(role).replace(/^ROLE_/, '') : 'APPLICATION').toUpperCase();
    }

    _cleanScope(scope) {
        return (scope ? String(scope) : 'SINGLETON').toUpperCase();
    }

    _formatDependencies(dependencies, dependents) {
        const depsList = Array.isArray(dependencies) ? dependencies : [];
        const dependentsList = Array.isArray(dependents) ? dependents : [];

        return {
            depsCount: `${depsList.length} ${depsList.length === 1 ? 'dep' : 'deps'}`,
            depsTooltip: `${depsList.length} dependencies (Depends on)`,
            usedByCount: `${dependentsList.length} used by`,
            usedByTooltip: `${dependentsList.length} dependents (Used by)`
        };
    }
}
