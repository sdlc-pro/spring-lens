package com.sdlcpro.springlens.time;

import java.time.Clock;
import java.time.Instant;

public final class SystemClock extends SpringLensClock {
    private static final SystemClock INSTANCE = new SystemClock();

    private SystemClock() {
        if (INSTANCE != null) {
            throw new IllegalStateException("Instance of SystemClock already created");
        }
    }

    public static SystemClock getInstance() {
        return INSTANCE;
    }

    @Override
    public Instant now() {
        return Clock.systemUTC().instant();
    }
}
