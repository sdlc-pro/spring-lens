package com.sdlcpro.springlens.time;

import java.time.Clock;
import java.time.Instant;

public final class SteadyClock extends SpringLensClock {
    private static final SteadyClock INSTANCE = new SteadyClock();

    private final Instant startInstant;
    private final long startNanoTime;

    private SteadyClock() {
        if (INSTANCE != null) {
            throw new IllegalStateException("Instance of SteadyClock already created");
        }
        this.startInstant = Clock.systemUTC().instant();
        this.startNanoTime = System.nanoTime();
    }

    @Override
    public Instant now() {
        long elapsedNanos = System.nanoTime() - INSTANCE.startNanoTime;
        return INSTANCE.startInstant.plusNanos(elapsedNanos);
    }

    public static SteadyClock getInstance() {
        return INSTANCE;
    }
}
