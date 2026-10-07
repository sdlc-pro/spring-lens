package com.sdlcpro.springlens.autoconfigure.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;

@AutoConfiguration
@SpringLensInternalComponent
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
@EnableConfigurationProperties(SpringLensConditionReportProperties.class)
@ConditionalOnProperty(
        prefix = "spring.lens.bean.condition-report",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
@Import({
        ConditionEvaluationInfoCollectorConfiguration.class,
        ConditionEvaluationInfoStorageConfiguration.class,
        ConditionEvaluationInfoHttpExposureConfiguration.class
})
public class SpringLensConditionReportAutoConfiguration {

}
