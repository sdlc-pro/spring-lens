package com.sdlcpro.springlens.model.transaction;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class IsolationLevelTest {

    @ParameterizedTest
    @CsvSource({
            "-1, DEFAULT",
            "1, READ_UNCOMMITTED",
            "2, READ_COMMITTED",
            "4, REPEATABLE_READ",
            "8, SERIALIZABLE"
    })
    void shouldMapValueToLevel(int value, IsolationLevel expected) {
        assertThat(IsolationLevel.from(value)).isEqualTo(expected);
        assertThat(expected.value()).isEqualTo(value);
    }

    @ParameterizedTest
    @ValueSource(ints = {Integer.MIN_VALUE, -2, 0, 3, 5, 6, 7, 9, 16, Integer.MAX_VALUE})
    void shouldFallBackToDefaultForUnsupportedValues(int value) {
        assertThat(IsolationLevel.from(value)).isEqualTo(IsolationLevel.DEFAULT);
    }

    @Test
    void shouldMatchJdbcConnectionConstants() {
        assertThat(IsolationLevel.READ_UNCOMMITTED.value()).isEqualTo(java.sql.Connection.TRANSACTION_READ_UNCOMMITTED);
        assertThat(IsolationLevel.READ_COMMITTED.value()).isEqualTo(java.sql.Connection.TRANSACTION_READ_COMMITTED);
        assertThat(IsolationLevel.REPEATABLE_READ.value()).isEqualTo(java.sql.Connection.TRANSACTION_REPEATABLE_READ);
        assertThat(IsolationLevel.SERIALIZABLE.value()).isEqualTo(java.sql.Connection.TRANSACTION_SERIALIZABLE);
    }
}
