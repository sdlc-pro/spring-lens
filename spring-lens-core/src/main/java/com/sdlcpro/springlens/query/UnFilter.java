package com.sdlcpro.springlens.query;

final class UnFilter implements Filter {
    private static final UnFilter INSTANCE = new UnFilter();

    private UnFilter() {
        if (INSTANCE != null) {
            throw new IllegalStateException("Instance of UnFilter already created");
        }
    }

    public static UnFilter getInstance() {
        return INSTANCE;
    }
}
