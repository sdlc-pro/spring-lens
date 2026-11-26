package com.sdlcpro.springlens.model.jdbc;

import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SqlExecutionSummaryTest {

    @Test
    void shouldCreateSummaryWithProvidedValues() {
        Map<SqlCategory, Long> categoryDistribution = Map.of(
                SqlCategory.SELECT, 10L,
                SqlCategory.INSERT, 3L
        );

        Map<SqlExecutionType, Long> executionTypeDistribution = Map.of(
                SqlExecutionType.SIMPLE, 12L,
                SqlExecutionType.BATCH, 1L
        );

        Map<SqlExecutionStatus, Long> executionStatusDistribution = Map.of(
                SqlExecutionStatus.SUCCESS, 11L,
                SqlExecutionStatus.FAILED, 2L
        );

        SqlExecutionSummary summary = new SqlExecutionSummary(
                13L,
                categoryDistribution,
                executionTypeDistribution,
                executionStatusDistribution,
                500_000L,
                120_000L
        );

        assertEquals(13L, summary.totalSqlExecutions());
        assertEquals(categoryDistribution, summary.categoryDistribution());
        assertEquals(executionTypeDistribution, summary.executionTypeDistribution());
        assertEquals(executionStatusDistribution, summary.executionStatusDistribution());
        assertEquals(500_000L, summary.totalExecutionDurationNanos());
        assertEquals(120_000L, summary.maxExecutionDurationNanos());
    }

    @Test
    void shouldDefensivelyCopyDistributionMaps() {
        EnumMap<SqlCategory, Long> categoryDistribution =
                new EnumMap<>(SqlCategory.class);
        categoryDistribution.put(SqlCategory.SELECT, 5L);

        EnumMap<SqlExecutionType, Long> executionTypeDistribution =
                new EnumMap<>(SqlExecutionType.class);
        executionTypeDistribution.put(SqlExecutionType.SIMPLE, 5L);

        EnumMap<SqlExecutionStatus, Long> executionStatusDistribution =
                new EnumMap<>(SqlExecutionStatus.class);
        executionStatusDistribution.put(SqlExecutionStatus.SUCCESS, 5L);

        SqlExecutionSummary summary = new SqlExecutionSummary(
                5L,
                categoryDistribution,
                executionTypeDistribution,
                executionStatusDistribution,
                250_000L,
                100_000L
        );

        // Mutate original maps after creating the summary.
        categoryDistribution.put(SqlCategory.UPDATE, 10L);
        executionTypeDistribution.put(SqlExecutionType.BATCH, 2L);
        executionStatusDistribution.put(SqlExecutionStatus.FAILED, 1L);

        // Summary should not be affected by external mutations.
        assertEquals(
                Map.of(SqlCategory.SELECT, 5L),
                summary.categoryDistribution()
        );

        assertEquals(
                Map.of(SqlExecutionType.SIMPLE, 5L),
                summary.executionTypeDistribution()
        );

        assertEquals(
                Map.of(SqlExecutionStatus.SUCCESS, 5L),
                summary.executionStatusDistribution()
        );
    }

    @Test
    void shouldExposeImmutableDistributionMaps() {
        SqlExecutionSummary summary = new SqlExecutionSummary(
                1L,
                Map.of(SqlCategory.SELECT, 1L),
                Map.of(SqlExecutionType.SIMPLE, 1L),
                Map.of(SqlExecutionStatus.SUCCESS, 1L),
                10_000L,
                10_000L
        );

        assertThrows(
                UnsupportedOperationException.class,
                () -> summary.categoryDistribution()
                        .put(SqlCategory.INSERT, 1L)
        );

        assertThrows(
                UnsupportedOperationException.class,
                () -> summary.executionTypeDistribution()
                        .put(SqlExecutionType.BATCH, 1L)
        );

        assertThrows(
                UnsupportedOperationException.class,
                () -> summary.executionStatusDistribution()
                        .put(SqlExecutionStatus.FAILED, 1L)
        );
    }

    @Test
    void shouldNormalizeNullDistributionMapsToEmptyMaps() {
        SqlExecutionSummary summary = new SqlExecutionSummary(
                0L,
                null,
                null,
                null,
                0L,
                0L
        );

        assertNotNull(summary.categoryDistribution());
        assertNotNull(summary.executionTypeDistribution());
        assertNotNull(summary.executionStatusDistribution());

        assertTrue(summary.categoryDistribution().isEmpty());
        assertTrue(summary.executionTypeDistribution().isEmpty());
        assertTrue(summary.executionStatusDistribution().isEmpty());
    }

    @Test
    void shouldReturnSharedEmptySummaryInstance() {
        SqlExecutionSummary first = SqlExecutionSummary.empty();
        SqlExecutionSummary second = SqlExecutionSummary.empty();

        assertSame(first, second);

        assertEquals(0L, first.totalSqlExecutions());
        assertEquals(0L, first.totalExecutionDurationNanos());
        assertEquals(0L, first.maxExecutionDurationNanos());

        assertTrue(first.categoryDistribution().isEmpty());
        assertTrue(first.executionTypeDistribution().isEmpty());
        assertTrue(first.executionStatusDistribution().isEmpty());
    }
}