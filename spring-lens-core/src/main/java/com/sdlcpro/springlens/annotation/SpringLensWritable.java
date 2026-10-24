package com.sdlcpro.springlens.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marker annotation used to designate a model type as a Spring Lens response payload.
 *
 * <p>Types carrying this marker are intended to be serialized by the Spring Lens JSON pipeline
 * rather than by the host application's HTTP message converters. This keeps the Spring Lens
 * response contract stable regardless of how the host application configures its own JSON
 * serialization.</p>
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface SpringLensWritable {
}
