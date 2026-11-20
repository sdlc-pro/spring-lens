package com.sdlcpro.springlens.insight.jdbc.interception;

import com.sdlcpro.springlens.model.jdbc.SqlExecutionType;
import com.sdlcpro.springlens.model.jdbc.SqlStatementEntry;
import com.sdlcpro.springlens.util.ExecutionUtils;

import java.sql.Connection;
import java.time.Instant;
import java.util.List;

/**
 * Manages telemetry data during the lifecycle of an intercepted SQL statement or batch execution.
 *
 * <p>This stateful context holder captures the target database connection, statement entries,
 * execution type, executing thread label, start/end timestamps, duration in nanoseconds,
 * and any encountered exceptions.</p>
 *
 * <p>This class is designed for use within JDBC interceptors in the
 * {@code com.sdlcpro.springlens.insight.jdbc.interception} package.</p>
 */
public final class SqlExecutionContext {

    private final Connection connection;
    private final SqlExecutionType executionType;
    private final String executedThread;

    private List<SqlStatementEntry> statements;
    private Instant executedAt;
    private long durationNanos;
    private Throwable error;

    /**
     * Constructs a new {@code SqlExecutionContext} with the specified connection and execution type.
     *
     * <p>The executing thread label is automatically captured via
     * {@link ExecutionUtils#currentThreadLabel()}.</p>
     *
     * @param connection    the underlying JDBC connection being intercepted
     * @param executionType the type of execution (e.g., SIMPLE or BATCH)
     */
    public SqlExecutionContext(Connection connection, SqlExecutionType executionType) {
        this.connection = connection;
        this.executionType = executionType != null ? executionType : SqlExecutionType.SIMPLE;
        this.executedThread = ExecutionUtils.currentThreadLabel();
        this.statements = List.of();
    }

    /**
     * Returns the underlying JDBC connection being intercepted.
     *
     * @return the JDBC connection, or {@code null} if not provided
     */
    public Connection getConnection() {
        return connection;
    }

    /**
     * Returns the list of executed SQL statement entries.
     *
     * @return an immutable list of statement entries, or an empty list if none are set
     */
    public List<SqlStatementEntry> getStatements() {
        return statements != null ? statements : List.of();
    }

    /**
     * Returns the type of execution (e.g., SIMPLE or BATCH).
     *
     * @return the SQL execution type
     */
    public SqlExecutionType getExecutionType() {
        return executionType;
    }

    /**
     * Returns the label of the thread performing the query.
     *
     * @return the current thread label captured during initialization
     */
    public String getExecutedThread() {
        return executedThread;
    }

    /**
     * Returns the timestamp when execution started or completed.
     *
     * @return the execution timestamp, or {@code null} if not set
     */
    public Instant getExecutedAt() {
        return executedAt;
    }

    /**
     * Returns the execution duration in nanoseconds.
     *
     * @return the duration in nanoseconds
     */
    public long getDurationNanos() {
        return durationNanos;
    }

    /**
     * Returns the captured exception if execution failed.
     *
     * @return the encountered exception, or {@code null} if execution succeeded
     */
    public Throwable getError() {
        return error;
    }

    /**
     * Sets the list of executed SQL statement entries.
     *
     * @param statements the statement entries list
     */
    void setStatements(List<SqlStatementEntry> statements) {
        this.statements = statements != null ? List.copyOf(statements) : List.of();
    }

    /**
     * Sets the execution timestamp.
     *
     * @param executedAt the instant when execution occurred
     */
    void setExecutedAt(Instant executedAt) {
        this.executedAt = executedAt;
    }

    /**
     * Sets the execution duration in nanoseconds.
     *
     * @param durationNanos the duration in nanoseconds
     */
    void setDurationNanos(long durationNanos) {
        this.durationNanos = durationNanos;
    }

    /**
     * Sets the captured exception if execution failed.
     *
     * @param error the encountered exception
     */
    void setError(Throwable error) {
        this.error = error;
    }
}