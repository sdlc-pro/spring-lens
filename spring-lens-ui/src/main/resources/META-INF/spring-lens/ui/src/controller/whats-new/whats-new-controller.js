import BaseController from '../base-controller.js';
import { RELEASES, CATEGORIES, UPCOMING } from './whats-new-data.js';
import container from '../../core/container.js';

export class WhatsNewController extends BaseController {

    constructor() {
        super('whatsNew');
        this.applicationState = container.make('applicationState');

        this.state = {
            appName: this.applicationState?.getAppName?.() || 'SpringLens',
            releases: RELEASES,
            categories: CATEGORIES,
            upcoming: UPCOMING,
            activeFilter: 'all',
            searchQuery: '',
            activeRelease: RELEASES[0]?.version || 'v1.0.0',
            activeModalImage: null,
            activeModalTitle: ''
        };
    }

    createAlpineState() {
        return {
            ...this.state,
            setFilter: (category) => this.setFilter(category),
            setSearchQuery: (query) => this.setSearchQuery(query),
            resetSearch: () => this.resetSearch(),
            goTo: (route) => this.goTo(route),
            openImageModal: (src, title) => this.openImageModal(src, title),
            closeImageModal: () => this.closeImageModal(),
            isFeatureVisible: (feature) => this.isFeatureVisible(feature),
            isHeroVisible: (hero) => this.isHeroVisible(hero),
            hasVisibleContent: (release) => this.hasVisibleContent(release)
        };
    }

    async enter() {
        const appName = this.applicationState?.getAppName?.() || 'SpringLens';
        this.setState({ appName });
    }

    setFilter(category) {
        this.setState({ activeFilter: category });
    }

    setSearchQuery(query) {
        this.setState({ searchQuery: query || '' });
    }

    resetSearch() {
        this.setState({ searchQuery: '', activeFilter: 'all' });
    }

    goTo(route) {
        if (!route) return;
        window.location.hash = '#/' + route;
    }

    openImageModal(src, title) {
        this.setState({ activeModalImage: src, activeModalTitle: title || '' });
    }

    closeImageModal() {
        this.setState({ activeModalImage: null, activeModalTitle: '' });
    }

    isFeatureVisible(feature) {
        const active = this.alpine?.activeFilter ?? this.state.activeFilter;
        const query = (this.alpine?.searchQuery ?? this.state.searchQuery ?? '').trim().toLowerCase();

        const matchesCategory = active === 'all' || feature.category === active;
        if (!matchesCategory) return false;

        if (!query) return true;

        const inTitle = feature.title?.toLowerCase().includes(query);
        const inDescription = feature.description?.toLowerCase().includes(query);
        const inCategory = feature.category?.toLowerCase().includes(query);
        const inTags = feature.tags?.some(tag => tag.toLowerCase().includes(query));
        const inPoints = feature.points?.some(point => point.toLowerCase().includes(query));

        return Boolean(inTitle || inDescription || inCategory || inTags || inPoints);
    }

    isHeroVisible(hero) {
        const active = this.alpine?.activeFilter ?? this.state.activeFilter;
        if (active !== 'all') return false;

        const query = (this.alpine?.searchQuery ?? this.state.searchQuery ?? '').trim().toLowerCase();
        if (!query) return true;

        const inTitle = hero.title?.toLowerCase().includes(query);
        const inDescription = hero.description?.toLowerCase().includes(query);
        const inTags = hero.tags?.some(tag => tag.toLowerCase().includes(query));
        const inHighlights = hero.highlights?.some(hl => hl.toLowerCase().includes(query));

        return Boolean(inTitle || inDescription || inTags || inHighlights);
    }

    hasVisibleContent(release) {
        const hasVisibleHero = this.isHeroVisible(release.hero);
        const hasVisibleFeatures = release.features.some(feature => this.isFeatureVisible(feature));
        return hasVisibleHero || hasVisibleFeatures;
    }
}
