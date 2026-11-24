package com.sdlcpro.springlens.model.jdbc;

import com.sdlcpro.springlens.annotation.SpringLensWritable;
import com.sdlcpro.springlens.util.DefensiveCopies;

import java.util.Map;

/**
 * Immutable summary of aggregated SQL execution metrics.
 *
 * <p>Provides aggregate statistics for intercepted SQL executions, including
 * total execution count, distributions across SQL categories, execution
 * types and statuses, and cumulative and maximum execution durations.
 *
 * <p>Distribution maps are defensively copied and exposed as immutable maps.
 * Null distribution maps are normalized to empty maps.
 *
 * @param totalSqlExecutions total number of recorded SQL executions
 * @param categoryDistribution distribution of executions grouped by {@link SqlCategory}
 * @param executionTypeDistribution distribution of executions grouped by {@link SqlExecutionType}
 * @param executionStatusDistribution distribution of executions grouped by {@link SqlExecutionStatus}
 * @param totalExecutionDurationNanos cumulative execution duration in nanoseconds
 * @param maxExecutionDurationNanos maximum execution duration observed for a single query in nanoseconds
 */
@SpringLensWritable
public record SqlExecutionSummary(
        long totalSqlExecutions,
        Map<SqlCategory, Long> categoryDistribution,
        Map<SqlExecutionType, Long> executionTypeDistribution,
        Map<SqlExecutionStatus, Long> executionStatusDistribution,
        long totalExecutionDurationNanos,
        long maxExecutionDurationNanos) {

    /**
     * Pre-instantiated empty summary with zeroed metrics and empty distributions.
     */
    private static final SqlExecutionSummary EMPTY = new SqlExecutionSummary(
            0L,
            Map.of(),
            Map.of(),
            Map.of(),
            0L,
            0L
    );

    /**
     * Compact constructor that defensively copies all distribution maps
     * and ensures they are immutable and non-null.
     */
    public SqlExecutionSummary {
        categoryDistribution =
                DefensiveCopies.immutableMapOrEmpty(categoryDistribution);

        executionTypeDistribution =
                DefensiveCopies.immutableMapOrEmpty(executionTypeDistribution);

        executionStatusDistribution =
                DefensiveCopies.immutableMapOrEmpty(executionStatusDistribution);
    }

    /**
     * Returns the shared empty SQL execution summary.
     *
     * <p>The returned instance represents zero recorded executions,
     * with empty distribution maps and zero duration metrics.
     *
     * @return the shared empty summary instance
     */
    public static SqlExecutionSummary empty() {
        return EMPTY;
    }
}