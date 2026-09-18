export default class Pipeline {

    constructor(...middlewares) {
        this.middlewares = [];
        this.context = null;
        this.pipe(...middlewares);
    }

    send(context) {
        this.context = context;
        return this;
    }

    through(...middlewares) {
        this.middlewares = [];
        return this.pipe(...middlewares);
    }

    pipe(...middlewares) {
        const handlers = middlewares.flat(Infinity).filter(fn => typeof fn === 'function');
        this.middlewares.push(...handlers);
        return this;
    }

    async thenRun(destination = null) {
        let currentIndex = -1;

        const dispatch = async (index) => {
            if (index <= currentIndex) {
                throw new Error('next() called multiple times in middleware pipeline');
            }
            currentIndex = index;

            const handler = this.middlewares[index];
            if (!handler) {
                return destination ? destination(this.context) : undefined;
            }

            return handler(this.context, () => dispatch(index + 1));
        };

        return dispatch(0);
    }
}

export { Pipeline };