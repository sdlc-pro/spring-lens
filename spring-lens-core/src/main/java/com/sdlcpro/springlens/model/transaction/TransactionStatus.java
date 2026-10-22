package com.sdlcpro.springlens.model.transaction;

/**
 * Outcome of a Spring transaction execution recorded by Spring-Lens.
 */
public enum TransactionStatus {
    /** The transaction completed and its changes were committed. */
    COMMITTED("Committed"),
    /** The transaction was rolled back and its changes were discarded. */
    ROLLED_BACK("Rolled Back"),
    /** The transaction failed with an error before it could complete. */
    ERRORED("Errored");

    private final String label;

    TransactionStatus(String label) {
        this.label = label;
    }

    /**
     * Returns the human-readable label for this status, for display.
     *
     * @return the display label, such as {@code "Rolled Back"}
     */
    public String getLabel() {
        return label;
    }
}
