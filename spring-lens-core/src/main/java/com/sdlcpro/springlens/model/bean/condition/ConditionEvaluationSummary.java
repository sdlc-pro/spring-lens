package com.sdlcpro.springlens.model.bean.condition;

import com.sdlcpro.springlens.annotation.SpringLensWritable;
import com.sdlcpro.springlens.util.Preconditions;

@SpringLensWritable
public record ConditionEvaluationSummary(
        int totalConditionSources,
        int matchedConditionSources,
        int unmatchedConditionSources,
        int totalEvaluatedConditions
) {
    private static final ConditionEvaluationSummary EMPTY = new ConditionEvaluationSummary(0, 0, 0, 0);

    public ConditionEvaluationSummary {
        Preconditions.isTrue(
                totalConditionSources >= 0,
                "The value of totalConditionSources must not be negative"
        );

        Preconditions.isTrue(
                matchedConditionSources >= 0,
                "The value of matchedConditionSources must not be negative"
        );

        Preconditions.isTrue(
                unmatchedConditionSources >= 0,
                "The value of unmatchedConditionSources must not be negative"
        );

        Preconditions.isTrue(
                totalEvaluatedConditions >= 0,
                "The value of totalEvaluatedConditions must not be negative"
        );
    }

    public static ConditionEvaluationSummary empty() {
        return EMPTY;
    }
}
