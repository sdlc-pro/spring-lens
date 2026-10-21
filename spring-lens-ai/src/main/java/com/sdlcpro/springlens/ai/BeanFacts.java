package com.sdlcpro.springlens.ai;

import com.sdlcpro.springlens.query.PageRequest;
import com.sdlcpro.springlens.query.Sort;
import com.sdlcpro.springlens.repository.bean.BeanDefinitionInfoRepository;

/** Explicit privacy boundary: only numeric counts derived from a bounded page leave storage. */
final class BeanFacts {
    private final BeanDefinitionInfoRepository repository;

    BeanFacts(BeanDefinitionInfoRepository repository) { this.repository = repository; }

    String context(AiProperties limits) {
        var page = repository.findAll(new PageRequest(0, limits.getMaxRecords(), Sort.unsorted()));
        int sampled = 0, lazy = 0, primary = 0, singleton = 0, prototype = 0;
        // Enforce our own cap even when a custom repository ignores the page size.
        for (var bean : page.getContent()) {
            if (sampled >= limits.getMaxRecords()) break;
            sampled++;
            if (bean.lazyInit()) lazy++;
            if (bean.primary()) primary++;
            if ("singleton".equals(bean.scope()) || "".equals(bean.scope())) singleton++;
            if ("prototype".equals(bean.scope())) prototype++;
        }
        String facts = "Bean definitions: total=" + Math.max(0, page.getTotalElements())
                + "; sampled=" + sampled + "; lazy=" + lazy + "; primary=" + primary
                + "; singleton=" + singleton + "; prototype=" + prototype
                + "; otherScope=" + (sampled - singleton - prototype)
                + ". Counts describe a bounded first-page sample, not the whole application.";
        return facts.substring(0, Math.min(facts.length(), limits.getMaxContextChars()));
    }
}
