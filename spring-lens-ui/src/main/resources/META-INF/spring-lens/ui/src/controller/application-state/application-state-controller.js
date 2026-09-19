import BaseController from '../base-controller.js';
import {
    ApplicationStateService,
    StateEmitter,
    StatusIndicatorWidget,
    HealthPoller
} from './index.js';

export class ApplicationStateController extends BaseController {

    static DEFAULT_APP_NAME = 'SpringLens';

    isLive = null;
    appInfo = null;
    emitter = new StateEmitter();

    constructor({infoApi, container, healthApi, intervalMs} = {}) {
        super('applicationState');

        this.service = new ApplicationStateService({healthApi, infoApi});
        this.statusWidget = new StatusIndicatorWidget({container});
        this.poller = new HealthPoller({
            onCheck: () => this.checkHealth(),
            intervalMs
        });

        this.addDisposable(this.poller);
        this.addDisposable(this.statusWidget);
    }

    onStateChange(callback) {
        return this.emitter.onStateChange(callback, this.isLive);
    }

    onAppInfoChange(callback) {
        return this.emitter.onAppInfoChange(callback, this.appInfo);
    }

    setAppInfo(info) {
        if (!info) return;
        this.appInfo = info;
        this.emitter.emitAppInfo(info);
    }

    getAppName() {
        return this.appInfo?.name || ApplicationStateController.DEFAULT_APP_NAME;
    }

    async fetchAppInfo(force = false) {
        if (!force && this.appInfo) return this.appInfo;
        const info = await this.service.fetchAppInfo();
        if (info) this.setAppInfo(info);
        return info;
    }

    start(intervalMs) {
        this.checkHealth().then(r => {});
        this.fetchAppInfo().then(r => {});
        this.poller.start(intervalMs);
    }

    stop() {
        this.poller.stop();
    }

    async checkHealth() {
        const isLive = await this.service.checkHealth();
        this.updateState(isLive);
        return isLive;
    }

    updateState(isLive) {
        if (this.isLive === isLive) return;
        this.isLive = isLive;
        this.statusWidget.render(isLive);
        this.emitter.emitState(isLive);
    }

    render(isLive) {
        this.updateState(isLive);
    }
}

export default ApplicationStateController;
