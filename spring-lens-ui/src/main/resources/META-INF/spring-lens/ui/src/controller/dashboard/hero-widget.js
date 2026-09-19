import { Formatter } from '../../helper/index.js';

class HeroWidget {
    static FALLBACK = Object.freeze({
        name: 'Spring Boot Application',
        bootVersion: 'Active',
        frameworkVersion: 'Detected',
        javaVersion: 'Runtime',
        javaVendor: 'Standard',
        startupDuration: 'Ready',
        formattedStartedAt: 'Live',
        startDate: null,
        profiles: ['default'],
        profilesLabel: 'Active Profiles',
        isActiveProfiles: false
    });

    extractViewModel(applicationInfo) {
        const {
            name = 'Spring Boot Application',
            spring = {},
            java = {},
            startup = {},
            activeProfiles = [],
            defaultProfiles = []
        } = applicationInfo ?? {};

        const { startDate, formattedStartedAt } = this._parseStartedAt(startup.startedAt);
        const { profiles, profilesLabel, isActiveProfiles } = this._resolveProfiles(activeProfiles, defaultProfiles);

        return {
            name,
            bootVersion: `v${spring.bootVersion ?? '3.x'}`,
            frameworkVersion: `v${spring.frameworkVersion ?? '6.x'}`,
            javaVersion: `Java ${java.version ?? '21'}`,
            javaVendor: java.vendor ?? 'OpenJDK',
            startupDuration: Formatter.formatIsoDuration(startup.startupDuration),
            formattedStartedAt,
            startDate,
            profiles,
            profilesLabel,
            isActiveProfiles
        };
    }

    getFallbackViewModel() {
        return { ...HeroWidget.FALLBACK };
    }

    calculateUptime(startDate) {
        if (!startDate) return '--';
        const elapsed = Date.now() - new Date(startDate).getTime();
        return Number.isNaN(elapsed) ? '--' : Formatter.formatUptime(elapsed);
    }

    _parseStartedAt(startedAt) {
        if (!startedAt) return { startDate: null, formattedStartedAt: '--' };

        const date = new Date(startedAt);
        if (Number.isNaN(date.getTime())) return { startDate: null, formattedStartedAt: '--' };

        return {
            startDate: date,
            formattedStartedAt: date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })
        };
    }

    _resolveProfiles(activeProfiles, defaultProfiles) {
        const active = Array.isArray(activeProfiles) ? activeProfiles : [];
        const defaults = Array.isArray(defaultProfiles) && defaultProfiles.length > 0 ? defaultProfiles : ['default'];
        const hasActive = active.length > 0;

        return {
            profiles: hasActive ? active : defaults,
            profilesLabel: hasActive ? 'Active Profiles' : 'Default Profiles',
            isActiveProfiles: hasActive
        };
    }
}

const heroWidget = new HeroWidget();
export default heroWidget;