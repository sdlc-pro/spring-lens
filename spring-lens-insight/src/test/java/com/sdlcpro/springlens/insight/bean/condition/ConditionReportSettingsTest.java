package com.sdlcpro.springlens.insight.bean.condition;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConditionReportSettingsTest {

    @Test
    void mutatingSourceSetAfterConstructionDoesNotAffectRecord() {
        Set<String> packages = new HashSet<>(Set.of("com.example.internal"));

        ConditionReportSettings settings = new ConditionReportSettings(true, packages, false);

        packages.add("com.example.injected");

        assertThat(settings.excludePackagePatterns())
                .containsExactly("com.example.internal");
    }

    @Test
    void internalSetsAreImmutable() {
        ConditionReportSettings settings = new ConditionReportSettings(true, Set.of("com.example"), false);

        assertThatThrownBy(() -> settings.excludePackagePatterns().add("com.example.new"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void nullSetIsNormalizedToEmptySet() {
        ConditionReportSettings settings = new ConditionReportSettings(false, null, false);

        assertThat(settings.excludePackagePatterns()).isNotNull().isEmpty();
    }

    @Test
    void booleanFlagsAreStoredAsIs() {
        ConditionReportSettings settingsTrue = new ConditionReportSettings(true, Set.of(), false);
        ConditionReportSettings settingsFalse = new ConditionReportSettings(false, Set.of(), false);

        assertThat(settingsTrue.includeToolInternal()).isTrue();
        assertThat(settingsFalse.includeToolInternal()).isFalse();
    }

    @Test
    void equalsAndHashCodeWorkAsValueObject() {
        ConditionReportSettings a = new ConditionReportSettings(true, Set.of("p1"), false);
        ConditionReportSettings b = new ConditionReportSettings(true, Set.of("p1"), false);

        assertThat(a).isEqualTo(b).hasSameHashCodeAs(b);
    }
}
