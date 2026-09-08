import httpClient from '../helper/http-client.js';
import beanDataStore from '../helper/bean-data-store.js';
import GraphTreeBuilder from '../helper/graph-tree-builder.js';
import {
    tree, tbLink, lrLink, nodeStyle,
    NW, NH, RX, GAP_X, GAP_Y, ICON, ZOOM_SCALE_EXTENT,
    PROGRESS_BADGE_STYLES, ALL_PROGRESS_BADGE_CLASSES, ALL_PROGRESS_DOT_CLASSES,
    TemplateEngine, QueryParam, Sidebar, ToastNotification, BeanSearchEngine, debounce,
    resolveBeanMetadata
} from '../helper/index.js';

export default class DependencyGraph {

    constructor(endpoints = {}) {
        this.dependencyGraphApi = endpoints.GRAPH_DEPENDENCIES;
        this.beanDefinitions = endpoints.BEAN_DEFINITION;
        this.findBeanDefinitionsApi = endpoints.FIND_BEAN_DEFINITION;

        this.root = null;
        this.svg = null;
        this.gLink = null;
        this.gNode = null;
        this.zoom = null;

        this.totalElements = 0;
        this.beanDependencies = null;
        this.accumulatedBeans = [];
        this.beanDetailsCache = new Map();
        this.isLoadingRemaining = false;

        this.selectedContextId = '';
        this.isHighlightPathActive = false;
        this.focusedNodeFullName = null;

        this.mode = localStorage.getItem('sl-layout') ?? 'tb';
        this.nodeTheme = localStorage.getItem('sl-node-theme') ?? 'tint';
    }

    initEvents() {
        this._bindSearchHandlers();
        this._bindClickActionRouter();
        this._bindCustomEventHandlers();
    }

    async enter(params) {
        this.initEvents();
        this._initSidebar();
        if (!this._initializeCanvas()) return;

        this._bindControls();
        this.setNodeTheme(this.nodeTheme, false);

        const isDataLoaded = await this._loadInitialData();
        if (!isDataLoaded) return;

        this._renderInitialGraph();
        this._handlePendingBeanFocus(params);
    }

    _initializeCanvas() {
        this.svg = d3.select('#tree-svg');
        if (!this.svg.node()) return false;

        this.svg.selectAll('*').remove();
        this._injectTooltip();

        const mainContainer = this._setupSvgContainers();
        this._setupZoom(mainContainer);
        return true;
    }

    _bindControls() {
        $('#btn-reload-graph')
            .off('click')
            .on('click', () => this.reloadGraphData());
    }

    async reloadGraphData() {
        const $btn = $('#btn-reload-graph');
        const $icon = $btn.find('.material-symbols-outlined');
        $icon.addClass('animate-spin');

        try {
            await this._fetchBeanGraphDependencies();
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
            this.fitView(0);
        } catch (error) {
            console.error('Error reloading graph data:', error);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 600);
        }
    }

    async _loadInitialData() {
        try {
            await this._fetchBeanGraphDependencies();
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            return true;
        } catch (error) {
            console.error('Failed to initialize graph data:', error);
            const clone = TemplateEngine.clone('tpl-bean-graph-error');
            if (clone) {
                $(clone).find('[data-field="errorMessage"]').text(error.message);
                $('#beanGraph').empty().append(clone);
            }
            return false;
        }
    }

    _renderInitialGraph() {
        this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
        this.fitView(0);
        this.setMode(this.mode);
    }

    _handlePendingBeanFocus(params) {
        const targetBean = QueryParam.get(params, 'focus', 'search', 'bean');
        const contextId = QueryParam.get(params, 'contextId', 'context') || '';
        if (!targetBean) return;

        setTimeout(() => this.focusOnBean(targetBean, contextId, false), 300);
    }

    async fetchBeanDetails(contextId, beanName) {
        if (!beanName || !contextId) return null;

        const cacheKey = `${contextId}:${beanName}`;
        if (this.beanDetailsCache.has(cacheKey)) {
            return this.beanDetailsCache.get(cacheKey);
        }

        try {
            const queryParams = QueryParam.build({ contextId: contextId, beanName }).toString();
            const beanDetails = await httpClient.getWithQuery(this.findBeanDefinitionsApi, queryParams);
            if (!beanDetails) return null;

            this._updateBeanCaches(beanDetails, cacheKey);
            return beanDetails;
        } catch (error) {
            console.warn(`Error fetching bean details for ${beanName}:`, error);
            this.beanDetailsCache.set(cacheKey, null);
            return null;
        }
    }

    _updateBeanCaches(beanDetails, primaryCacheKey) {
        this.beanDetailsCache.set(primaryCacheKey, beanDetails);
        beanDataStore.addBeans([beanDetails]);
    }

    _mergeBeanDetailsIntoTree(node, details) {
        if (!node || !details) return;

        // 1. Update node metadata in place
        node.data.meta = {
            ...node.data.meta,
            ...(details.type && { type: details.type }),
            ...(details.scope && { scope: details.scope })
        };

        const dependencies = details.dependencies;
        if (!dependencies?.length) return;

        // Ensure _children backing array exists
        node._children ??= [];

        // 2. Pre-index existing children names for O(1) existence checks
        const existingChildNames = new Set();
        const existingChildren = node._children;

        for (let i = 0; i < existingChildren.length; i++) {
            const childData = existingChildren[i].data;

            if (childData?.fullName)
                existingChildNames.add(childData.fullName);

            if (childData?.name)
                existingChildNames.add(childData.name);
        }

        let hasAddedNewChild = false;
        const contextId = details.contextId ?? node.data?.contextId;

        // 3. Append missing dependency nodes
        for (let i = 0; i < dependencies.length; i++) {
            const dependencyName = dependencies[i];
            if (existingChildNames.has(dependencyName)) continue;

            const dependencyNode = this._createDynamicHierarchyChild(node, dependencyName, contextId);
            node._children.push(dependencyNode);
            existingChildNames.add(dependencyName);
            hasAddedNewChild = true;
        }

        // 4. Synchronize active visible children if node is currently expanded
        if (hasAddedNewChild && node.children) {
            node.children = node._children;
        }
    }

    _createDynamicHierarchyChild(parentNode, beanName, contextId, visited = new Set()) {
        const beanRecord = beanDataStore.findBeanByName(beanName, contextId);
        const displayName = GraphTreeBuilder._displayName(beanName);
        const isCycle = visited.has(beanName);

        const childData = {
            name: displayName,
            fullName: beanName,
            contextId,
            meta: {
                type: beanRecord?.type ?? 'N/A',
                scope: beanRecord?.scope ?? 'singleton',
                contextId,
                ...(isCycle && { isCycle: true })
            },
            ...(isCycle && { isCycle: true })
        };

        const childNode = d3.hierarchy(childData);
        childNode.depth = parentNode.depth + 1;
        childNode.parent = parentNode;
        childNode.id = `dyn_${parentNode.id}_${beanName}`;
        childNode.children = null;

        if (isCycle) {
            childNode._children = null;
            return childNode;
        }

        const deps = beanRecord?.dependencies ?? [];
        if (deps.length > 0) {
            const nextVisited = new Set(visited).add(beanName);
            childNode._children = deps.map(depName => this._createDynamicHierarchyChild(childNode, depName, contextId, nextVisited));
        } else {
            childNode._children = null;
        }

        return childNode;
    }

    async _fetchBeanGraphDependencies() {
        this._updateProgressBadge({ loaded: 0, total: 0, isComplete: false });

        const serverResponse = await httpClient.get(this.dependencyGraphApi);
        this.beanDependencies = serverResponse;

        const initialBeanDefinitions = Array.isArray(serverResponse)
            ? serverResponse
            : (serverResponse?.content ?? []);

        this.accumulatedBeans = [...initialBeanDefinitions];
        this.totalElements = serverResponse?.totalElements ?? initialBeanDefinitions.length;

        const hasRemainingPages = this._hasSubsequentPages(serverResponse);

        this._updateProgressBadge({
            loaded: this.accumulatedBeans.length,
            total: this.totalElements,
            isComplete: !hasRemainingPages
        });

        if (hasRemainingPages) {
            setTimeout(() => this._fetchRemainingGraphPages(serverResponse), 50);
        }
    }

    _hasSubsequentPages(paginationPayload) {
        if (!paginationPayload || Array.isArray(paginationPayload)) return false;

        const { totalPages = 1, pageNumber = 0, last = true } = paginationPayload;
        return !last && pageNumber < totalPages - 1;
    }

    async _fetchRemainingGraphPages(firstPageData) {
        if (this.isLoadingRemaining) return;
        this.isLoadingRemaining = true;

        try {
            const { totalPages = 1, pageNumber = 0, pageSize = 20 } = firstPageData;

            for (let targetPageIndex = pageNumber + 1; targetPageIndex < totalPages; targetPageIndex++) {
                const searchParams = QueryParam.build({
                    pageNumber: targetPageIndex,
                    pageSize
                }).toString();

                const fetchedPagePayload = await httpClient.getWithQuery(this.dependencyGraphApi, searchParams);
                const fetchedBeanDefinitions = fetchedPagePayload?.content ?? [];

                if (fetchedBeanDefinitions.length === 0) break;

                this.accumulatedBeans.push(...fetchedBeanDefinitions);
                this._buildHierarchyFromDependencies(this.accumulatedBeans);

                this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
                this._updateTotalBeanCount();

                const isFinalPageBatch = targetPageIndex === totalPages - 1;
                this._updateProgressBadge({
                    loaded: this.accumulatedBeans.length,
                    total: this.totalElements,
                    isComplete: isFinalPageBatch
                });

                await this._yieldThreadToEventLoop(50);
            }
        } catch (networkStreamingError) {
            console.error('Error loading lazy background bean graph data:', networkStreamingError);
            this._updateProgressBadge({ hasError: true, errorMsg: networkStreamingError.message });
        } finally {
            this.isLoadingRemaining = false;
        }
    }

    _yieldThreadToEventLoop(delayDurationInMilliseconds = 50) {
        return new Promise(resolveEventLoopYield => setTimeout(resolveEventLoopYield, delayDurationInMilliseconds));
    }

    _extractUniqueContextIdentifiers(beanDefinitions) {
        const uniqueContextSet = new Set();
        for (let i = 0; i < beanDefinitions.length; i++) {
            const contextIdentifier = beanDefinitions[i]?.contextId;
            if (contextIdentifier) {
                uniqueContextSet.add(contextIdentifier);
            }
        }
        return Array.from(uniqueContextSet);
    }

    _buildContextFilterOptionsHtml(uniqueContextId, selectedContextId) {
        const isDefaultOptionSelected = !selectedContextId ? 'selected' : '';
        const defaultOptionHtml = `<option value="" ${isDefaultOptionSelected} class="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">All Contexts (${uniqueContextId.length})</option>`;

        const contextOptionsHtml = uniqueContextId.map(contextIdentifier => {
            const isSelected = contextIdentifier === selectedContextId ? 'selected' : '';
            return `<option value="${contextIdentifier}" ${isSelected} class="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">${contextIdentifier}</option>`;
        }).join('');

        return `${defaultOptionHtml}${contextOptionsHtml}`;
    }

    _buildHierarchyFromDependencies(beanDefinitions = null) {
        const listOfBeanDefinitions = this._resolveRawBeanDefinitions(beanDefinitions);
        if (!listOfBeanDefinitions || listOfBeanDefinitions.length === 0) {
            this.root = null;
            return;
        }

        this._populateContextFilter(listOfBeanDefinitions);

        const scopedBeanDefinitions = this._filterBeanDefinitionsByActiveContext(listOfBeanDefinitions);
        this._buildAndCrossLinkBeanDependencies(scopedBeanDefinitions);

        const rawTreeHierarchyData = GraphTreeBuilder.buildByContext(scopedBeanDefinitions);

        if (!rawTreeHierarchyData) {
            this.root = null;
            return;
        }

        this.root = this._createD3HierarchyRootNode(rawTreeHierarchyData);
    }

    _resolveRawBeanDefinitions(providedBeanDefinitions) {
        if (providedBeanDefinitions) {
            return providedBeanDefinitions;
        }

        if (Array.isArray(this.beanDependencies)) {
            return this.beanDependencies;
        }

        return this.beanDependencies?.content ?? [];
    }

    _populateContextFilter(beanDefinitions = []) {
        const $contextFilterSelectElement = $('#context-filter');
        if ($contextFilterSelectElement.length === 0) return;

        const uniqueContextIdentifiers = this._extractUniqueContextIdentifiers(beanDefinitions);
        const $filterContainerElement = $contextFilterSelectElement.closest('#context-filter-container').length
            ? $contextFilterSelectElement.closest('#context-filter-container')
            : $contextFilterSelectElement.parent();

        if (uniqueContextIdentifiers.length <= 1) {
            $filterContainerElement.addClass('hidden').removeClass('flex');
            return;
        }

        $filterContainerElement.removeClass('hidden').addClass('flex');

        const renderedOptionsHtml = this._buildContextFilterOptionsHtml(
            uniqueContextIdentifiers,
            this.selectedContextId
        );

        $contextFilterSelectElement.html(renderedOptionsHtml);
    }

    _filterBeanDefinitionsByActiveContext(beanDefinitions) {
        if (!this.selectedContextId) {
            return beanDefinitions;
        }

        return beanDefinitions.filter(bean => bean?.contextId === this.selectedContextId);
    }

    _buildAndCrossLinkBeanDependencies(beanDefinitions) {
        beanDataStore.addBeans(beanDefinitions);
        const beanCount = beanDefinitions.length;

        // Cross-link inverse dependent relationships
        for (let i = 0; i < beanCount; i++) {
            const upstreamBean = beanDefinitions[i];
            const dependencyNames = upstreamBean?.dependencies ?? [];

            for (let j = 0; j < dependencyNames.length; j++) {
                const dependencyName = dependencyNames[j];
                const targetDependencyBean = beanDataStore.findBeanByName(dependencyName);

                if (targetDependencyBean) {
                    targetDependencyBean.dependents ??= [];
                    if (!targetDependencyBean.dependents.includes(upstreamBean.beanName)) {
                        targetDependencyBean.dependents.push(upstreamBean.beanName);
                    }
                }
            }
        }
    }

    _createD3HierarchyRootNode(treeData) {
        const root = d3.hierarchy(treeData);

        root.descendants().forEach((node, index) => {
            node.id = index;
            node._children = node.children;

            if (node.data) {
                node.data.name = node.data.name || GraphTreeBuilder._displayName(node.data.fullName || node.data.contextId || '');
                node.data.meta = node.data.meta || {};
                if (node.depth === 0) {
                    node.data.meta.type = 'context';
                }
            }

            if (node.depth > 0) {
                node.children = null;
            }
        })

        root.x0 = 0;
        root.y0 = 0;

        return root;
    }

    _updateTotalBeanCount() {
        const beanList = this.accumulatedBeans.length > 0
            ? this.accumulatedBeans
            : (Array.isArray(this.beanDependencies) ? this.beanDependencies : (this.beanDependencies?.content || []));

        const totalElements = this.totalElements || this.beanDependencies?.totalElements || beanList.length;
        $('#beans-count').text(totalElements);

        let totalDeps = 0;
        for (const bean of beanList) {
            totalDeps += bean.dependencies?.length ?? 0;
        }
        $('#deps-count').text(totalDeps);
    }

    _injectTooltip() {
        if ($('#tip').length === 0) {
            const clone = TemplateEngine.clone('tpl-tooltip');
            if (clone) $('body').append(clone);
        }
    }

    _setupSvgContainers() {
        const gMain = this.svg.append('g').attr('id', 'g-main');

        this._createMarker('dot', {
            viewBox: '0 0 10 10',
            refX: 9,
            refY: 5,
            markerUnits: 'userSpaceOnUse',
            markerWidth: 10,
            markerHeight: 10,
            orient: 'auto',
            circle: { cx: 5, cy: 5, r: 4, fill: '#94a3b8' }
        });

        this.gLink = gMain.append('g').attr('class', 'links');
        this.gNode = gMain.append('g').attr('class', 'nodes');

        return gMain;
    }

    _createMarker(id, config) {
        const { circle, ...markerAttrs } = config;
        const marker = this.svg.append('defs')
            .append('marker')
            .attr('id', id);

        for (const [key, value] of Object.entries(markerAttrs)) {
            marker.attr(key, value);
        }

        if (!circle) return;

        const circleNode = marker.append('circle');
        for (const [key, value] of Object.entries(circle)) {
            circleNode.attr(key, value);
        }
    }

    _setupZoom(gMain) {
        this.zoom = d3.zoom()
            .scaleExtent(ZOOM_SCALE_EXTENT)
            .on('zoom', ({ transform }) => {
                gMain.attr('transform', transform);
                this.updateZoomPercent(transform.k);
            });

        this.svg.call(this.zoom)
            .on('click', () => {
                this.closeSidebar();
                this.clearFocusedNode();
            });
    }

    showTip({ pageX, pageY }, node) {
        const { data, depth, _children = [] } = node;
        const { name, meta = {} } = data;
        const { type, scope, role, deps, dependents } = meta;

        const childrenCount = _children?.length;
        const shortType = type ? type.slice(type.lastIndexOf('.') + 1) : '';

        const typeLabel = shortType ? `Type: ${shortType}` : '';
        const scopeLabel = scope ? `Scope: ${scope}${role ? ` · ${role}` : ''}` : '';

        let metaText = `Leaf · depth ${depth}`;
        if (deps !== undefined) {
            metaText = `Deps: ${deps} · Dependents: ${dependents}`;
        } else if (childrenCount > 0) {
            metaText = `${childrenCount} child bean(s) · depth ${depth}`;
        }

        // Cache element lookups or execute in a single selection
        $('#tip-name').text(name);
        $('#tip-type').text(typeLabel);
        $('#tip-scope').text(scopeLabel);
        $('#tip-meta').text(metaText);

        $('#tip')
            .addClass('show')
            .css({ left: pageX + 12, top: pageY + 20 });
    }

    highlightPathForNode(node) {
        if (!this.isHighlightPathActive || !node || !this.svg) return;

        const pathNodeRefs = new Set();
        const pathNodeIds = new Set();
        const pathNodeNames = new Set();

        // 1. Trace upwards: All ancestor nodes to root
        let currentAncestor = node;
        while (currentAncestor) {
            pathNodeRefs.add(currentAncestor);
            if (currentAncestor.id !== undefined) pathNodeIds.add(currentAncestor.id);
            if (currentAncestor.data?.fullName) pathNodeNames.add(currentAncestor.data.fullName);
            if (currentAncestor.data?.name) pathNodeNames.add(currentAncestor.data.name);
            currentAncestor = currentAncestor.parent;
        }

        // 2. Trace downwards: All descendant nodes (visible children recursively across all nested levels)
        const traversalQueue = [node];
        while (traversalQueue.length > 0) {
            const currentDescendant = traversalQueue.shift();
            pathNodeRefs.add(currentDescendant);
            if (currentDescendant.id !== undefined) pathNodeIds.add(currentDescendant.id);
            if (currentDescendant.data?.fullName) pathNodeNames.add(currentDescendant.data.fullName);
            if (currentDescendant.data?.name) pathNodeNames.add(currentDescendant.data.name);

            const activeChildren = currentDescendant.children || [];
            for (let i = 0; i < activeChildren.length; i++) {
                traversalQueue.push(activeChildren[i]);
            }
        }

        const isNodeInPath = (n) => {
            if (!n) return false;
            return pathNodeRefs.has(n) ||
                (n.id !== undefined && pathNodeIds.has(n.id)) ||
                (n.data?.fullName && pathNodeNames.has(n.data.fullName)) ||
                (n.data?.name && pathNodeNames.has(n.data.name));
        };

        // Class toggle on all graph nodes
        this.svg.selectAll('g.node')
            .classed('highlighted', isNodeInPath)
            .classed('dimmed', targetNode => !isNodeInPath(targetNode));

        // Class toggle on all connecting links
        this.svg.selectAll('path.link')
            .classed('highlighted', ({ source, target }) => isNodeInPath(source) && isNodeInPath(target))
            .classed('dimmed', ({ source, target }) => !isNodeInPath(source) || !isNodeInPath(target));
    }

    resetPathHighlight() {
        if (!this.svg) return;

        if (this.isHighlightPathActive && this.selectedNodeRef) {
            this.highlightPathForNode(this.selectedNodeRef);
            return;
        }

        this.svg.selectAll('g.node, path.link')
            .classed('dimmed', false)
            .classed('highlighted', false);
    }

    update(event, source) {
        if (!this.svg?.node() || !this.root) return;

        const isTB = this.mode === 'tb';
        const duration = event?.altKey ? 4000 : 950;
        const linkColor = '#94a3b8';

        const descendants = this.root.descendants();
        const nodes = descendants.slice().reverse();
        const links = this.root.links();

        let visibleCount = 0;

        descendants.forEach((node) => {
            const lengthOfBeanName = node.data.name?.length ?? 0;
            const hasChildren = (node.children && node.children.length > 0) || (node._children && node._children.length > 0);
            const extraPadding = hasChildren ? 88 : 56;
            node.width = Math.max(165, lengthOfBeanName * 7.5 + extraPadding);

            if (node.depth === 0 || node.parent?.children) {
                visibleCount++;
            }
        });

        this._calculateLayout(nodes, isTB);

        const transition = d3.transition().duration(duration);

        this._drawNodes(nodes, transition, isTB, source);
        this._drawLinks(links, transition, isTB, source, linkColor);

        // Store current positions for future animations
        this.root.eachBefore(node => {
            node.x0 = node.x;
            node.y0 = node.y;
        });

        $('#nodeCount strong').text(visibleCount);
    }

    _calculateLayout(nodes, isTB) {
        const maxWidth = d3.max(nodes, node => node.width) || NW;
        tree.nodeSize(isTB ? [maxWidth + GAP_X, NH + GAP_Y] : [NH + 28, maxWidth + GAP_Y]);
        tree(this.root);
    }

    _drawNodes(nodes, transition, isTB, source) {
        const $tip = $('#tip');

        // Pre-calculate position transform helpers with subtle initial offset for slide-up reveal
        const getSourcePos = (node) => {
            const posX = node.x0 ?? node.parent?.x0 ?? node.parent?.x ?? node.x;
            const posY = (node.y0 ?? node.parent?.y0 ?? node.parent?.y ?? node.y) + (isTB ? 20 : 0);
            const posXOffset = isTB ? posX : posX + 20;
            return isTB ? `translate(${posX},${posY})` : `translate(${posY},${posXOffset})`;
        };

        const getNodePos = ({ x, y }) => isTB ? `translate(${x},${y})` : `translate(${y},${x})`;
        const exitPos = `translate(${isTB ? source.x : source.y},${isTB ? source.y : source.x})`;
        const initialTransform = node => getSourcePos(node);

        const nodeSelection = this.gNode.selectAll('g.node').data(nodes, node => node.id);

        // Create entering nodes
        const enter = nodeSelection.enter().append('g')
            .attr('class', 'node')
            .attr('cursor', 'pointer')
            .attr('transform', initialTransform)
            .attr('fill-opacity', 0)
            .on('click', async (event, node) => {
                event.stopPropagation();
                this.markNodeAsFocused(node);

                const { contextId, fullName, meta } = node.data;

                if (meta?.type !== "context") {
                    const details = await this.fetchBeanDetails(contextId, fullName);
                    if (details) this._mergeBeanDetailsIntoTree(node, details);
                    await this.selectNodeAndShowDetails(node, details);
                }

                $tip.removeClass('show');
            })
            .on('mouseenter', (event, node) => {
                this.showTip(event, node);
                this.highlightPathForNode(node);
            })
            .on('mousemove', ({ pageX, pageY }) => $tip.css({ left: pageX + 12, top: pageY + 20 }))
            .on('mouseleave', () => {
                $tip.removeClass('show');
                this.resetPathHighlight();
            });

        enter.append('rect')
            .attr('class', 'node-rect')
            .attr('y', -NH / 2)
            .attr('height', NH)
            .attr('rx', RX)
            .attr('stroke-width', 2);

        enter.append('rect')
            .attr('class', 'node-icon-bg')
            .attr('y', -14)
            .attr('width', 28)
            .attr('height', 28)
            .attr('rx', 8);

        enter.append('g')
            .attr('class', 'node-icon')
            .append('path')
            .attr('d', ICON)
            .attr('stroke-width', 1.8)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('fill', 'none');

        enter.append('text')
            .attr('class', 'node-text')
            .attr('y', 1)
            .attr('dy', '0.35em')
            .attr('font-size', 13)
            .attr('font-weight', 600)
            .attr('font-family', 'Inter, -apple-system, sans-serif');

        // Right-side expand / collapse toggle icon button
        const toggleGroup = enter.append('g')
            .attr('class', 'node-toggle')
            .attr('cursor', 'pointer')
            .on('mouseenter', function (event, node) {
                const style = nodeStyle(node);
                d3.select(this).select('circle').attr('fill', style.stroke);
                d3.select(this).select('.node-toggle-icon').attr('stroke', '#ffffff');
            })
            .on('mouseleave', function (event, node) {
                const style = nodeStyle(node);
                const isDark = document.documentElement.classList.contains('dark');
                d3.select(this).select('circle').attr('fill', isDark ? '#0f172a' : '#ffffff');
                d3.select(this).select('.node-toggle-icon').attr('stroke', style.stroke);
            })
            .on('click', async (event, node) => {
                event.stopPropagation();

                const { contextId, fullName, meta } = node.data;
                if (meta?.type !== "context") {
                    const details = await this.fetchBeanDetails(contextId, fullName);
                    if (details) this._mergeBeanDetailsIntoTree(node, details);
                }

                node.children = node.children ? null : node._children;
                this.update(event, node);
                $tip.removeClass('show');
            });

        toggleGroup.append('circle')
            .attr('r', 9.5)
            .attr('fill', '#ffffff')
            .attr('stroke-width', 1.6);

        toggleGroup.append('path')
            .attr('class', 'node-toggle-icon')
            .attr('stroke-width', 1.6)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('fill', 'none');

        // Update merged nodes with staggered delay for fade-up reveal animation
        const mergedSelection = nodeSelection.merge(enter);

        mergedSelection
            .transition(transition)
            .delay((d, i) => d.depth === 0 ? 0 : Math.min(d.depth * 140 + (i % 20) * 55, 1200))
            .attr('transform', getNodePos)
            .attr('fill-opacity', 1);

        this._updateNodeStylesAndContent(mergedSelection);

        // Animate exiting nodes
        nodeSelection.exit()
            .transition(transition)
            .remove()
            .attr('transform', exitPos)
            .attr('fill-opacity', 0);
    }

    _updateNodeStylesAndContent(selection) {
        const isBadge = (this.nodeTheme === 'badge');

        selection
            .style('--node-color', node => nodeStyle(node, this.nodeTheme).stroke)
            .classed('node-focused', node => Boolean(
                this.focusedNodeFullName && (
                    node.data?.fullName === this.focusedNodeFullName ||
                    node.data?.name === this.focusedNodeFullName
                )
            ));


        selection.select('.node-rect')
            .attr('x', ({ width }) => -width / 2)
            .attr('width', ({ width }) => width)
            .attr('fill', node => nodeStyle(node, this.nodeTheme).fill)
            .attr('stroke', node => nodeStyle(node, this.nodeTheme).stroke);

        selection.select('.node-icon-bg')
            .style('display', isBadge ? 'block' : 'none')
            .attr('x', ({ width }) => -width / 2 + 8)
            .attr('fill', node => nodeStyle(node, this.nodeTheme).iconBg ?? 'rgba(0,0,0,0.05)');

        selection.select('.node-icon')
            .attr('transform', ({ width }) => isBadge
                ? `translate(${-width / 2 + 12}, -10)`
                : `translate(${-width / 2 + 14}, -10)`);

        selection.select('.node-icon path')
            .attr('stroke', node => nodeStyle(node, this.nodeTheme).icon);

        selection.select('.node-text')
            .attr('x', ({ width }) => isBadge ? -width / 2 + 44 : -width / 2 + 42)
            .attr('fill', node => nodeStyle(node, this.nodeTheme).text)
            .text(({ data }) => data.name);

        selection.each(function (node) {
            const hasChildren = (node.children && node.children.length > 0) || (node._children && node._children.length > 0);
            const toggle = d3.select(this).select('.node-toggle');

            if (hasChildren) {
                const style = nodeStyle(node);
                const isExpanded = !!node.children;
                const isDark = document.documentElement.classList.contains('dark');

                toggle.style('display', 'block')
                    .attr('transform', `translate(${node.width / 2 - 18}, 0)`);

                toggle.select('circle')
                    .attr('fill', isDark ? '#0f172a' : '#ffffff')
                    .attr('stroke', style.stroke);

                toggle.select('.node-toggle-icon')
                    .attr('stroke', style.stroke)
                    .attr('d', isExpanded ? 'M -4 0 L 4 0' : 'M -4 0 L 4 0 M 0 -4 L 0 4');
            } else {
                toggle.style('display', 'none');
            }
        });
    }

    _drawLinks(links, transition, isTB, source, linkColor) {
        const linkFn = isTB ? tbLink : lrLink;

        // Pre-compute origin path string once for all entering elements
        const origin = { x: source.x0 ?? source.x, y: source.y0 ?? source.y };
        const enterPathD = linkFn({ source: origin, target: origin });
        const exitPathD = linkFn({ source, target: source });

        const linkSelection = this.gLink.selectAll('path.link').data(links, link => link.target.id);

        // Create entering links
        const enter = linkSelection.enter().append('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', linkColor)
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#dot)')
            .attr('d', enterPathD);

        // Animate active links with matching staggered delay
        linkSelection.merge(enter)
            .transition(transition)
            .delay((d, i) => Math.min(d.target.depth * 140 + (i % 20) * 55, 1200))
            .attr('stroke', linkColor)
            .attr('d', linkFn);

        // Animate exiting links
        linkSelection.exit()
            .transition(transition)
            .remove()
            .attr('d', exitPathD);
    }

    zoomBy(factor, duration = 300) {
        if (!this.svg || !this.zoom) return;

        this.svg.transition()
            .duration(duration)
            .call(this.zoom.scaleBy, factor);
    }

    fitView(duration = 500, padding = 35, minScale = 0.4, maxScale = 1.8) {
        if (!this.svg?.node() || !this.root) return;

        const $beanGraph = $('#beanGraph');
        const width = $beanGraph.width() || 800;
        const height = $beanGraph.height() || 600;

        const nodes = this.root.descendants();
        if (nodes.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let maxNodeW = NW;

        const isTB = this.mode === 'tb';

        // Single pass to find coordinate bounds and maximum node width
        for (let i = 0; i < nodes.length; i++) {
            const { x, y, width: nodeWidth = NW } = nodes[i];
            const nx = isTB ? x : y;
            const ny = isTB ? y : x;

            if (nx < minX) minX = nx;
            if (nx > maxX) maxX = nx;
            if (ny < minY) minY = ny;
            if (ny > maxY) maxY = ny;
            if (nodeWidth > maxNodeW) maxNodeW = nodeWidth;
        }

        const graphW = (maxX - minX) + maxNodeW + padding * 2;
        const graphH = (maxY - minY) + NH + padding * 2;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const rawScale = (Math.min(width / graphW, height / graphH)) * 1.25;
        const scale = Math.max(minScale, Math.min(maxScale, rawScale));

        const tx = width / 2 - centerX * scale;
        const ty = height / 2 - centerY * scale;

        this.svg.transition()
            .duration(duration)
            .call(this.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    updateZoomPercent(k) {
        $('#zoom-percent').text(`${Math.round(k * 100)}%`);
    }

    async selectNodeAndShowDetails(selectedHierarchyNode, beanDetails) {
        this.selectedNodeRef = selectedHierarchyNode;
        if (this.isHighlightPathActive) this.highlightPathForNode(selectedHierarchyNode);

        const { fullName, meta } = selectedHierarchyNode.data ?? {};
        const { dependencies = [], dependents = [] } = beanDetails ?? {};

        const isIgnoredType = meta?.type === 'context' || meta?.type === 'N/A';
        const hasDetails = dependencies.length > 0 || dependents.length > 0;

        if (isIgnoredType || !hasDetails) {
            this.closeSidebar();
            ToastNotification.show({
                title: 'Bean Details',
                message: `No additional details available for <span class="font-semibold text-gray-850 dark:text-gray-200">${fullName}</span>.`,
                type: 'sweet',
                duration: 4000
            });
            return;
        }

        this.showBeanDetails(beanDetails, selectedHierarchyNode);
    }

    showBeanDetails(beanDetails, hierarchyNode) {
        const { contextId, dependencies, dependents } = beanDetails;

        if (hierarchyNode && beanDetails) {
            this._mergeBeanDetailsIntoTree(hierarchyNode, beanDetails);
        }

        this._openSidebarAndPopulateData(beanDetails);
        this._renderDependencyAccordions(dependencies, dependents, contextId);

        // If the node exists in the current graph tree layout, focus & highlight it
        if (this.root) {
            const targetNode = hierarchyNode || this.findNodeInTree(this.root, beanDetails.beanName);
            if (targetNode) {
                this.markNodeAsFocused(targetNode);
                if (this.isHighlightPathActive) {
                    this.highlightPathForNode(targetNode);
                }
            }
        }
    }

    _openSidebarAndPopulateData(beanDetails = {}) {
        this.openSidebar();
        Sidebar.populateDetails(beanDetails);
        Sidebar.updateSidebarIcon(beanDetails);
        this.switchTab('properties');
    }

    _initSidebar() {
        const $sidebar = $('#details-sidebar');
        if ($sidebar.length && !$sidebar.children().length) {
            $sidebar.empty();
            const clone = TemplateEngine.clone('tpl-bean-details-sidebar');
            if (clone) {
                $sidebar.append(clone);
            }
        }
    }

    openSidebar() {
        this._initSidebar();
        const $sidebar = $('#details-sidebar');
        if (!$sidebar.length) return;
        $sidebar.removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-4 border-0')
            .addClass('w-[360px] max-w-[360px] opacity-100 mr-0 border');
    }

    closeSidebar(immediate = false) {
        const $sidebar = $('#details-sidebar');
        if (!$sidebar.length) return;
        $sidebar.removeClass('w-[360px] max-w-[360px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-4 border-0');
    }

    switchTab(tabName) {
        Sidebar.switchTab(tabName);
    }

    _renderDependencyAccordions(dependencyNames = [], dependentNames = [], contextId = '') {
        $('#detail-deps-count').text(dependencyNames.length);
        $('#detail-dependents-count').text(dependentNames.length);

        Sidebar.renderDependencyList($('#detail-deps-list'), dependencyNames, {
            emptyText: 'No dependencies',
            emptyTemplateId: 'tpl-graph-dep-empty',
            templateId: 'tpl-graph-dep-item',
            contextId
        });
        Sidebar.renderDependencyList($('#detail-dependents-list'), dependentNames, {
            emptyText: 'No dependents',
            emptyTemplateId: 'tpl-graph-dep-empty',
            templateId: 'tpl-graph-dep-item',
            contextId
        });
    }

    findNodeInTree(rootNode, targetIdentifier) {
        if (!rootNode || !targetIdentifier) return null;

        const normalizedTargetName = this._extractTerminalBeanIdentifier(targetIdentifier);
        const traversalStack = [rootNode];

        while (traversalStack.length > 0) {
            const currentNode = traversalStack.pop();
            const currentNodeIdentifier = currentNode.data?.fullName ?? currentNode.data?.name ?? '';

            if (this._isMatchingNode(currentNodeIdentifier, targetIdentifier, normalizedTargetName)) {
                return currentNode;
            }

            const childNodes = currentNode.children ?? currentNode._children;
            if (childNodes) {
                for (let i = childNodes.length - 1; i >= 0; i--) {
                    traversalStack.push(childNodes[i]);
                }
            }
        }

        return null;
    }

    _extractTerminalBeanIdentifier(identifier) {
        return identifier.includes(':') ? identifier.split(':').pop() : identifier;
    }

    _isMatchingNode(nodeIdentifier, rawTargetIdentifier, normalizedTargetName) {
        if (!nodeIdentifier) return false;
        if (nodeIdentifier === rawTargetIdentifier) return true;

        const normalizedNodeName = this._extractTerminalBeanIdentifier(nodeIdentifier);
        return normalizedNodeName === normalizedTargetName;
    }

    async focusOnBean(fullName, contextId = '', openSidebar = false) {
        if (!fullName) return;

        if (this.root) {
            const targetNode = this.findNodeInTree(this.root, fullName);
            if (targetNode) {
                // Expand collapsed parents along the upward ancestor path
                let currentNode = targetNode.parent;
                let needsUpdate = false;

                while (currentNode) {
                    if (currentNode._children && !currentNode.children) {
                        currentNode.children = currentNode._children;
                        needsUpdate = true;
                    }
                    currentNode = currentNode.parent;
                }

                if (needsUpdate) {
                    this.update(null, this.root);
                }

                // Measure viewport dimensions once
                const $graph = $('#beanGraph');
                const width = $graph.width() || 800;
                const height = $graph.height() || 600;

                const isTopBottom = this.mode === 'tb';
                const { x: nodeX, y: nodeY } = targetNode;

                const targetX = isTopBottom ? nodeX : nodeY;
                const targetY = isTopBottom ? nodeY : nodeX;

                const zoomScale = 1.3;
                const translateX = width / 2 - targetX * zoomScale;
                const translateY = height / 2 - targetY * zoomScale;

                this.svg.transition()
                    .duration(600)
                    .call(this.zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale));

                this.markNodeAsFocused(targetNode);

                if (this.isHighlightPathActive) {
                    this.highlightPathForNode(targetNode);
                }
            } else {
                console.info(`Bean "${fullName}" not found in current graph layout.`);
            }
        }

        if (openSidebar) {
            this.showBeanDetails(fullName, contextId);
        }
    }

    markNodeAsFocused(targetNode) {
        this.focusedNodeFullName = targetNode?.data?.fullName || targetNode?.data?.name || (typeof targetNode === 'string' ? targetNode : null);
        if (!this.svg) return;

        this.svg.selectAll('g.node')
            .style('--node-color', node => nodeStyle(node).stroke)
            .classed('node-focused', node => Boolean(
                this.focusedNodeFullName && (
                    node === targetNode ||
                    node.data?.fullName === this.focusedNodeFullName ||
                    node.data?.name === this.focusedNodeFullName
                )
            ));

        this.svg.selectAll('g.node.node-focused').raise();
    }

    clearFocusedNode() {
        this.focusedNodeFullName = null;
        if (!this.svg) return;
        this.svg.selectAll('g.node').classed('node-focused', false);
    }

    setMode(layoutMode) {
        this.mode = layoutMode;
        localStorage.setItem('sl-layout', layoutMode);

        const isTopBottom = layoutMode === 'tb';
        const activeClasses = 'bg-white text-gray-800 shadow-sm';
        const inactiveClasses = 'text-gray-500 hover:text-gray-800';

        // Batch toggle button styling
        $('#btn-tb')
            .toggleClass(activeClasses, isTopBottom)
            .toggleClass(inactiveClasses, !isTopBottom);

        $('#btn-lr')
            .toggleClass(activeClasses, !isTopBottom)
            .toggleClass(inactiveClasses, isTopBottom);

        if (!this.root) return;

        // Cache previous positions before recalculating layout
        this.root.eachBefore(node => {
            node.x0 = node.x;
            node.y0 = node.y;
        });

        const { x = 0, y = 0, x0 = 0, y0 = 0 } = this.root;

        this.update(null, { x, y, x0, y0 });
        this.fitView(500);
    }

    setNodeTheme(themeName, shouldUpdate = true) {
        this.nodeTheme = themeName;
        localStorage.setItem('sl-node-theme', themeName);

        const isTint = themeName === 'tint';
        const activeClasses = 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white shadow-xs font-bold';
        const inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium';

        $('#btn-node-theme-tint')
            .toggleClass(activeClasses, isTint)
            .toggleClass(inactiveClasses, !isTint);

        $('#btn-node-theme-badge')
            .toggleClass(activeClasses, !isTint)
            .toggleClass(inactiveClasses, isTint);

        if (shouldUpdate && this.root) {
            this.update(null, this.root);
        }
    }

    _bindSearchHandlers() {
        this._debouncedGraphSearch = debounce((query) => {
            this._handleSearchInput(query);
        }, 180);

        $(document).off('input.graphSearch', '#search-input').on('input.graphSearch', '#search-input', (event) => {
            this._debouncedGraphSearch(event.target.value);
        });

        $(document).off('keydown.graphSearch', '#search-input').on('keydown.graphSearch', '#search-input', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this._debouncedGraphSearch?.flush();
                const $firstSuggestion = $('#search-suggestions .suggestion-item').first();
                if ($firstSuggestion.length) {
                    $firstSuggestion.trigger('click');
                } else {
                    const query = $('#search-input').val()?.trim();
                    if (query) {
                        this.focusOnBean(query, this.selectedContextId, false);
                        $('#search-input').val('');
                        $('#search-suggestions').hide();
                    }
                }
            } else if (event.key === 'Escape') {
                this._debouncedGraphSearch?.cancel();
                $('#search-input').val('');
                $('#search-suggestions').hide().empty();
            }
        });

        this._bindOutsideSearchDismissal();
    }

    async _handleSearchInput(rawQueryValue) {
        const $suggestionsBox = $('#search-suggestions');
        const query = (rawQueryValue || '').trim();

        if (!query) {
            $suggestionsBox.hide().empty();
            return;
        }

        // Show loading indicator
        $suggestionsBox.html('<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs flex items-center gap-2"><span class="material-symbols-outlined text-[16px] animate-spin text-primary">progress_activity</span><span>Searching beans...</span></div>').show();

        try {
            const queryParams = QueryParam.build({
                search: query,
                pageSize: 12
            }).toString();

            const response = await httpClient.getWithQuery(this.beanDefinitions, queryParams);
            const items = response?.content ?? (Array.isArray(response) ? response : []);

            this._renderSearchSuggestions($suggestionsBox, items, query);
        } catch (error) {
            console.warn('Error fetching search suggestions from API:', error);
            // Fallback to in-memory matching if API is offline
            const matchingBeans = this._searchMatchingNodes(query, 12);
            this._renderSearchSuggestions($suggestionsBox, matchingBeans, query);
        }
    }

    _searchMatchingNodes(searchQuery, maxResultsCount) {
        const candidateBeans = [];
        const visitedFullNames = new Set();
        const traversalStack = [this.root];

        while (traversalStack.length > 0) {
            const currentNode = traversalStack.pop();
            const nodeData = currentNode.data ?? {};
            const { fullName, meta = {} } = nodeData;

            if (this._isSearchCandidate(fullName, visitedFullNames)) {
                visitedFullNames.add(fullName);
                const displayName = GraphTreeBuilder._displayName(fullName);
                candidateBeans.push({
                    beanName: displayName,
                    fullName,
                    type: meta.type || '',
                    scope: meta.scope || ''
                });
            }

            const childNodes = currentNode.children ?? currentNode._children;
            if (childNodes) {
                for (let i = childNodes.length - 1; i >= 0; i--) {
                    traversalStack.push(childNodes[i]);
                }
            }
        }

        const results = BeanSearchEngine.search(candidateBeans, searchQuery, {
            limit: maxResultsCount,
            scoreResults: true
        });

        return results.map(b => ({
            beanName: b.beanName,
            fullName: b.fullName,
            type: b.type,
            scope: b.scope
        }));
    }

    _isSearchCandidate(fullName, visitedFullNames) {
        return Boolean(
            fullName &&
            !visitedFullNames.has(fullName)
        );
    }

    _renderSearchSuggestions($suggestionsBox, matchingBeans, query = '') {
        if (!matchingBeans || matchingBeans.length === 0) {
            $suggestionsBox
                .html('<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs italic">No matching beans found</div>')
                .show();
            return;
        }

        $suggestionsBox.empty();
        const fragment = document.createDocumentFragment();
        matchingBeans.forEach(matchingBean => {
            const { contextId, beanName, type, scope } = matchingBean;
            const meta = resolveBeanMetadata({ beanName, type: type });

            const itemElem = document.createElement('div');
            itemElem.className = 'suggestion-item px-3 py-2 text-xs hover:bg-purple-50/60 dark:hover:bg-purple-950/40 cursor-pointer flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800/60 last:border-b-0 transition-colors';
            itemElem.setAttribute('data-fullname', beanName);
            itemElem.setAttribute('data-context-id', contextId);

            const highlightedName = BeanSearchEngine.highlight(beanName, query);
            const shortType = type ? type.split('.').pop() : '';

            itemElem.innerHTML = `
                <div class="flex items-center gap-2 min-w-0">
                    <span class="material-symbols-outlined text-[16px] flex-shrink-0" style="color: ${meta.color}">${meta.icon}</span>
                    <div class="min-w-0">
                        <div class="font-semibold text-gray-800 dark:text-gray-200 truncate">${highlightedName}</div>
                        ${shortType ? `<div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">${shortType}</div>` : ''}
                    </div>
                </div>
                ${scope ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 uppercase">${scope}</span>` : ''}
            `;

            fragment.appendChild(itemElem);
        });

        $suggestionsBox.append(fragment).show();
    }

    _bindOutsideSearchDismissal() {
        $(document).on('click', (event) => {
            const isClickInsideSearch = Boolean(
                event.target.closest('#search-input') ||
                event.target.closest('#search-suggestions')
            );

            if (!isClickInsideSearch) {
                $('#search-suggestions').hide();
            }
        });
    }

    _bindClickActionRouter() {
        $(document).on('click', (event) => {
            const $clickedElement = $(event.target);

            if (this._handleBeanNavigationClick($clickedElement, event)) return;
            if (this._handleAccordionToggleClick($clickedElement)) return;
            this._handleToolbarActionClick($clickedElement);
        });
    }

    _handleBeanNavigationClick($clickedElement, event) {
        const $navigationLink = $clickedElement.closest('.suggestion-item, .dep-item-left, .dep-link');
        if ($navigationLink.length === 0) return false;

        event.stopPropagation();

        const isSuggestion = $navigationLink.hasClass('suggestion-item');
        if (isSuggestion) {
            $('#search-input').val('');
            $('#search-suggestions').hide();
        }

        const targetBeanFullName = $navigationLink.data('fullname') || $navigationLink.attr('data-fullname');
        const targetContextId = $navigationLink.data('context-id') || $navigationLink.attr('data-context-id') || this.selectedContextId || '';

        if (targetBeanFullName) {
            if (isSuggestion) {
                this.focusOnBean(targetBeanFullName, targetContextId, false);
            } else {
                this.showBeanDetails(targetBeanFullName, targetContextId);
            }
        }

        return true;
    }

    _handleAccordionToggleClick($clickedElement) {
        const $accordionHeader = $clickedElement.closest('.accordion-header');
        if (!$accordionHeader.length) return false;

        $accordionHeader.toggleClass('open');
        $accordionHeader.find('.material-symbols-outlined').toggleClass('rotate-90');
        $accordionHeader.next('.accordion-body').slideToggle(200);

        return true;
    }

    _handleToolbarActionClick($clickedElement) {
        const $actionButton = $clickedElement.closest('button, [id^="btn-"]');
        if ($actionButton.length === 0) return;

        const actionButtonId = $actionButton.attr('id');
        const buttonActionMap = this._getToolbarActionMap($actionButton);

        const targetActionHandler = buttonActionMap[actionButtonId];
        if (targetActionHandler) {
            targetActionHandler();
        }
    }

    _getToolbarActionMap($actionButton) {
        return {
            'btn-expand': () => this._mutateTreeNodes(node => node.children = node._children),
            'btn-collapse': () => this._mutateTreeNodes(node => { if (node.depth > 0) node.children = null; }),
            'btn-control-zoom-in': () => this.zoomBy(1.25),
            'btn-control-zoom-out': () => this.zoomBy(0.8),
            'btn-control-fit': () => this.fitView(),
            'btn-pan-mode': () => this.fitView(),
            'btn-highlight-path': () => this._togglePathHighlightState($actionButton),
            'btn-close-sidebar': () => this.closeSidebar(),
            'btn-tb': () => this.setMode('tb'),
            'btn-lr': () => this.setMode('lr'),
            'btn-node-theme-tint': () => this.setNodeTheme('tint'),
            'btn-node-theme-badge': () => this.setNodeTheme('badge')
        };
    }

    _togglePathHighlightState($highlightButton) {
        const HIGHLIGHT_BUTTON_CLASSES = {
            active: 'bg-primary text-white border-primary hover:bg-primary/90',
            inactive: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        };

        this.isHighlightPathActive = !this.isHighlightPathActive;

        $highlightButton
            .toggleClass(HIGHLIGHT_BUTTON_CLASSES.active, this.isHighlightPathActive)
            .toggleClass(HIGHLIGHT_BUTTON_CLASSES.inactive, !this.isHighlightPathActive);

        if (!this.isHighlightPathActive) {
            this.resetPathHighlight();
        } else if (this.selectedNodeRef) {
            this.highlightPathForNode(this.selectedNodeRef);
        }
    }

    _bindCustomEventHandlers() {
        document.addEventListener('themechanged', () => {
            if (this.root) this.update(null, this.root);
        });

        $(document).on('change', '#context-filter', (event) => {
            this.selectedContextId = $(event.target).val();
            const beans = this.accumulatedBeans.length > 0 ? this.accumulatedBeans : null;
            this._buildHierarchyFromDependencies(beans);
            this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
            this._updateTotalBeanCount();
            this.fitView(500);
        });

        $(document).on('click', '.tab-btn', (event) => {
            const tabName = $(event.currentTarget).attr('data-tab');
            if (tabName) {
                this.switchTab(tabName);
            }
        });
    }

    _mutateTreeNodes(mutatorFn) {
        if (!this.root) return;
        this.root.eachBefore(mutatorFn);
        this.update(null, this.root);
        this.fitView();
    }

    _updateProgressBadge({ loaded = 0, total = 0, isComplete = false, hasError = false, errorMsg = '' } = {}) {
        const $badgeElement = $('#chunk-progress-badge');
        const $dotElement = $('#chunk-progress-dot');
        const $textElement = $('#chunk-progress-text');

        if ($badgeElement.length === 0) return;

        const progressState = this._resolveProgressState(hasError, isComplete);
        const configuration = this._getProgressConfiguration(progressState, { loaded, total, errorMsg });

        $badgeElement.removeClass(ALL_PROGRESS_BADGE_CLASSES).addClass(configuration.badgeClass);
        $dotElement.removeClass(ALL_PROGRESS_DOT_CLASSES).addClass(configuration.dotClass);
        $textElement.html(configuration.textHtml);
    }

    _resolveProgressState(hasError, isComplete) {
        if (hasError) return 'error';
        if (isComplete) return 'complete';
        return 'loading';
    }

    _getProgressConfiguration(state, { loaded, total, errorMsg }) {
        const style = PROGRESS_BADGE_STYLES[state] || PROGRESS_BADGE_STYLES.loading;

        const textHtmlMap = {
            error: `Failed <span class="text-[11px] opacity-85">(${errorMsg || 'Retry'})</span>`,
            complete: `Loaded (${loaded})`,
            loading: `Loading: ${loaded} / ${total}`
        };

        return {
            badgeClass: style.badge,
            dotClass: style.dot,
            textHtml: textHtmlMap[state]
        };
    }

    leave() {
        this.closeSidebar();
        this.clearFocusedNode();
        this._debouncedGraphSearch?.cancel();
        $('#search-input').val('');
        $('#search-results').addClass('hidden').empty();
        $('#tip').removeClass('show');
    }
}