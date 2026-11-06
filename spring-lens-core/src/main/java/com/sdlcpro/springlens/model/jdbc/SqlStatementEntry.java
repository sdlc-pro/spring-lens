package com.sdlcpro.springlens.model.jdbc;

import com.sdlcpro.springlens.util.Preconditions;

/**
 * Represents an individual SQL statement captured during SQL execution.
 *
 * <p>Stores the SQL statement, the number of times it occurred,
 * and its corresponding SQL category.</p>
 *
 * @param sql the SQL statement text
 * @param occurrenceCount number of occurrences of the SQL statement
 * @param sqlCategory category of the SQL statement
 */
public record SqlStatementEntry(
        String sql,
        long occurrenceCount,
        SqlCategory sqlCategory
) {

    /**
     * Validates the SQL statement entry.
     *
     * @throws IllegalArgumentException if occurrenceCount is not positive
     *                                  or sqlCategory is null
     */
    public SqlStatementEntry {
        Preconditions.isTrue(occurrenceCount > 0, "The value of occurrenceCount must be positive");
        Preconditions.requireNonNull(sqlCategory, "SqlCategory must not be null value");
    }
}