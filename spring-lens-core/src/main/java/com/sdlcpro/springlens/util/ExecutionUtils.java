package com.sdlcpro.springlens.util;

public final class ExecutionUtils {

    private ExecutionUtils() {
        throw new UnsupportedOperationException("ExecutionUtils is an utility class and cannot be instantiated");
    }

    public static Thread currentThread() {
        return Thread.currentThread();
    }

    public static String currentThreadName() {
        return currentThread().getName();
    }

    public static long currentThreadId() {
        return currentThread().getId();
    }

    public static String currentThreadLabel() {
        Thread thread = Thread.currentThread();

        if (!thread.getName().isBlank()) {
            return thread.getName();
        }

        /*
        Note: Virtual thread checks can be integrated here for Java 21+ environments:
        return thread.isVirtual()
                ? "VirtualThread-" + thread.threadId()
                : "Thread-" + thread.threadId();
         */

        return "Thread-" + thread.getId();
    }
}
