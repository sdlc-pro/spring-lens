package com.sdlcpro.springlens.model.jdbc;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SqlStatementEntryTest {

    private static final SqlCategory CATEGORY = SqlCategory.values()[0];

    @Test
    void shouldCreateSqlStatementEntrySuccessfully() {
        SqlStatementEntry entry = new SqlStatementEntry(
                "SELECT * FROM users",
                1,
                CATEGORY
        );

        assertNotNull(entry);
        assertEquals("SELECT * FROM users", entry.sql());
        assertEquals(1, entry.occurrenceCount());
        assertEquals(CATEGORY, entry.sqlCategory());
    }

    @Test
    void shouldAllowNullSqlIfNotProhibitedByContract() {
        SqlStatementEntry entry = new SqlStatementEntry(
                null,
                1,
                CATEGORY
        );

        assertNull(entry.sql());
    }

    @Test
    void shouldThrowExceptionWhenOccurrenceCountIsZero() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new SqlStatementEntry(
                        "SELECT * FROM users",
                        0,
                        CATEGORY
                )
        );
    }

    @Test
    void shouldThrowExceptionWhenOccurrenceCountIsNegative() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new SqlStatementEntry(
                        "SELECT * FROM users",
                        -1,
                        CATEGORY
                )
        );
    }

    @Test
    void shouldThrowExceptionWhenSqlCategoryIsNull() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new SqlStatementEntry(
                        "SELECT * FROM users",
                        1,
                        null
                )
        );
    }
}