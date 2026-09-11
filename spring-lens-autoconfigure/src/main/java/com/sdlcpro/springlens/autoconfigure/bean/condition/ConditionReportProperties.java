package com.sdlcpro.springlens.autoconfigure.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Configuration properties for controlling condition evaluation reporting.
 * Externalized configuration property bindings under the spring.lens.bean.condition-report prefix.
 */
@SpringLensInternalComponent
@ConfigurationProperties(prefix = "spring.lens.bean.condition-report")
public class ConditionReportProperties {
    private boolean enabled = true;
    private final Include include = new Include();
    private final Exclude exclude = new Exclude();

    /**
     * @return whether the condition report is enabled
     */
    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * @return inclusion configuration
     */
    public Include getInclude() {
        return include;
    }

    /**
     * @return exclusion configuration
     */
    public Exclude getExclude() {
        return exclude;
    }

    /**
     * Defines externalized configuration property bindings for include block under spring.lens.bean.condition-report.include
     */
    public static final class Include {
        private boolean toolInternal = false;

        /**
         * @return whether tool internal components are included
         */
        public boolean isToolInternal() {
            return toolInternal;
        }

        public void setToolInternal(boolean toolInternal) {
            this.toolInternal = toolInternal;
        }
    }

    /**
     * Defines externalized configuration property bindings for exclude block under spring.lens.bean.condition-report.exclude
     */
    public static final class Exclude {
        private Set<String> packagePatterns = new LinkedHashSet<>();
        private boolean frameworkInternal;

        /**
         * @return the set of package patterns to exclude
         */
        public Set<String> getPackagePatterns() {
            return packagePatterns;
        }

        public void setPackagePatterns(Set<String> packagePatterns) {
            this.packagePatterns = packagePatterns;
        }

        public boolean isFrameworkInternal() {
            return frameworkInternal;
        }

        public void setFrameworkInternal(boolean frameworkInternal) {
            this.frameworkInternal = frameworkInternal;
        }
    }
}
