package com.sdlcpro.springlens.util;

import com.sdlcpro.springlens.model.ErrorInfo;

import java.io.PrintWriter;
import java.io.StringWriter;

public final class ExceptionUtils {
    private static final int DEFAULT_MAX_STACK_TRACE_LENGTH = 10 * 1024;
    private static final String MAX_STACK_TRACE_LENGTH_PROP = "spring.lens.exception.max-stack-trace.length";

    private static int maxStackTraceLength;

    static {
        maxStackTraceLength = DEFAULT_MAX_STACK_TRACE_LENGTH;

        try {
            String definedMaxStackTraceLength = System.getProperty(MAX_STACK_TRACE_LENGTH_PROP);
            if (definedMaxStackTraceLength != null) {
                int value = Integer.parseInt(definedMaxStackTraceLength.trim());
                maxStackTraceLength = value < 0 ? DEFAULT_MAX_STACK_TRACE_LENGTH : value;
            }
        } catch (Exception ignore) {
        }
    }

    private ExceptionUtils() {
        throw new UnsupportedOperationException("ExceptionUtils is an utility class and cannot be instantiated");
    }

    public static ErrorInfo resolveErrorInfo(Throwable throwable) {
        if (throwable == null) {
            return null;
        }

        String type = throwable.getClass().getName();
        String message = throwable.getMessage();
        String stackTrace = formatStackTrace(throwable);

        return new ErrorInfo(type, message, stackTrace);
    }

    private static String formatStackTrace(Throwable throwable) {
        StringWriter writer = new StringWriter();
        try (PrintWriter printWriter = new PrintWriter(writer)) {
            throwable.printStackTrace(printWriter);
        }

        String stackTrace = writer.toString();
        if (stackTrace.length() > maxStackTraceLength) {
            return stackTrace.substring(0, maxStackTraceLength).concat("... [stack trace truncated]");
        }

        return stackTrace;
    }
}
