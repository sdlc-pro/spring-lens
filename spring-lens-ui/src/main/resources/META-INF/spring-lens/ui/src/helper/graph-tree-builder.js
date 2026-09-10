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

        // 3. Build top-level root bean nodes (SHALLOW: 1 level only, eliminating exponential DAG explosion)
        contextNode.children = rootNames.map(name => {
            const beanRecord = beanMap.get(name) || {};
            const deps = beanRecord.dependencies || [];
            return {
                name: this._displayName(name),
                fullName: name,
                contextId,
                hasChildren: deps.length > 0,
                dependencyNames: deps,
                meta: {
                    type: beanRecord.type || 'N/A',
                    scope: beanRecord.scope || 'singleton',
                    contextId,
                    deps: deps.length
                },
                children: null
            };
        });

        return contextNode;
    }

    static buildModalGraphHierarchy(targetBean, findBeanFn = () => null) {
        if (!targetBean) return null;

        const { beanName, contextId, scope, type, role, dependencies, dependents } = targetBean;

        const createChild = (name, kind) => {
            const depBean = findBeanFn(name, contextId);
            return this._prepareBeanNode(name, depBean, { kind });
        };

        const deps = (dependencies || []).map(name => createChild(name, 'dependency'));
        const dependentBeans = (dependents || []).map(name => createChild(name, 'dependent'));
        const targetNode = this._prepareBeanNode(beanName, { scope, role, type }, { kind: 'target' });

        return {
            target: targetNode,
            dependencies: deps,
            dependents: dependentBeans
        };
    }

    static _prepareBeanNode(name, beanData = {}, options = {}) {
        const { type = 'N/A', scope = 'N/A', role = 'N/A' } = beanData || {};
        const kind = typeof options === 'string' ? options : (options?.kind || 'dependency');
        const children = (typeof options === 'object' && Array.isArray(options?.children)) ? options.children : [];

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