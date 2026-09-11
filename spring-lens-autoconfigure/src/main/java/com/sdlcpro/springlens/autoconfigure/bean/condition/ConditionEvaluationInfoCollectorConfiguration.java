package com.sdlcpro.springlens.autoconfigure.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.insight.bean.condition.ConditionEvaluationInfoCollector;
import com.sdlcpro.springlens.insight.bean.condition.ConditionEvaluationInfoGatherer;
import com.sdlcpro.springlens.insight.bean.condition.ConditionReportSettings;
import com.sdlcpro.springlens.listener.bean.ConditionEvaluationInfoCollectListener;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import com.sdlcpro.springlens.model.bean.condition.ConditionMatch;
import com.sdlcpro.springlens.model.bean.condition.ConditionOutcome;
import com.sdlcpro.springlens.util.ClassInspector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionEvaluationReport;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;

@SpringLensInternalComponent
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
class ConditionEvaluationInfoCollectorConfiguration {
    private static final Logger logger = LoggerFactory.getLogger(ConditionEvaluationInfoCollectorConfiguration.class);

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public ConditionEvaluationInfoCollector conditionEvaluationInfoCollector(
            ApplicationContext context, ConditionReportProperties properties,
            ObjectProvider<ConditionEvaluationInfoCollectListener> conditionEvaluationInfoCollectListenerProvider
    ) {
        var include = properties.getInclude();
        var exclude = properties.getExclude();

        var settings = new ConditionReportSettings(
                include.isToolInternal(),
                exclude.getPackagePatterns(),
                exclude.isFrameworkInternal()
        );

        var conditionEvaluationInfoGatherer = new ConditionEvaluationInfoGathererImpl();
        return new ConditionEvaluationInfoCollector(
                context,
                conditionEvaluationInfoGatherer,
                settings,
                conditionEvaluationInfoCollectListenerProvider
        );
    }


    private static class ConditionEvaluationInfoGathererImpl implements ConditionEvaluationInfoGatherer {

        @Override
        public List<ConditionEvaluationInfo> gather(ConfigurableApplicationContext context) {
            var conditionEvaluationReport = ConditionEvaluationReport.get(context.getBeanFactory());
            String contextId = context.getId() == null ? ObjectUtils.identityToString(context) : context.getId();
            var outcomeMap = conditionEvaluationReport.getConditionAndOutcomesBySource();
            var conditionEvaluationInfos = new LinkedList<ConditionEvaluationInfo>();
            for (Map.Entry<String, ConditionEvaluationReport.ConditionAndOutcomes> entry : outcomeMap.entrySet()) {
                String source = entry.getKey();
                try {
                    ConditionEvaluationReport.ConditionAndOutcomes conditionAndOutcomes = entry.getValue();
                    var conditionEvaluationInfo = createConditionEvaluationInfo(contextId, source, conditionAndOutcomes);
                    conditionEvaluationInfos.add(conditionEvaluationInfo);
                } catch (Exception ex) {
                    logger.debug("Filed to gather condition evaluation info fro source '{}' in context '{}'",
                            entry.getKey(),
                            context,
                            ex
                    );
                }
            }

            return conditionEvaluationInfos;
        }

        private static ConditionEvaluationInfo createConditionEvaluationInfo(
                String contextId, String source,
                ConditionEvaluationReport.ConditionAndOutcomes conditionAndOutcomes) {

            var matches = new LinkedList<ConditionMatch>();
            for (ConditionEvaluationReport.ConditionAndOutcome outcome : conditionAndOutcomes) {
                var condition = ClassInspector.getClassName(outcome.getCondition().getClass());
                boolean matched = outcome.getOutcome().isMatch();
                var message = outcome.getOutcome().getMessage();
                if (!StringUtils.hasLength(message)) {
                    message = matched ? "matched" : "did not match";
                }
                matches.add(new ConditionMatch(condition, matched, message));
            }

            return new ConditionEvaluationInfo(
                    contextId,
                    source,
                    conditionAndOutcomes.isFullMatch() ? ConditionOutcome.MATCHED : ConditionOutcome.NOT_MATCHED,
                    matches
            );
        }
    }
}
