import ENDPOINTS from './api-endpoints.js';
import {renderMarkdown} from './markdown-renderer.js';

// Deliberately send only fixed selections, never DOM contents, query strings, or diagnostic data.
export async function initializeAiAssistant() {
    const base = ENDPOINTS.APPLICATION_INFO.replace(/\/application$/, '/ai');
    try {
        const response = await fetch(`${base}/capabilities`, {signal: AbortSignal.timeout(3000)});
        if (!response.ok) return;
        const capabilities = await response.json();
        if (capabilities.module !== 'bean-definitions') return;
    } catch { return; }

    const launcher = document.createElement('button');
    launcher.id = 'ai-insights-launcher';
    launcher.type = 'button';
    launcher.textContent = 'AI insights';
    launcher.className = 'fixed bottom-6 right-6 z-50 rounded-xl bg-indigo-600 text-white px-4 py-3 shadow-lg';
    launcher.setAttribute('aria-controls', 'ai-insights');
    launcher.setAttribute('aria-haspopup', 'dialog');
    const drawer = document.createElement('dialog');
    drawer.id = 'ai-insights';
    drawer.className = 'ai-insights-dialog bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100';
    drawer.setAttribute('aria-labelledby', 'ai-insights-title');
    drawer.setAttribute('aria-describedby', 'ai-insights-description');
    // Static scaffold only; model output is rendered with safe DOM construction.
    drawer.innerHTML = `<div class="ai-insights-layout">
        <header class="ai-insights-header">
            <h2 id="ai-insights-title">AI insights</h2>
            <form method="dialog"><button type="submit" class="ai-insights-close" aria-label="Close AI insights" autofocus>Close</button></form>
        </header>
        <div class="ai-insights-body">
            <p id="ai-insights-description" class="ai-insights-description">Analyze existing bean definitions. Only bounded numeric counts are sent to your configured AI provider. Generated advice may be inaccurate; verify it against observability data.</p>
            <p id="ai-page-context" class="ai-insights-context"></p>
            <label class="ai-insights-focus-label" for="ai-focus">Focus
                <select id="ai-focus" class="ai-insights-focus">
                    <option value="OVERVIEW">Bean definitions overview</option>
                    <option value="LAZY_INITIALIZATION">Lazy initialization</option>
                    <option value="SCOPES">Bean scopes</option>
                </select>
            </label>
            <button id="ai-generate" type="button" class="ai-insights-generate">Generate insight</button>
            <div id="ai-result" class="ai-markdown custom-scrollbar" role="status" aria-live="polite" aria-atomic="true" aria-busy="false" hidden></div>
        </div>
    </div>`;
    document.body.append(launcher, drawer);
    const generate = drawer.querySelector('#ai-generate');
    const result = drawer.querySelector('#ai-result');
    const returnFocus = launcher;
    launcher.addEventListener('click', () => {
        // Page context is displayed locally; the only supported server context is bean definitions.
        drawer.querySelector('#ai-page-context').textContent = 'Analysis context: Bean definitions';
        drawer.showModal();
    });
    let pending;
    const finishDialog = () => {
        if (drawer.open) return;
        const activeRequest = pending;
        pending = null;
        activeRequest?.abort();
        generate.disabled = false;
        result.setAttribute('aria-busy', 'false');
        requestAnimationFrame(() => {
            if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
        });
    };
    drawer.addEventListener('close', finishDialog);
    drawer.addEventListener('cancel', event => {
        event.preventDefault();
        drawer.close();
        finishDialog();
    });
    drawer.querySelector('form[method="dialog"]').addEventListener('submit', event => {
        event.preventDefault();
        drawer.close();
        finishDialog();
    });
    generate.addEventListener('click', async () => {
        generate.disabled = true;
        result.hidden = false;
        result.setAttribute('aria-busy', 'true');
        result.textContent = 'Analyzing…';
        const controller = new AbortController();
        pending = controller;
        const timer = setTimeout(() => controller.abort(), 32000);
        try {
            const response = await fetch(`${base}/insights`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({module: 'bean-definitions', focus: drawer.querySelector('#ai-focus').value}),
                signal: controller.signal
            });
            if (pending !== controller || !drawer.open) return;
            if (!response.ok) throw new Error('unavailable');
            const data = await response.json();
            if (pending !== controller || !drawer.open) return;
            if (typeof data.insight === 'string' && data.insight.trim()) {
                renderMarkdown(result, data.insight);
            } else {
                result.textContent = 'AI insights are unavailable.';
            }
        } catch {
            if (pending === controller && drawer.open) result.textContent = 'AI insights are unavailable. You can continue using Spring Lens.';
        } finally {
            clearTimeout(timer);
            if (pending === controller) {
                pending = null;
                generate.disabled = false;
                result.setAttribute('aria-busy', 'false');
            }
        }
    });
}
