export default class StateEmitter {

    stateListeners = new Set();
    appInfoListeners = new Set();

    onStateChange(callback, currentState = null) {
        return this._subscribe(this.stateListeners, callback, currentState);
    }

    onAppInfoChange(callback, currentAppInfo = null) {
        return this._subscribe(this.appInfoListeners, callback, currentAppInfo);
    }

    emitState(isLive) {
        this._emit(this.stateListeners, isLive);
    }

    emitAppInfo(info) {
        this._emit(this.appInfoListeners, info);
    }

    clear() {
        this.stateListeners.clear();
        this.appInfoListeners.clear();
    }

    _subscribe(listeners, callback, initialValue) {
        listeners.add(callback);
        if (initialValue != null) this._safeCall(callback, initialValue);
        return () => listeners.delete(callback);
    }

    _emit(listeners, payload) {
        for (const listener of listeners) {
            this._safeCall(listener, payload);
        }
    }

    _safeCall(fn, payload) {
        try {
            fn(payload);
        } catch (error) {
            console.error('Error in listener callback:', error);
        }
    }
}
