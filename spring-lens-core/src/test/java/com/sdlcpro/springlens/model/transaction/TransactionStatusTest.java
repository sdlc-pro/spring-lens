package com.sdlcpro.springlens.model.transaction;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionStatusTest {

    @Test
    void shouldDefineStatusesInOrder() {
        assertThat(TransactionStatus.values())
                .containsExactly(TransactionStatus.COMMITTED, TransactionStatus.ROLLED_BACK, TransactionStatus.ERRORED);
    }

    @Test
    void shouldExposeDisplayLabels() {
        assertThat(TransactionStatus.COMMITTED.getLabel()).isEqualTo("Committed");
        assertThat(TransactionStatus.ROLLED_BACK.getLabel()).isEqualTo("Rolled Back");
        assertThat(TransactionStatus.ERRORED.getLabel()).isEqualTo("Errored");
    }
}
