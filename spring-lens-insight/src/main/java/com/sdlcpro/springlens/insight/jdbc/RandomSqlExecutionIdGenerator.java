package com.sdlcpro.springlens.insight.jdbc;

import com.sdlcpro.springlens.util.RandomIdGenerator;

/**
 * Thread-safe singleton generator of random SQL execution identifiers.
 *
 * <p>Delegates to {@link RandomIdGenerator} to produce 16-character lowercase
 * hexadecimal identifiers. Uniqueness is probabilistic; collisions are possible.</p>
 *
 * <p>The singleton is safely published during class initialization. Its private
 * constructor rejects subsequent construction attempts, including reflective
 * invocations.</p>
 */
public final class RandomSqlExecutionIdGenerator implements SqlExecutionIdGenerator {

    private static final RandomSqlExecutionIdGenerator INSTANCE = new RandomSqlExecutionIdGenerator();

    /**
     * Creates the singleton during class initialization.
     *
     * @throws IllegalStateException if the singleton has already been created
     */
    private RandomSqlExecutionIdGenerator() {
        if (INSTANCE != null) {
            throw new IllegalStateException("Instance of RandomSqlExecutionIdGenerator already created.");
        }
    }

    /**
     * Generates a random SQL execution identifier using the core ID generator.
     *
     * @return a non-null, 16-character lowercase hexadecimal identifier
     */
    @Override
    public String generate() {
        return RandomIdGenerator.generate(RandomIdGenerator.Length._16);
    }

    /**
     * Returns the shared instance of this generator.
     *
     * @return the singleton generator instance
     */
    public static RandomSqlExecutionIdGenerator getInstance() {
        return INSTANCE;
    }
}
