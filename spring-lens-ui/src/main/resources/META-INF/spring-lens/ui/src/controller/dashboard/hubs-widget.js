import { BeanMetadataRules } from '../../helper/index.js';

class DependencyHubsWidget {
    computeMetrics(dependenciesResponse) {
        const items = dependenciesResponse?.content ?? [];
        const totalBeans = dependenciesResponse?.totalElements ?? items.length;

        const dependentCounts = new Map();
        let totalEdges = 0;

        for (const { dependencies = [] } of items) {
            totalEdges += dependencies.length;
            for (const dep of dependencies) {
                dependentCounts.set(dep, (dependentCounts.get(dep) || 0) + 1);
            }
        }

        const hubs = [...dependentCounts.entries()]
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([beanName, count], index) => this._formatHub(beanName, count, index + 1));

        return {
            totalBeans: totalBeans.toLocaleString(),
            totalEdges: totalEdges.toLocaleString(),
            dependedBeans: dependentCounts.size.toLocaleString(),
            footerStats: `${totalBeans} Beans • ${totalEdges} Connections`,
            hubs
        };
    }

    render(dependenciesResponse) {
        return this.computeMetrics(dependenciesResponse);
    }

    _formatHub(beanName, count, rank) {
        const meta = BeanMetadataRules.resolveBeanMetadata({ beanName });
        return {
            rank,
            name: beanName,
            type: 'Referenced by other beans',
            icon: meta.icon,
            iconColor: meta.color,
            dependentsCount: count
        };
    }
}

export const hubsWidget = new DependencyHubsWidget();
export default hubsWidget;
