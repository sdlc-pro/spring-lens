package com.sdlcpro.springlens.insight.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Collection;
import java.util.function.Consumer;

public final class SafeListenerInvoker {

    private static final Logger logger = LoggerFactory.getLogger(SafeListenerInvoker.class);

    private SafeListenerInvoker() {
        throw new UnsupportedOperationException("SafeListenerInvoker is an utility class and cannot be instantiated");
    }

    public static <L> void invoke(ObjectProvider<L> provider, Consumer<L> consumer) {
        invoke(provider.stream().toList(), consumer);
    }

    public static <L, A> void invoke(ObjectProvider<L> provider, A arg, ListenerMethod<L, A> method) {
        invoke(provider.stream().toList(), arg, method);
    }

    public static <L, A1, A2> void invoke(ObjectProvider<L> provider, A1 a1, A2 a2, ListenerMethod2<L, A1, A2> method) {
        invoke(provider.stream().toList(), a1, a2, method);
    }

    public static <L, A1, A2, A3> void invoke(ObjectProvider<L> provider, A1 a1, A2 a2, A3 a3, ListenerMethod3<L, A1, A2, A3> method) {
        invoke(provider.stream().toList(), a1, a2, a3, method);
    }

    public static <L, A1, A2, A3, A4> void invoke(ObjectProvider<L> provider, A1 a1, A2 a2, A3 a3, A4 a4, ListenerMethod4<L, A1, A2, A3, A4> method) {
        invoke(provider.stream().toList(), a1, a2, a3, a4, method);
    }

    public static <L, A1, A2, A3, A4, A5> void invoke(ObjectProvider<L> provider, A1 a1, A2 a2, A3 a3, A4 a4, A5 a5, ListenerMethod5<L, A1, A2, A3, A4, A5> method) {
        invoke(provider.stream().toList(), a1, a2, a3, a4, a5, method);
    }

    public static <L> void orderedInvoke(ObjectProvider<L> provider, Consumer<L> consumer) {
        invoke(provider.orderedStream().toList(), consumer);
    }

    public static <L, A> void orderedInvoke(ObjectProvider<L> provider, A arg, ListenerMethod<L, A> method) {
        invoke(provider.orderedStream().toList(), arg, method);
    }

    public static <L, A1, A2> void orderedInvoke(ObjectProvider<L> provider, A1 a1, A2 a2, ListenerMethod2<L, A1, A2> method) {
        invoke(provider.orderedStream().toList(), a1, a2, method);
    }

    public static <L, A1, A2, A3> void orderedInvoke(ObjectProvider<L> provider, A1 a1, A2 a2, A3 a3, ListenerMethod3<L, A1, A2, A3> method) {
        invoke(provider.orderedStream().toList(), a1, a2, a3, method);
    }

    public static <L, A1, A2, A3, A4> void orderedInvoke(ObjectProvider<L> provider, A1 a1, A2 a2, A3 a3, A4 a4, ListenerMethod4<L, A1, A2, A3, A4> method) {
        invoke(provider.orderedStream().toList(), a1, a2, a3, a4, method);
    }

    public static <L, A1, A2, A3, A4, A5> void orderedInvoke(ObjectProvider<L> provider, A1 a1, A2 a2, A3 a3, A4 a4, A5 a5, ListenerMethod5<L, A1, A2, A3, A4, A5> method) {
        invoke(provider.orderedStream().toList(), a1, a2, a3, a4, a5, method);
    }

    public static <L, A> void invoke(Collection<L> listeners, A arg, ListenerMethod<L, A> method) {
        invoke(listeners, l -> method.call(l, arg));
    }

    public static <L, A1, A2> void invoke(Collection<L> listeners, A1 a1, A2 a2, ListenerMethod2<L, A1, A2> method) {
        invoke(listeners, l -> method.call(l, a1, a2));
    }

    public static <L, A1, A2, A3> void invoke(Collection<L> listeners, A1 a1, A2 a2, A3 a3, ListenerMethod3<L, A1, A2, A3> method) {
        invoke(listeners, l -> method.call(l, a1, a2, a3));
    }

    public static <L, A1, A2, A3, A4> void invoke(Collection<L> listeners, A1 a1, A2 a2, A3 a3, A4 a4, ListenerMethod4<L, A1, A2, A3, A4> method) {
        invoke(listeners, l -> method.call(l, a1, a2, a3, a4));
    }

    public static <L, A1, A2, A3, A4, A5> void invoke(Collection<L> listeners, A1 a1, A2 a2, A3 a3, A4 a4, A5 a5, ListenerMethod5<L, A1, A2, A3, A4, A5> method) {
        invoke(listeners, l -> method.call(l, a1, a2, a3, a4, a5));
    }

    public static <L> void invoke(Collection<L> listeners, Consumer<L> consumer) {
        if (consumer == null || listeners == null || listeners.isEmpty()) {
            return;
        }

        for (L listener : listeners) {
            if (listener != null) {
                try {
                    consumer.accept(listener);
                } catch (Exception ex) {
                    logger.debug(
                            "Exception occurred while executing listener '{}': {}",
                            listener.getClass().getName(),
                            ex.getMessage(),
                            ex
                    );
                }
            }
        }
    }

    @FunctionalInterface
    public interface ListenerMethod<L, A> {
        void call(L listener, A arg);
    }

    @FunctionalInterface
    public interface ListenerMethod2<L, A1, A2> {
        void call(L listener, A1 a1, A2 a2);
    }

    @FunctionalInterface
    public interface ListenerMethod3<L, A1, A2, A3> {
        void call(L listener, A1 a1, A2 a2, A3 a3);
    }

    @FunctionalInterface
    public interface ListenerMethod4<L, A1, A2, A3, A4> {
        void call(L listener, A1 a1, A2 a2, A3 a3, A4 a4);
    }

    @FunctionalInterface
    public interface ListenerMethod5<L, A1, A2, A3, A4, A5> {
        void call(L listener, A1 a1, A2 a2, A3 a3, A4 a4, A5 a5);
    }
}
