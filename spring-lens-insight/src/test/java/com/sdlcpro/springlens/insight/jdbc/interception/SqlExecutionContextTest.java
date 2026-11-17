package com.sdlcpro.springlens.insight.jdbc.interception;

import com.sdlcpro.springlens.model.jdbc.SqlCategory;
import com.sdlcpro.springlens.model.jdbc.SqlExecutionType;
import com.sdlcpro.springlens.model.jdbc.SqlStatementEntry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.sql.Connection;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

class SqlExecutionContextTest {

    @Test
    @DisplayName("Should initialize context correctly with default empty statement list and captured thread")
    void initialization_setsDefaultsCorrectly() {
        Connection mockConnection = Mockito.mock(Connection.class);
        SqlExecutionContext context = new SqlExecutionContext(mockConnection, SqlExecutionType.SIMPLE);

        assertSame(mockConnection, context.getConnection());
        assertEquals(SqlExecutionType.SIMPLE, context.getExecutionType());
        assertNotNull(context.getExecutedThread());
        assertNotNull(context.getStatements());
        assertEquals(0, context.getStatements().size());
        assertNull(context.getExecutedAt());
        assertEquals(0L, context.getDurationNanos());
        assertNull(context.getError());
    }

    @Test
    @DisplayName("Should default to SIMPLE execution type if null is passed to constructor")
    void initialization_nullExecutionType_defaultsToSimple() {
        Connection mockConnection = Mockito.mock(Connection.class);
        SqlExecutionContext context = new SqlExecutionContext(mockConnection, null);

        assertEquals(SqlExecutionType.SIMPLE, context.getExecutionType());
    }

    @Test
    @DisplayName("Should correctly update and retrieve telemetry state via package-private setters")
    void stateTransitions_updateAndRetrieveSuccessfully() {
        Connection mockConnection = Mockito.mock(Connection.class);
        SqlExecutionContext context = new SqlExecutionContext(mockConnection, SqlExecutionType.BATCH);

        Instant now = Instant.now();
        Throwable testError = new RuntimeException("DB Connection Timeout");
        List<SqlStatementEntry> entries = List.of(
                new SqlStatementEntry("SELECT * FROM users", 1200L, SqlCategory.SELECT)
        );
        context.setStatements(entries);
        context.setExecutedAt(now);
        context.setDurationNanos(1_500_000L);
        context.setError(testError);

        assertEquals(entries, context.getStatements());
        assertEquals(now, context.getExecutedAt());
        assertEquals(1_500_000L, context.getDurationNanos());
        assertSame(testError, context.getError());
    }

    @Test
    @DisplayName("Should handle null statement list gracefully by falling back to an empty list")
    void setStatements_nullInput_fallsBackToEmptyList() {
        SqlExecutionContext context = new SqlExecutionContext(null, SqlExecutionType.SIMPLE);
        context.setStatements(null);

        assertNotNull(context.getStatements());
        assertEquals(0, context.getStatements().size());
    }
}