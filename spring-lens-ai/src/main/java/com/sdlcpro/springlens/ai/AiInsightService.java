package com.sdlcpro.springlens.ai;

import org.springframework.ai.chat.client.ChatClient;
import java.util.concurrent.*;

/** Owns a bounded worker; a stalled provider cannot accumulate queued work or block collectors. */
public final class AiInsightService implements AutoCloseable {
    public enum Focus { OVERVIEW, LAZY_INITIALIZATION, SCOPES }
    private final BeanFacts facts;
    private final ChatClient client;
    private final AiProperties limits;
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
            new SynchronousQueue<>(), task -> {
                Thread thread = new Thread(task, "spring-lens-ai");
                thread.setDaemon(true);
                return thread;
            }, new ThreadPoolExecutor.AbortPolicy());

    AiInsightService(BeanFacts facts, ChatClient client, AiProperties limits) {
        this.facts = facts;
        this.client = client;
        this.limits = limits;
    }

    public String analyze(Focus focus) {
        if (focus == null || !limits.valid()) throw new Unavailable();
        Future<String> task;
        try {
            task = worker.submit(() -> {
                String context = facts.context(limits);
                // No advisors, tools, conversation memory, user text, or application diagnostics.
                String answer = client.prompt()
                        .system("Explain Spring bean definitions using only the supplied numeric facts. "
                                + "Distinguish observed counts from suggestions. The sample may be incomplete. "
                                + "Do not claim to diagnose a failure. Return concise plain text, at most 200 words.")
                        .user("Focus: " + focus.name() + "\n" + context).call().content();
                if (answer == null || answer.isBlank()) throw new Unavailable();
                String sanitized = answer.replaceAll("[\\p{Cc}&&[^\\n\\t]]", "");
                return sanitized.substring(0, Math.min(sanitized.length(), limits.getMaxInsightChars()));
            });
        } catch (RejectedExecutionException exception) {
            throw new Unavailable();
        }
        try {
            return task.get(limits.getTimeoutMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException exception) {
            task.cancel(true);
            Thread.currentThread().interrupt();
            throw new Unavailable();
        } catch (ExecutionException | TimeoutException exception) {
            task.cancel(true);
            throw new Unavailable();
        }
    }

    @Override public void close() { worker.shutdownNow(); }

    /** Deliberately carries no provider exception, prompt, or sensitive error message. */
    public static final class Unavailable extends RuntimeException { }
}
