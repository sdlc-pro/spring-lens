package com.sdlcpro.springlens.query;

import com.sdlcpro.springlens.accessor.FieldAccessorCache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class FilterToPredicateConverterTest {

    @BeforeEach
    void setUp() {
        FieldAccessorCache.clear();
    }

    @MethodSource("equalsCases")
    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    void shouldEvaluateEquals(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.EQUALS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @MethodSource("notEqualsCases")
    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    void shouldEvaluateNotEquals(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.NOT_EQUALS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("equalsIgnoreCaseCases")
    void shouldEvaluateEqualsIgnoreCase(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.EQUALS_IGNORE_CASE, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("greaterThanCases")
    void shouldEvaluateGreaterThan(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.GREATER_THAN, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("lessThanCases")
    void shouldEvaluateLessThan(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.LESS_THAN, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("greaterThanOrEqualsCases")
    void shouldEvaluateGreaterThanOrEquals(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.GREATER_THAN_OR_EQUALS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("lessThanOrEqualsCases")
    void shouldEvaluateLessThanOrEquals(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.LESS_THAN_OR_EQUALS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("startsWithCases")
    void shouldEvaluateStartsWith(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.STARTS_WITH, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("endsWithCases")
    void shouldEvaluateEndsWith(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.ENDS_WITH, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsTextCases")
    void shouldEvaluateContainsForCharSequence(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsTextIgnoreCaseCases")
    void shouldEvaluateContainsIgnoreCaseForCharSequence(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS_IGNORE_CASE, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsArrayCases")
    void shouldEvaluateContainsForArray(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsIgnoreCaseArrayCases")
    void shouldEvaluateContainsIgnoreCaseForArray(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS_IGNORE_CASE, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsIterableCases")
    void shouldEvaluateContainsForIterable(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsIgnoreCaseIterableCases")
    void shouldEvaluateContainsIgnoreCaseForIterable(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS_IGNORE_CASE, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsMapCases")
    void shouldEvaluateContainsForMap(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}, expected={2}")
    @MethodSource("containsIgnoreCaseMapCases")
    void shouldEvaluateContainsIgnoreCaseForMap(Object testValue, Object filterValue, boolean expected) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS_IGNORE_CASE, filterValue);
        var predicate = converter.convert(filter);
        assertEquals(expected, predicate.test(new TestModel(testValue)));
    }

    @ParameterizedTest(name = "[{index}] test_value={0}, filter_value={1}")
    @MethodSource("unsupportedContainmentCases")
    void shouldReturnFalseForUnsupportedContainmentSource(Object testValue, Object filterValue) {
        var converter = createConverter();
        var filter = createFilter(ConditionalOperator.CONTAINS, filterValue);
        var predicate = converter.convert(filter);
        assertFalse(predicate.test(new TestModel(testValue)));
    }

    private static Stream<Arguments> equalsCases() {
        var sharedArray = new int[]{1, 2, 3};
        var sharedList = List.of(1, 2, 3);
        var sharedSet = Set.of(1, 2, 3);
        var sharedMap = Map.of(1, "Java", 2, "Spring");

        return Stream.of(
                arguments("Java", "Java", true),
                arguments("Java", "Spring", false),
                arguments("", "", true),
                arguments("", "Java", false),
                arguments("Java", "java", false),

                arguments(null, null, true),
                arguments(null, "Java", false),
                arguments("Java", null, false),

                arguments(100, 100, true),
                arguments(100, 100L, false),
                arguments(100, 100.0, false),
                arguments(100.0, 100.0, true),
                arguments(
                        new BigDecimal("100.00"),
                        new BigDecimal("100.00"),
                        true
                ),
                arguments(
                        new BigDecimal("100.0"),
                        new BigDecimal("100.00"),
                        false
                ),
                arguments(
                        new BigInteger("100"),
                        new BigInteger("100"),
                        true
                ),

                arguments(true, true, true),
                arguments(true, false, false),

                arguments('A', 'A', true),
                arguments('A', 'a', false),

                arguments(Status.ACTIVE, Status.ACTIVE, true),
                arguments(Status.ACTIVE, Status.INACTIVE, false),

                arguments(sharedArray, sharedArray, true),
                arguments(sharedList, sharedList, true),
                arguments(sharedSet, sharedSet, true),
                arguments(sharedMap, sharedMap, true),

                arguments(
                        new int[]{1, 2, 3},
                        new int[]{1, 2, 3},
                        false
                ),
                arguments(
                        new String[]{"Java"},
                        new String[]{"Java"},
                        false
                ),

                arguments(
                        List.of("Java", "Spring"),
                        List.of("Java", "Spring"),
                        true
                ),
                arguments(
                        List.of("Java", "Spring"),
                        List.of("Spring", "Java"),
                        false
                ),
                arguments(
                        List.of("Java"),
                        List.of("Java", "Spring"),
                        false
                ),

                arguments(
                        Map.of("language", "Java"),
                        Map.of("language", "Java"),
                        true
                ),
                arguments(
                        Map.of("language", "Java"),
                        Map.of("language", "Kotlin"),
                        false
                ),

                arguments(
                        new TestValue("Java"),
                        new TestValue("Java"),
                        true
                ),
                arguments(
                        new TestValue("Java"),
                        new TestValue("Spring"),
                        false
                )
        );
    }

    private static Stream<Arguments> notEqualsCases() {
        var sharedArray = new int[]{1, 2, 3};
        var sharedList = List.of(1, 2, 3);
        var sharedSet = Set.of(1, 2, 3);
        var sharedMap = Map.of(1, "Java", 2, "Spring");

        return Stream.of(
                arguments("Java", "Java", false),
                arguments("Java", "Spring", true),
                arguments("", "", false),
                arguments("", "Java", true),
                arguments("Java", "java", true),

                arguments(null, null, false),
                arguments(null, "Java", true),
                arguments("Java", null, true),

                arguments(100, 100, false),
                arguments(100, 100L, true),
                arguments(100, 100.0, true),
                arguments(100.0, 100.0, false),
                arguments(
                        new BigDecimal("100.00"),
                        new BigDecimal("100.00"),
                        false
                ),
                arguments(
                        new BigDecimal("100.0"),
                        new BigDecimal("100.00"),
                        true
                ),
                arguments(
                        new BigInteger("100"),
                        new BigInteger("100"),
                        false
                ),

                arguments(true, true, false),
                arguments(true, false, true),

                arguments('A', 'A', false),
                arguments('A', 'a', true),

                arguments(Status.ACTIVE, Status.ACTIVE, false),
                arguments(Status.ACTIVE, Status.INACTIVE, true),

                arguments(sharedArray, sharedArray, false),
                arguments(sharedList, sharedList, false),
                arguments(sharedSet, sharedSet, false),
                arguments(sharedMap, sharedMap, false),

                arguments(
                        new int[]{1, 2, 3},
                        new int[]{1, 2, 3},
                        true
                ),
                arguments(
                        new String[]{"Java"},
                        new String[]{"Java"},
                        true
                ),

                arguments(
                        List.of("Java", "Spring"),
                        List.of("Java", "Spring"),
                        false
                ),
                arguments(
                        List.of("Java", "Spring"),
                        List.of("Spring", "Java"),
                        true
                ),
                arguments(
                        List.of("Java"),
                        List.of("Java", "Spring"),
                        true
                ),

                arguments(
                        Map.of("language", "Java"),
                        Map.of("language", "Java"),
                        false
                ),
                arguments(
                        Map.of("language", "Java"),
                        Map.of("language", "Kotlin"),
                        true
                ),

                arguments(
                        new TestValue("Java"),
                        new TestValue("Java"),
                        false
                ),
                arguments(
                        new TestValue("Java"),
                        new TestValue("Spring"),
                        true
                )
        );
    }

    private static Stream<Arguments> equalsIgnoreCaseCases() {
        return Stream.of(
                arguments("Java", "java", true),
                arguments("JAVA", "java", true),
                arguments("Spring Boot", "SPRING BOOT", true),
                arguments(new StringBuilder("Java"), "java", true),
                arguments(new StringBuffer("JAVA"), "java", true),
                arguments("Java", "Lava", false),

                arguments("123", 123, true),
                arguments("123.45", new BigDecimal("123.45"), true),
                arguments("100", BigInteger.valueOf(100), true),
                arguments("10.5", 10.5, true),
                arguments("123", 456, false),

                arguments("A", 'a', true),
                arguments("B", 'B', true),
                arguments("A", 'b', false),

                arguments("TRUE", true, true),
                arguments("false", false, true),
                arguments("TRUE", false, false),

                arguments("ACTIVE", Status.ACTIVE, true),
                arguments("inactive", Status.INACTIVE, true),
                arguments("PENDING", Status.PENDING, true),
                arguments("ACTIVE", Status.INACTIVE, false),

                arguments(123, 123, false),
                arguments(true, true, false),
                arguments('A', 'A', false),
                arguments(Status.ACTIVE, Status.ACTIVE, false),
                arguments("Java", new Object(), false),
                arguments(null, null, false),
                arguments(null, "Java", false),
                arguments("Java", null, false)
        );
    }

    private static Stream<Arguments> greaterThanCases() {
        return Stream.of(
                arguments(10, 5, true),
                arguments(5, 10, false),
                arguments(10, 10, false),

                arguments(10, 5L, true),
                arguments(5, 10.0, false),
                arguments(10.0, 10, false),

                arguments(new BigDecimal("10.50"), new BigDecimal("10.40"), true),
                arguments(new BigDecimal("10.40"), new BigDecimal("10.50"), false),

                arguments(BigInteger.valueOf(100), BigInteger.valueOf(50), true),

                arguments("Spring", "Java", true),
                arguments("Java", "Spring", false),

                arguments('B', 'A', true),
                arguments('A', 'B', false),

                arguments(true, false, true),
                arguments(false, true, false),

                arguments(Status.INACTIVE, Status.ACTIVE, true),
                arguments(Status.ACTIVE, Status.INACTIVE, false),

                arguments(null, 10, false),
                arguments(10, null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> lessThanCases() {
        return Stream.of(
                arguments(5, 10, true),
                arguments(10, 5, false),
                arguments(10, 10, false),

                arguments(5, 10L, true),
                arguments(10, 5.0, false),

                arguments(new BigDecimal("10.40"), new BigDecimal("10.50"), true),
                arguments(BigInteger.valueOf(50), BigInteger.valueOf(100), true),

                arguments("Java", "Spring", true),
                arguments("Spring", "Java", false),

                arguments('A', 'B', true),
                arguments('B', 'A', false),

                arguments(false, true, true),
                arguments(true, false, false),

                arguments(Status.ACTIVE, Status.INACTIVE, true),
                arguments(Status.INACTIVE, Status.ACTIVE, false),

                arguments(null, 10, false),
                arguments(10, null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> greaterThanOrEqualsCases() {
        return Stream.of(
                arguments(10, 5, true),
                arguments(5, 10, false),
                arguments(10, 10, true),

                arguments(10, 5L, true),
                arguments(5, 10.0, false),
                arguments(10.0, 10, true),

                arguments(new BigDecimal("10.50"), new BigDecimal("10.40"), true),
                arguments(new BigDecimal("10.50"), new BigDecimal("10.50"), true),

                arguments(BigInteger.valueOf(100), BigInteger.valueOf(100), true),

                arguments("Spring", "Java", true),
                arguments("Java", "Spring", false),
                arguments("Java", "Java", true),

                arguments('B', 'A', true),
                arguments('A', 'B', false),
                arguments('A', 'A', true),

                arguments(true, false, true),
                arguments(false, true, false),
                arguments(true, true, true),

                arguments(Status.INACTIVE, Status.ACTIVE, true),
                arguments(Status.ACTIVE, Status.INACTIVE, false),
                arguments(Status.ACTIVE, Status.ACTIVE, true),

                arguments(null, 10, false),
                arguments(10, null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> lessThanOrEqualsCases() {
        return Stream.of(
                arguments(5, 10, true),
                arguments(10, 5, false),
                arguments(10, 10, true),

                arguments(5, 10L, true),
                arguments(10, 5.0, false),
                arguments(10.0, 10, true),

                arguments(new BigDecimal("10.40"), new BigDecimal("10.50"), true),
                arguments(new BigDecimal("10.50"), new BigDecimal("10.50"), true),

                arguments(BigInteger.valueOf(50), BigInteger.valueOf(100), true),

                arguments("Java", "Spring", true),
                arguments("Spring", "Java", false),
                arguments("Java", "Java", true),

                arguments('A', 'B', true),
                arguments('B', 'A', false),
                arguments('A', 'A', true),

                arguments(false, true, true),
                arguments(true, false, false),
                arguments(true, true, true),

                arguments(Status.ACTIVE, Status.INACTIVE, true),
                arguments(Status.INACTIVE, Status.ACTIVE, false),
                arguments(Status.ACTIVE, Status.ACTIVE, true),

                arguments(null, 10, false),
                arguments(10, null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> startsWithCases() {
        return Stream.of(
                arguments("Spring Boot", "Spring", true),
                arguments("Spring Boot", "Boot", false),
                arguments("Spring Boot", "Spring Boot", true),
                arguments("Spring Boot", "", true),
                arguments("", "", true),
                arguments("", "Java", false),

                arguments("Spring Boot", "spring", false),
                arguments("JAVA", "Java", false),

                arguments(new StringBuilder("Spring Boot"), "Spring", true),
                arguments(new StringBuilder("Spring Boot"), "Boot", false),

                arguments(new StringBuffer("Spring Boot"), "Spring", true),
                arguments(new StringBuffer("Spring Boot"), "Boot", false),

                arguments("123456", 123, true),
                arguments("123456", 456, false),
                arguments("10.50", new BigDecimal("10"), true),
                arguments("100", 100, true),

                arguments("Abdullah", 'A', true),
                arguments("Abdullah", 'B', false),

                arguments("trueValue", true, true),
                arguments("falseValue", false, true),
                arguments("trueValue", false, false),

                arguments("ACTIVE_STATUS", Status.ACTIVE, true),
                arguments("INACTIVE_STATUS", Status.ACTIVE, false),

                arguments(123, "1", false),
                arguments(true, "true", false),
                arguments('A', "A", false),
                arguments(Status.ACTIVE, "ACTIVE", false),

                arguments("Spring Boot", new Object(), false),

                arguments(null, "Spring", false),
                arguments("Spring Boot", null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> endsWithCases() {
        return Stream.of(
                arguments("Spring Boot", "Boot", true),
                arguments("Spring Boot", "Spring", false),
                arguments("Spring Boot", "Spring Boot", true),
                arguments("Spring Boot", "", true),
                arguments("", "", true),
                arguments("", "Java", false),

                arguments("Spring Boot", "boot", false),
                arguments("JAVA", "ava", false),
                arguments("JAVA", "AVA", true),

                arguments(new StringBuilder("Spring Boot"), "Boot", true),
                arguments(new StringBuilder("Spring Boot"), "Spring", false),

                arguments(new StringBuffer("Spring Boot"), "Boot", true),
                arguments(new StringBuffer("Spring Boot"), "Spring", false),

                arguments("Spring123", 123, true),
                arguments("Spring123", 12, false),
                arguments("Price: 10.50", new BigDecimal("10.50"), true),
                arguments("Value: 100", 100, true),

                arguments("Abdullah", 'h', true),
                arguments("Abdullah", 'A', false),

                arguments("value_true", true, true),
                arguments("value_false", false, true),
                arguments("value_true", false, false),

                arguments("STATUS_ACTIVE", Status.ACTIVE, true),
                arguments("STATUS_PENDING", Status.ACTIVE, false),

                arguments(123, "3", false),
                arguments(true, "true", false),
                arguments('A', "A", false),
                arguments(Status.ACTIVE, "ACTIVE", false),

                arguments("Spring Boot", new Object(), false),

                arguments(null, "Boot", false),
                arguments("Spring Boot", null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsTextCases() {
        return Stream.of(
                arguments("Spring Boot Framework", "Boot", true),
                arguments("Spring Boot Framework", "Spring", true),
                arguments("Spring Boot Framework", "Framework", true),
                arguments("Spring Boot Framework", "Boot Framework", true),
                arguments("Spring Boot Framework", "Spring Boot Framework", true),
                arguments("Spring Boot Framework", "Java", false),

                arguments("Spring Boot Framework", "spring", false),
                arguments("Spring Boot Framework", "BOOT", false),
                arguments("Spring Boot Framework", "Framework", true),

                arguments("Spring Boot", "", true),
                arguments("", "", true),
                arguments("", "Spring", false),

                arguments(new StringBuilder("Spring Boot Framework"), "Boot", true),
                arguments(new StringBuilder("Spring Boot Framework"), "Java", false),
                arguments("Spring Boot Framework", new StringBuilder("Boot"), true),
                arguments("Spring Boot Framework", new StringBuilder("Java"), false),
                arguments(new StringBuilder("Spring Boot Framework"), new StringBuilder("Boot"), true),
                arguments(new StringBuilder("Spring Boot Framework"), new StringBuilder("Java"), false),

                arguments(new StringBuffer("Spring Boot Framework"), "Boot", true),
                arguments(new StringBuffer("Spring Boot Framework"), "Java", false),
                arguments("Spring Boot Framework", new StringBuffer("Boot"), true),
                arguments("Spring Boot Framework", new StringBuffer("Java"), false),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuffer("Boot"), true),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuffer("Java"), false),

                arguments(new StringBuilder("Spring Boot Framework"), new StringBuffer("Boot"), true),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuilder("Boot"), true),
                arguments(new StringBuilder("Spring Boot Framework"), new StringBuffer("Java"), false),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuilder("Java"), false),

                arguments("Price: 10.50 USD", new BigDecimal("10.50"), true),
                arguments("Price: 10.50 USD", new BigInteger("10"), true),
                arguments("Price: 10.50 USD", 10, true),
                arguments("Price: 10.50 USD", 10.50f, true),
                arguments("Price: 10.50 USD", 10.50, true),
                arguments("Price: 10.50 USD", 15, false),
                arguments("Price: 10.50 USD", 15.50f, false),
                arguments("Price: 10.50 USD", 15.50, false),

                arguments("Spring Boot", 'B', true),
                arguments("Spring Boot", 'b', false),
                arguments("Spring Boot", 'J', false),

                arguments("Become a true programmer", true, true),
                arguments("This is a false matter", false, true),
                arguments("Become a true programmer", false, false),

                arguments("Current status: ACTIVE", Status.ACTIVE, true),
                arguments("Current status: INACTIVE", Status.PENDING, false),

                arguments("Spring Boot Framework", new Object(), false),
                arguments("Spring Boot Framework", new int[]{1, 2, 3}, false),

                arguments(null, "Spring", false),
                arguments("Spring Boot", null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsTextIgnoreCaseCases() {
        return Stream.of(
                arguments("Spring Boot Framework", "boot", true),
                arguments("Spring Boot Framework", "SPRING", true),
                arguments("Spring Boot Framework", "FRAMEWORK", true),
                arguments("Spring Boot Framework", "BOOT FRAMEWORK", true),
                arguments("Spring Boot Framework", "Java", false),

                arguments("sPrInG bOoT", "SPRING", true),
                arguments("SPRING BOOT", "spring boot", true),
                arguments("Java Framework", "FRAME", true),

                arguments("Spring Boot", "", true),
                arguments("", "", true),
                arguments("", "Spring", false),

                arguments(new StringBuilder("Spring Boot Framework"), "bOoT", true),
                arguments(new StringBuilder("Spring Boot Framework"), "JAVA", false),
                arguments("Spring Boot Framework", new StringBuilder("bOoT"), true),
                arguments("Spring Boot Framework", new StringBuilder("JAVA"), false),
                arguments(new StringBuilder("Spring Boot Framework"), new StringBuilder("bOoT"), true),
                arguments(new StringBuilder("Spring Boot Framework"), new StringBuilder("JAVA"), false),

                arguments(new StringBuffer("Spring Boot Framework"), "bOoT", true),
                arguments(new StringBuffer("Spring Boot Framework"), "JAVA", false),
                arguments("Spring Boot Framework", new StringBuffer("bOoT"), true),
                arguments("Spring Boot Framework", new StringBuffer("JAVA"), false),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuffer("bOoT"), true),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuffer("JAVA"), false),

                arguments(new StringBuilder("Spring Boot Framework"), new StringBuffer("bOot"), true),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuilder("bOot"), true),
                arguments(new StringBuilder("Spring Boot Framework"), new StringBuffer("java"), false),
                arguments(new StringBuffer("Spring Boot Framework"), new StringBuilder("java"), false),

                arguments("Spring Boot", 'b', true),
                arguments("Spring Boot", 'B', true),
                arguments("Spring Boot", 'j', false),

                arguments("Become a true programmer", true, true),
                arguments("This is a False matter", false, true),
                arguments("Become a true programmer", false, false),

                arguments("Current status: active", Status.ACTIVE, true),
                arguments("Current status: inactive", Status.PENDING, false),

                arguments("Spring Boot Framework", new Object(), false),
                arguments("Spring Boot Framework", new int[]{1, 2, 3}, false),

                arguments(null, "Spring", false),
                arguments("Spring Boot", null, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsArrayCases() {
        return Stream.of(
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Spring", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Boot", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Framework", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Java", false),

                arguments(new String[]{"Spring", "Boot", "Framework"}, "spring", false),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "BOOT", false),

                arguments(new String[]{"Spring Boot Framework"}, "Boot", true),
                arguments(new String[]{"Spring Boot Framework"}, "Spring", true),
                arguments(new String[]{"Spring Boot Framework"}, "Framework", true),
                arguments(new String[]{"Spring Boot Framework"}, "Java", false),

                arguments(new String[]{"Spring Boot Framework"}, "spring", false),
                arguments(new String[]{"Spring Boot Framework"}, "BOOT", false),

                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, "Boot", true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, 123, true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, true, true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, Status.ACTIVE, true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, 456, false),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, false, false),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, new StringBuilder("Spring"), true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, new StringBuffer("Spring"), true),
                arguments(new Object[]{new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE}, "Spring", true),
                arguments(new Object[]{new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE}, "Spring", true),
                arguments(new Object[]{new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE}, new StringBuffer("Spring"), true),
                arguments(new Object[]{new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE}, new StringBuilder("Spring"), true),

                arguments(new Integer[]{10, 20, 30}, 10, true),
                arguments(new Integer[]{10, 20, 30}, 20, true),
                arguments(new Integer[]{10, 20, 30}, 40, false),
                arguments(new Integer[]{10, 20, 30}, "20", false),

                arguments(new int[]{10, 20, 30}, 10, true),
                arguments(new int[]{10, 20, 30}, 20, true),
                arguments(new int[]{10, 20, 30}, 30, true),
                arguments(new int[]{10, 20, 30}, 40, false),
                arguments(new int[]{10, 20, 30}, "20", false),

                arguments(new long[]{100L, 200L, 300L}, 100L, true),
                arguments(new long[]{100L, 200L, 300L}, 200L, true),
                arguments(new long[]{100L, 200L, 300L}, 400L, false),

                arguments(new double[]{10.5, 20.5, 30.5}, 10.5, true),
                arguments(new double[]{10.5, 20.5, 30.5}, 20.5, true),
                arguments(new double[]{10.5, 20.5, 30.5}, 40.5, false),

                arguments(new boolean[]{true, false}, true, true),
                arguments(new boolean[]{true, false}, false, true),

                arguments(new char[]{'S', 'p', 'r', 'i', 'n', 'g'}, 'S', true),
                arguments(new char[]{'S', 'p', 'r', 'i', 'n', 'g'}, 'g', true),
                arguments(new char[]{'S', 'p', 'r', 'i', 'n', 'g'}, 'B', false),

                arguments(new String[]{}, "Spring", false),
                arguments(new Integer[]{}, 10, false),
                arguments(new int[]{}, 10, false),

                arguments(new String[]{null, "Spring", "Boot"}, "Spring", true),
                arguments(new String[]{null, "Spring", "Boot"}, "Java", false),
                arguments(new String[]{null, "Spring", "Boot"}, null, true),
                arguments(new Object[]{null, 10, 20}, 10, true),
                arguments(new Object[]{null, 10, 20}, null, true),

                arguments(new String[]{"Spring", "Boot"}, new Object(), false),
                arguments(new String[]{"Spring", "Boot"}, new int[]{1, 2, 3}, false),
                arguments(new Integer[]{10, 20, 30}, new Object(), false),

                arguments(null, "Spring", false),
                arguments(null, 10, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsIgnoreCaseArrayCases() {
        return Stream.of(
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Spring", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Boot", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Framework", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "Java", false),

                arguments(new String[]{"Spring", "Boot", "Framework"}, "spring", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "SPRING", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "BOOT", true),
                arguments(new String[]{"Spring", "Boot", "Framework"}, "framework", true),

                arguments(new String[]{"Spring Boot Framework"}, "Boot", true),
                arguments(new String[]{"Spring Boot Framework"}, "Spring", true),
                arguments(new String[]{"Spring Boot Framework"}, "Framework", true),
                arguments(new String[]{"Spring Boot Framework"}, "Java", false),

                arguments(new String[]{"Spring Boot Framework"}, "spring", true),
                arguments(new String[]{"Spring Boot Framework"}, "SPRING", true),
                arguments(new String[]{"Spring Boot Framework"}, "boot", true),
                arguments(new String[]{"Spring Boot Framework"}, "BOOT", true),
                arguments(new String[]{"Spring Boot Framework"}, "framework", true),
                arguments(new String[]{"Spring Boot Framework"}, "FRAMEWORK", true),
                arguments(new String[]{"Spring Boot Framework"}, "JAVA", false),

                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, "boot", true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, "BOOT", true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, 123, true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, true, true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, Status.ACTIVE, true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, 456, false),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, false, false),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, new StringBuilder("spring"), true),
                arguments(new Object[]{"Spring Boot", 123, true, Status.ACTIVE}, new StringBuffer("boot"), true),
                arguments(new Object[]{new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE}, "spring", true),
                arguments(new Object[]{new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE}, "boot", true),
                arguments(new Object[]{new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE}, new StringBuffer("spring"), true),
                arguments(new Object[]{new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE}, new StringBuilder("boot"), true),

                arguments(new Integer[]{10, 20, 30}, 10, true),
                arguments(new Integer[]{10, 20, 30}, 20, true),
                arguments(new Integer[]{10, 20, 30}, 40, false),
                arguments(new Integer[]{10, 20, 30}, "20", false),

                arguments(new int[]{10, 20, 30}, 10, true),
                arguments(new int[]{10, 20, 30}, 20, true),
                arguments(new int[]{10, 20, 30}, 30, true),
                arguments(new int[]{10, 20, 30}, 40, false),
                arguments(new int[]{10, 20, 30}, "20", false),

                arguments(new long[]{100L, 200L, 300L}, 100L, true),
                arguments(new long[]{100L, 200L, 300L}, 200L, true),
                arguments(new long[]{100L, 200L, 300L}, 400L, false),

                arguments(new double[]{10.5, 20.5, 30.5}, 10.5, true),
                arguments(new double[]{10.5, 20.5, 30.5}, 20.5, true),
                arguments(new double[]{10.5, 20.5, 30.5}, 40.5, false),

                arguments(new boolean[]{true, false}, true, true),
                arguments(new boolean[]{true, false}, false, true),

                arguments(new char[]{'S', 'p', 'r', 'i', 'n', 'g'}, 'S', true),
                arguments(new char[]{'S', 'p', 'r', 'i', 'n', 'g'}, 'g', true),
                arguments(new char[]{'S', 'p', 'r', 'i', 'n', 'g'}, 'B', false),

                arguments(new String[]{}, "Spring", false),
                arguments(new Integer[]{}, 10, false),
                arguments(new int[]{}, 10, false),

                arguments(new String[]{null, "Spring", "Boot"}, "spring", true),
                arguments(new String[]{null, "Spring", "Boot"}, "BOOT", true),
                arguments(new String[]{null, "Spring", "Boot"}, "Java", false),
                arguments(new String[]{null, "Spring", "Boot"}, null, true),
                arguments(new Object[]{null, 10, 20}, 10, true),
                arguments(new Object[]{null, 10, 20}, null, true),

                arguments(new String[]{"Spring", "Boot"}, new Object(), false),
                arguments(new String[]{"Spring", "Boot"}, new int[]{1, 2, 3}, false),
                arguments(new Integer[]{10, 20, 30}, new Object(), false),

                arguments(null, "Spring", false),
                arguments(null, 10, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsIterableCases() {
        return Stream.of(
                arguments(List.of("Spring", "Boot", "Framework"), "Spring", true),
                arguments(List.of("Spring", "Boot", "Framework"), "Boot", true),
                arguments(List.of("Spring", "Boot", "Framework"), "Framework", true),
                arguments(List.of("Spring", "Boot", "Framework"), "Java", false),

                arguments(List.of("Spring", "Boot", "Framework"), "spring", false),
                arguments(List.of("Spring", "Boot", "Framework"), "BOOT", false),

                arguments(List.of("Spring Boot Framework"), "Boot", true),
                arguments(List.of("Spring Boot Framework"), "Spring", true),
                arguments(List.of("Spring Boot Framework"), "Framework", true),
                arguments(List.of("Spring Boot Framework"), "Java", false),

                arguments(List.of("Spring Boot Framework"), "spring", false),
                arguments(List.of("Spring Boot Framework"), "BOOT", false),

                arguments(new LinkedList<>(List.of("Spring", "Boot")), "Spring", true),
                arguments(new LinkedList<>(List.of("Spring", "Boot")), "Java", false),

                arguments(new LinkedHashSet<>(List.of("Spring", "Boot", "Framework")), "Spring", true),
                arguments(new LinkedHashSet<>(List.of("Spring", "Boot", "Framework")), "Java", false),

                arguments(new LinkedHashSet<>(List.of("Spring Boot Framework")), "Boot", true),
                arguments(new LinkedHashSet<>(List.of("Spring Boot Framework")), "Java", false),

                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), "Spring", true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), "Boot", true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), 123, true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), true, true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), Status.ACTIVE, true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), 456, false),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), false, false),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), new StringBuilder("Spring"), true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), new StringBuffer("Spring"), true),
                arguments(List.of(new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE), "Spring", true),
                arguments(List.of(new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE), "Spring", true),
                arguments(List.of(new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE), new StringBuffer("Spring"), true),
                arguments(List.of(new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE), new StringBuilder("Spring"), true),

                arguments(List.of(10, 20, 30), 10, true),
                arguments(List.of(10, 20, 30), 20, true),
                arguments(List.of(10, 20, 30), 40, false),
                arguments(List.of(10, 20, 30), "20", false),

                arguments(List.of('S', 'p', 'r', 'i', 'n', 'g'), 'S', true),
                arguments(List.of('S', 'p', 'r', 'i', 'n', 'g'), 'g', true),
                arguments(List.of('S', 'p', 'r', 'i', 'n', 'g'), 'B', false),

                arguments(List.of(true, false), true, true),
                arguments(List.of(true, false), false, true),

                arguments(Collections.emptyList(), "Spring", false),
                arguments(Collections.emptySet(), 10, false),

                arguments(Arrays.asList(null, "Spring", "Boot"), "Spring", true),
                arguments(Arrays.asList(null, "Spring", "Boot"), "Java", false),
                arguments(Arrays.asList(null, "Spring", "Boot"), null, true),
                arguments(Arrays.asList(null, 10, 20), 10, true),
                arguments(Arrays.asList(null, 10, 20), null, true),

                arguments((Iterable<String>) () -> List.of("Spring", "Boot", "Framework").iterator(), "Boot", true),
                arguments((Iterable<String>) () -> List.of("Spring", "Boot", "Framework").iterator(), "Java", false),
                arguments((Iterable<String>) () -> List.of("Spring Boot Framework").iterator(), "Boot", true),

                arguments(List.of("Spring", "Boot"), new Object(), false),
                arguments(List.of("Spring", "Boot"), new int[]{1, 2, 3}, false),
                arguments(List.of(10, 20, 30), new Object(), false),

                arguments(null, "Spring", false),
                arguments(null, 10, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsIgnoreCaseIterableCases() {
        return Stream.of(
                arguments(List.of("Spring", "Boot", "Framework"), "Spring", true),
                arguments(List.of("Spring", "Boot", "Framework"), "Boot", true),
                arguments(List.of("Spring", "Boot", "Framework"), "Framework", true),
                arguments(List.of("Spring", "Boot", "Framework"), "Java", false),

                arguments(List.of("Spring", "Boot", "Framework"), "spring", true),
                arguments(List.of("Spring", "Boot", "Framework"), "SPRING", true),
                arguments(List.of("Spring", "Boot", "Framework"), "boot", true),
                arguments(List.of("Spring", "Boot", "Framework"), "BOOT", true),
                arguments(List.of("Spring", "Boot", "Framework"), "framework", true),

                arguments(List.of("Spring Boot Framework"), "spring", true),
                arguments(List.of("Spring Boot Framework"), "SPRING", true),
                arguments(List.of("Spring Boot Framework"), "boot", true),
                arguments(List.of("Spring Boot Framework"), "BOOT", true),
                arguments(List.of("Spring Boot Framework"), "framework", true),
                arguments(List.of("Spring Boot Framework"), "FRAMEWORK", true),
                arguments(List.of("Spring Boot Framework"), "JAVA", false),

                arguments(new LinkedList<>(List.of("Spring", "Boot")), "spring", true),
                arguments(new LinkedList<>(List.of("Spring", "Boot")), "BOOT", true),
                arguments(new LinkedList<>(List.of("Spring", "Boot")), "Java", false),

                arguments(new LinkedHashSet<>(List.of("Spring", "Boot", "Framework")), "spring", true),
                arguments(new LinkedHashSet<>(List.of("Spring", "Boot", "Framework")), "BOOT", true),
                arguments(new LinkedHashSet<>(List.of("Spring Boot Framework")), "boot", true),
                arguments(new LinkedHashSet<>(List.of("Spring Boot Framework")), "JAVA", false),

                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), "boot", true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), "BOOT", true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), 123, true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), true, true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), Status.ACTIVE, true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), 456, false),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), false, false),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), new StringBuilder("spring"), true),
                arguments(List.of("Spring Boot", 123, true, Status.ACTIVE), new StringBuffer("boot"), true),
                arguments(List.of(new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE), "spring", true),
                arguments(List.of(new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE), "boot", true),
                arguments(List.of(new StringBuilder("Spring Boot"), 123, true, Status.ACTIVE), new StringBuffer("spring"), true),
                arguments(List.of(new StringBuffer("Spring Boot"), 123, true, Status.ACTIVE), new StringBuilder("boot"), true),

                arguments(List.of(10, 20, 30), 10, true),
                arguments(List.of(10, 20, 30), 20, true),
                arguments(List.of(10, 20, 30), 40, false),
                arguments(List.of(10, 20, 30), "20", false),

                arguments(List.of('S', 'p', 'r', 'i', 'n', 'g'), 'S', true),
                arguments(List.of('S', 'p', 'r', 'i', 'n', 'g'), 'g', true),
                arguments(List.of('S', 'p', 'r', 'i', 'n', 'g'), 'B', false),

                arguments(List.of(true, false), true, true),
                arguments(List.of(true, false), false, true),

                arguments(Collections.emptyList(), "Spring", false),
                arguments(Collections.emptySet(), 10, false),

                arguments(Arrays.asList(null, "Spring", "Boot"), "spring", true),
                arguments(Arrays.asList(null, "Spring", "Boot"), "BOOT", true),
                arguments(Arrays.asList(null, "Spring", "Boot"), "Java", false),
                arguments(Arrays.asList(null, "Spring", "Boot"), null, true),
                arguments(Arrays.asList(null, 10, 20), 10, true),
                arguments(Arrays.asList(null, 10, 20), null, true),

                arguments((Iterable<String>) () -> List.of("Spring", "Boot", "Framework").iterator(), "spring", true),
                arguments((Iterable<String>) () -> List.of("Spring", "Boot", "Framework").iterator(), "BOOT", true),
                arguments((Iterable<String>) () -> List.of("Spring Boot Framework").iterator(), "boot", true),

                arguments(List.of("Spring", "Boot"), new Object(), false),
                arguments(List.of("Spring", "Boot"), new int[]{1, 2, 3}, false),
                arguments(List.of(10, 20, 30), new Object(), false),

                arguments(null, "Spring", false),
                arguments(null, 10, false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsMapCases() {
        return Stream.of(
                arguments(Map.of("name", "Mamun", "language", "Java"), "name", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "language", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "email", false),

                arguments(Map.of("name", "Mamun", "language", "Java"), "Mamun", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "Java", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "Spring", false),

                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "first", true),
                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "Name", true),
                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "middle", false),

                arguments(Map.of("framework", "Spring Boot Framework"), "Spring", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "Boot", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "Framework", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "Java", false),

                arguments(Map.of("language", "Java"), "java", false),
                arguments(Map.of("language", "Java"), "JAVA", false),
                arguments(Map.of("Language", "Java"), "language", false),

                arguments(Map.of("name", "Mamun", "age", 30, "active", true), "Mamun", true),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), 30, true),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), true, true),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), 40, false),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), false, false),

                arguments(Map.of("status", Status.ACTIVE), Status.ACTIVE, true),
                arguments(Map.of("status", Status.ACTIVE), Status.INACTIVE, false),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("name", "Unknown"),
                        true
                ),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("unknown", "Java"),
                        true
                ),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("name", "Mamun"),
                        true
                ),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("email", "example@example.com"),
                        false
                ),

                arguments(
                        Map.of("firstName", "Mamun"),
                        Map.entry("first", "Unknown"),
                        true
                ),

                arguments(
                        Map.of("name", "Spring Boot Framework"),
                        Map.entry("unknown", "Boot"),
                        true
                ),

                arguments(
                        Map.of("language", "Java"),
                        Map.entry("LANGUAGE", "Unknown"),
                        false
                ),

                arguments(
                        Map.of("language", "Java"),
                        Map.entry("unknown", "java"),
                        false
                ),

                arguments(Collections.emptyMap(), "name", false),
                arguments(Collections.emptyMap(), "Mamun", false),
                arguments(Collections.emptyMap(), Map.entry("name", "Mamun"), false),

                arguments(
                        new HashMap<>() {{
                            put(null, "Mamun");
                            put("name", null);
                        }},
                        "Mamun",
                        true
                ),
                arguments(
                        new HashMap<>() {{
                            put(null, "Mamun");
                            put("name", null);
                        }},
                        null,
                        true
                ),

                arguments(Map.of("name", "Mamun"), new Object(), false),
                arguments(Map.of("name", "Mamun"), new int[]{1, 2, 3}, false),

                arguments(null, "name", false),
                arguments(null, Map.entry("name", "Mamun"), false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> containsIgnoreCaseMapCases() {
        return Stream.of(
                arguments(Map.of("name", "Mamun", "language", "Java"), "name", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "NAME", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "LANGUAGE", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "email", false),

                arguments(Map.of("name", "Mamun", "language", "Java"), "mamun", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "MAMUN", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "java", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "JAVA", true),
                arguments(Map.of("name", "Mamun", "language", "Java"), "Spring", false),

                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "first", true),
                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "FIRST", true),
                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "name", true),
                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "NAME", true),
                arguments(Map.of("firstName", "Mamun", "lastName", "Shikder"), "middle", false),

                arguments(Map.of("framework", "Spring Boot Framework"), "spring", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "SPRING", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "boot", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "BOOT", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "framework", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "FRAMEWORK", true),
                arguments(Map.of("framework", "Spring Boot Framework"), "java", false),

                arguments(Map.of("name", "Mamun", "age", 30, "active", true), "mamun", true),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), 30, true),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), true, true),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), 40, false),
                arguments(Map.of("name", "Mamun", "age", 30, "active", true), false, false),

                arguments(Map.of("status", Status.ACTIVE), Status.ACTIVE, true),
                arguments(Map.of("status", Status.ACTIVE), Status.INACTIVE, false),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("NAME", "Unknown"),
                        true
                ),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("unknown", "JAVA"),
                        true
                ),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("NAME", "MAMUN"),
                        true
                ),

                arguments(
                        Map.of("name", "Mamun", "language", "Java"),
                        Map.entry("EMAIL", "example@example.com"),
                        false
                ),

                arguments(
                        Map.of("firstName", "Mamun"),
                        Map.entry("FIRST", "Unknown"),
                        true
                ),

                arguments(
                        Map.of("name", "Spring Boot Framework"),
                        Map.entry("UNKNOWN", "boot"),
                        true
                ),

                arguments(
                        Map.of("language", "Java"),
                        Map.entry("LANGUAGE", "JAVA"),
                        true
                ),

                arguments(Collections.emptyMap(), "NAME", false),
                arguments(Collections.emptyMap(), "MAMUN", false),
                arguments(Collections.emptyMap(), Map.entry("NAME", "MAMUN"), false),

                arguments(
                        new HashMap<>() {{
                            put(null, "Mamun");
                            put("name", null);
                        }},
                        "mamun",
                        true
                ),
                arguments(
                        new HashMap<>() {{
                            put(null, "Mamun");
                            put("name", null);
                        }},
                        null,
                        true
                ),

                arguments(Map.of("name", "Mamun"), new Object(), false),
                arguments(Map.of("name", "Mamun"), new int[]{1, 2, 3}, false),

                arguments(null, "name", false),
                arguments(null, Map.entry("name", "Mamun"), false),
                arguments(null, null, false)
        );
    }

    private static Stream<Arguments> unsupportedContainmentCases() {
        return Stream.of(
                arguments(10, 1),
                arguments(10.5, 5.0),
                arguments(true, true),
                arguments('A', 'A'),

                arguments(Status.ACTIVE, Status.ACTIVE),

                arguments(new TestValue("Mamun"), "Mamun"),

                arguments(LocalDate.now(), LocalDate.now()),
                arguments(LocalDateTime.now(), LocalDateTime.now()),

                arguments(new Object(), new Object())
        );
    }

    private static FilterToPredicateConverter<TestModel> createConverter() {
        return new FilterToPredicateConverter<>(TestModel.class);
    }

    private static Filter createFilter(ConditionalOperator operation, Object value) {
        return new ConditionalFilter("value", operation, value);
    }

    private record TestModel(Object value) {

    }

    private record TestValue(String value) {

    }

    private enum Status {
        ACTIVE,
        INACTIVE,
        PENDING
    }
}
