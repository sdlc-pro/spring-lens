package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.inspector.security.DependencyInventoryCollector;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import com.sdlcpro.springlens.model.security.DependencyKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URL;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Collects the dependency inventory by locating every jar that exposes a
 * {@code META-INF/MANIFEST.MF} through the application class loader.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class ClasspathDependencyInventoryCollector implements DependencyInventoryCollector {

    private static final Logger log = LoggerFactory.getLogger(ClasspathDependencyInventoryCollector.class);

    private static final String MANIFEST_RESOURCE = "META-INF/MANIFEST.MF";
    private static final String JAR_ROOT_SEPARATOR = "!/";

    private static final Comparator<String> NULLS_LAST = Comparator.nullsLast(Comparator.naturalOrder());
    private static final Comparator<DependencyInfo> ORDER = Comparator
            .comparing(DependencyInfo::groupId, NULLS_LAST)
            .thenComparing(DependencyInfo::artifactId, NULLS_LAST)
            .thenComparing(DependencyInfo::version, NULLS_LAST);

    private final ClassLoader classLoader;
    private final JarDependencyReader reader;

    public ClasspathDependencyInventoryCollector(ClassLoader classLoader, JarDependencyReader reader) {
        this.classLoader = classLoader;
        this.reader = reader;
    }

    @Override
    public List<DependencyInfo> collect() {
        Map<DependencyKey, DependencyInfo> unique = new LinkedHashMap<>();
        try {
            Enumeration<URL> resources = classLoader.getResources(MANIFEST_RESOURCE);
            while (resources.hasMoreElements()) {
                collectOne(resources.nextElement(), unique);
            }
        } catch (IOException e) {
            log.debug("Unable to enumerate classpath manifests", e);
        }
        return unique.values().stream().sorted(ORDER).toList();
    }

    private void collectOne(URL resource, Map<DependencyKey, DependencyInfo> unique) {
        try {
            if (!"jar".equals(resource.getProtocol())) {
                return;
            }
            DependencyInfo info = reader.read(new URL(jarRoot(resource.toString())));
            unique.putIfAbsent(info.key(), info);
        } catch (Exception e) {
            log.debug("Skipping classpath resource {}", resource, e);
        }
    }

    /**
     * Strips a manifest URL down to the jar root, cutting after the last {@code !/}.
     */
    static String jarRoot(String resourceUrl) {
        int index = resourceUrl.lastIndexOf(JAR_ROOT_SEPARATOR);
        return index < 0 ? resourceUrl : resourceUrl.substring(0, index + JAR_ROOT_SEPARATOR.length());
    }
}
