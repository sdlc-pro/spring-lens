export default class HealthPoller {

    timer = null;

    constructor({onCheck, intervalMs = 10000} = {}) {
        this.onCheck = onCheck;
        this.intervalMs = intervalMs;
    }

    start(intervalMs = this.intervalMs) {
        this.intervalMs = intervalMs;
        this._startPolling();
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    stop() {
        this._stopPolling();
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }

    _startPolling() {
        this._stopPolling();
        this.timer = setInterval(() => this.onCheck?.(), this.intervalMs);
    }

    _stopPolling() {
        clearInterval(this.timer);
        this.timer = null;
    }

     destroy() {
        this.stop();
        this.onCheck = null;
    }

    _onVisibilityChange = () => {
        if (document.hidden) {
            this._stopPolling();
            return;
        }
        this.onCheck?.();
        this._startPolling();
    };
}
