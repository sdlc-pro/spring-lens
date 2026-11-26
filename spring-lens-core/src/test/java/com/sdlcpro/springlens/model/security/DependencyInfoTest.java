package com.sdlcpro.springlens.model.security;

import org.junit.jupiter.api.Test;

import static com.sdlcpro.springlens.model.security.DependencyEcosystem.MAVEN;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
class DependencyInfoTest {

    @Test
    void shouldRejectBlankArtifactId() {
        assertThatThrownBy(() -> new DependencyInfo("org.yaml", " ", "1.33", MAVEN, "file:/x.jar", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("DependencyInfo artifactId must not be blank");
    }

    @Test
    void shouldRejectNullEcosystem() {
        assertThatThrownBy(() -> new DependencyInfo("org.yaml", "snakeyaml", "1.33", null, "file:/x.jar", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("DependencyInfo ecosystem must not be null");
    }

    @Test
    void shouldDefaultEvaluationStatusToNotEvaluated() {
        var info = new DependencyInfo("org.yaml", "snakeyaml", "1.33", MAVEN, "file:/x.jar", null);
        assertThat(info.evaluationStatus()).isEqualTo(DependencyEvaluationStatus.NOT_EVALUATED);
    }

    @Test
    void shouldBeResolvedOnlyWhenGroupIdAndVersionPresent() {
        assertThat(new DependencyInfo("org.yaml", "snakeyaml", "1.33", MAVEN, null, null).resolved()).isTrue();
        assertThat(new DependencyInfo(null, "tools", null, MAVEN, null, null).resolved()).isFalse();
        assertThat(new DependencyInfo(null, "snakeyaml", "1.33", MAVEN, null, null).resolved()).isFalse();
    }

    @Test
    void shouldExposeKeyAndOsvPackageName() {
        var info = new DependencyInfo("org.yaml", "snakeyaml", "1.33", MAVEN, null, null);
        assertThat(info.key()).isEqualTo(new DependencyKey("org.yaml", "snakeyaml", "1.33"));
        assertThat(info.osvPackageName()).isEqualTo("org.yaml:snakeyaml");
    }

    @Test
    void withEvaluationStatusReturnsCopyWithNewStatus() {
        var info = new DependencyInfo("org.yaml", "snakeyaml", "1.33", MAVEN, null, null);
        var evaluated = info.withEvaluationStatus(DependencyEvaluationStatus.EVALUATED);
        assertThat(evaluated.evaluationStatus()).isEqualTo(DependencyEvaluationStatus.EVALUATED);
        assertThat(evaluated.key()).isEqualTo(info.key());
        assertThat(info.evaluationStatus()).isEqualTo(DependencyEvaluationStatus.NOT_EVALUATED);
    }
}
