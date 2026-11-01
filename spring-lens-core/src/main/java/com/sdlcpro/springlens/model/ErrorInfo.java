package com.sdlcpro.springlens.model;

import com.sdlcpro.springlens.util.Preconditions;

public record ErrorInfo(String type, String message, String stackTrace) {

    public ErrorInfo {
        Preconditions.hasText(type, "Error type must not be blank");
    }
}
