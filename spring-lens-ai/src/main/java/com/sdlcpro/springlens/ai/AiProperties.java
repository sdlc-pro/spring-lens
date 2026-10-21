package com.sdlcpro.springlens.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Independent, opt-in AI limits. Invalid limits fail closed before any data is read. */
@ConfigurationProperties("spring.lens.ai")
public class AiProperties {
    private boolean enabled;
    private int maxRecords = 100;
    private int maxContextChars = 2048;
    private int maxInsightChars = 4000;
    private long timeoutMillis = 10000;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getMaxRecords() { return maxRecords; }
    public void setMaxRecords(int value) { maxRecords = value; }
    public int getMaxContextChars() { return maxContextChars; }
    public void setMaxContextChars(int value) { maxContextChars = value; }
    public int getMaxInsightChars() { return maxInsightChars; }
    public void setMaxInsightChars(int value) { maxInsightChars = value; }
    public long getTimeoutMillis() { return timeoutMillis; }
    public void setTimeoutMillis(long value) { timeoutMillis = value; }

    boolean valid() {
        return maxRecords >= 1 && maxRecords <= 500 && maxContextChars >= 256 && maxContextChars <= 4096
                && maxInsightChars >= 1 && maxInsightChars <= 8000 && timeoutMillis >= 1 && timeoutMillis <= 30000;
    }
}
