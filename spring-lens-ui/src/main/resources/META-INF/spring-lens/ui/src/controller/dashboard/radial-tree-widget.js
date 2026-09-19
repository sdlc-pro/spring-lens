import { GraphTreeBuilder, BeanMetadataRules } from '../../helper/index.js';

class RadialTreeWidget {

    static THEMES = Object.freeze([
        { pattern: /service/, color: '#34d399', badgeClass: 'bg-emerald-400/20 text-emerald-300' },
        { pattern: /repo|data|entity|repository/, color: '#fbbf24', badgeClass: 'bg-amber-400/20 text-amber-300' },
        { pattern: /controller|web|rest|endpoint/, color: '#f472b6', badgeClass: 'bg-pink-400/20 text-pink-300' },
        { pattern: /config|security|filter|properties/, color: '#c084fc', badgeClass: 'bg-purple-400/20 text-purple-300' }
    ]);
    static DEFAULT_THEME = Object.freeze({ color: '#60a5fa', badgeClass: 'bg-blue-400/20 text-blue-300' });
    static ROOT_THEME = Object.freeze({ color: '#10b981', badgeClass: 'bg-emerald-500/20 text-emerald-300' });

    constructor() {
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;
        this.forceSimulation = null;
        this.dependenciesData = null;
        this.stateUpdater = null;
    }

    resolveTheme(d) {
        if (d.depth === 0) return RadialTreeWidget.ROOT_THEME;
        const text = `${d.data?.name || ''} ${d.data?.meta?.type || d.data?.type || ''}`.toLowerCase();
        return RadialTreeWidget.THEMES.find(theme => theme.pattern.test(text)) || RadialTreeWidget.DEFAULT_THEME;
    }

    getNodeColor(d) {
        return this.resolveTheme(d).color;
    }

    computeTooltipData(d, descendants) {
        const isRootNode = d.depth === 0;
        const meta = BeanMetadataRules.resolveBeanMetadata(d.data);
        const theme = this.resolveTheme(d);

        return {
            icon: isRootNode ? 'account_tree' : meta.icon,
            iconColor: theme.color,
            title: isRootNode ? (d.data?.name || 'Application Context') : d.data.name,
            scope: isRootNode ? 'CONTEXT' : (d.data?.meta?.scope || 'singleton'),
            badgeClass: theme.badgeClass,
            type: isRootNode ? 'Root Context' : (d.data?.meta?.type || d.data?.type || 'Spring Bean'),
            depth: `L${d.depth}`,
            directDeps: d.children ? d.children.length : 0,
            subtree: descendants.size - 1,
            parent: d.parent ? (d.parent.data?.name || d.parent.data?.fullName || 'Root') : 'None'
        };
    }

    render(dependenciesResponse = this.dependenciesData, stateUpdater = null) {
        if (!dependenciesResponse) return;
        this.dependenciesData = dependenciesResponse;
        if (stateUpdater) {
            this.stateUpdater = stateUpdater;
        }

        const items = dependenciesResponse?.content ?? [];
        const svgNode = document.getElementById('db-radial-tree-svg');
        if (!svgNode) return;

        if (items.length === 0) {
            this.stateUpdater?.({
                radialLoading: false,
                radialStats: 'No dependencies found'
            });
            return;
        }

        try {
            this._stopSimulation();

            const treeData = GraphTreeBuilder.buildByContext(items);
            if (!treeData) {
                this.stateUpdater?.({ radialLoading: false });
                return;
            }

            const width = svgNode.clientWidth || 400;
            const height = svgNode.clientHeight || 340;

            const isDark = document.documentElement.classList.contains('dark');
            const defaultLinkStroke = isDark ? '#334155' : '#cbd5e1';
            const rootLinkStroke = '#10b981';

            const hierarchy = d3.hierarchy(treeData);
            const nodes = hierarchy.descendants();
            const links = hierarchy.links();

            this.stateUpdater?.({
                radialLoading: false,
                radialStats: `${nodes.length} Beans • ${hierarchy.height} Levels • Hover or drag nodes`
            });

            const svg = d3.select(svgNode);
            svg.selectAll('*').remove();

            const g = svg.append('g');
            this._setupZoom(svg, g, width, height);

            const linksGroup = g.append('g').attr('class', 'tree-links');
            const linkSelection = this._renderLinks(linksGroup, links, defaultLinkStroke, rootLinkStroke);

            const nodesGroup = g.append('g').attr('class', 'tree-nodes');
            const nodeGroups = this._renderNodes(nodesGroup, nodes, isDark);

            const simulation = this._createSimulation(nodes, links, width, height);
            this.forceSimulation = simulation;

            this._bindSimulationTick(simulation, linkSelection, nodeGroups);
            nodeGroups.call(this._createDragBehavior(simulation));
            this._bindHoverEvents(nodeGroups, linkSelection, svgNode, isDark, defaultLinkStroke, rootLinkStroke);

            this.stateUpdater?.({ radialLoading: false });
        } catch (err) {
            console.error('Error rendering Force-Directed Tree:', err);
            this.stateUpdater?.({ radialLoading: false });
        }
    }

    _setupZoom(svg, g, width, height) {
        const zoom = d3.zoom()
            .scaleExtent([0.25, 5.0])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        const initialScale = 1.30;
        const initialTransform = d3.zoomIdentity
            .translate((width / 2) * (1 - initialScale), (height / 2) * (1 - initialScale))
            .scale(initialScale);

        this.radialZoom = zoom;
        this.radialSvg = svg;
        this.radialInitialTransform = initialTransform;

        svg.call(zoom).call(zoom.transform, initialTransform);
    }

    _renderLinks(linksGroup, links, defaultLinkStroke, rootLinkStroke) {
        return linksGroup.selectAll('line')
            .data(links)
            .join('line')
            .attr('class', 'tree-link')
            .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
            .attr('stroke-opacity', 0.45)
            .attr('stroke-width', 0.75)
            .attr('stroke-linecap', 'round');
    }

    _renderNodes(nodesGroup, nodes, isDark) {
        const nodeGroups = nodesGroup.selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'tree-node select-none');

        nodeGroups.append('circle')
            .attr('class', 'node-dot')
            .attr('r', d => d.depth === 0 ? 6.2 : (d.children?.length ? 5.4 : 4.2))
            .attr('fill', d => this.getNodeColor(d))
            .attr('stroke', isDark ? '#0f172a' : '#ffffff')
            .attr('stroke-width', 1.0);

        return nodeGroups;
    }

    _createSimulation(nodes, links, width, height) {
        return d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(d => d.depth === 1 ? 58 : (d.target.children ? 40 : 28))
                .strength(0.85)
            )
            .force('charge', d3.forceManyBody()
                .strength(d => d.depth === 0 ? -190 : (d.children ? -135 : -58))
                .distanceMax(270)
            )
            .force('collide', d3.forceCollide()
                .radius(d => (d.depth === 0 ? 11 : (d.children ? 9 : 7)) + 3)
                .iterations(2)
            )
            .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
            .force('x', d3.forceX(width / 2).strength(0.04))
            .force('y', d3.forceY(height / 2).strength(0.04));
    }

    _bindSimulationTick(simulation, linkSelection, nodeGroups) {
        simulation.on('tick', () => {
            linkSelection
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
    }

    _createDragBehavior(simulation) {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    _positionTooltip(event, svgNode) {
        const containerRect = svgNode.getBoundingClientRect();
        const x = event.clientX - containerRect.left + 14;
        const y = event.clientY - containerRect.top - 20;
        const tooltipEl = document.getElementById('db-radial-tooltip');
        if (tooltipEl) {
            tooltipEl.style.left = `${Math.min(x, containerRect.width - 240)}px`;
            tooltipEl.style.top = `${Math.max(10, y)}px`;
        }
    }

    _bindHoverEvents(nodeGroups, linkSelection, svgNode, isDark, defaultLinkStroke, rootLinkStroke) {
        const hoverActiveColor = isDark ? '#94a3b8' : '#475569';

        nodeGroups
            .on('mouseenter', (event, d) => {
                const ancestors = new Set(d.ancestors());
                const descendants = new Set(d.descendants());

                linkSelection
                    .transition().duration(150)
                    .attr('stroke', link => {
                        const isConnected = (ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source));
                        return isConnected ? hoverActiveColor : defaultLinkStroke;
                    })
                    .attr('stroke-width', link => {
                        const isConnected = (ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source));
                        return isConnected ? 0.95 : 0.5;
                    })
                    .attr('stroke-opacity', link => {
                        const isConnected = (ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source));
                        return isConnected ? 0.9 : 0.15;
                    });

                nodeGroups
                    .transition().duration(150)
                    .attr('opacity', node => (ancestors.has(node) || descendants.has(node)) ? 1 : 0.2);

                d3.select(event.currentTarget).selectAll('circle.node-dot')
                    .transition().duration(150)
                    .attr('transform', 'scale(1.3)')
                    .attr('stroke', isDark ? '#ffffff' : '#0f172a')
                    .attr('stroke-width', 1.5);

                this._positionTooltip(event, svgNode);
                this.stateUpdater?.({
                    radialTooltip: {
                        ...this.computeTooltipData(d, descendants),
                        visible: true
                    }
                });
            })
            .on('mousemove', event => this._positionTooltip(event, svgNode))
            .on('mouseleave', event => {
                linkSelection
                    .transition().duration(200)
                    .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                    .attr('stroke-width', 0.75)
                    .attr('stroke-opacity', 0.45);

                nodeGroups
                    .transition().duration(200)
                    .attr('opacity', 1);

                d3.select(event.currentTarget).selectAll('circle.node-dot')
                    .transition().duration(200)
                    .attr('transform', 'scale(1)')
                    .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                    .attr('stroke-width', 1.0);

                this.stateUpdater?.({
                    radialTooltip: { visible: false }
                });
            });
    }

    zoom(scaleFactor) {
        if (this.radialSvg && this.radialZoom) {
            this.radialSvg.transition().duration(250).call(this.radialZoom.scaleBy, scaleFactor);
        }
    }

    resetZoom() {
        if (this.radialSvg && this.radialZoom && this.radialInitialTransform) {
            this.radialSvg.transition().duration(300).call(this.radialZoom.transform, this.radialInitialTransform);
            if (this.forceSimulation) {
                this.forceSimulation.alpha(0.3).restart();
            }
        }
    }

    onThemeChanged() {
        if (this.dependenciesData) {
            this.render(this.dependenciesData);
        }
    }

    _stopSimulation() {
        if (this.forceSimulation) {
            this.forceSimulation.stop();
            this.forceSimulation = null;
        }
    }

    destroy() {
        this._stopSimulation();
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;
        this.dependenciesData = null;

        this.stateUpdater?.({
            radialTooltip: { visible: false }
        });
    }
}

const radialTreeWidget = new RadialTreeWidget();
export default radialTreeWidget;