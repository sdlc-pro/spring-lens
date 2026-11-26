package com.sdlcpro.springlens.insight.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static com.sdlcpro.springlens.insight.security.CvssV3BaseScoreCalculator.calculate;
import static org.assertj.core.api.Assertions.assertThat;

class CvssV3BaseScoreCalculatorTest {

    @ParameterizedTest
    @CsvSource({
            "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:L,8.3",
            "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H,8.8",
            "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H,9.8",
            "CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N,1.8",
            "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N,5.4",
            "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N,0.0",
            "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H,10.0",
            "CVSS:3.1/A:H/I:H/C:H/S:U/UI:N/PR:N/AC:L/AV:N,9.8",
            "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/E:F/RL:O,9.8"})
    void computesBaseScore(String vector, double expected) {
        assertThat(calculate(vector)).hasValue(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "CVSS:4.0/AV:N", "CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "garbage",
            "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H",
            "CVSS:3.1/AV:N/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "CVSS:3.2/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"})
    void returnsEmptyForUnsupportedOrMalformedVector(String vector) {
        assertThat(calculate(vector)).isEmpty();
    }

    @Test
    void nullIsEmpty() {
        assertThat(calculate(null)).isEmpty();
    }
}
