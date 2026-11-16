package com.sdlcpro.springlens.exception;

/**
 * Thrown when a field accessor cannot be created.
 */
public final class AccessorCreationException extends RuntimeException {

    public AccessorCreationException(String message, Throwable cause) {
        super(message, cause);
    }
}
