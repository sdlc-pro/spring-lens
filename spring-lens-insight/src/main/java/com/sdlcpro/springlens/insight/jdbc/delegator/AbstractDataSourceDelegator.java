package com.sdlcpro.springlens.insight.jdbc.delegator;

import com.sdlcpro.springlens.util.Preconditions;

import javax.sql.DataSource;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.logging.Logger;

/**
 * Base delegating implementation of {@link DataSource}.
 *
 * <p>All operations are delegated to the wrapped target
 * {@link DataSource}. Subclasses may override selected
 * methods to provide additional behavior such as
 * monitoring, tracing, logging, or instrumentation.</p>
 */
public abstract class AbstractDataSourceDelegator implements DataSource {
    protected final DataSource dataSource;

    public AbstractDataSourceDelegator(DataSource dataSource) {
        Preconditions.requireNonNull(dataSource, "The instance of datasource must not be null");
        this.dataSource = dataSource;
    }

    @Override
    public Connection getConnection() throws SQLException {
        return this.dataSource.getConnection();
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        return this.dataSource.getConnection(username, password);
    }

    @Override
    public PrintWriter getLogWriter() throws SQLException {
        return this.dataSource.getLogWriter();
    }

    @Override
    public void setLogWriter(PrintWriter out) throws SQLException {
        this.dataSource.setLogWriter(out);
    }

    @Override
    public void setLoginTimeout(int seconds) throws SQLException {
        this.dataSource.setLoginTimeout(seconds);
    }

    @Override
    public int getLoginTimeout() throws SQLException {
        return this.dataSource.getLoginTimeout();
    }

    @Override
    public Logger getParentLogger() throws SQLFeatureNotSupportedException {
        return this.dataSource.getParentLogger();
    }

    @Override
    public <T> T unwrap(Class<T> iface) throws SQLException {
        return this.dataSource.unwrap(iface);
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) throws SQLException {
        return this.dataSource.isWrapperFor(iface);
    }
}