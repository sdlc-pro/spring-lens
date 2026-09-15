package com.sdlcpro.springlens.autoconfigure.http.request;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.http.HttpRequestMethod;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashSet;
import java.util.Set;

@SpringLensInternalComponent
@ConfigurationProperties(prefix = "spring.lens.http.request")
public class SpringLensHttpRequestProperties {

    private boolean includeRequestBody = false;
    private boolean includeResponseBody = false;
    private int maxBodyLength = 4096;
    private final Include include = new Include();
    private final Exclude exclude = new Exclude();
    private final Maskable maskable = new Maskable();

    public boolean isIncludeRequestBody() {
        return includeRequestBody;
    }

    public void setIncludeRequestBody(boolean includeRequestBody) {
        this.includeRequestBody = includeRequestBody;
    }

    public boolean isIncludeResponseBody() {
        return includeResponseBody;
    }

    public void setIncludeResponseBody(boolean includeResponseBody) {
        this.includeResponseBody = includeResponseBody;
    }

    public int getMaxBodyLength() {
        return maxBodyLength;
    }

    public void setMaxBodyLength(int maxBodyLength) {
        this.maxBodyLength = maxBodyLength;
    }

    public Include getInclude() {
        return include;
    }

    public Exclude getExclude() {
        return exclude;
    }

    public Maskable getMaskable() {
        return maskable;
    }

    public static class Include {
        private final Set<String> uriPatterns = new HashSet<>();

        public Set<String> getUriPatterns() {
            return uriPatterns;
        }
    }

    public static class Exclude {
        private final Set<String> uriPatterns = new HashSet<>(Set.of("/spring-lens/**"));
        private final Set<HttpRequestMethod> methods = new HashSet<>();

        public Set<String> getUriPatterns() {
            return uriPatterns;
        }

        public Set<HttpRequestMethod> getMethods() {
            return methods;
        }
    }

    public static class Maskable {
        private final Set<String> headers = new HashSet<>();
        private final Set<String> params = new HashSet<>();

        public Set<String> getHeaders() {
            return headers;
        }

        public Set<String> getParams() {
            return params;
        }
    }
}
