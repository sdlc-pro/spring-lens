package com.sdlcpro.springlens.util;

import java.util.Collection;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Utility class for validating arguments and state,
 * providing a lightweight alternative to Spring's Assert.
 */
public final class Preconditions {

    private static final String DEFAULT_MSG = "Validation failed";

    private Preconditions() {
        throw new UnsupportedOperationException("Preconditions is an utility class and cannot be instantiated");
    }

    // --- state ---
    public static void state(boolean expression, String message) {
        if (!expression) throw new IllegalStateException(messageOrDefault(message));
    }

    public static void state(boolean expression, Supplier<String> message) {
        if (!expression) throw new IllegalStateException(nullSafeMessage(message));
    }

    // --- isTrue ---
    public static void isTrue(boolean expression, String message) {
        if (!expression) throw new IllegalArgumentException(messageOrDefault(message));
    }

    public static void isTrue(boolean expression, Supplier<String> message) {
        if (!expression) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    // --- isNull / notNull ---
    public static void isNull(Object object, String message) {
        if (object != null) throw new IllegalArgumentException(messageOrDefault(message));
    }

    public static void isNull(Object object, Supplier<String> message) {
        if (object != null) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    public static void notNull(Object object, String message) {
        if (object == null) throw new IllegalArgumentException(message != null ? message : "Object must not be null");
    }

    public static void notNull(Object object, Supplier<String> message) {
        if (object == null) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    public static <T> T requireNonNull(T object, String message) {
        if (object == null) {
            throw new IllegalArgumentException(message != null ? message : "Object must not be null");
        }

        return object;
    }

    public static <T> T requireNonNull(T object, Supplier<String> message) {
        if (object == null) {
            throw new IllegalArgumentException(nullSafeMessage(message));
        }

        return object;
    }

    public static void requiredArray(Object object, String message) {
        if (object == null || !object.getClass().isArray()) {
            throw new IllegalArgumentException(message != null ? message : "Object must a type of Array");
        }
    }

    // --- hasLength ---
    public static void hasLength(String text, String message) {
        if (text == null || text.isEmpty())
            throw new IllegalArgumentException(message != null ? message : "Text must not be empty");
    }

    public static void hasLength(String text, Supplier<String> message) {
        if (text == null || text.isEmpty()) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    // --- hasText ---
    public static void hasText(String text, String message) {
        if (text == null || text.isBlank())
            throw new IllegalArgumentException(message != null ? message : "Text must not be blank");
    }

    public static void hasText(String text, Supplier<String> message) {
        if (text == null || text.isBlank()) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    // --- doesNotContain ---
    public static void doesNotContain(String textToSearch, String substring, String message) {
        if (textToSearch != null && substring != null && textToSearch.contains(substring))
            throw new IllegalArgumentException(messageOrDefault(message));
    }

    public static void doesNotContain(String textToSearch, String substring, Supplier<String> message) {
        if (textToSearch != null && substring != null && textToSearch.contains(substring))
            throw new IllegalArgumentException(nullSafeMessage(message));
    }

    // --- notEmpty (Array, Collection, Map) ---
    public static void notEmpty(Object[] array, String message) {
        if (array == null || array.length == 0)
            throw new IllegalArgumentException(message != null ? message : "Array must not be empty");
    }

    public static void notEmpty(Object[] array, Supplier<String> message) {
        if (array == null || array.length == 0) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    public static void notEmpty(Collection<?> collection, String message) {
        if (collection == null || collection.isEmpty())
            throw new IllegalArgumentException(message != null ? message : "Collection must not be empty");
    }

    public static void notEmpty(Collection<?> collection, Supplier<String> message) {
        if (collection == null || collection.isEmpty()) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    public static void notEmpty(Map<?, ?> map, String message) {
        if (map == null || map.isEmpty())
            throw new IllegalArgumentException(message != null ? message : "Map must not be empty");
    }

    public static void notEmpty(Map<?, ?> map, Supplier<String> message) {
        if (map == null || map.isEmpty()) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    // --- noNullElements ---
    public static void noNullElements(Object[] array, String message) {
        if (array != null)
            for (Object e : array) if (e == null) throw new IllegalArgumentException(messageOrDefault(message));
    }

    public static void noNullElements(Object[] array, Supplier<String> message) {
        if (array != null)
            for (Object e : array) if (e == null) throw new IllegalArgumentException(nullSafeMessage(message));
    }

    public static void noNullElements(Collection<?> collection, String message) {
        notNull(collection, "Collection must not be null");
        for (Object e : collection) {
            if (e == null) throw new IllegalArgumentException(messageOrDefault(message));
        }
    }

    public static void noNullElements(Collection<?> collection, Supplier<String> message) {
        notNull(collection, "Collection must not be null");
        for (Object e : collection) {
            if (e == null) throw new IllegalArgumentException(nullSafeMessage(message));
        }
    }

    // --- isInstanceOf / isAssignable ---
    public static void isInstanceOf(Class<?> type, Object obj, String message) {
        notNull(type, "Type class must not be null");
        if (!type.isInstance(obj)) throw new IllegalArgumentException(messageOrDefault(message));
    }

    public static void isInstanceOf(Class<?> type, Object obj, Supplier<String> message) {
        if (type == null || !type.isInstance(obj)) {
            throw new IllegalArgumentException(message != null ? nullSafeMessage(message) : "Object is not of type " + nullSafeName(type));
        }
    }

    public static void isInstanceOf(Class<?> type, Object obj) {
        isInstanceOf(type, obj, (Supplier<String>) null);
    }

    public static void isAssignable(Class<?> superType, Class<?> subType, String message) {
        if (superType == null || !superType.isAssignableFrom(subType))
            throw new IllegalArgumentException(messageOrDefault(message));
    }

    public static void isAssignable(Class<?> superType, Class<?> subType, Supplier<String> message) {
        if (superType == null || !superType.isAssignableFrom(subType))
            throw new IllegalArgumentException(nullSafeMessage(message));
    }

    public static void isAssignable(Class<?> superType, Class<?> subType) {
        isAssignable(superType, subType, nullSafeName(subType) + " is not assignable to " + nullSafeName(superType));
    }

    // --- Helper Methods ---
    private static String messageOrDefault(String message) {
        return message != null ? message : DEFAULT_MSG;
    }

    private static String nullSafeMessage(Supplier<String> messageSupplier) {
        String message = (messageSupplier != null) ? messageSupplier.get() : null;
        return (message != null) ? message : DEFAULT_MSG;
    }

    private static String nullSafeName(Class<?> clazz) {
        return clazz != null ? clazz.getName() : "Unknown Type";
    }
}
