package com.sdlcpro.springlens.listener.jdbc;

import com.sdlcpro.springlens.model.jdbc.SqlExecutionInfo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class SqlExecutionInfoCollectListenerTest {

    @Test
    void shouldSupportLambdaExpressionRegistration() {
        List<SqlExecutionInfo> collected = new ArrayList<>();
        SqlExecutionInfoCollectListener listener = collected::add;
        SqlExecutionInfo info = mock(SqlExecutionInfo.class);

        listener.onSqlExecutionInfoCollected(info);

        assertThat(collected).containsExactly(info);
    }

    @Test
    void shouldSupportMethodReferenceRegistration() {
        RecordingConsumer consumer = new RecordingConsumer();
        SqlExecutionInfoCollectListener listener = consumer::consume;
        SqlExecutionInfo info = mock(SqlExecutionInfo.class);

        listener.onSqlExecutionInfoCollected(info);

        assertThat(consumer.received).containsExactly(info);
    }

    @Test
    void shouldInvokeListenersInOrderWhenComposedWithAndThen() {
        List<String> trace = new ArrayList<>();
        SqlExecutionInfo info = mock(SqlExecutionInfo.class);

        SqlExecutionInfoCollectListener first = ignored -> trace.add("first");
        SqlExecutionInfoCollectListener second = ignored -> trace.add("second");

        first.andThen(second).onSqlExecutionInfoCollected(info);

        assertThat(trace).containsExactly("first", "second");
    }

    @Test
    void andThenShouldThrowWhenAfterIsNull() {
        SqlExecutionInfoCollectListener listener = ignored -> {};

        assertThatThrownBy(() -> listener.andThen(null))
                .isInstanceOf(NullPointerException.class);
    }

    private static final class RecordingConsumer {
        private final List<SqlExecutionInfo> received = new ArrayList<>();

        private void consume(SqlExecutionInfo info) {
            received.add(info);
        }
    }
}