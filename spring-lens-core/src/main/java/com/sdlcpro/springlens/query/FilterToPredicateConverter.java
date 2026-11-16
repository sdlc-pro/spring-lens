package com.sdlcpro.springlens.query;

import com.sdlcpro.springlens.accessor.FieldAccessorCache;
import com.sdlcpro.springlens.util.Preconditions;

import java.lang.reflect.Array;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Predicate;

final class FilterToPredicateConverter<T> {
    private final Class<T> type;

    FilterToPredicateConverter(Class<T> type) {
        this.type = Preconditions.requireNonNull(type, "Type must not be null");
    }

    Predicate<T> convert(Filter filter) {
        return filter == null ? obj -> true : compile(filter);
    }

    private Predicate<T> compile(Filter filter) {
        if (filter instanceof UnFilter) {
            return obj -> true;
        }

        if (filter instanceof ConditionalFilter conditionalFilter) {
            return compileCondition(conditionalFilter);
        }

        if (filter instanceof CompositeFilter compositeFilter) {
            return compileComposite(compositeFilter);
        }

        throw new IllegalArgumentException("Unsupported filter type: " + filter.getClass());
    }

    private Predicate<T> compileCondition(ConditionalFilter filter) {
        String property = filter.property();
        Preconditions.hasText(property, "Filter property must not be blank");

        ConditionalOperator operator = Preconditions.requireNonNull(filter.operator(), "Filter operator must not be null");
        Function<Object, Object> accessor = FieldAccessorCache.getAccessor(type, property);

        Object expected = filter.value();
        return target -> evaluateOperation(operator, accessor, target, expected);
    }

    private static boolean evaluateOperation(ConditionalOperator operator, Function<Object, Object> accessor, Object target, Object expected) {
        if (target == null) {
            return false;
        }

        Object actual = accessor.apply(target);
        return switch (operator) {
            case EQUALS -> Objects.equals(actual, expected);
            case EQUALS_IGNORE_CASE -> equalsIgnoreCase(actual, expected);
            case NOT_EQUALS -> !Objects.equals(actual, expected);
            case GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUALS, LESS_THAN_OR_EQUALS ->
                    compare(actual, expected, operator);
            case CONTAINS -> contains(actual, expected, false);
            case CONTAINS_IGNORE_CASE -> contains(actual, expected, true);
            case STARTS_WITH -> startsWith(actual, expected);
            case ENDS_WITH -> endsWith(actual, expected);
        };
    }

    private Predicate<T> compileComposite(CompositeFilter filter) {
        List<Filter> filters = Preconditions.requireNonNull(filter.filters(), "Composite filter list must not be null");

        List<Predicate<T>> predicates = new ArrayList<>(filters.size());
        for (Filter child : filters) {
            Preconditions.requireNonNull(child, "Composite filter must not contain null");
            predicates.add(compile(child));
        }

        List<Predicate<T>> compiledPredicates = List.copyOf(predicates);
        return switch (Preconditions.requireNonNull(filter.operator(), "Composite operator must not be null")) {
            case AND -> obj -> and(compiledPredicates, obj);
            case OR -> obj -> or(compiledPredicates, obj);
        };
    }

    private static <T> boolean and(List<Predicate<T>> predicates, T obj) {
        for (Predicate<T> predicate : predicates) {
            if (!predicate.test(obj)) {
                return false;
            }
        }

        return true;
    }

    private static <T> boolean or(List<Predicate<T>> predicates, T obj) {
        for (Predicate<T> predicate : predicates) {
            if (predicate.test(obj)) {
                return true;
            }
        }

        return false;
    }

    private static boolean equalsIgnoreCase(Object actual, Object expected) {
        return actual instanceof CharSequence actualText
                && isTextComparable(expected)
                && actualText.toString().equalsIgnoreCase(expected.toString());
    }

    private static boolean compare(Object actual, Object expected, ConditionalOperator operator) {
        if (actual == null || expected == null) {
            return false;
        }

        int result = safeCompare(actual, expected);
        return switch (operator) {
            case GREATER_THAN -> result > 0;
            case LESS_THAN -> result < 0;
            case GREATER_THAN_OR_EQUALS -> result >= 0;
            case LESS_THAN_OR_EQUALS -> result <= 0;
            default -> throw new IllegalArgumentException("Unsupported comparison operator: " + operator);
        };
    }

    @SuppressWarnings("unchecked")
    private static int safeCompare(Object actual, Object expected) {
        if (actual instanceof Number actualNumber && expected instanceof Number expectedNumber) {
            return compareNumbers(actualNumber, expectedNumber);
        }

        if (!(actual instanceof Comparable<?> comparable)) {
            throw new IllegalArgumentException("Field value type '" + actual.getClass() + "' is not comparable");
        }

        try {
            return ((Comparable<Object>) comparable).compareTo(expected);
        } catch (ClassCastException ex) {
            throw new IllegalArgumentException("Cannot compare values of type '" + actual.getClass() + "' and '" + expected.getClass() + "'", ex);
        }
    }

    private static int compareNumbers(Number actual, Number expected) {
        boolean actualNaN = isNaN(actual);
        boolean expectedNaN = isNaN(expected);

        if (actualNaN || expectedNaN) {
            return actualNaN && expectedNaN ? 0 : actualNaN ? 1 : -1;
        }

        boolean actualInfinite = isInfinite(actual);
        boolean expectedInfinite = isInfinite(expected);

        if (actualInfinite || expectedInfinite) {
            if (actualInfinite && expectedInfinite) {
                return Double.compare(
                        actual.doubleValue(),
                        expected.doubleValue()
                );
            }

            if (actualInfinite) {
                return actual.doubleValue() > 0 ? 1 : -1;
            }

            return expected.doubleValue() > 0 ? -1 : 1;
        }

        return toBigDecimal(actual).compareTo(toBigDecimal(expected));
    }

    private static BigDecimal toBigDecimal(Number value) {
        try {
            if (value instanceof BigDecimal decimal) {
                return decimal;
            }

            if (value instanceof BigInteger integer) {
                return new BigDecimal(integer);
            }

            if (value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long) {
                return BigDecimal.valueOf(value.longValue());
            }

            if (value instanceof Float) {
                return new BigDecimal(value.toString());
            }

            if (value instanceof Double) {
                return BigDecimal.valueOf(value.doubleValue());
            }

            return new BigDecimal(value.toString());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Unsupported numeric representation: " + value.getClass(), ex);
        }
    }

    private static boolean isNaN(Number value) {
        return value instanceof Double d && Double.isNaN(d)
                || value instanceof Float f && Float.isNaN(f);
    }

    private static boolean isInfinite(Number value) {
        return value instanceof Double d && Double.isInfinite(d)
                || value instanceof Float f && Float.isInfinite(f);
    }

    private static boolean contains(Object source, Object target, boolean ignoreCase) {
        if (source == null) {
            return false;
        }

        if (source instanceof CharSequence sourceText) {
            return containsText(sourceText, target, ignoreCase);
        }

        if (source.getClass().isArray()) {
            return containsArray(source, target, ignoreCase);
        }

        if (source instanceof Iterable<?> collection) {
            return containsIterable(collection, target, ignoreCase);
        }

        if (source instanceof Map<?, ?> sourceMap) {
            return containsMap(sourceMap, target, ignoreCase);
        }

        /*
         * For unsupported object to test containment we can return false instead of throwing
         * 'UnsupportedOperationException' to prevent the runtime failures
         */
        return false;
    }

    private static boolean containsText(CharSequence source, Object target, boolean ignoreCase) {
        if (!isTextComparable(target)) {
            return false;
        }

        String sourceValue = source.toString();
        String targetValue = target.toString();
        if (!ignoreCase) {
            return sourceValue.contains(targetValue);
        }

        int targetLength = targetValue.length();
        for (int i = 0; i <= sourceValue.length() - targetLength; i++) {
            if (sourceValue.regionMatches(true, i, targetValue, 0, targetLength)) {
                return true;
            }
        }

        return false;
    }

    private static boolean isTextComparable(Object value) {
        return value instanceof CharSequence
                || value instanceof Number
                || value instanceof Character
                || value instanceof Boolean
                || value instanceof Enum<?>;
    }

    private static boolean containsArray(Object source, Object target, boolean ignoreCase) {
        int length = Array.getLength(source);
        for (int i = 0; i < length; i++) {
            if (matches(Array.get(source, i), target, ignoreCase)) {
                return true;
            }
        }

        return false;
    }

    private static boolean containsIterable(Iterable<?> source, Object target, boolean ignoreCase) {
        for (Object value : source) {
            if (matches(value, target, ignoreCase)) {
                return true;
            }
        }

        return false;
    }

    private static boolean containsMap(Map<?, ?> source, Object target, boolean ignoreCase) {
        if (target instanceof Map.Entry<?, ?> entry) {
            return containsMapEntry(source, entry, ignoreCase);
        }

        for (Map.Entry<?, ?> entry : source.entrySet()) {
            if (matches(entry.getKey(), target, ignoreCase) || matches(entry.getValue(), target, ignoreCase)) {
                return true;
            }
        }

        return false;
    }

    private static boolean containsMapEntry(Map<?, ?> source, Map.Entry<?, ?> target, boolean ignoreCase) {
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            if (matches(entry.getKey(), target.getKey(), ignoreCase)
                    || matches(entry.getValue(), target.getValue(), ignoreCase)) {
                return true;
            }
        }

        return false;
    }

    private static boolean matches(Object source, Object target, boolean ignoreCase) {
        if (source instanceof CharSequence sourceText) {
            return containsText(sourceText, target, ignoreCase);
        }

        return Objects.equals(source, target);
    }

    private static boolean startsWith(Object actual, Object expected) {
        return actual instanceof CharSequence actualText
                && isTextComparable(expected)
                && actualText.toString().startsWith(expected.toString());
    }

    private static boolean endsWith(Object actual, Object expected) {
        return actual instanceof CharSequence actualText
                && isTextComparable(expected)
                && actualText.toString().endsWith(expected.toString());
    }
}
