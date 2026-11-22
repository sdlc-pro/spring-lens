package com.sdlcpro.springlens.insight.jdbc.interception;

/**
 * Listener interface for observing SQL execution lifecycle events.
 *
 * <p>Implementations can use this interface to collect telemetry, record
 * execution metrics, perform auditing, log SQL execution details, or monitor
 * database query performance.
 *
 * <p>Listeners are notified before and after a SQL statement or batch execution.
 * The {@link SqlExecutionContext} provides access to the execution metadata,
 * including the SQL statements, execution duration, status, and error details.
 *
 * <p>Both callback methods have default no-op implementations, allowing
 * implementations to override only the callbacks they are interested in.
 *
 * @see SqlExecutionContext
 */
public interface SqlExecutionListener {

    /**
     * Invoked immediately before a SQL statement or batch query is executed.
     *
     * <p>This callback can be used to perform pre-execution actions such as
     * initializing metrics, recording the start of an operation, or auditing
     * an SQL execution.
     *
     * @param context the active SQL execution context
     */
    default void beforeExecute(SqlExecutionContext context) {
    }

    /**
     * Invoked immediately after a SQL statement or batch query execution
     * completes, regardless of whether the execution succeeds or fails.
     *
     * <p>This callback can be used to collect execution metrics, inspect
     * the final execution status, record the duration, or process error
     * information.
     *
     * @param context the active SQL execution context containing execution metadata
     */
    default void afterExecute(SqlExecutionContext context) {
    }
}