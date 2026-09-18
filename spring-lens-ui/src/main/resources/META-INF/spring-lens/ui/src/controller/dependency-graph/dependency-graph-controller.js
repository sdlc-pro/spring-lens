import BaseController from '../base-controller.js';
import {
    GraphHierarchyBuilder,
    GraphPathTracer,
    GraphCanvasWidget,
    GraphSearchWidget,
    GraphSidebarWidget,
    QueryParam,
    ToastNotification,
    AsyncUtils
} from './index.js';
import {container} from "../../helper/index.js";

export class DependencyGraphController extends BaseController {

    constructor() {
        super('dependencyGraph');
        this.service = container.make('dependencyGraphService');

        this.state = {
            appName: 'SpringLens',
            searchQuery: '',
            searchSuggestions: [],
            showSuggestions: false,
            isSearching: false,
            availableContexts: [],
            selectedContextId: '',
            mode: localStorage.getItem('sl-layout') ?? 'tb',
            isHighlightPathActive: false,
            refreshing: false,
            chunkProgress: { visible: false, state: 'loading', text: '', loaded: 0, total: 0 },
            beansCount: 0,
            loadedBeansCount: 0,
            totalBeansCount: 0,
            remainingBeansCount: 0,
            hasMoreBeans: false,
            isLoadingMore: false,
            isLoadingAll: false,
            loadAllModalOpen: false,
            isExporting: false,
            customLoadAmount: 100,
            depsCount: 0,
            zoomPercent: '100%',
            sidebarOpen: false,
            sidebarTab: 'properties',
            sidebarLoading: false,
            selectedBean: null,
            selectedBeanMeta: { icon: 'schema', color: '#8b5cf6' },
            selectedBeanFormatted: null,
            sidebarDeps: [],
            sidebarDependents: [],
            errorMessage: null
        };

        for (const key of Object.keys(this.state)) {
            Object.defineProperty(this, key, {
                get: () => (this.alpine ? this.alpine[key] : this.state[key]),
                set: (value) => this.setState({ [key]: value }),
                configurable: true,
                enumerable: true,
            });
        }

        this.pathTracer = new GraphPathTracer({
            onStateChange: () => this._renderCanvas()
        });

        this.canvasWidget = new GraphCanvasWidget({
            onNodeClick: (event, node) => this._handleNodeClick(event, node),
            onToggleClick: (event, node) => this._handleToggleClick(event, node),
            onNodeHover: (event, node) => this.pathTracer.highlightPathForNode(node),
            onNodeLeave: () => this.pathTracer.resetPathHighlight(this.selectedNodeRef),
            onZoomChange: (percentStr) => this.setState({ zoomPercent: percentStr }),
            onModeChange: (mode) => this.setState({ mode }),
            onBackgroundClick: () => {
                this.closeSidebar();
                this.clearFocusedNode();
            },
        });

        this.sidebarWidget = new GraphSidebarWidget({
            onTransition: () => this.canvasWidget.animateSidebarTransition(this.root, this._getExtraCanvasConfig())
        });

        this.searchWidget = new GraphSearchWidget(this.service, {
            getRootNode: () => this.root,
            getSelectedContextId: () => this.selectedContextId
        });

        this.addDisposable(this.canvasWidget);
        this.addDisposable(this.searchWidget);
        this.addDisposable(this.sidebarWidget);

        this.root = null;
        this.selectedNodeRef = null;

        this._debouncedSearch = AsyncUtils.debounce(async (query) => {
            const results = await this.searchWidget.search(query, 12);
            if (this.searchQuery.trim() === query.trim()) {
                this.setState({ searchSuggestions: results, isSearching: false });
            }
        }, 180);
    }

    setState(patch) {
        if (!patch) return;
        Object.assign(this.state, patch);
        if (this.alpine) {
            Object.assign(this.alpine, patch);
        }
    }

    createAlpineState() {
        return {
            ...this.state,
            onSearchInput: (event) => this.onSearchInput(event),
            clearSearch: () => this.clearSearch(),
            onSearchEnter: () => this.onSearchEnter(),
            selectSuggestion: (item) => this.selectSuggestion(item),
            closeSuggestions: () => this.closeSuggestions(),
            onContextFilterChange: () => this.onContextFilterChange(),
            setMode: (mode) => this.setMode(mode),
            collapseAllNodes: () => this.collapseAllNodes(),
            toggleHighlightPath: () => this.toggleHighlightPath(),
            reloadGraphData: () => this.reloadGraphData(),
            fitView: () => this.fitView(),
            zoomBy: (factor) => this.zoomBy(factor),
            closeSidebar: () => this.closeSidebar(),
            setSidebarTab: (tab) => this.setSidebarTab(tab),
            selectDependency: (dep) => this.selectDependency(dep),
            loadMoreBeans: (count) => this.loadMoreBeans(count),
            loadCustomBatch: () => this.loadCustomBatch(),
            onCustomLoadAmountInput: (event) => this.onCustomLoadAmountInput(event),
            openLoadAllModal: () => this.openLoadAllModal(),
            closeLoadAllModal: () => this.closeLoadAllModal(),
            confirmLoadAll: () => this.confirmLoadAll(),
            exportGraph: (fullTree = true) => this.exportGraph(fullTree)
        };
    }

    get canvas() {
        return this.canvasWidget.canvas;
    }

    set canvas(value) {
        this.canvasWidget.canvas = value;
    }

    get canvasRenderer() {
        return this.canvasWidget.canvasRenderer;
    }

    get zoom() {
        return this.canvasWidget.zoom;
    }

    get currentTransform() {
        return this.canvasWidget.currentTransform;
    }

    set currentTransform(value) {
        this.canvasWidget.currentTransform = value;
    }

    get activePathNodeRefs() {
        return this.pathTracer.activePathNodeRefs;
    }

    get activePathNodeIds() {
        return this.pathTracer.activePathNodeIds;
    }

    get activePathNodeNames() {
        return this.pathTracer.activePathNodeNames;
    }

    get focusedNodeFullName() {
        return this.canvasWidget.focusedNodeFullName;
    }

    get focusedNodeContextId() {
        return this.canvasWidget.focusedNodeContextId;
    }

    get focusedNodeId() {
        return this.canvasWidget.focusedNodeId;
    }

    get totalElements() {
        return this.service.totalElements;
    }

    get accumulatedBeans() {
        return this.service.accumulatedBeans;
    }

    get beanDependencies() {
        return this.service.beanDependencies;
    }

    get beanDetailsCache() {
        return this.service.beanDetailsCache;
    }

    get dependencyGraphApi() {
        return this.service.endpoints?.dependencies;
    }

    get beanDefinitions() {
        return this.service.endpoints?.definitions;
    }

    get findBeanDefinitionsApi() {
        return this.service.endpoints?.find;
    }

    async enter(params) {
        this._bindCustomEventHandlers();

        if (!this._initializeCanvas()) return;

        const isDataLoaded = await this._loadInitialData();
        if (!isDataLoaded) return;

        this._renderInitialGraph();
        this._handlePendingBeanFocus(params);
    }

    _initializeCanvas() {
        const canvasElem = document.getElementById('tree-canvas');
        if (!canvasElem) return false;
        return this.canvasWidget.init(canvasElem, () => this.root);
    }

    async reloadGraphData() {
        this.setState({ refreshing: true, errorMessage: null });
        try {
            this.service.clearCache();
            await this.service.fetchBeanGraphDependencies(500, (progress) => this._updateProgressBadge(progress));
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            this.update(null, null, 0);
            this.fitView(0);
        } catch (error) {
            console.error('Error reloading graph data:', error);
            this.setState({ errorMessage: error.message || 'Failed to reload graph data' });
        } finally {
            setTimeout(() => this.setState({ refreshing: false }), 600);
        }
    }

    async _loadInitialData() {
        try {
            this.setState({ errorMessage: null });
            await this.service.fetchBeanGraphDependencies(500, (progress) => this._updateProgressBadge(progress));
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            return true;
        } catch (error) {
            console.error('Failed to initialize graph data:', error);
            this.setState({ errorMessage: error.message || 'Failed to initialize graph data' });
            return false;
        }
    }

    _renderInitialGraph() {
        this.canvasWidget.setMode(this.mode, false);
        this.update(null, null, 0);
        this.fitView(0);
    }

    _handlePendingBeanFocus(params) {
        const targetBean = QueryParam.get(params, 'focus', 'search', 'bean');
        const contextId = QueryParam.get(params, 'contextId', 'context') || '';
        if (!targetBean) return;

        setTimeout(() => this.focusOnBean(targetBean, contextId, false), 300);
    }

    async fetchBeanDetails(contextId, beanName) {
        return this.service.fetchBeanDetails(contextId, beanName);
    }

    _mergeBeanDetailsIntoTree(node, details) {
        GraphHierarchyBuilder.mergeBeanDetailsIntoTree(node, details, (n) => this._calculateNodeWidth(n));
    }

    _nodeHasChildren(node) {
        return GraphHierarchyBuilder.nodeHasChildren(node);
    }

    _lazyLoadChildren(node) {
        GraphHierarchyBuilder.lazyLoadChildren(node, (n) => this._calculateNodeWidth(n));
    }

    _createDynamicHierarchyChild(parentNode, beanName, contextId, isCycle = false) {
        return GraphHierarchyBuilder.createDynamicHierarchyChild(parentNode, beanName, contextId, isCycle, (n) => this._calculateNodeWidth(n));
    }

    _buildHierarchyFromDependencies(beanDefinitions = null) {
        const listOfBeans = beanDefinitions || this.service.accumulatedBeans;
        if (!listOfBeans || listOfBeans.length === 0) {
            this.root = null;
            return;
        }

        this._populateContextFilter(listOfBeans);
        this.root = GraphHierarchyBuilder.buildHierarchy(
            listOfBeans,
            this.selectedContextId,
            (node) => this._calculateNodeWidth(node)
        );
    }

    _populateContextFilter(beanDefinitions = []) {
        const uniqueContextIdentifiers = GraphHierarchyBuilder.extractUniqueContextIdentifiers(beanDefinitions);
        this.setState({ availableContexts: uniqueContextIdentifiers });
    }

    onContextFilterChange() {
        const beans = this.service.accumulatedBeans.length > 0 ? this.service.accumulatedBeans : null;
        this._buildHierarchyFromDependencies(beans);
        this.update(null, null, 0);
        this._updateTotalBeanCount();
        this.fitView(500);
    }

    _updateTotalBeanCount() {
        const beanList = this.service.accumulatedBeans;
        const totalElements = this.service.totalElements || beanList.length;
        const loadedCount = beanList.length;
        const remainingCount = Math.max(0, totalElements - loadedCount);
        const hasMore = loadedCount < totalElements;

        let totalDeps = 0;
        for (let i = 0; i < beanList.length; i++) {
            totalDeps += beanList[i]?.dependencies?.length ?? 0;
        }

        this.setState({
            beansCount: totalElements,
            loadedBeansCount: loadedCount,
            totalBeansCount: totalElements,
            remainingBeansCount: remainingCount,
            hasMoreBeans: hasMore,
            depsCount: totalDeps
        });
    }

    async loadMoreBeans(count = 100) {
        if (this.state.isLoadingMore || !this.state.hasMoreBeans) {
            return;
        }

        const batchSize = Math.max(1, parseInt(count, 10) || 100);
        this.setState({ isLoadingMore: true });

        try {
            // 1. Capture currently expanded nodes to preserve branch state
            const expandedKeys = new Set();
            if (this.root) {
                this.root.eachBefore(node => {
                    if (node.children && node.depth > 0) {
                        const key = `${node.data?.contextId || ''}::${node.data?.fullName || node.data?.name || ''}`;
                        expandedKeys.add(key);
                    }
                });
            }

            // 2. Fetch incremental batch from API using pageNumber & pageSize
            const result = await this.service.fetchMoreBeans(batchSize, (progress) => {
                this._updateProgressBadge(progress);
            });

            const newlyLoadedCount = result?.newBeans?.length ?? 0;

            // 3. Rebuild hierarchy and inject new beans
            this._buildHierarchyFromDependencies();

            // 4. Restore expanded branch states
            if (this.root && expandedKeys.size > 0) {
                this.root.eachBefore(node => {
                    const key = `${node.data?.contextId || ''}::${node.data?.fullName || node.data?.name || ''}`;
                    if (expandedKeys.has(key)) {
                        if (!node._children || node._children.length === 0) {
                            this._lazyLoadChildren(node);
                        }
                        node.children = node._children;
                    }
                });
            }

            // 5. Update counts
            this._updateTotalBeanCount();

            // 6. Smooth canvas update
            this.update(null, null, 400);
        } catch (error) {
            console.error('Error loading more beans into graph:', error);
            ToastNotification.show({
                title: 'Load Failed',
                message: error.message || 'Failed to load additional beans',
                type: 'error',
                duration: 3500
            });
        } finally {
            this.setState({ isLoadingMore: false });
        }
    }

    loadCustomBatch() {
        const amount = Number.parseInt(this.state.customLoadAmount, 10) || 100;
        this.loadMoreBeans(amount);
    }

    onCustomLoadAmountInput(event) {
        const val = Number.parseInt(event.target.value, 10);
        if (Number.isFinite(val) && val > 0) {
            this.setState({ customLoadAmount: Math.min(1000, val) });
        }
    }

    openLoadAllModal() {
        if (!this.state.hasMoreBeans || this.state.isLoadingMore || this.state.isLoadingAll) {
            return;
        }
        this.setState({ loadAllModalOpen: true });
    }

    closeLoadAllModal() {
        this.setState({ loadAllModalOpen: false });
    }

    async confirmLoadAll() {
        this.closeLoadAllModal();
        if (!this.state.hasMoreBeans || this.state.isLoadingMore || this.state.isLoadingAll) {
            return;
        }

        this.setState({ isLoadingAll: true });
        try {
            await this.loadMoreBeans(this.state.remainingBeansCount);
        } finally {
            this.setState({ isLoadingAll: false });
        }
    }

    async exportGraph(fullTree = true) {
        if (this.state.isExporting || !this.root) return;

        this.setState({ isExporting: true });
        try {
            const blob = await this.canvasWidget.exportPNG({ fullTree, pixelRatio: 2 });
            if (!blob) {
                console.warn('Failed to generate PNG export.');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const contextSuffix = this.state.selectedContextId ? `-${this.state.selectedContextId}` : '';
            const modeSuffix = fullTree ? 'full-tree' : 'viewport';
            const filename = `spring-lens-graph${contextSuffix}-${modeSuffix}-${timestamp}.png`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Error exporting graph as PNG:', err);
        } finally {
            this.setState({ isExporting: false });
        }
    }

    _getExtraCanvasConfig() {
        return {
            isHighlightPathActive: this.isHighlightPathActive,
            selectedNodeRef: this.selectedNodeRef,
            isNodeHighlighted: (node) => this.pathTracer.isNodeInActivePath(node),
            isLinkHighlighted: (link) => this.pathTracer.isLinkInActivePath(link)
        };
    }

    _renderCanvas(source = null, duration = 0) {
        this.canvasWidget.renderCanvas(this.root, source, duration, this._getExtraCanvasConfig());
    }

    update(event, source = null, customDuration = null) {
        this.canvasWidget.update(
            this.root,
            event,
            source,
            customDuration,
            this._getExtraCanvasConfig(),
            (node) => this._nodeHasChildren(node)
        );
    }

    _calculateNodeWidth(node) {
        return this.canvasWidget.calculateNodeWidth(node, (n) => this._nodeHasChildren(n));
    }

    highlightPathForNode(node) {
        this.pathTracer.highlightPathForNode(node);
    }

    resetPathHighlight() {
        this.pathTracer.resetPathHighlight(this.selectedNodeRef);
    }

    toggleHighlightPath() {
        const nextState = !this.isHighlightPathActive;
        this.pathTracer.isHighlightPathActive = nextState;
        this.setState({ isHighlightPathActive: nextState });

        if (nextState && this.selectedNodeRef) {
            this.highlightPathForNode(this.selectedNodeRef);
        } else {
            this.resetPathHighlight();
        }

        this._renderCanvas();
    }

    collapseAllNodes() {
        this._mutateTreeNodes((node) => {
            if (node.depth > 0) node.children = null;
        });
    }

    zoomBy(factor, duration = 300) {
        this.canvasWidget.zoomBy(factor, duration);
    }

    fitView(duration = 500, padding = 50, minScale = 0.25, maxScale = 0.88) {
        this.canvasWidget.fitView(this.root, duration, padding, minScale, maxScale, this._getExtraCanvasConfig());
    }

    updateZoomPercent(k) {
        this.canvasWidget.updateZoomPercent(k);
    }

    markNodeAsFocused(targetNode) {
        this.canvasWidget.markNodeAsFocused(targetNode, this.root, this._getExtraCanvasConfig());
    }

    clearFocusedNode() {
        this.canvasWidget.clearFocusedNode(this.root, this._getExtraCanvasConfig());
    }

    setMode(layoutMode, triggerUpdate = true) {
        this.setState({ mode: layoutMode });
        this.canvasWidget.setMode(
            layoutMode,
            triggerUpdate ? this.root : null,
            (source) => this.update(null, source)
        );
    }

    findNodeInTree(rootNode, targetIdentifier, targetContextId = null) {
        return GraphHierarchyBuilder.findNodeInTree(rootNode, targetIdentifier, targetContextId);
    }

    _expandPathToBean(targetBeanName, contextId = '') {
        return GraphHierarchyBuilder.expandPathToBean(
            this.root,
            targetBeanName,
            contextId,
            (n) => this._calculateNodeWidth(n),
            (r) => this.update(null, r)
        );
    }

    async focusOnBean(fullName, contextId = '', openSidebar = false) {
        if (!fullName) return;

        if (contextId && this.selectedContextId && this.selectedContextId !== contextId) {
            this.setState({ selectedContextId: contextId });
            const beans = this.service.accumulatedBeans.length > 0 ? this.service.accumulatedBeans : null;
            this._buildHierarchyFromDependencies(beans);
            this.update(null, null, 0);
            this._updateTotalBeanCount();
        }

        if (this.root) {
            let targetNode = this.findNodeInTree(this.root, fullName, contextId);
            if (!targetNode) {
                targetNode = this._expandPathToBean(fullName, contextId);
            }

            if (targetNode) {
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

                const isTopBottom = this.mode === 'tb';
                const { x: nodeX, y: nodeY } = targetNode;
                const targetX = isTopBottom ? nodeX : nodeY;
                const targetY = isTopBottom ? nodeY : nodeX;

                if (this.canvasWidget.canvasRenderer) {
                    const state = this.canvasWidget.canvasRenderer.nodeStates.get(targetNode.id);
                    if (state) {
                        state.x = targetX;
                        state.y = targetY;
                        state.startX = targetX;
                        state.startY = targetY;
                        state.targetX = targetX;
                        state.targetY = targetY;
                        state.opacity = 1;
                        state.targetOpacity = 1;
                        state.delay = 0;
                    }
                }

                this.markNodeAsFocused(targetNode);

                const beanGraphElem = document.getElementById('beanGraph');
                const width = beanGraphElem?.clientWidth || 800;
                const height = beanGraphElem?.clientHeight || 600;

                const zoomScale = 1.15;
                const translateX = width / 2 - targetX * zoomScale;
                const translateY = height / 2 - targetY * zoomScale;

                const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale);
                this.currentTransform = newTransform;
                d3.select(this.canvas).property('__zoom', newTransform);

                if (this.canvasWidget.canvasRenderer) {
                    this.canvasWidget.canvasRenderer.animateTransform(newTransform, 500, (k) => this.updateZoomPercent(k));
                } else {
                    this._renderCanvas();
                    this.updateZoomPercent(zoomScale);
                }

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

    async showBeanDetails(beanDetailsOrName, hierarchyNodeOrContextId) {
        let beanDetails = beanDetailsOrName;
        let hierarchyNode = null;
        let contextId = '';

        if (typeof beanDetailsOrName === 'string') {
            const beanName = beanDetailsOrName;
            contextId = typeof hierarchyNodeOrContextId === 'string' ? hierarchyNodeOrContextId : (this.selectedContextId || '');
            hierarchyNode = this.root ? this.findNodeInTree(this.root, beanName, contextId) : null;
            const fetched = await this.fetchBeanDetails(contextId, beanName);
            beanDetails = fetched || { beanName, contextId };
        } else if (beanDetailsOrName && typeof beanDetailsOrName === 'object') {
            beanDetails = beanDetailsOrName;
            hierarchyNode = hierarchyNodeOrContextId && typeof hierarchyNodeOrContextId === 'object' ? hierarchyNodeOrContextId : null;
            contextId = beanDetails.contextId || (typeof hierarchyNodeOrContextId === 'string' ? hierarchyNodeOrContextId : '') || '';
        }

        if (!beanDetails) return;

        const { dependencies = [], dependents = [] } = beanDetails;

        if (hierarchyNode) {
            this._mergeBeanDetailsIntoTree(hierarchyNode, beanDetails);
        }

        const formatted = this.sidebarWidget.formatDetails(beanDetails);
        const formattedDeps = this.sidebarWidget.formatDependencyItems(dependencies, contextId);
        const formattedDependents = this.sidebarWidget.formatDependencyItems(dependents, contextId);

        this.setState({
            selectedBean: beanDetails,
            selectedBeanFormatted: formatted,
            selectedBeanMeta: formatted?.meta || { icon: 'schema', color: '#8b5cf6' },
            sidebarDeps: formattedDeps,
            sidebarDependents: formattedDependents,
            sidebarTab: 'properties',
            sidebarOpen: true
        });

        this.canvasWidget.animateSidebarTransition(this.root, this._getExtraCanvasConfig());

        if (this.root) {
            const targetNode = hierarchyNode || this.findNodeInTree(this.root, beanDetails.beanName, contextId);
            if (targetNode) {
                this.markNodeAsFocused(targetNode);
                if (this.isHighlightPathActive) {
                    this.highlightPathForNode(targetNode);
                }
            }
        }
    }

    openSidebar() {
        this.setState({ sidebarOpen: true });
        this.canvasWidget.animateSidebarTransition(this.root, this._getExtraCanvasConfig());
    }

    closeSidebar() {
        this.setState({ sidebarOpen: false });
        this.canvasWidget.animateSidebarTransition(this.root, this._getExtraCanvasConfig());
    }

    setSidebarTab(tabName) {
        this.setState({ sidebarTab: tabName });
    }

    switchTab(tabName) {
        this.setSidebarTab(tabName);
    }

    selectDependency(dep) {
        const fullName = typeof dep === 'string' ? dep : dep?.fullName;
        const contextId = typeof dep === 'object' && dep.contextId ? dep.contextId : (this.selectedContextId || '');
        if (!fullName) return;

        this.focusOnBean(fullName, contextId, false);
        this.showBeanDetails(fullName, contextId);
    }

    async _handleNodeClick(event, node) {
        this.markNodeAsFocused(node);

        const { contextId, fullName, meta } = node.data;

        if (meta?.type === 'context') {
            this.closeSidebar();
            await this._handleToggleClick(event, node);
            return;
        }

        const details = await this.fetchBeanDetails(contextId, fullName);
        if (details) this._mergeBeanDetailsIntoTree(node, details);
        await this.selectNodeAndShowDetails(node, details);

        this.canvasWidget.hideTip();
    }

    async _handleToggleClick(event, node) {
        const { contextId, fullName, meta } = node.data;
        if (meta?.type !== 'context') {
            const details = await this.fetchBeanDetails(contextId, fullName);
            if (details) this._mergeBeanDetailsIntoTree(node, details);
        }

        if (!node._children || node._children.length === 0) {
            this._lazyLoadChildren(node);
        }

        node.children = node.children ? null : node._children;
        this.update(event, node);
        this.canvasWidget.hideTip();
    }

    onSearchInput(event) {
        const query = (event?.target?.value ?? this.searchQuery ?? '').trim();
        this.setState({ searchQuery: event?.target?.value ?? '' });

        if (!query) {
            this.setState({ showSuggestions: false, searchSuggestions: [], isSearching: false });
            this._debouncedSearch?.cancel();
            return;
        }

        this.setState({ showSuggestions: true, isSearching: true });
        this._debouncedSearch(query);
    }

    clearSearch() {
        this._debouncedSearch?.cancel();
        this.setState({
            searchQuery: '',
            showSuggestions: false,
            searchSuggestions: [],
            isSearching: false
        });
    }

    onSearchEnter() {
        this._debouncedSearch?.flush();
        if (this.searchSuggestions && this.searchSuggestions.length > 0) {
            this.selectSuggestion(this.searchSuggestions[0]);
        } else {
            const query = (this.searchQuery || '').trim();
            if (query) {
                this.focusOnBean(query, this.selectedContextId, false);
                this.closeSuggestions();
            }
        }
    }

    selectSuggestion(item) {
        this.clearSearch();
        if (item) {
            this.focusOnBean(item.fullName, item.contextId, false);
        }
    }

    closeSuggestions() {
        this.setState({ showSuggestions: false });
    }

    _bindCustomEventHandlers() {
        const themeHandler = () => {
            if (this.root) {
                this._renderCanvas();
            }
        };
        document.addEventListener('themechanged', themeHandler);
        this.addDisposable(() => document.removeEventListener('themechanged', themeHandler));

        const debouncedResize = AsyncUtils.debounce(() => {
            if (this.canvasWidget.canvasRenderer && this.root) {
                this._renderCanvas();
            }
        }, 150);
        window.addEventListener('resize', debouncedResize);
        this.addDisposable(() => {
            window.removeEventListener('resize', debouncedResize);
            debouncedResize.cancel?.();
        });

        const keyHandler = (event) => {
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                event.preventDefault();
                const searchInput = document.getElementById('search-input');
                searchInput?.focus();
            }
        };
        document.addEventListener('keydown', keyHandler);
        this.addDisposable(() => document.removeEventListener('keydown', keyHandler));
    }

    _expandVisibleNodes(maxDepth = 2) {
        if (!this.root) return;
        this.root.eachBefore(node => {
            if (node.depth < maxDepth) {
                if (!node._children || node._children.length === 0) {
                    this._lazyLoadChildren(node);
                }
                node.children = node._children;
            }
        });
        this.update(null, this.root);
        this.fitView(400);
    }

    _mutateTreeNodes(mutatorFn) {
        if (!this.root) return;
        this.root.eachBefore(mutatorFn);
        this.update(null, this.root);
        this.fitView();
    }

    _updateProgressBadge({ loaded = 0, total = 0, isComplete = false, hasError = false, errorMsg = '' } = {}) {
        const progressState = hasError ? 'error' : (isComplete ? 'complete' : 'loading');

        let text = '';
        if (hasError) {
            text = `Failed <span class="text-[11px] opacity-85">(${errorMsg || 'Retry'})</span>`;
        } else if (isComplete) {
            text = `Loaded (${loaded})`;
        } else {
            text = `Loading: ${loaded} / ${total}`;
        }

        this.setState({
            chunkProgress: {
                visible: !isComplete || loaded > 0,
                state: progressState,
                text,
                loaded,
                total
            }
        });

        if (isComplete) {
            setTimeout(() => {
                if (this.chunkProgress.state === 'complete') {
                    this.setState({
                        chunkProgress: {
                            ...this.chunkProgress,
                            visible: false
                        }
                    });
                }
            }, 3000);
        }
    }

    leave() {
        this.closeSidebar();
        this.clearFocusedNode();
        this.selectedNodeRef = null;
        this.clearSearch();
        this.canvasWidget.destroy();

        super.leave();
    }
}