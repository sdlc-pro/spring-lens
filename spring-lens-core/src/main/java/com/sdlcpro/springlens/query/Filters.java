package com.sdlcpro.springlens.query;

import com.sdlcpro.springlens.util.Preconditions;

import java.lang.reflect.Array;
import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;

public final class Filters {

    private Filters() {
        throw new UnsupportedOperationException("The Filters is an utility class and cannot be instantiated");
    }

    private static boolean isValuePresent(Object value) {
        if (value == null) {
            return false;
        }

        if (value instanceof CharSequence charSequence
                && charSequence.toString().isBlank()) {
            return false;
        }

        if (value.getClass().isArray()
                && Array.getLength(value) <= 0) {
            return false;
        }

        if (value instanceof Collection<?> collection
                && collection.isEmpty()) {
            return false;
        }

        if (value instanceof Map<?, ?> map
                && map.isEmpty()) {
            return false;
        }

        return !(value instanceof Optional<?> optional) || optional.isPresent();
    }

    public static Filter eqIfPresent(String property, Object value) {
        return isValuePresent(value) ? eq(property, value) : Filter.UNFILTERED;
    }

    public static Filter eqIfPresent(String property, Object testValue, Supplier<?> valueSupplier) {
        Preconditions.notNull(valueSupplier, "Value supplier must not be null");
        return isValuePresent(testValue)
                ? eq(property, Preconditions.requireNonNull(valueSupplier.get(), "Supplied value must not be null"))
                : Filter.UNFILTERED;
    }

    public static <T, R> Filter eqIfPresent(String property, T value, Function<T, R> valueMapper) {
        Preconditions.notNull(valueMapper, "Value mapper must not be null");
        return isValuePresent(value)
                ? eq(property, Preconditions.requireNonNull(valueMapper.apply(value), "Mapped value must not be null"))
                : Filter.UNFILTERED;
    }

    public static Filter orIfPresent(Object value, Filter... filters) {
        return isValuePresent(value) ? or(filters) : Filter.UNFILTERED;

    }

    public static Filter eqIgnoreCaseIfPresent(String property, Object value) {
        return isValuePresent(value) ? eqIgnoreCase(property, value) : Filter.UNFILTERED;
    }

    public static Filter containsIfPresent(String property, Object value) {
        return isValuePresent(value) ? contains(property, value) : Filter.UNFILTERED;
    }

    public static <T, R> Filter containsIfPresent(String property, T value, Function<T, R> valueMapper) {
        Preconditions.notNull(valueMapper, "Value mapper must not be null");
        return isValuePresent(value)
                ? contains(property, Preconditions.requireNonNull(valueMapper.apply(value), "Mapped value must not be null"))
                : Filter.UNFILTERED;
    }

    public static <T, R> Filter containsIgnoreCaseIfPresent(String property, T value, Function<T, R> valueMapper) {
        Preconditions.notNull(valueMapper, "Value mapper must not be null");
        return isValuePresent(value)
                ? containsIgnoreCase(property, Preconditions.requireNonNull(valueMapper.apply(value), "Mapped value must not be null"))
                : Filter.UNFILTERED;
    }

    public static Filter containsIgnoreCaseIfPresent(String property, Object value) {
        return isValuePresent(value) ? containsIgnoreCase(property, value) : Filter.UNFILTERED;
    }

    public static Filter eq(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.EQUALS, value);
    }

    public static Filter eqIgnoreCase(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.EQUALS_IGNORE_CASE, value);
    }

    public static Filter ne(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.NOT_EQUALS, value);
    }

    public static Filter gt(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.GREATER_THAN, value);
    }

    public static Filter lt(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.LESS_THAN, value);
    }

    public static Filter gte(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.GREATER_THAN_OR_EQUALS, value);
    }

    public static Filter lte(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.LESS_THAN_OR_EQUALS, value);
    }

    public static Filter contains(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.CONTAINS, value);
    }

    public static Filter containsIgnoreCase(String property, Object value) {
        return ConditionalFilter.of(property, ConditionalOperator.CONTAINS_IGNORE_CASE, value);
    }

    public static Filter startsWith(String property, CharSequence value) {
        return ConditionalFilter.of(property, ConditionalOperator.STARTS_WITH, value);
    }

    public static Filter endsWith(String property, CharSequence value) {
        return ConditionalFilter.of(property, ConditionalOperator.ENDS_WITH, value);
    }

    public static Filter and(Filter... filters) {
        return and(Arrays.stream(filters).toList());
    }

    public static Filter and(List<Filter> filters) {
        return CompositeFilter.of(LogicalOperator.AND, filters);
    }

    public static Filter or(Filter... filters) {
        return or(Arrays.stream(filters).toList());
    }

    public static Filter or(List<Filter> filters) {
        return CompositeFilter.of(LogicalOperator.OR, filters);
    }

    public static Filter all() {
        return Filter.UNFILTERED;
    }
}
