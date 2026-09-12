package com.sdlcpro.springlens.insight.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.constant.SpringFrameworkModule;
import com.sdlcpro.springlens.insight.support.matcher.PackageMatcher;
import com.sdlcpro.springlens.insight.util.SafeListenerInvoker;
import com.sdlcpro.springlens.listener.bean.ConditionEvaluationInfoCollectListener;
import com.sdlcpro.springlens.matcher.CompositeMatcher;
import com.sdlcpro.springlens.model.bean.condition.ConditionEvaluationInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

import static com.sdlcpro.springlens.constant.SpringLensConstants.SPRING_LENS_BASE_PACKAGE_PATTERN;

@SpringLensInternalComponent
public class ConditionEvaluationInfoCollector implements SmartInitializingSingleton {
    private static final Logger logger = LoggerFactory.getLogger(ConditionEvaluationInfoCollector.class);

    private final ApplicationContext context;
    private final ConditionEvaluationInfoGatherer conditionEvaluationInfoGatherer;
    private final ObjectProvider<ConditionEvaluationInfoCollectListener> conditionEvaluationInfoCollectListenerProvider;
    private final CompositeMatcher<ConditionEvaluationCollectionContext> conditionEvaluationCollectionMatcher;

    public ConditionEvaluationInfoCollector(
            ApplicationContext context,
            ConditionEvaluationInfoGatherer conditionEvaluationInfoGatherer,
            ConditionReportSettings settings,
            ObjectProvider<ConditionEvaluationInfoCollectListener> conditionEvaluationInfoCollectListenerProvider) {
        this.context = context;
        this.conditionEvaluationInfoGatherer = conditionEvaluationInfoGatherer;
        this.conditionEvaluationInfoCollectListenerProvider = conditionEvaluationInfoCollectListenerProvider;
        this.conditionEvaluationCollectionMatcher = createCollectionMatcher(settings);
    }

    private CompositeMatcher<ConditionEvaluationCollectionContext> createCollectionMatcher(
            ConditionReportSettings settings) {
        var matcher = new CompositeMatcher<ConditionEvaluationCollectionContext>();
        matcher.addExcludeMatcher(new PackageMatcher<>(settings.excludePackagePatterns()));
        if (!settings.includeToolInternal()) {
            matcher.addExcludeMatcher(new PackageMatcher<>(Set.of(SPRING_LENS_BASE_PACKAGE_PATTERN)));
        }

        if (settings.excludeFrameworkInternal()) {
            var excludePackagePatterns = new LinkedHashSet<String>();
            var modules = SpringFrameworkModule.modules();
            for (SpringFrameworkModule module : modules) {
                excludePackagePatterns.add(module.getPackagePattern());
            }

            matcher.addExcludeMatcher(new PackageMatcher<>(excludePackagePatterns));
        }

        return matcher;
    }

    @Override
    public void afterSingletonsInstantiated() {
        List<ConditionEvaluationInfo> conditionEvaluationInfos = this.collectConditionEvaluationInfo();
        this.publishConditionEvaluationInfo(conditionEvaluationInfos);
    }

    public List<ConditionEvaluationInfo> collectConditionEvaluationInfo() {
        var conditionEvaluationInfos = new LinkedList<ConditionEvaluationInfo>();
        this.collectConditionEvaluationInfoRecursively(this.context, conditionEvaluationInfos);
        return conditionEvaluationInfos;
    }

    private void collectConditionEvaluationInfoRecursively(
            ApplicationContext context,
            List<ConditionEvaluationInfo> conditionEvaluationInfos) {

        var parentContext = context.getParent();
        if (parentContext != null) {
            this.collectConditionEvaluationInfoRecursively(parentContext, conditionEvaluationInfos);
        }

        if (!(context instanceof ConfigurableApplicationContext configurableApplicationContext)) {
            return;
        }

        for (var gatheredInfo : this.conditionEvaluationInfoGatherer.gather(configurableApplicationContext)) {
            if (gatheredInfo != null) {
                try {
                    if (this.isEligibleToCollectInfo(gatheredInfo.source())) {
                        conditionEvaluationInfos.add(gatheredInfo);
                    }
                } catch (Exception ex) {
                    logger.debug("Filed to collect condition evaluation info for source '{}' in context '{}'",
                            gatheredInfo.source(),
                            gatheredInfo.contextId(),
                            ex
                    );
                }
            }
        }
    }

    public boolean isEligibleToCollectInfo(String source) {
        var context = new ConditionEvaluationCollectionContext(source);
        return this.conditionEvaluationCollectionMatcher.matches(context);
    }

    private void publishConditionEvaluationInfo(List<ConditionEvaluationInfo> conditionEvaluationInfos) {
        for (var conditionEvaluationInfo : conditionEvaluationInfos) {
            SafeListenerInvoker.invoke(
                    this.conditionEvaluationInfoCollectListenerProvider,
                    conditionEvaluationInfo,
                    ConditionEvaluationInfoCollectListener::onConditionEvaluationInfoCollect
            );
        }
    }
}
