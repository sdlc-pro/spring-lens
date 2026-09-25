package com.sdlcpro.springlens.insight.bean.instance;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.bean.BeanInfoUtils;
import com.sdlcpro.springlens.inspector.bean.BeanProxyInfoInspector;
import com.sdlcpro.springlens.model.bean.BeanInfoCompositeKey;
import com.sdlcpro.springlens.model.bean.ProxyType;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceProxyInfo;
import com.sdlcpro.springlens.util.Preconditions;
import org.springframework.aop.Advisor;
import org.springframework.aop.framework.Advised;
import org.springframework.aop.framework.AopProxyUtils;
import org.springframework.context.ApplicationContext;

import java.util.LinkedList;
import java.util.List;

@SpringLensInternalComponent
public class DefaultBeanProxyInfoInspector implements BeanProxyInfoInspector {
    private final ApplicationContext context;

    public DefaultBeanProxyInfoInspector(ApplicationContext context) {
        Preconditions.notNull(context, "ApplicationContext must not be null");
        this.context = context;
    }

    @Override
    public BeanInstanceProxyInfo inspectBy(BeanInfoCompositeKey key) {
        Preconditions.notNull(key, "The BeanInfoCompositeKey must not be null");

        String contextId = key.contextId();
        String beanName = key.beanName();

        ApplicationContext appContext = this.context;
        while (appContext != null) {
            if (contextId.equals(appContext.getId())) {
                return getProxyInfo(appContext, beanName);
            }

            appContext = appContext.getParent();
        }

        return null;
    }

    private static BeanInstanceProxyInfo getProxyInfo(ApplicationContext context, String beanName) {
        Object bean = context.getBean(beanName);
        if (!(bean instanceof Advised advised)) {
            return null;
        }

        Advisor[] advisors = advised.getAdvisors();
        List<String> advices = new LinkedList<>();
        if (advisors != null) {
            for (Advisor advisor : advisors) {
                if (advisor != null) {
                    var advice = advisor.getAdvice();
                    if (advice != null) {
                        advices.add(advice.getClass().getTypeName());
                    } else {
                        advices.add(advisor.getClass().getTypeName());
                    }
                }
            }
        }

        List<String> proxiedInterfaces = new LinkedList<>();
        Class<?>[] interfaces = advised.getProxiedInterfaces();
        if (interfaces != null) {
            for (Class<?> clazz : interfaces) {
                if (clazz != null) {
                    proxiedInterfaces.add(clazz.getTypeName());
                }
            }
        }

        String targetClass = AopProxyUtils.ultimateTargetClass(bean).getTypeName();
        ProxyType proxyType = BeanInfoUtils.resolveBeanProxyType(bean);

        return new BeanInstanceProxyInfo(
                targetClass,
                List.copyOf(advices),
                List.copyOf(proxiedInterfaces),
                advised.isFrozen(),
                proxyType
        );
    }
}
