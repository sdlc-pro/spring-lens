package com.sdlcpro.springlens.insight.jdbc;

/**
 * Strategy for generating identifiers for intercepted SQL executions.
 *
 * <p>The default implementation is the thread-safe singleton
 * {@link RandomSqlExecutionIdGenerator}.</p>
 */
public interface SqlExecutionIdGenerator {

    /**
     * Returns the shared default generator for SQL execution identifiers.
     *
     * @return the singleton {@link RandomSqlExecutionIdGenerator} instance
     */
    static SqlExecutionIdGenerator getDefaultInstance() {
        return RandomSqlExecutionIdGenerator.getInstance();
    }

    /**
     * Generates an identifier for a SQL execution.
     *
     * @return a non-null SQL execution identifier
     */
    String generate();
}
