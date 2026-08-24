package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.support.matcher.ClassNameMatcher;
import com.sdlcpro.springlens.insight.support.matcher.PackageMatcher;
import com.sdlcpro.springlens.matcher.CompositeMatcher;
import com.sdlcpro.springlens.model.bean.BeanRole;
import com.sdlcpro.springlens.model.bean.ProxyType;
import com.sdlcpro.springlens.util.ClassInspector;
import com.sdlcpro.springlens.util.Preconditions;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;

/**
 * Utility methods for inspecting Spring bean metadata, resolving runtime
 * class details, mapping Spring bean roles, and determining whether a
 * given bean is an internal SpringLens framework component.
 */
public final class BeanInfoUtils {

    private BeanInfoUtils() {
        throw new UnsupportedOperationException("The BeanInfoUtils is an utility class and cannot be instantiated");
    }

    /**
     * Resolves the proxy type of the given bean.
     *
     * @param bean the bean instance, must not be null
     * @return the resolved {@link ProxyType}
     */
    public static ProxyType resolveBeanProxyType(Object bean) {
        Preconditions.notNull(bean, "Bean must not be null");

        if (AopUtils.isCglibProxy(bean)) {
            return ProxyType.CGLIB;
        }
        if (AopUtils.isJdkDynamicProxy(bean)) {
            return ProxyType.JDK_DYNAMIC;
        }
        return ProxyType.UNKNOWN;
    }

    /**
     * Resolves the runtime class of the given bean.
     *
     * @param bean the bean instance, may be null
     * @return the bean's runtime class, or null if the bean is null
     */
    public static Class<?> resolveRuntimeClass(Object bean) {
        return bean != null ? bean.getClass() : null;
    }

    /**
     * Resolves the fully qualified runtime type name of the given bean.
     *
     * @param bean the bean instance, may be null
     * @return the bean's fully qualified type name, or null if the bean is null
     */
    public static String resolveRuntimeBeanType(Object bean) {
        return bean != null ? bean.getClass().getTypeName() : null;
    }

    /**
     * Resolves the {@link BeanRole} of the given bean name using the provided bean factory.
     *
     * @param beanFactory the bean factory to resolve the bean definition from
     * @param beanName    the name of the bean
     * @return the resolved bean role
     */
    public static BeanRole resolveBeanRole(ConfigurableListableBeanFactory beanFactory, String beanName) {
        Preconditions.notNull(beanFactory, "ConfigurableListableBeanFactory must not be null");
        Preconditions.hasText(beanName, "Bean name must not be blank");
        return BeanRole.from(beanFactory.getBeanDefinition(beanName).getRole());
    }

    /**
     * Checks whether the given bean's class is annotated with {@link SpringLensInternalComponent}.
     *
     * @param bean the bean instance, may be null
     * @return true if the bean is a SpringLens internal component, false otherwise
     */
    public static boolean isSpringLensComponent(Object bean) {
        return bean != null && ClassInspector.hasAnnotation(bean.getClass(), SpringLensInternalComponent.class);
    }

    /**
     * Resolve the bean scope like singleton, prototype etc
     *
     * @param beanFactory the type of {@link ConfigurableListableBeanFactory} must not be null
     * @param beanName    the name of the bean, must not be null
     * @return the scope of the bean, if the value from {@link ConfigurableListableBeanFactory} get null or empty
     * it simply return {@link ConfigurableListableBeanFactory}.SCOPE_SINGLETON
     */
    public static String resolveBeanScope(ConfigurableListableBeanFactory beanFactory, String beanName) {
        Preconditions.notNull(beanFactory, "ConfigurableListableBeanFactory must not be null");
        Preconditions.hasText(beanName, "Bean name must not be blank");
        BeanDefinition definition = beanFactory.getBeanDefinition(beanName);
        var scope = definition.getScope();
        return scope == null || scope.isEmpty()
                ? ConfigurableListableBeanFactory.SCOPE_SINGLETON
                : scope;
    }

    /**
     * Resolve the bean class type from @link ConfigurableListableBeanFactory}
     *
     * @param beanFactory the type of {@link ConfigurableListableBeanFactory} must not be null
     * @param beanName    the name of the bean, must not be null
     * @return the bean class type, it is just defined type not the actual runtime type
     */
    public static String resolveBeanType(ConfigurableListableBeanFactory beanFactory, String beanName) {
        Preconditions.notNull(beanFactory, "ConfigurableListableBeanFactory must not be null");
        Preconditions.hasText(beanName, "Bean name must not be blank");
        Class<?> clazz = beanFactory.getType(beanName);
        if (clazz != null) {
            return clazz.getTypeName();
        }

        return null;
    }

    /**
     * Generate the composite matcher from given {@link BeanInfoCollectorSettings}
     *
     * @param settings user configuration regarding bean info collection, must not be null
     * @return {@link CompositeMatcher} of context type {@link BeanInfoCollectionContext}
     */
    public static CompositeMatcher<BeanInfoCollectionContext> createCollectionMatcher(BeanInfoCollectorSettings settings) {
        Preconditions.notNull(settings, "BeanInfoCollectorSettings must not be null");
        var matcher = new CompositeMatcher<BeanInfoCollectionContext>();
        if (!settings.includeInfraRole()) {
            matcher.addExcludeMatcher(new InfraBeanRoleMatcher<>());
        }

        matcher.addExcludeMatcher(new ClassNameMatcher<>(settings.excludeClasses()));
        matcher.addExcludeMatcher(new PackageMatcher<>(settings.excludePackagePatterns()));

        if (!settings.includeToolInternal()) {
            matcher.addExcludeMatcher(new ToolInternalComponentMatcher<>());
        }

        return matcher;
    }
}
