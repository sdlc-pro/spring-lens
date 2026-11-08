
package com.sdlcpro.springlens.model.jdbc;

import com.sdlcpro.springlens.model.ErrorInfo;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class SqlExecutionInfoTest {

    private static final String EXECUTION_ID = "sql-execution-123";

    private static final Instant EXECUTED_AT = Instant.parse("2026-11-05T10:00:00Z");

    private static final String EXECUTED_THREAD = "main";

    private static final long DURATION_NANOS = 1_500_000L;

    private static final SqlExecutionType EXECUTION_TYPE = SqlExecutionType.SIMPLE;

    private static final SqlExecutionStatus STATUS = SqlExecutionStatus.SUCCESS;

    private SqlExecutionInfo createValidExecutionInfo(
            List<SqlStatementEntry> statements
    ) {
        return new SqlExecutionInfo(
                EXECUTION_ID,
                statements,
                EXECUTION_TYPE,
                EXECUTED_THREAD,
                EXECUTED_AT,
                DURATION_NANOS,
                STATUS,
                null
        );
    }

    @Test
    void shouldCreateSqlExecutionInfoSuccessfully() {
        SqlExecutionInfo info = createValidExecutionInfo(List.of());

        assertNotNull(info);
        assertEquals(EXECUTION_ID, info.executionId());
        assertEquals(EXECUTION_TYPE, info.executionType());
        assertEquals(EXECUTED_THREAD, info.executedThread());
        assertEquals(EXECUTED_AT, info.executedAt());
        assertEquals(DURATION_NANOS, info.durationNanos());
        assertEquals(STATUS, info.status());
        assertNull(info.error());
        assertTrue(info.statements().isEmpty());
    }

    @Test
    void shouldAcceptZeroDuration() {
        SqlExecutionInfo info = new SqlExecutionInfo(
                EXECUTION_ID,
                List.of(),
                EXECUTION_TYPE,
                EXECUTED_THREAD,
                EXECUTED_AT,
                0,
                STATUS,
                null
        );

        assertEquals(0, info.durationNanos());
    }

    @Test
    void shouldThrowExceptionWhenExecutionIdIsNull() {
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> new SqlExecutionInfo(
                        null,
                        List.of(),
                        EXECUTION_TYPE,
                        EXECUTED_THREAD,
                        EXECUTED_AT,
                        DURATION_NANOS,
                        STATUS,
                        null
                )
        );

        assertEquals(
                "executionId must not be null",
                exception.getMessage()
        );
    }

    @Test
    void shouldThrowExceptionWhenExecutionTypeIsNull() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new SqlExecutionInfo(
                        EXECUTION_ID,
                        List.of(),
                        null,
                        EXECUTED_THREAD,
                        EXECUTED_AT,
                        DURATION_NANOS,
                        STATUS,
                        null
                )
        );
    }

    @Test
    void shouldThrowExceptionWhenDurationIsNegative() {
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> new SqlExecutionInfo(
                        EXECUTION_ID,
                        List.of(),
                        EXECUTION_TYPE,
                        EXECUTED_THREAD,
                        EXECUTED_AT,
                        -1,
                        STATUS,
                        null
                )
        );

        assertEquals(
                "durationNanos must be greater than or equal to zero",
                exception.getMessage()
        );
    }

    @Test
    void shouldThrowExceptionWhenStatusIsNull() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new SqlExecutionInfo(
                        EXECUTION_ID,
                        List.of(),
                        EXECUTION_TYPE,
                        EXECUTED_THREAD,
                        EXECUTED_AT,
                        DURATION_NANOS,
                        null,
                        null
                )
        );
    }

    @Test
    void shouldConvertNullStatementsToEmptyList() {
        SqlExecutionInfo info = createValidExecutionInfo(null);

        assertNotNull(info.statements());
        assertTrue(info.statements().isEmpty());
    }

    @Test
    void shouldReturnImmutableStatementsList() {
        SqlStatementEntry statement =
                mock(SqlStatementEntry.class);

        SqlExecutionInfo info = createValidExecutionInfo(
                List.of(statement)
        );

        assertThrows(
                UnsupportedOperationException.class,
                () -> info.statements().add(
                        mock(SqlStatementEntry.class)
                )
        );
    }

    @Test
    void shouldDefensivelyCopyOriginalStatementsList() {
        SqlStatementEntry firstStatement =
                mock(SqlStatementEntry.class);

        SqlStatementEntry secondStatement =
                mock(SqlStatementEntry.class);

        List<SqlStatementEntry> originalStatements =
                new ArrayList<>();

        originalStatements.add(firstStatement);

        SqlExecutionInfo info =
                createValidExecutionInfo(originalStatements);

        originalStatements.add(secondStatement);

        assertEquals(1, info.statements().size());

        assertSame(
                firstStatement,
                info.statements().get(0)
        );
    }

    @Test
    void shouldThrowExceptionWhenStatementsContainsNull() {
        List<SqlStatementEntry> statements =
                new ArrayList<>();

        statements.add(null);

        assertThrows(
                NullPointerException.class,
                () -> createValidExecutionInfo(statements)
        );
    }

    @Test
    void shouldPreserveOptionalErrorMetadata() {
        ErrorInfo error = mock(ErrorInfo.class);

        SqlExecutionInfo info = new SqlExecutionInfo(
                EXECUTION_ID,
                List.of(),
                EXECUTION_TYPE,
                EXECUTED_THREAD,
                EXECUTED_AT,
                DURATION_NANOS,
                SqlExecutionStatus.FAILED,
                error
        );

        assertSame(error, info.error());
    }
}
