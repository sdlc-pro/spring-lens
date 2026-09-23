export default class Guard {

    static isNil(val) {
        return val == null;
    }

    static isNotNil(val) {
        return val != null;
    }

    static isBlank(val) {
        return val == null || (typeof val === 'string' && val.trim().length === 0);
    }

    static isPresent(val) {
        return !this.isBlank(val);
    }

    static isAnyBlank(...values) {
        return values.some(val => this.isBlank(val));
    }

    static hasDependencies(bean) {
        return Boolean(bean && Array.isArray(bean.dependencies) && Array.isArray(bean.dependents));
    }
}
