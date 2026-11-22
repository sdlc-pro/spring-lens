package com.sdlcpro.springlens.insight.jdbc.interception;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;

class SqlExecutionListenerTest {

    @Test
    void defaultMethodsShouldBeNoOps() {
        SqlExecutionListener listener = new SqlExecutionListener() {};
        SqlExecutionContext context = mock(SqlExecutionContext.class);

        assertThatCode(() -> {
            listener.beforeExecute(context);
            listener.afterExecute(context);
        }).doesNotThrowAnyException();
    }

    @Test
    void customListenerShouldReceiveCallbacksInOrderOnSuccess() {
        List<String> events = new ArrayList<>();
        SqlExecutionContext context = mock(SqlExecutionContext.class);

        SqlExecutionListener listener = new SqlExecutionListener() {
            @Override
            public void beforeExecute(SqlExecutionContext ctx) {
                if (ctx == context) {
                    events.add("beforeExecute");
                }
            }

            @Override
            public void afterExecute(SqlExecutionContext ctx) {
                if (ctx == context) {
                    events.add("afterExecute");
                }
            }
        };

        simulateSqlExecution(listener, context, false);

        assertThat(events).containsExactly("beforeExecute", "afterExecute");
    }

    @Test
    void customListenerShouldReceiveAfterExecuteEvenWhenExecutionFails() {
        List<String> events = new ArrayList<>();
        SqlExecutionContext context = mock(SqlExecutionContext.class);

        SqlExecutionListener listener = new SqlExecutionListener() {
            @Override
            public void beforeExecute(SqlExecutionContext ctx) {
                events.add("beforeExecute");
            }

            @Override
            public void afterExecute(SqlExecutionContext ctx) {
                events.add("afterExecute");
            }
        };

        try {
            simulateSqlExecution(listener, context, true);
        } catch (RuntimeException ignored) {
            // Expected failure during simulated SQL execution
        }

        assertThat(events).containsExactly("beforeExecute", "afterExecute");
    }

    @Test
    void listenerWithOnlyAfterExecuteOverrideShouldWork() {
        List<SqlExecutionContext> completedContexts = new ArrayList<>();
        SqlExecutionContext context = mock(SqlExecutionContext.class);

        SqlExecutionListener listener = new SqlExecutionListener() {
            @Override
            public void afterExecute(SqlExecutionContext ctx) {
                completedContexts.add(ctx);
            }
        };

        simulateSqlExecution(listener, context, false);

        assertThat(completedContexts).containsExactly(context);
    }

    private void simulateSqlExecution(
            SqlExecutionListener listener,
            SqlExecutionContext context,
            boolean failExecution
    ) {
        listener.beforeExecute(context);
        try {
            if (failExecution) {
                throw new RuntimeException("Simulated SQL failure");
            }
        } finally {
            listener.afterExecute(context);
        }
    }
}