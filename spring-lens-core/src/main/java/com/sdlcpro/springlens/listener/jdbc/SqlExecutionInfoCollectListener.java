package com.sdlcpro.springlens.listener.jdbc;

import com.sdlcpro.springlens.model.jdbc.SqlExecutionInfo;

import java.util.Objects;

/**
 * Functional callback interface for receiving newly collected {@link SqlExecutionInfo}
 * telemetry records from the JDBC interception pipeline.
 *
 * <p>Implementations decouple telemetry generation from downstream consumers such
 * as in-memory stores, audit loggers, metrics exporters, or live dashboard streamers.
 *
 * @see SqlExecutionInfo
 */
@FunctionalInterface
public interface SqlExecutionInfoCollectListener {

    /**
     * Invoked when a finalized {@link SqlExecutionInfo} record is collected.
     *
     * @param sqlExecutionInfo the collected SQL execution telemetry record
     */
    void onSqlExecutionInfoCollected(SqlExecutionInfo sqlExecutionInfo);

    /**
     * Returns a composed listener that invokes this listener first and then
     * invokes the {@code after} listener.
     *
     * @param after the subsequent listener to invoke
     * @return a composed {@link SqlExecutionInfoCollectListener}
     * @throws NullPointerException if {@code after} is {@code null}
     */
    default SqlExecutionInfoCollectListener andThen(SqlExecutionInfoCollectListener after) {
        Objects.requireNonNull(after, "after listener must not be null");
        return info -> {
            onSqlExecutionInfoCollected(info);
            after.onSqlExecutionInfoCollected(info);
        };
    }
}