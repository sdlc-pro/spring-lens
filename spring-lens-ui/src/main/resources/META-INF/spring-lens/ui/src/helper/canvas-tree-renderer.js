import { NH, NW, RX, ICON } from './constants.js';
import { nodeStyle } from './utils.js';

/**
 * High-performance HTML5 Canvas renderer for D3 collapsible dependency trees.
 * Capable of rendering 10,000+ nodes at 60 FPS with smooth requestAnimationFrame
 * transition animations matching SVG physics (springy cubic-out expansion/collapse).
 */
export default class CanvasTreeRenderer {

    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement?.getContext('2d');
        this.options = options;

        this.width = 800;
        this.height = 600;
        this.dpr = window.devicePixelRatio || 1;

        this.onNodeClick = options.onNodeClick || (() => {});
        this.onToggleClick = options.onToggleClick || (() => {});
        this.onNodeHover = options.onNodeHover || (() => {});
        this.onNodeLeave = options.onNodeLeave || (() => {});

        this.hoveredNode = null;
        this.currentTransform = d3.zoomIdentity;
        this.currentRoot = null;
        this.currentConfig = {};

        // Node animation state tracking: id -> { id, node, x, y, opacity, startX, startY, startOpacity, targetX, targetY, targetOpacity, isExiting }
        this.nodeStates = new Map();
        this.animFrameId = null;
        this.transformAnimFrameId = null;

        this._iconPath2D = null;
        if (typeof Path2D !== 'undefined') {
            try {
                this._iconPath2D = new Path2D(ICON);
            } catch (e) {
                this._iconPath2D = null;
            }
        }

        this._bindEvents();
    }

    resize(width, height) {
        if (!this.canvas || !this.ctx) return;
        this.width = width;
        this.height = height;
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);

        if (!this.animFrameId && this.currentRoot) {
            this._drawCanvasFrame();
        }
    }

    /**
     * Smoothly animates expanding, collapsing, and moving nodes using requestAnimationFrame.
     */
    animateTransition(root, transform, config = {}, source = null, duration = 650) {
        if (!this.canvas || !this.ctx || !root) return;

        this.currentRoot = root;
        this.currentTransform = transform || this.currentTransform;
        this.currentConfig = config;

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        const isTB = config.mode === 'tb';
        const currentDescendants = root.descendants();
        const currentIdSet = new Set();

        // If no prior state existed or instant duration requested, initialize directly
        if (this.nodeStates.size === 0 || duration <= 0) {
            this.render(root, this.currentTransform, config);
            return;
        }

        const srcNode = source || root;
        const srcCx = isTB ? (srcNode.x0 ?? srcNode.x ?? 0) : (srcNode.y0 ?? srcNode.y ?? 0);
        const srcCy = isTB ? (srcNode.y0 ?? srcNode.y ?? 0) : (srcNode.x0 ?? srcNode.x ?? 0);
        const srcTargetCx = isTB ? (srcNode.x ?? 0) : (srcNode.y ?? 0);
        const srcTargetCy = isTB ? (srcNode.y ?? 0) : (srcNode.x ?? 0);

        // 1. Process current visible / entering nodes
        for (let i = 0; i < currentDescendants.length; i++) {
            const node = currentDescendants[i];
            currentIdSet.add(node.id);

            const targetCx = isTB ? node.x : node.y;
            const targetCy = isTB ? node.y : node.x;

            let state = this.nodeStates.get(node.id);
            if (state) {
                // Continuing node: interpolate from current rendered position
                state.node = node;
                state.startX = state.x;
                state.startY = state.y;
                state.startOpacity = state.opacity;
                state.targetX = targetCx;
                state.targetY = targetCy;
                state.targetOpacity = 1;
                state.isExiting = false;
            } else {
                // Entering node: starts from parent or clicked source position with opacity 0
                const parentState = node.parent ? this.nodeStates.get(node.parent.id) : null;
                const startX = parentState ? parentState.x : srcCx;
                const startY = parentState ? parentState.y : srcCy;

                this.nodeStates.set(node.id, {
                    id: node.id,
                    node: node,
                    x: startX,
                    y: startY,
                    opacity: 0,
                    startX: startX,
                    startY: startY,
                    startOpacity: 0,
                    targetX: targetCx,
                    targetY: targetCy,
                    targetOpacity: 1,
                    isExiting: false
                });
            }
        }

        // 2. Process exiting nodes: collapsing back into parent or source position with opacity fading to 0
        for (const [id, state] of this.nodeStates.entries()) {
            if (!currentIdSet.has(id)) {
                const parentState = state.node?.parent ? this.nodeStates.get(state.node.parent.id) : null;
                const destX = parentState ? parentState.targetX : srcTargetCx;
                const destY = parentState ? parentState.targetY : srcTargetCy;

                state.startX = state.x;
                state.startY = state.y;
                state.startOpacity = state.opacity;
                state.targetX = destX;
                state.targetY = destY;
                state.targetOpacity = 0;
                state.isExiting = true;
            }
        }

        // 3. requestAnimationFrame tick with cubic-out deceleration easing
        const startTime = performance.now();

        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, Math.max(0, elapsed / duration));
            // Natural cubic deceleration curve
            const t = 1 - Math.pow(1 - progress, 3);

            for (const state of this.nodeStates.values()) {
                state.x = state.startX + (state.targetX - state.startX) * t;
                state.y = state.startY + (state.targetY - state.startY) * t;
                state.opacity = state.startOpacity + (state.targetOpacity - state.startOpacity) * t;
            }

            this._drawCanvasFrame();

            if (progress < 1) {
                this.animFrameId = requestAnimationFrame(tick);
            } else {
                this.animFrameId = null;
                // Remove exiting nodes
                for (const [id, state] of this.nodeStates.entries()) {
                    if (state.isExiting) {
                        this.nodeStates.delete(id);
                    } else {
                        state.x = state.targetX;
                        state.y = state.targetY;
                        state.opacity = 1;
                    }
                }
                this._drawCanvasFrame();
            }
        };

        this.animFrameId = requestAnimationFrame(tick);
    }

    /**
     * Smoothly animates zoom & pan transitions on Canvas.
     */
    animateTransform(targetTransform, duration = 400, onUpdate = null) {
        if (!this.canvas || !this.ctx) return;

        if (this.transformAnimFrameId) {
            cancelAnimationFrame(this.transformAnimFrameId);
            this.transformAnimFrameId = null;
        }

        if (duration <= 0) {
            this.currentTransform = targetTransform;
            if (onUpdate) onUpdate(targetTransform.k);
            this._drawCanvasFrame();
            return;
        }

        const startX = this.currentTransform.x;
        const startY = this.currentTransform.y;
        const startK = this.currentTransform.k;
        const targetX = targetTransform.x;
        const targetY = targetTransform.y;
        const targetK = targetTransform.k;

        const startTime = performance.now();

        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, Math.max(0, elapsed / duration));
            const t = 1 - Math.pow(1 - progress, 3);

            const curX = startX + (targetX - startX) * t;
            const curY = startY + (targetY - startY) * t;
            const curK = startK + (targetK - startK) * t;

            this.currentTransform = d3.zoomIdentity.translate(curX, curY).scale(curK);
            if (onUpdate) onUpdate(curK);

            this._drawCanvasFrame();

            if (progress < 1) {
                this.transformAnimFrameId = requestAnimationFrame(tick);
            } else {
                this.transformAnimFrameId = null;
                this.currentTransform = targetTransform;
                if (onUpdate) onUpdate(targetK);
                this._drawCanvasFrame();
            }
        };

        this.transformAnimFrameId = requestAnimationFrame(tick);
    }

    /**
     * Immediate static render (used for mouse move, hover, and immediate redraws).
     */
    render(root, transform, config = {}) {
        if (!this.canvas || !this.ctx || !root) return;

        this.currentRoot = root;
        this.currentTransform = transform || this.currentTransform;
        this.currentConfig = config;

        // If animation is in progress, simply re-draw current frame with updated transform/config
        if (this.animFrameId) {
            this._drawCanvasFrame();
            return;
        }

        // Synchronize static positions
        const isTB = config.mode === 'tb';
        const descendants = root.descendants();
        const activeIds = new Set();

        for (let i = 0; i < descendants.length; i++) {
            const node = descendants[i];
            activeIds.add(node.id);
            const cx = isTB ? node.x : node.y;
            const cy = isTB ? node.y : node.x;

            let state = this.nodeStates.get(node.id);
            if (state) {
                state.node = node;
                state.x = cx;
                state.y = cy;
                state.opacity = 1;
                state.targetX = cx;
                state.targetY = cy;
                state.targetOpacity = 1;
                state.isExiting = false;
            } else {
                this.nodeStates.set(node.id, {
                    id: node.id,
                    node: node,
                    x: cx,
                    y: cy,
                    opacity: 1,
                    startX: cx,
                    startY: cy,
                    startOpacity: 1,
                    targetX: cx,
                    targetY: cy,
                    targetOpacity: 1,
                    isExiting: false
                });
            }
        }

        // Clean up unmounted states
        for (const id of this.nodeStates.keys()) {
            if (!activeIds.has(id)) {
                this.nodeStates.delete(id);
            }
        }

        this._drawCanvasFrame();
    }

    _drawCanvasFrame() {
        if (!this.canvas || !this.ctx) return;

        const ctx = this.ctx;
        const dpr = this.dpr;
        const config = this.currentConfig;
        const isTB = config.mode === 'tb';
        const isDark = document.documentElement.classList.contains('dark');
        const nodeTheme = config.nodeTheme || 'tint';
        const isHighlightActive = config.isHighlightPathActive && config.selectedNodeRef;

        // Clear canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply Retina scaling and zoom transform
        ctx.scale(dpr, dpr);
        ctx.translate(this.currentTransform.x, this.currentTransform.y);
        ctx.scale(this.currentTransform.k, this.currentTransform.k);

        // 1. Draw connecting bezier curves (active and exiting)
        this._drawAnimatedLinks(ctx, isTB, isDark, isHighlightActive, config);

        // 2. Draw nodes (active and exiting)
        this._drawAnimatedNodes(ctx, isTB, isDark, nodeTheme, config);
    }

    _drawAnimatedLinks(ctx, isTB, isDark, isHighlightActive, config) {
        if (!this.currentRoot) return;

        const defaultColor = isDark ? '#334155' : '#cbd5e1';
        const highlightColor = isDark ? '#60a5fa' : '#3b82f6';

        // 1. Draw links between visible hierarchy nodes
        const links = this.currentRoot.links();
        const linkCount = links.length;

        for (let i = 0; i < linkCount; i++) {
            const link = links[i];
            const sourceState = this.nodeStates.get(link.source.id);
            const targetState = this.nodeStates.get(link.target.id);
            if (!sourceState || !targetState) continue;

            const alpha = Math.min(sourceState.opacity, targetState.opacity);
            if (alpha <= 0.001) continue;

            const isHighlighted = isHighlightActive && config.isLinkHighlighted?.(link);
            const isDimmed = isHighlightActive && !isHighlighted;
            const strokeColor = isHighlighted ? highlightColor : defaultColor;
            const baseLineWidth = isHighlighted ? 2.8 : (isDimmed ? 1.2 : 1.6);
            const baseAlpha = isHighlighted ? 1 : (isDimmed ? 0.12 : 0.85);

            this._drawSingleCurve(ctx, sourceState, targetState, link.source, link.target, isTB, strokeColor, baseLineWidth, alpha * baseAlpha);
        }

        // 2. Draw links for exiting nodes (smoothly collapsing back into their parent)
        for (const targetState of this.nodeStates.values()) {
            if (!targetState.isExiting) continue;
            const parent = targetState.node?.parent;
            if (!parent) continue;

            const sourceState = this.nodeStates.get(parent.id);
            if (!sourceState) continue;

            const alpha = targetState.opacity;
            if (alpha <= 0.001) continue;

            this._drawSingleCurve(ctx, sourceState, targetState, parent, targetState.node, isTB, defaultColor, 1.4, alpha * 0.7);
        }
    }

    _drawSingleCurve(ctx, sourceState, targetState, sourceNode, targetNode, isTB, strokeColor, lineWidth, alpha) {
        ctx.save();
        ctx.beginPath();

        let sx, sy, tx, ty, mx, my;

        if (isTB) {
            sx = sourceState.x;
            sy = sourceState.y + NH / 2;
            tx = targetState.x;
            ty = targetState.y - NH / 2;
            my = (sy + ty) / 2;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(sx, my, tx, my, tx, ty);
        } else {
            const sWidth = sourceNode.width || NW;
            const tWidth = targetNode.width || NW;
            sx = sourceState.x + sWidth / 2;
            sy = sourceState.y;
            tx = targetState.x - tWidth / 2;
            ty = targetState.y;
            mx = (sx + tx) / 2;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(mx, sy, mx, ty, tx, ty);
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.stroke();

        // Terminal circle on target end
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();

        ctx.restore();
    }

    _drawAnimatedNodes(ctx, isTB, isDark, nodeTheme, config) {
        const isBadge = (nodeTheme === 'badge');
        const focusedFullName = config.focusedNodeFullName;
        const isHighlightActive = config.isHighlightPathActive && config.selectedNodeRef;

        for (const state of this.nodeStates.values()) {
            if (state.opacity <= 0.001) continue;

            const node = state.node;
            const style = nodeStyle(node, nodeTheme);
            const width = node.width || NW;
            const height = NH;

            const cx = state.x;
            const cy = state.y;
            const x = cx - width / 2;
            const y = cy - height / 2;

            const isFocused = Boolean(
                focusedFullName && (
                    node.data?.fullName === focusedFullName ||
                    node.data?.name === focusedFullName
                )
            );

            const isNodeHighlighted = !isHighlightActive || config.isNodeHighlighted?.(node);
            const isDimmed = isHighlightActive && !isNodeHighlighted;

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, state.opacity * (isDimmed ? 0.15 : 1)));

            // 1. Card background
            ctx.beginPath();
            this._roundRect(ctx, x, y, width, height, RX);
            ctx.fillStyle = style.fill || (isDark ? '#0f172a' : '#ffffff');
            ctx.fill();

            // 2. Stroke / outline
            ctx.lineWidth = isFocused ? 3 : (this.hoveredNode === node ? 2.4 : 1.8);
            ctx.strokeStyle = isFocused ? (style.stroke || '#8b5cf6') : (style.stroke || '#94a3b8');

            if (isFocused) {
                ctx.shadowColor = style.stroke || '#8b5cf6';
                ctx.shadowBlur = 12;
            } else if (this.hoveredNode === node) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
                ctx.shadowBlur = 8;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 3. Icon
            const iconX = x + (isBadge ? 14 : 16);
            const iconY = cy;

            if (isBadge) {
                ctx.beginPath();
                this._roundRect(ctx, x + 8, cy - 14, 28, 28, 8);
                ctx.fillStyle = style.iconBg || 'rgba(0,0,0,0.06)';
                ctx.fill();
            }

            if (this._iconPath2D) {
                ctx.save();
                ctx.translate(iconX, iconY - 10);
                ctx.scale(0.85, 0.85);
                ctx.strokeStyle = style.icon || style.stroke || '#6366f1';
                ctx.lineWidth = 1.8;
                ctx.stroke(this._iconPath2D);
                ctx.restore();
            }

            // 4. Text Label
            const textX = x + (isBadge ? 44 : 42);
            ctx.fillStyle = style.text || (isDark ? '#f1f5f9' : '#1e293b');
            ctx.font = '600 13px Inter, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const maxTextWidth = width - (isBadge ? 76 : 72);
            const text = node.data?.name || '';
            ctx.fillText(this._truncateText(ctx, text, maxTextWidth), textX, cy + 1);

            // 5. Expand / Collapse toggle badge
            const hasChildren = this._hasNodeChildren(node);
            if (hasChildren) {
                const isExpanded = Boolean(node.children && node.children.length > 0);
                const toggleX = x + width - 18;
                const toggleY = cy;

                ctx.beginPath();
                ctx.arc(toggleX, toggleY, 9.5, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = style.stroke || '#94a3b8';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                // Minus or Plus sign
                ctx.beginPath();
                ctx.strokeStyle = style.stroke || '#94a3b8';
                ctx.lineWidth = 1.6;
                ctx.moveTo(toggleX - 4, toggleY);
                ctx.lineTo(toggleX + 4, toggleY);
                if (!isExpanded) {
                    ctx.moveTo(toggleX, toggleY - 4);
                    ctx.lineTo(toggleX, toggleY + 4);
                }
                ctx.stroke();
            }

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
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y + radius, x, y);
            ctx.closePath();
        }
    }

    _truncateText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let truncated = text;
        while (truncated.length > 3 && ctx.measureText(truncated + '…').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '…';
    }

    _hasNodeChildren(node) {
        if (!node) return false;
        if ((node.children && node.children.length > 0) || (node._children && node._children.length > 0)) return true;
        if (node.data?.hasChildren) return true;
        const deps = node.data?.dependencyNames;
        return Boolean(deps && deps.length > 0);
    }

    _getNodeAtScreenPosition(screenX, screenY) {
        if (!this.currentRoot || !this.currentTransform) return null;

        const isTB = this.currentConfig?.mode === 'tb';
        const k = this.currentTransform.k;
        const worldX = (screenX - this.currentTransform.x) / k;
        const worldY = (screenY - this.currentTransform.y) / k;

        const nodes = this.currentRoot.descendants();
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const width = node.width || NW;
            const height = NH;

            const state = this.nodeStates?.get(node.id);
            if (state && state.opacity <= 0.1) continue;

            const cx = state ? state.x : (isTB ? node.x : node.y);
            const cy = state ? state.y : (isTB ? node.y : node.x);

            const left = cx - width / 2;
            const right = cx + width / 2;
            const top = cy - height / 2;
            const bottom = cy + height / 2;

            if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
                // Check if toggle circle on the right side was clicked
                const toggleX = right - 18;
                const toggleY = cy;
                const distToToggle = Math.hypot(worldX - toggleX, worldY - toggleY);
                const isToggle = distToToggle <= 12;

                return { node, isToggle };
            }
        }

        return null;
    }

    _bindEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;

            const hit = this._getNodeAtScreenPosition(screenX, screenY);
            if (hit) {
                if (hit.isToggle) {
                    this.onToggleClick(event, hit.node);
                } else {
                    this.onNodeClick(event, hit.node);
                }
            }
        });

        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;

            const hit = this._getNodeAtScreenPosition(screenX, screenY);
            const node = hit?.node || null;

            if (node !== this.hoveredNode) {
                this.hoveredNode = node;
                this.canvas.style.cursor = node ? 'pointer' : 'default';

                if (node) {
                    this.onNodeHover(event, node);
                } else {
                    this.onNodeLeave();
                }

                if (this.currentRoot) {
                    this._drawCanvasFrame();
                }
            } else if (node) {
                this.onNodeHover(event, node);
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.hoveredNode) {
                this.hoveredNode = null;
                this.canvas.style.cursor = 'default';
                this.onNodeLeave();
                if (this.currentRoot) {
                    this._drawCanvasFrame();
                }
            }
        });
    }
}
