package com.sdlcpro.springlens.model.jdbc;

import com.sdlcpro.springlens.model.ErrorInfo;
import com.sdlcpro.springlens.util.DefensiveCopies;
import com.sdlcpro.springlens.util.Preconditions;

import java.time.Instant;
import java.util.List;

/**
 * Represents the complete telemetry information of a SQL execution.
 *
 * <p>This record captures execution identity, executed SQL statements,
 * execution type, thread information, timestamp, duration, execution
 * status, and optional error metadata.</p>
 *
 * <p>The record is immutable. The statements collection is defensively
 * copied and exposed as an unmodifiable list.</p>
 *
 * <p>Validation rules:</p>
 * <ul>
 *     <li>executionId must not be null.</li>
 *     <li>executionType must not be null.</li>
 *     <li>durationNanos must be greater than or equal to zero.</li>
 *     <li>status must not be null.</li>
 *     <li>null statements are normalized to an empty immutable list.</li>
 * </ul>
 *
 * @param executionId   unique identifier of the SQL execution
 * @param statements    SQL statements executed during this execution
 * @param executionType type of SQL execution
 * @param executedThread name of the thread performing the execution
 * @param executedAt    timestamp when the execution occurred
 * @param durationNanos execution duration in nanoseconds
 * @param status        outcome status of the execution
 * @param error         optional error metadata when execution fails
 */
public record SqlExecutionInfo(

        String executionId,

        List<SqlStatementEntry> statements,

        SqlExecutionType executionType,

        String executedThread,

        Instant executedAt,

        long durationNanos,

        SqlExecutionStatus status,

        ErrorInfo error

) {

    /**
     * Validates the record components and creates an immutable
     * defensive copy of the SQL statements collection.
     *
     * @throws IllegalArgumentException if executionId or executionType
     *                                  or status is null, or durationNanos
     *                                  is negative
     * @throws NullPointerException if the statements collection contains
     *                              a null element
     */
    public SqlExecutionInfo {
        Preconditions.requireNonNull(
                executionId,
                "executionId must not be null"
        );

        Preconditions.requireNonNull(
                executionType,
                "executionType must not be null"
        );

        Preconditions.isTrue(
                durationNanos >= 0,
                "durationNanos must be greater than or equal to zero"
        );

        Preconditions.requireNonNull(
                status,
                "status must not be null"
        );

        statements = DefensiveCopies.immutableListOrEmpty(statements);
    }
}
