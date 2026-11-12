package com.sdlcpro.springlens.accessor;

import com.sdlcpro.springlens.exception.AccessorCreationException;
import com.sdlcpro.springlens.exception.DataAccessException;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.*;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

public final class FieldAccessorCache {
    private static final Map<Class<?>, Map<String, Function<Object, Object>>> CACHE = new ConcurrentHashMap<>();

    private FieldAccessorCache() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    public static Function<Object, Object> getAccessor(Class<?> rootType, String fieldPath) {
        if (rootType == null) {
            throw new IllegalArgumentException("The value of rootType must not be null");
        }

        if (fieldPath == null || fieldPath.isBlank()) {
            throw new IllegalArgumentException("The value of fieldPath must not be blank");
        }

        return CACHE
                .computeIfAbsent(rootType, k -> new ConcurrentHashMap<>())
                .computeIfAbsent(fieldPath, path -> createAccessor(rootType, path));
    }

    private static Function<Object, Object> createAccessor(Class<?> rootType, String fieldPath) {
        try {
            String[] parts = fieldPath.split("\\.", -1);

            Type currentType = rootType;
            MethodHandle[] handles = new MethodHandle[parts.length];
            MethodHandles.Lookup lookup = MethodHandles.publicLookup();
            for (int i = 0; i < parts.length; i++) {
                if (parts[i].isBlank()) {
                    throw new IllegalArgumentException("Invalid field path: " + fieldPath);
                }

                currentType = resolveElementType(currentType);
                if (!(currentType instanceof Class<?> currentClass)) {
                    throw new IllegalArgumentException("Cannot resolve field '" + parts[i] + "' from type '" + currentType + "'");
                }

                Method method = resolveAccessorMethod(currentClass, parts[i]);
                method.setAccessible(true);
                handles[i] = lookup.unreflect(method);
                currentType = method.getGenericReturnType();
            }

            return target -> accessData(target, handles, 0);

        } catch (Exception e) {
            throw new AccessorCreationException("Failed to create accessor for field path '" + fieldPath + "'", e);
        }
    }

    private static Object accessData(Object target, MethodHandle[] handles, int pos) {
        if (target == null) {
            return null;
        }

        if (target instanceof Map<?, ?> map) {
            List<Object> results = new ArrayList<>();
            for (var value : map.values()) {
                Object result = accessData(value, handles, pos);
                flattenInto(results, result);
            }

            return results;
        }

        if (target instanceof Collection<?> collection) {
            List<Object> results = new ArrayList<>();
            for (Object value : collection) {
                Object result = accessData(value, handles, pos);
                flattenInto(results, result);
            }

            return results;
        }

        if (target.getClass().isArray()) {
            int length = Array.getLength(target);
            List<Object> results = new ArrayList<>();
            for (int i = 0; i < length; i++) {
                Object value = Array.get(target, i);
                Object result = accessData(value, handles, pos);
                flattenInto(results, result);
            }

            return results;
        }

        if (pos >= handles.length) {
            return target;
        }

        try {
            Object data = handles[pos].invoke(target);
            return accessData(data, handles, pos + 1);
        } catch (Throwable e) {
            throw new DataAccessException("Failed to access data at position " + pos, e);
        }
    }

    private static void flattenInto(List<Object> results, Object value) {
        if (value instanceof Collection<?> collection) {
            for (Object element : collection) {
                flattenInto(results, element);
            }
        } else {
            results.add(value);
        }
    }

    private static Type resolveElementType(Type type) {
        while (true) {
            if (type instanceof ParameterizedType parameterizedType) {
                Type rawType = parameterizedType.getRawType();
                if (rawType instanceof Class<?> rawClass) {
                    if (Map.class.isAssignableFrom(rawClass)) {
                        type = resolveWildcard(parameterizedType.getActualTypeArguments()[1]);
                        continue;
                    }

                    if (Collection.class.isAssignableFrom(rawClass)) {
                        type = resolveWildcard(parameterizedType.getActualTypeArguments()[0]);
                        continue;
                    }
                }
            }

            if (type instanceof Class<?> clazz && clazz.isArray()) {
                type = clazz.getComponentType();
                continue;
            }

            return type;
        }
    }

    private static Type resolveWildcard(Type type) {
        if (type instanceof WildcardType wildcardType) {
            Type[] upperBounds = wildcardType.getUpperBounds();
            return upperBounds.length > 0 ? upperBounds[0] : Object.class;
        }

        return type;
    }

    private static Method resolveAccessorMethod(Class<?> targetType, String fieldName) throws NoSuchMethodException {
        if (targetType.isRecord()) {
            for (RecordComponent component : targetType.getRecordComponents()) {
                if (component.getName().equals(fieldName)) {
                    return component.getAccessor();
                }
            }
        }

        String suffix = Character.toUpperCase(fieldName.charAt(0)) + fieldName.substring(1);
        try {
            Method method = targetType.getMethod("is" + suffix);
            if (method.getReturnType() == boolean.class || method.getReturnType() == Boolean.class) {
                return method;
            }
        } catch (NoSuchMethodException ignored) {
        }

        try {
            Method method = targetType.getMethod("get" + suffix);
            if (method.getReturnType() != void.class) {
                return method;
            }
        } catch (NoSuchMethodException ignored) {
        }

        throw new NoSuchMethodException("Cannot find a public property accessor for '" + fieldName + "' in '" + targetType.getName() + "'");
    }

    public static void clear() {
        CACHE.clear();
    }

    public static int cacheSize() {
        return CACHE.values()
                .stream()
                .mapToInt(Map::size)
                .sum();
    }
}
