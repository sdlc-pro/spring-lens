package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.support.matcher.AnnotatedClassMatcher;
import com.sdlcpro.springlens.insight.support.provider.ClassProvider;

import java.util.Set;

/**
 * Matches Spring Lens internal tool components annotated with
 * {@link SpringLensInternalComponent}.
 *
 * <p>Used when collecting bean definitions so framework-owned beans can be
 * excluded without treating only HTTP endpoints as internal.</p>
 *
 * @param <T> the type of context being matched; it must provide a class
 * @since 1.0.0
 */
public class ToolInternalComponentMatcher<T extends ClassProvider> extends AnnotatedClassMatcher<T> {

    /**
     * Creates a matcher that recognizes classes annotated with
     * {@link SpringLensInternalComponent}.
     */
    public ToolInternalComponentMatcher() {
        super(Set.of(SpringLensInternalComponent.class));
    }
}
