package com.sdlcpro.springlens.insight.jdbc.delegator;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Savepoint;
import java.sql.Statement;

/**
 * A protective wrapper around JDBC {@link Connection} instances that enforces
 * read-only query safety boundaries.
 * <p>
 * This class intercepts mutating operations, transaction control methods, and unparameterized
 * statement creation, throwing a descriptive {@link SQLFeatureNotSupportedException}.
 * Parameterized query preparation (via {@code prepareStatement}) remains available
 * for executing read-only queries.
 * </p>
 *
 * @since 1.0
 */
public final class ReadOnlyConnectionDelegator extends AbstractConnectionDelegator {

    /**
     * Constructs a new {@code ReadOnlyConnectionDelegator} wrapping the specified underlying connection.
     *
     * @param delegate the underlying JDBC connection to delegate safe read operations to
     */
    public ReadOnlyConnectionDelegator(Connection delegate) {
        super(delegate);
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because unparameterized statement creation is restricted under read-only mode.
     * </p>
     */
    @Override
    public Statement createStatement() throws SQLException {
        throw unsupportedOperation("createStatement");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because unparameterized statement creation is restricted under read-only mode.
     * </p>
     */
    @Override
    public Statement createStatement(int resultSetType, int resultSetConcurrency) throws SQLException {
        throw unsupportedOperation("createStatement");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because unparameterized statement creation is restricted under read-only mode.
     * </p>
     */
    @Override
    public Statement createStatement(int resultSetType, int resultSetConcurrency, int resultSetHoldability) throws SQLException {
        throw unsupportedOperation("createStatement");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because changing auto-commit mode is not supported on a read-only connection.
     * </p>
     */
    @Override
    public void setAutoCommit(boolean autoCommit) throws SQLException {
        throw unsupportedOperation("setAutoCommit");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because manual commits are not required or permitted on a read-only connection.
     * </p>
     */
    @Override
    public void commit() throws SQLException {
        throw unsupportedOperation("commit");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because rollbacks are not applicable on a read-only connection.
     * </p>
     */
    @Override
    public void rollback() throws SQLException {
        throw unsupportedOperation("rollback");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because savepoint-based rollbacks are not supported on a read-only connection.
     * </p>
     */
    @Override
    public void rollback(Savepoint savepoint) throws SQLException {
        throw unsupportedOperation("rollback");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because creating savepoints is a mutating transaction operation.
     * </p>
     */
    @Override
    public Savepoint setSavepoint() throws SQLException {
        throw unsupportedOperation("setSavepoint");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because creating named savepoints is a mutating transaction operation.
     * </p>
     */
    @Override
    public Savepoint setSavepoint(String name) throws SQLException {
        throw unsupportedOperation("setSavepoint");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Throws an exception because releasing savepoints is not supported under read-only boundaries.
     * </p>
     */
    @Override
    public void releaseSavepoint(Savepoint savepoint) throws SQLException {
        throw unsupportedOperation("releaseSavepoint");
    }

    /**
     * {@inheritDoc}
     * <p>
     * Enforces that the read-only flag cannot be disabled. If {@code readOnly} is true,
     * the call is delegated successfully; if false, an exception is thrown.
     * </p>
     */
    @Override
    public void setReadOnly(boolean readOnly) throws SQLException {
        if (!readOnly) {
            throw unsupportedOperation("setReadOnly");
        }
        super.setReadOnly(true);
    }

    /**
     * Helper method that generates a standardized {@link SQLFeatureNotSupportedException}
     * for restricted operations using modern Java string formatting.
     *
     * @param operation the name of the restricted operation being attempted
     * @return a configured {@code SQLFeatureNotSupportedException} with a consistent message
     */
    private SQLFeatureNotSupportedException unsupportedOperation(String operation) {
        return new SQLFeatureNotSupportedException(
                "Operation '%s' is not supported by ReadOnlyConnectionDelegator.".formatted(operation)
        );
    }
}