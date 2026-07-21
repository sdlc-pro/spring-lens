package com.sdlcpro.springlens.insight.http.endpoint;

import com.sdlcpro.springlens.model.http.endpoint.EndpointInfo;
import org.springframework.web.servlet.HandlerMapping;

import java.util.List;

/**
 * Collects endpoint metadata from a Spring {@link HandlerMapping}.
 *
 * <p>Implementations support specific {@link HandlerMapping} types and extract
 * a snapshot of their endpoint metadata.</p>
 *
 * @since 1.0.0
 */
public interface EndpointInfoCollector {

    /**
     * Determines whether this collector can process the given handler mapping.
     *
     * @param mapping the Spring handler mapping to evaluate
     * @return {@code true} if this collector supports the mapping; {@code false}
     * otherwise
     */
    default boolean supports(HandlerMapping mapping) {
        return false;
    }

    /**
     * Collects endpoint metadata from the given handler mapping.
     *
     * @param mapping the Spring handler mapping to inspect
     * @return the collected endpoint metadata
     */
    List<EndpointInfo> collect(HandlerMapping mapping);
}
