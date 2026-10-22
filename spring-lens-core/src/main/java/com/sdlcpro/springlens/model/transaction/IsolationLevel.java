package com.sdlcpro.springlens.model.transaction;

/**
 * Isolation level of a Spring transaction, mapped to the integer constants shared by Spring's
 * {@code TransactionDefinition} and JDBC's {@code java.sql.Connection}.
 */
public enum IsolationLevel {
    /** Use the default isolation level of the underlying datastore. */
    DEFAULT(-1),
    /** Dirty reads, non-repeatable reads and phantom reads can occur. */
    READ_UNCOMMITTED(1),
    /** Dirty reads are prevented; non-repeatable reads and phantom reads can occur. */
    READ_COMMITTED(2),
    /** Dirty reads and non-repeatable reads are prevented; phantom reads can occur. */
    REPEATABLE_READ(4),
    /** Dirty reads, non-repeatable reads and phantom reads are prevented. */
    SERIALIZABLE(8);

    private static final IsolationLevel[] VALUES;

    private final int value;

    static {
        VALUES = values();
    }

    IsolationLevel(int value) {
        this.value = value;
    }

    /**
     * Returns the integer value of this isolation level.
     *
     * @return the Spring/JDBC isolation constant, or {@code -1} for {@link #DEFAULT}
     */
    public final int value() {
        return this.value;
    }

    /**
     * Returns the isolation level for the given integer value.
     *
     * @param value a Spring/JDBC isolation constant
     * @return the matching isolation level, or {@link #DEFAULT} if the value isn't a supported level
     */
    public static IsolationLevel from(int value) {
        if (value < 0 || value > 8) {
            return DEFAULT;
        }

        for (IsolationLevel level : VALUES) {
            if (level.value == value) {
                return level;
            }
        }

        return DEFAULT;
    }
}
