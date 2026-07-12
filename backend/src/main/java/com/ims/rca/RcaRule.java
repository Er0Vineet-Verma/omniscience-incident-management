package com.ims.rca;

import java.util.List;

/**
 * A simple root-cause-analysis rule.
 *
 * @param name             rule display name
 * @param keywordPattern   case-insensitive regex describing the keyword predicate
 *                         matched against ERROR/WARN log messages
 * @param threshold        minimum number of matching messages for the rule to fire
 * @param suggestedCause   likely root cause when the rule fires
 * @param suggestedActions recommended remediation actions
 */
public record RcaRule(
        String name,
        String keywordPattern,
        int threshold,
        String suggestedCause,
        List<String> suggestedActions
) {
}
