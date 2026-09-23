import {
    GraphTreeBuilder,
    beanDataStore,
    httpClient,
    NH, RX, ICON, ZOOM_SCALE_EXTENT,
    GRAPH_NODE_THEMES_BADGE, QueryParam, ENDPOINTS
} from '../../helper/index.js';

export default class DefinitionGraphModalWidget {

    constructor(options = {}) {
        this.findBeanEndpoint = options.findBeanEndpoint || ENDPOINTS?.FIND_BEAN_DEFINITION;
        this.onSelectBean = options.onSelectBean;
        this.onTooltipChange = options.onTooltipChange;
        this.contextId = options.contextId || '';
        this.targetBean = null;

        this.modalGraphMode = 'lr';
        this.canvas = null;
        this.ctx = null;
        this.d3Zoom = null;
        this.currentTransform = (typeof d3 !== 'undefined') ? d3.zoomIdentity : { x: 0, y: 0, k: 1 };
        this.dpr = window.devicePixelRatio || 1;
        this.width = 800;
        this.height = 500;

        this.modalGraphData = null;
        this.modalGraphNodes = [];
        this.links = [];
        this.headers = [];
        this.hoveredNode = null;
        this.iconPath2D = (typeof Path2D !== 'undefined' && ICON) ? new Path2D(ICON) : null;

        this.resizeObserver = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.isDragging = false;
        this._windowCleanup = null;
    }

    get isReady() {
        return Boolean(this.canvas && this.ctx);
    }

    get hasNodes() {
        return this.modalGraphNodes.length > 0;
    }

    initCanvas() {
        const canvasElem = document.getElementById('modal-tree-canvas');
        if (!canvasElem) return false;
        if (this.canvas === canvasElem && this.ctx && canvasElem.isConnected) return true;

        this.canvas = canvasElem;
        this.ctx = canvasElem.getContext('2d');

        if (typeof d3 !== 'undefined') {
            this.d3Zoom = d3.zoom()
                .scaleExtent(ZOOM_SCALE_EXTENT || [0.05, 4])
                .on('zoom', ({ transform }) => {
                    this.currentTransform = transform;
                    if (this.hoveredNode) {
                        this.hoveredNode = null;
                        this.hideTooltip();
                    }
                    this.renderCurrent();
                })
                .on('end', () => {
                    this.isDragging = false;
                });
            d3.select(this.canvas).call(this.d3Zoom);
            d3.select(this.canvas).on('dblclick.zoom', null);
        }

        this.canvas.addEventListener('mousedown', (event) => {
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            this.isDragging = false;
        });

        this.canvas.addEventListener('mousemove', (event) => {
            if (event.buttons === 0) {
                this.isDragging = false;
            } else {
                const distance = Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY);
                if (distance > 5) {
                    this.isDragging = true;
                    if (this.hoveredNode) {
                        this.hoveredNode = null;
                        this.hideTooltip();
                        this.renderCurrent();
                    }
                    return;
                }
            }
            if (this.isDragging) return;
            this._handleMouseMove(event);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.hoveredNode = null;
            this.hideTooltip();
            this.renderCurrent();
        });

        this.canvas.addEventListener('click', (event) => {
            if (this.isDragging) {
                this.isDragging = false;
                return;
            }
            this._handleClick(event);
        });

        if (this._windowCleanup) {
            this._windowCleanup();
        }
        const onDragRelease = () => {
            this.isDragging = false;
        };
        window.addEventListener('mouseup', onDragRelease);
        window.addEventListener('pointerup', onDragRelease);
        this._windowCleanup = () => {
            window.removeEventListener('mouseup', onDragRelease);
            window.removeEventListener('pointerup', onDragRelease);
        };

        const container = document.getElementById('modal-graph-container');
        if (container && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver?.disconnect();
            this.resizeObserver = new ResizeObserver((entries) => {
                const entry = entries?.[0];
                const width = entry?.contentRect?.width || container.clientWidth;
                const height = entry?.contentRect?.height || container.clientHeight;
                if (width > 0 && height > 0) {
                    const needsFit = (this.width === 0 || this.width === 800 || Math.abs(this.width - width) > 10);
                    this.resize(width, height);
                    if (needsFit && this.modalGraphNodes?.length > 0) {
                        this.fitView();
                    }
                }
            });
            this.resizeObserver.observe(container);
        }

        return true;
    }

    async open(targetBean) {
        this.render(targetBean);
        await this._prefetchRelatedBeans(targetBean);
    }

    close() {
        this.hoveredNode = null;
        this.isDragging = false;
        this.hideTooltip();
    }

    render(targetBean) {
        this.hoveredNode = null;
        this.isDragging = false;
        this.hideTooltip();
        this.initCanvas();
        this.targetBean = targetBean;
        this.contextId = targetBean?.contextId || this.contextId;

        const rawData = GraphTreeBuilder.buildModalGraphHierarchy(
            targetBean,
            (depName, ctxId) => beanDataStore.findBeanByName(depName, ctxId || this.contextId)
        );
        this.modalGraphData = rawData;
        this._computeLayout(rawData);
        this.resize();
        this.renderCurrent();
        requestAnimationFrame(() => this.fitView());
    }

    renderCurrent() {
        if (!this.isReady) return;

        const isDark = document.documentElement.classList.contains('dark');

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.translate(this.currentTransform.x, this.currentTransform.y);
        this.ctx.scale(this.currentTransform.k, this.currentTransform.k);

        this._drawScene(this.ctx, isDark, this.hoveredNode);
        this.ctx.restore();
    }

    setMode(mode) {
        if (this.modalGraphMode === mode) return;
        this.modalGraphMode = mode;

        if (this.modalGraphData) {
            this._computeLayout(this.modalGraphData);
            this.renderCurrent();
            this.fitView();
        }
    }

    fitView() {
        if (!this.isReady || !this.d3Zoom || !this.hasNodes) return;

        const width = this.width || 800;
        const height = this.height || 500;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const node of this.modalGraphNodes) {
            const left = node.x - (node.width || 180) / 2;
            const right = node.x + (node.width || 180) / 2;
            const top = node.y - NH / 2 - 32;
            const bottom = node.y + NH / 2 + 10;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;
        }

        if (!Number.isFinite(minX)) return;

        const graphWidth = Math.max(1, maxX - minX);
        const graphHeight = Math.max(1, maxY - minY);

        let scale = Math.min(0.9, Math.min((width - 60) / graphWidth, (height - 60) / graphHeight));
        if (isNaN(scale) || !isFinite(scale) || scale <= 0) scale = 1;

        const translateX = width / 2 - ((minX + maxX) / 2) * scale;
        const translateY = height / 2 - ((minY + maxY) / 2) * scale;

        if (isNaN(translateX) || isNaN(translateY) || !isFinite(translateX) || !isFinite(translateY)) return;

        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
        d3.select(this.canvas).transition().duration(400).call(this.d3Zoom.transform, transform);
    }

    zoom(scaleFactor) {
        if (this.canvas && this.d3Zoom) {
            d3.select(this.canvas).transition().duration(300).call(this.d3Zoom.scaleBy, scaleFactor);
        }
    }

    resize(customWidth, customHeight) {
        const container = document.getElementById('modal-graph-container');
        if (!container || !this.canvas) return;

        const width = customWidth || container.clientWidth;
        const height = customHeight || container.clientHeight;
        if (width === 0 || height === 0) return;

        this.width = width;
        this.height = height;
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.renderCurrent();
    }

    async exportPNG({ pixelRatio = 2 } = {}) {
        if (!this.hasNodes) return null;

        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const node of this.modalGraphNodes) {
            const left = node.x - (node.width || 180) / 2;
            const right = node.x + (node.width || 180) / 2;
            const top = node.y - NH / 2 - 32;
            const bottom = node.y + NH / 2 + 10;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;
        }

        if (!Number.isFinite(minX)) return null;

        const padding = 60;
        const contentWidth = Math.max(200, maxX - minX + padding * 2);
        const contentHeight = Math.max(160, maxY - minY + padding * 2);

        const maxDimension = 16384;
        let dpr = Math.max(1, pixelRatio);
        if (contentWidth * dpr > maxDimension || contentHeight * dpr > maxDimension) {
            dpr = Math.min(maxDimension / contentWidth, maxDimension / contentHeight);
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = Math.round(contentWidth * dpr);
        exportCanvas.height = Math.round(contentHeight * dpr);

        const exportCtx = exportCanvas.getContext('2d');
        if (!exportCtx) return null;

        exportCtx.fillStyle = bgColor;
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        exportCtx.scale(dpr, dpr);
        exportCtx.translate(-(minX - padding), -(minY - padding));

        this._drawScene(exportCtx, isDark, null);

        exportCtx.save();
        exportCtx.setTransform(1, 0, 0, 1, 0, 0);
        exportCtx.font = '500 ' + Math.max(10, Math.round(11 * (dpr > 1.5 ? 1.5 : dpr))) + 'px Inter, -apple-system, sans-serif';
        exportCtx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)';
        exportCtx.textAlign = 'right';
        exportCtx.textBaseline = 'bottom';
        const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        const targetName = this.modalGraphData?.target?.name || 'Bean';
        exportCtx.fillText(`SpringLens Bean Dependency Graph • ${targetName} • ${dateStr}`, exportCanvas.width - 20, exportCanvas.height - 16);
        exportCtx.restore();

        return new Promise((resolve) => {
            exportCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    destroy() {
        this.close();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        if (this._windowCleanup) {
            this._windowCleanup();
            this._windowCleanup = null;
        }
        this.modalGraphData = null;
        this.modalGraphNodes = [];
        this.links = [];
        this.headers = [];
        this.canvas = null;
        this.ctx = null;
        this.d3Zoom = null;
    }

    _resolveContextId(targetBean) {
        return targetBean?.contextId || this.contextId || '';
    }

    async _prefetchRelatedBeans(targetBean) {
        if (!this.findBeanEndpoint) return;

        const ctxId = this._resolveContextId(targetBean);
        const relatedNames = [...(targetBean.dependencies || []), ...(targetBean.dependents || [])];
        const missingNames = relatedNames.filter(name => !beanDataStore.findBeanByName(name, ctxId));

        if (missingNames.length > 0) {
            try {
                const fetchPromises = missingNames.map(async (name) => {
                    const query = new URLSearchParams({ contextId: ctxId, beanName: name }).toString();
                    return httpClient.getWithQuery(this.findBeanEndpoint, query);
                });

                const results = await Promise.allSettled(fetchPromises);
                const fetchedBeans = results.flatMap(r =>
                    (r.status === 'fulfilled' && r.value) ? [r.value] : []
                );

                if (fetchedBeans.length > 0) {
                    beanDataStore.addBeans(fetchedBeans);
                }
            } catch (error) {
                console.warn('Failed to pre-fetch related bean details:', error);
            }
        }
    }

    _computeLayout(graphData) {
        if (!graphData?.target) return;

        const { target, dependencies = [], dependents = [] } = graphData;
        const isTB = this.modalGraphMode === 'tb';
        const isDark = document.documentElement.classList.contains('dark');

        const measureWidth = (node) => {
            const nameLen = node?.name?.length || 0;
            return Math.max(180, nameLen * 7.8 + 64);
        };

        target.width = measureWidth(target);
        target.id = 'target-node';

        dependencies.forEach((node, i) => {
            node.id = `dep-${i}`;
            node.width = measureWidth(node);
        });

        dependents.forEach((node, i) => {
            node.id = `dependent-${i}`;
            node.width = measureWidth(node);
        });

        this.headers = [];
        const depNodes = dependencies;
        const dependentNodes = dependents;

        if (isTB) {
            target.x = 0;
            target.y = 0;

            const nodeGap = 28;
            const vGap = 80;
            const depRowY = -(NH / 2) - vGap - (NH / 2);
            const dependentRowY = (NH / 2) + vGap + (NH / 2);

            if (depNodes.length > 0) {
                const depTotalW = depNodes.reduce((sum, d) => sum + d.width, 0) + (depNodes.length - 1) * nodeGap;
                let curDepX = -depTotalW / 2;
                depNodes.forEach((node) => {
                    node.x = curDepX + node.width / 2;
                    node.y = depRowY;
                    curDepX += node.width + nodeGap;
                });
                this.headers.push({
                    text: `DEPENDENCIES (${dependencies.length})`,
                    x: 0,
                    y: depRowY - NH / 2 - 22,
                    color: isDark ? '#34d399' : '#059669'
                });
            }

            this.headers.push({
                text: 'TARGET BEAN',
                x: 0,
                y: target.y - NH / 2 - 22,
                color: isDark ? '#60a5fa' : '#2563eb'
            });

            if (dependentNodes.length > 0) {
                const dependentTotalW = dependentNodes.reduce((sum, d) => sum + d.width, 0) + (dependentNodes.length - 1) * nodeGap;
                let curDependentX = -dependentTotalW / 2;
                dependentNodes.forEach((node) => {
                    node.x = curDependentX + node.width / 2;
                    node.y = dependentRowY;
                    curDependentX += node.width + nodeGap;
                });
                this.headers.push({
                    text: `DEPENDENTS (${dependents.length})`,
                    x: 0,
                    y: dependentRowY - NH / 2 - 22,
                    color: isDark ? '#c084fc' : '#9333ea'
                });
            }
        } else {
            target.x = 0;
            target.y = 0;

            const hGap = 110;
            const rowHeight = NH + 22;

            if (depNodes.length > 0) {
                const maxDepWidth = Math.max(...depNodes.map(d => d.width), 180);
                const depColCenterX = -(target.width / 2) - hGap - (maxDepWidth / 2);
                const depTotalH = (depNodes.length - 1) * rowHeight;
                depNodes.forEach((node, i) => {
                    node.x = depColCenterX;
                    node.y = -depTotalH / 2 + i * rowHeight;
                });
                const minDepY = Math.min(...depNodes.map(d => d.y));
                this.headers.push({
                    text: `DEPENDENCIES (${dependencies.length})`,
                    x: depColCenterX,
                    y: minDepY - NH / 2 - 22,
                    color: isDark ? '#34d399' : '#059669'
                });
            }

            this.headers.push({
                text: 'TARGET BEAN',
                x: 0,
                y: target.y - NH / 2 - 22,
                color: isDark ? '#60a5fa' : '#2563eb'
            });

            if (dependentNodes.length > 0) {
                const maxDependentWidth = Math.max(...dependentNodes.map(d => d.width), 180);
                const dependentColCenterX = (target.width / 2) + hGap + (maxDependentWidth / 2);
                const dependentTotalH = (dependents.length - 1) * rowHeight;
                dependentNodes.forEach((node, i) => {
                    node.x = dependentColCenterX;
                    node.y = -dependentTotalH / 2 + i * rowHeight;
                });
                const minDependentY = Math.min(...dependentNodes.map(d => d.y));
                this.headers.push({
                    text: `DEPENDENTS (${dependents.length})`,
                    x: dependentColCenterX,
                    y: minDependentY - NH / 2 - 22,
                    color: isDark ? '#c084fc' : '#9333ea'
                });
            }
        }

        this.links = [];
        dependencies.forEach(dep => {
            this.links.push({
                source: dep,
                target: target,
                kind: 'dependency'
            });
        });
        dependents.forEach(dependent => {
            this.links.push({
                source: target,
                target: dependent,
                kind: 'dependent'
            });
        });

        this.modalGraphNodes = [target, ...dependencies, ...dependents];
    }

    _drawScene(ctx, isDark, hoveredNode = null) {
        const isTB = this.modalGraphMode === 'tb';

        for (const header of this.headers) {
            ctx.save();
            ctx.font = '700 11px Inter, -apple-system, sans-serif';
            ctx.fillStyle = header.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(header.text, header.x, header.y);
            ctx.restore();
        }

        for (const link of this.links) {
            const isDependency = link.kind === 'dependency';
            const strokeColor = isDependency
                ? (isDark ? '#34d399' : '#059669')
                : (isDark ? '#c084fc' : '#9333ea');

            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = strokeColor;
            ctx.lineWidth = 1.8;
            ctx.globalAlpha = 0.85;

            let sx, sy, tx, ty, mx, my;
            if (isTB) {
                sx = link.source.x;
                sy = link.source.y + NH / 2;
                tx = link.target.x;
                ty = link.target.y - NH / 2;
                my = (sy + ty) / 2;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(sx, my, tx, my, tx, ty);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx - 4.5, ty - 8);
                ctx.lineTo(tx + 4.5, ty - 8);
                ctx.closePath();
                ctx.fill();
            } else {
                sx = link.source.x + link.source.width / 2;
                sy = link.source.y;
                tx = link.target.x - link.target.width / 2;
                ty = link.target.y;
                mx = (sx + tx) / 2;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(mx, sy, mx, ty, tx, ty);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx - 8, ty - 4.5);
                ctx.lineTo(tx - 8, ty + 4.5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        const mode = isDark ? 'dark' : 'light';
        const modeMap = GRAPH_NODE_THEMES_BADGE?.[mode] || GRAPH_NODE_THEMES_BADGE.light;

        for (const node of this.modalGraphNodes) {
            const kind = node?.meta?.kind || (node.id === 'target-node' ? 'target' : 'default');
            const style = modeMap[kind] || modeMap.default;
            const isHovered = (hoveredNode === node);
            const isTarget = (node.id === 'target-node');
            const x = node.x - node.width / 2;
            const y = node.y - NH / 2;

            ctx.save();
            ctx.beginPath();
            this._roundRect(ctx, x, y, node.width, NH, RX);
            ctx.fillStyle = style.fill || (isDark ? '#0f172a' : '#ffffff');
            ctx.fill();

            ctx.lineWidth = isTarget ? 2.5 : (isHovered ? 2.4 : 1.8);
            ctx.strokeStyle = style.stroke || '#3b82f6';
            if (isHovered) {
                ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.18)';
                ctx.shadowBlur = 10;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            this._roundRect(ctx, x + 8, node.y - 14, 28, 28, 8);
            ctx.fillStyle = style.iconBg || (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)');
            ctx.fill();

            if (this.iconPath2D) {
                ctx.save();
                ctx.translate(x + 14, node.y - 10);
                ctx.scale(0.85, 0.85);
                ctx.strokeStyle = style.icon || style.stroke || '#3b82f6';
                ctx.lineWidth = 1.8;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke(this.iconPath2D);
                ctx.restore();
            }

            ctx.fillStyle = style.text || (isDark ? '#f1f5f9' : '#1e293b');
            ctx.font = '600 13px Inter, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name || '', x + 44, node.y + 1);

            ctx.restore();
        }
    }

    _roundRect(ctx, x, y, width, height, radius) {
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, width, height, radius);
        } else {
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x + radius, y);
            ctx.quadraticCurveTo(x, y + radius, x, y);
            ctx.closePath();
        }
    }

    _handleMouseMove(event) {
        if (!this.hasNodes) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? (this.width / rect.width) : 1;
        const scaleY = rect.height > 0 ? (this.height / rect.height) : 1;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        let worldX = mouseX;
        let worldY = mouseY;
        if (this.currentTransform && typeof this.currentTransform.invert === 'function') {
            [worldX, worldY] = this.currentTransform.invert([mouseX, mouseY]);
        }

        const hitNode = this._findNodeAt(worldX, worldY);

        if (hitNode) {
            this.canvas.style.cursor = 'pointer';

            if (this.hoveredNode !== hitNode) {
                this.hoveredNode = hitNode;
                this.renderCurrent();
                this._emitNodeTooltip(hitNode);
            }
        } else {
            this.canvas.style.cursor = '';
            if (this.hoveredNode !== null) {
                this.hoveredNode = null;
                this.hideTooltip();
                this.renderCurrent();
            }
        }
    }

    _emitNodeTooltip(node) {
        const container = document.getElementById('modal-graph-container');
        const containerWidth = container?.clientWidth || this.width || 800;
        const containerHeight = container?.clientHeight || this.height || 600;

        const screenX = node.x * this.currentTransform.k + this.currentTransform.x;
        const screenY = node.y * this.currentTransform.k + this.currentTransform.y;
        const halfHeight = (NH / 2) * this.currentTransform.k;
        const nodeSpacing = 14;

        const isNearBottom = (screenY + halfHeight + nodeSpacing + 140 > containerHeight);
        const tipY = isNearBottom
            ? Math.round(screenY - halfHeight - nodeSpacing)
            : Math.round(screenY + halfHeight + nodeSpacing);
        const placement = isNearBottom ? 'top' : 'bottom';
        const clampedX = Math.max(160, Math.min(containerWidth - 160, Math.round(screenX)));

        const name = node.fullName || node.name || node.data?.name || '-';
        const ctxId = this._resolveContextId(this.targetBean);
        const storedBean = beanDataStore.findBeanByName(name, ctxId) || beanDataStore.findBeanByName(name);

        const nodeMeta = node.meta || node.data?.meta || {};
        const type = (storedBean?.type && storedBean.type !== 'N/A') ? storedBean.type : nodeMeta.type;
        const scope = (storedBean?.scope && storedBean.scope !== 'N/A') ? storedBean.scope : nodeMeta.scope;
        const role = (storedBean?.role && storedBean.role !== 'N/A') ? storedBean.role : nodeMeta.role;
        const kind = nodeMeta.kind;

        const shortType = type && type !== 'N/A' ? (type.includes('.') ? type.slice(type.lastIndexOf('.') + 1) : type) : '-';
        const cleanRole = role && role !== 'N/A' ? role.replace(/^ROLE_/, '') : '-';
        const displayScope = scope && scope !== 'N/A' ? scope : '-';

        const kindMap = {
            target: {
                label: 'Target',
                badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
            },
            dependency: {
                label: 'Depends On',
                badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            },
            dependent: {
                label: 'Used By',
                badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
            }
        };

        const kindInfo = kindMap[kind] || {
            label: kind ? kind.toUpperCase() : '',
            badgeClass: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/30'
        };

        const tipEl = document.getElementById('modal-graph-tooltip');
        if (tipEl) {
            tipEl.style.left = `${clampedX}px`;
            tipEl.style.top = `${tipY}px`;
            tipEl.style.transform = `translate(-50%, ${placement === 'bottom' ? '0%' : '-100%'})`;
            tipEl.style.display = 'flex';
            tipEl.style.opacity = '1';
            tipEl.style.visibility = 'visible';
            tipEl.style.pointerEvents = 'none';

            const nameEl = document.getElementById('modal-tip-name');
            if (nameEl) nameEl.textContent = name;

            const typeEl = document.getElementById('modal-tip-type');
            if (typeEl) typeEl.textContent = shortType;

            const scopeEl = document.getElementById('modal-tip-scope');
            if (scopeEl) scopeEl.textContent = displayScope;

            const roleEl = document.getElementById('modal-tip-role');
            if (roleEl) roleEl.textContent = cleanRole;

            const kindEl = document.getElementById('modal-tip-kind');
            if (kindEl) {
                kindEl.textContent = kindInfo.label || '';
                kindEl.className = `${kindInfo.badgeClass || ''} px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold`;
                kindEl.style.display = kindInfo.label ? 'inline-block' : 'none';
            }

            const metaEl = document.getElementById('modal-tip-meta');
            if (metaEl) {
                metaEl.textContent = kindInfo.label ? `Role in view: ${kindInfo.label.toUpperCase()}` : '';
                metaEl.style.display = kindInfo.label ? 'block' : 'none';
            }

            const loadingEl = document.getElementById('modal-tip-loading');
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }

        this.onTooltipChange?.({
            visible: true,
            x: clampedX,
            y: tipY,
            placement,
            name,
            type: shortType,
            scope: displayScope,
            role: cleanRole,
            kind: kindInfo.label,
            kindClass: kindInfo.badgeClass,
            meta: kindInfo.label ? `Role in view: ${kindInfo.label.toUpperCase()}` : '',
            loading: false
        });
    }

    showTooltip(event, node) {
        this._emitNodeTooltip(node);
    }

    hideTooltip() {
        this.hoveredNode = null;
        const tipEl = document.getElementById('modal-graph-tooltip');
        if (tipEl) {
            tipEl.style.display = 'none';
        }
        this.onTooltipChange?.({ visible: false });
    }

    _handleClick(event) {
        if (!this.hasNodes) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? (this.width / rect.width) : 1;
        const scaleY = rect.height > 0 ? (this.height / rect.height) : 1;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        let worldX = mouseX;
        let worldY = mouseY;
        if (this.currentTransform && typeof this.currentTransform.invert === 'function') {
            [worldX, worldY] = this.currentTransform.invert([mouseX, mouseY]);
        }

        const hitNode = this._findNodeAt(worldX, worldY);
        if (hitNode?.fullName) {
            this.onSelectBean?.(hitNode.fullName);
        }
    }

    _findNodeAt(worldX, worldY) {
        for (let i = this.modalGraphNodes.length - 1; i >= 0; i--) {
            const node = this.modalGraphNodes[i];
            const halfWidth = (node.width || 180) / 2;
            const halfHeight = NH / 2;

            if (
                worldX >= node.x - halfWidth - 4 &&
                worldX <= node.x + halfWidth + 4 &&
                worldY >= node.y - halfHeight - 4 &&
                worldY <= node.y + halfHeight + 4
            ) {
                return node;
            }
        }

        return null;
    }
}
