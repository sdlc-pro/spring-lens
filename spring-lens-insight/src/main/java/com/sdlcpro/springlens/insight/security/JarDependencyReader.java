package com.sdlcpro.springlens.insight.security;

import com.sdlcpro.springlens.annotation.SpringLensInternalComponent;
import com.sdlcpro.springlens.model.security.DependencyEcosystem;
import com.sdlcpro.springlens.model.security.DependencyEvaluationStatus;
import com.sdlcpro.springlens.model.security.DependencyInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.JarURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.Optional;
import java.util.Properties;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads Maven coordinates of a classpath jar from its
 * {@code META-INF/maven/<groupId>/<artifactId>/pom.properties} entries,
 * falling back to the jar file name when the metadata is absent or unreadable.
 *
 * @author Ixtiyorxon
 * @since 2026-11-26
 */
@SpringLensInternalComponent
public class JarDependencyReader {

    private static final Logger log = LoggerFactory.getLogger(JarDependencyReader.class);

    private static final String POM_PROPERTIES_PREFIX = "META-INF/maven/";
    private static final String POM_PROPERTIES_SUFFIX = "/pom.properties";
    private static final Pattern FILE_NAME_PATTERN = Pattern.compile("^(?<artifact>.+?)-(?<version>\\d[^/]*)\\.jar$");

    public JarDependencyReader() {
    }

    /**
     * Reads the dependency coordinates of the jar behind the given {@code jar:} URL.
     * Never throws; failures yield a file-name based UNRESOLVED result.
     *
     * @param jarUrl a {@code jar:} URL ending in {@code !/}
     * @return the dependency information
     */
    public DependencyInfo read(URL jarUrl) {
        String location = jarUrl.toString();
        String fileName = fileNameFromUrl(location);
        try {
            DependencyInfo fromPom = readPomProperties(jarUrl, fileName);
            if (fromPom != null) {
                return withLocation(fromPom, location);
            }
        } catch (Exception e) {
            log.debug("Unable to read Maven metadata from {}", location, e);
        }
        DependencyInfo fallback = parseFileName(fileName)
                .orElseGet(() -> new DependencyInfo(null, "unknown", null,
                        DependencyEcosystem.MAVEN, null, DependencyEvaluationStatus.UNRESOLVED));
        return withLocation(fallback, location);
    }

    /**
     * Parses a jar file name such as {@code jackson-databind-2.15.3.jar}.
     *
     * @param jarFileName the jar file name
     * @return an UNRESOLVED dependency with null group and location, or empty when no name can be derived
     */
    static Optional<DependencyInfo> parseFileName(String jarFileName) {
        if (jarFileName == null || jarFileName.isBlank()) {
            return Optional.empty();
        }
        Matcher matcher = FILE_NAME_PATTERN.matcher(jarFileName);
        if (matcher.matches()) {
            return Optional.of(unresolved(matcher.group("artifact"), matcher.group("version")));
        }
        String stem = fallbackArtifactId(jarFileName);
        return stem.isBlank() ? Optional.empty() : Optional.of(unresolved(stem, null));
    }

    /**
     * Extracts the file name from a jar URL, supporting Spring Boot nested URLs.
     */
    static String fileNameFromUrl(String url) {
        String value = url;
        if (value.endsWith("!/")) {
            value = value.substring(0, value.length() - 2);
        }
        String name = value.substring(value.lastIndexOf('/') + 1);
        while (name.startsWith("!")) {
            name = name.substring(1);
        }
        return name;
    }

    private DependencyInfo readPomProperties(URL jarUrl, String fileName) throws IOException {
        URLConnection connection = jarUrl.openConnection();
        connection.setUseCaches(false);
        if (!(connection instanceof JarURLConnection jarConnection)) {
            return null;
        }
        try (JarFile jarFile = jarConnection.getJarFile()) {
            DependencyInfo first = null;
            DependencyInfo bestPrefix = null;
            var entries = jarFile.entries();
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                String entryName = entry.getName();
                if (entry.isDirectory() || !entryName.startsWith(POM_PROPERTIES_PREFIX)
                        || !entryName.endsWith(POM_PROPERTIES_SUFFIX)) {
                    continue;
                }
                DependencyInfo candidate = load(jarFile, entry);
                if (candidate == null) {
                    continue;
                }
                if (fileName.equals(candidate.artifactId() + "-" + candidate.version() + ".jar")) {
                    return candidate;
                }
                if (fileName.startsWith(candidate.artifactId() + "-")
                        && (bestPrefix == null || candidate.artifactId().length() > bestPrefix.artifactId().length())) {
                    bestPrefix = candidate;
                }
                if (first == null) {
                    first = candidate;
                }
            }
            return bestPrefix != null ? bestPrefix : first;
        }
    }

    private DependencyInfo load(JarFile jarFile, JarEntry entry) throws IOException {
        Properties properties = new Properties();
        try (InputStream in = jarFile.getInputStream(entry)) {
            properties.load(in);
        }
        String groupId = trimToNull(properties.getProperty("groupId"));
        String artifactId = trimToNull(properties.getProperty("artifactId"));
        String version = trimToNull(properties.getProperty("version"));
        if (groupId == null || artifactId == null || version == null) {
            return null;
        }
        return new DependencyInfo(groupId, artifactId, version, DependencyEcosystem.MAVEN, null,
                DependencyEvaluationStatus.NOT_EVALUATED);
    }

    private static DependencyInfo unresolved(String artifactId, String version) {
        return new DependencyInfo(null, artifactId, version, DependencyEcosystem.MAVEN, null,
                DependencyEvaluationStatus.UNRESOLVED);
    }

    private static DependencyInfo withLocation(DependencyInfo info, String location) {
        return new DependencyInfo(info.groupId(), info.artifactId(), info.version(), info.ecosystem(), location,
                info.evaluationStatus());
    }

    private static String fallbackArtifactId(String fileName) {
        return fileName.toLowerCase().endsWith(".jar") ? fileName.substring(0, fileName.length() - 4) : fileName;
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
