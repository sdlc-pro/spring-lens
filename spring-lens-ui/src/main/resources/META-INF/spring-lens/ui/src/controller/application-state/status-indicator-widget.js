import TemplateEngine from '../../helper/template-engine.js';

export default class StatusIndicatorWidget {

    static DEFAULT_CONTAINER = '#sidebar-status-container';

    currentStatus = null;

    constructor({container = StatusIndicatorWidget.DEFAULT_CONTAINER} = {}) {
        this.container = container;
    }

    render(isLive) {
        if (this.currentStatus === isLive) return;
        this.currentStatus = isLive;

        const template = isLive ? 'tpl-status-connected' : 'tpl-status-disconnected';
        const element = TemplateEngine.clone(template);
        if (element) {
            $(this.container).empty().append(element);
        }
    }

    destroy() {
        $(this.container).empty();
        this.currentStatus = null;
    }
}
