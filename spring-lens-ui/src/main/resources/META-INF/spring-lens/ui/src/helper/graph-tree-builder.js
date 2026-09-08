export default class GraphTreeBuilder {

    static _displayName(beanName = '') {
        if (!beanName) return '';
        const simpleName = beanName.split('.').pop() || '';
        return simpleName.replace(/\$\$.*$/, '').split('$').pop() || '';
    }

    /**
     * Builds hierarchical tree structures grouped by application context.
     */
    static buildByContext(beanDependencies = []) {
        const groupedData = this._transformBeanDependencyData(beanDependencies);
        const contextKeys = Object.keys(groupedData);

        if (contextKeys.length === 0) {
            return this._buildSingleContextTree('default', []);
        }

        if (contextKeys.length === 1) {
            const contextId = contextKeys[0];
            return this._buildSingleContextTree(contextId, groupedData[contextId]);
        }

        return {
            name: "Application Contexts",
            fullName: "Application Contexts",
            contextId: 'all',
            meta: { type: 'context', contextId: 'all' },
            children: contextKeys.map(contextId =>
                this._buildSingleContextTree(contextId, groupedData[contextId])
            )
        };
    }

    static _transformBeanDependencyData(dependencies) {
        if (!dependencies) return {};

        const list = Array.isArray(dependencies)
            ? dependencies
            : (Array.isArray(dependencies.content) ? dependencies.content : []);

        if (list.length > 0) {
            return list.reduce((acc, bean = {}) => {
                const {
                    contextId = "default",
                    beanName : name = '',
                    dependencies = []
                } = bean;

                (acc[contextId] = acc[contextId] || []).push({
                    name,
                    dependencies
                });
                return acc;
            }, {});
        }

        return {};
    }

    /**
     * Builds a single hierarchy tree for a given context.
     */
    static _buildSingleContextTree(contextId, beans = []) {
        const contextNode = {
            name: contextId,
            fullName: contextId,
            contextId,
            meta: { type: 'context', contextId },
            children: []
        };

        if (!beans.length) return contextNode;

        const beanMap = new Map();
        const hasParent = new Set();

        // 1. Single pass: Populate map and track dependencies
        for (const eachBean of beans) {
            beanMap.set(eachBean.name, eachBean);
        }

        for (const eachBean of beans) {
            for (const dep of eachBean.dependencies) {
                hasParent.add(dep);
            }
        }

        // 2. Identify top-level root beans (circular fallback to first bean)
        const rootBeans = beans.filter(bean => !hasParent.has(bean.name));
        const rootNames = rootBeans.length ? rootBeans.map(bean => bean.name) : [beans[0].name];

        // 3. Build tree recursively with single-set backtracking (prevents memory cloning)
        const visited = new Set();

        const buildNode = (name) => {
            const beanRecord = beanMap.get(name) || {};
            const isCycle = visited.has(name);
            const meta = {
                type: beanRecord.type || 'N/A',
                scope: beanRecord.scope || 'singleton',
                contextId,
                ...(isCycle && { isCycle: true })
            };

            const node = {
                name: this._displayName(name),
                fullName: name,
                contextId,
                meta,
                ...(isCycle && { isCycle: true })
            };

            if (isCycle) return node;

            visited.add(name);
            const validChildren = beanRecord.dependencies || [];

            if (validChildren.length > 0) {
                node.children = validChildren.map(buildNode);
            }

            visited.delete(name);
            return node;
        };

        contextNode.children = rootNames.map(buildNode);
        return contextNode;
    }

    static buildModalGraphHierarchy(targetBean, findBeanFn = () => null) {
        if (!targetBean) return null;

        const { beanName, contextId, scope, type, role, dependencies, dependents } = targetBean;

        const createChild = (name, kind) => {
            const depBean = findBeanFn(name, contextId);
            return this._prepareBeanNode(name, depBean, kind);
        };

        const deps = (dependencies || []).map(name => createChild(name, 'dependency'));
        const dependentBean = (dependents || []).map(name => createChild(name, 'dependent'));
        const children = [...deps, ...dependentBean];

        return this._prepareBeanNode(beanName, { scope, role, type }, {
            kind: "target",
            children
        });
    }

    static _prepareBeanNode(name, beanData = {}, { kind = 'dependency', children = [] } = {}) {
        const { type = 'N/A', scope = 'N/A', role = 'N/A' } = beanData || {};

        return {
            name: this._displayName(name),
            fullName: name,
            meta: {
                type: type,
                scope: scope,
                role: role,
                kind
            },
            ...(children?.length > 0 && { children })
        };
    }
}