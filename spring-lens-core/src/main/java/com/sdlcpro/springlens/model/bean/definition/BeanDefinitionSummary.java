package com.sdlcpro.springlens.model.bean.definition;

import com.sdlcpro.springlens.annotation.SpringLensWritable;
import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.LoadingMode;
import com.sdlcpro.springlens.util.DefensiveCopies;
import com.sdlcpro.springlens.util.Preconditions;

import java.util.Map;

/**
 * Immutable summary of bean bean-definition metrics across Spring application
 * contexts.
 *
 * <p>The summary contains distributions of bean definitions by application
 * context, scope, role, and loading mode, together with the total number of
 * bean definitions.</p>
 *
 * <p>This type is a response model marked with {@link SpringLensWritable}, so it is
 * serialized as the body of Spring-Lens REST responses using the
 * {@code application/vnd.sdlc-pro.spring-lens.v2+json} media type.
 *
 * @param contextDistribution     distribution of bean definitions by context
 * @param scopeDistribution       distribution of bean definitions by scope
 * @param roleDistribution        distribution of bean definitions by role
 * @param loadingModeDistribution distribution of bean definitions by loading mode
 * @param totalBeanDefinitions    total number of bean definitions
 */
@SpringLensWritable
public record BeanDefinitionSummary(
        Map<String, Integer> contextDistribution,
        Map<String, Integer> scopeDistribution,
        Map<BeanRole, Integer> roleDistribution,
        Map<LoadingMode, Integer> loadingModeDistribution,
        long totalBeanDefinitions
) {
    private static final BeanDefinitionSummary EMPTY = new BeanDefinitionSummary(
            Map.of(),
            Map.of(),
            Map.of(),
            Map.of(),
            0L
    );

    public BeanDefinitionSummary {
        contextDistribution = DefensiveCopies.immutableMapOrEmpty(contextDistribution);
        scopeDistribution = DefensiveCopies.immutableMapOrEmpty(scopeDistribution);
        roleDistribution = DefensiveCopies.immutableEnumMapOrEmpty(roleDistribution);
        loadingModeDistribution = DefensiveCopies.immutableEnumMapOrEmpty(loadingModeDistribution);

        Preconditions.isTrue(
                totalBeanDefinitions >= 0,
                "Total bean bean-definition count must not be negative value"
        );
    }

    /**
     * Creates an empty bean bean-definition summary.
     *
     * @return an empty summary with zero total bean definitions
     */
    public static BeanDefinitionSummary empty() {
        return EMPTY;
    }
}
