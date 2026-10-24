package com.sdlcpro.springlens.exposure;

import org.springframework.http.MediaType;

import java.nio.charset.StandardCharsets;

/**
 * Vendor media types owned by Spring Lens.
 *
 * <p>Spring Lens endpoints declare these media types instead of the standard JSON media type, so that
 * the Spring Lens HTTP message converters are selected for Spring Lens payloads without competing with
 * the converters configured by the host application.</p>
 */
public final class SpringLensMediaType {

    /**
     * Parsed form of {@link #APPLICATION_SPRING_LENS_JSON_VALUE}.
     */
    public static final MediaType APPLICATION_SPRING_LENS_JSON;

    /**
     * String value of the Spring Lens vendor JSON media type.
     */
    public static final String APPLICATION_SPRING_LENS_JSON_VALUE = "application/vnd.sdlc-pro.spring-lens.v2+json";

    /**
     * Parsed form of {@link #APPLICATION_SPRING_LENS_JSON_UTF8_VALUE}.
     */
    public static final MediaType APPLICATION_SPRING_LENS_JSON_UTF8;

    /**
     * String value of the Spring Lens vendor JSON media type qualified with a UTF-8 charset.
     */
    public static final String APPLICATION_SPRING_LENS_JSON_UTF8_VALUE = "application/vnd.sdlc-pro.spring-lens.v2+json;charset=UTF-8";

    static {
        APPLICATION_SPRING_LENS_JSON = new MediaType(
                "application",
                "vnd.sdlc-pro.spring-lens.v2+json"
        );

        APPLICATION_SPRING_LENS_JSON_UTF8 = new MediaType(
                "application",
                "vnd.sdlc-pro.spring-lens.v2+json",
                StandardCharsets.UTF_8
        );
    }

    private SpringLensMediaType() {
        throw new UnsupportedOperationException("SpringLensMediaType is an utility class and cannot be instantiated");
    }
}
