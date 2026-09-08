import TemplateEngine from './template-engine.js';
import { DEPENDENCY_CATEGORY_COLORS } from './constants.js';
import { capitalize, getBeanCategory, resolveBeanMetadata } from './utils.js';
import GraphTreeBuilder from './graph-tree-builder.js';
import beanDataStore from './bean-data-store.js';

export const DEFAULT_SIDEBAR_SELECTORS = {
    beanName: '#detail-bean-name',
    type: '#detail-bean-type',
    scope: '#detail-bean-scope',
    role: '#detail-bean-role',
    primary: '#detail-prop-primary',
    lazyInit: '#detail-prop-lazy',
    autowired: '#detail-prop-autowired',
    contextId: '#detail-prop-context',
    factoryBean: '#detail-factory-bean',
    factoryMethod: '#detail-factory-method',
    initMethod: '#detail-init-method',
    destroyMethod: '#detail-destroy-method'
};

export default class Sidebar {

    /**
     * Populates bean details text and titles in the sidebar.
     * @param {Object} beanInformation - Bean definition metadata.
     * @param {Object} selectorMap - Map of field names to DOM selector strings.
     */
    static populateDetails(beanInformation = {}, selectorMap = DEFAULT_SIDEBAR_SELECTORS) {
        const details = this.formatDetails(beanInformation);

        Object.entries(selectorMap).forEach(([field, selector]) => {
            if (!selector || details[field] == null) return;
            const $el = $(selector);
            if (!$el.length) return;

            $el.text(details[field]);
            if (field === 'beanName' || field === 'type') {
                $el.attr('title', details[field]);
            }

            // Enhanced styling for boolean traits
            if (field === 'primary' || field === 'lazyInit' || field === 'autowired') {
                const isTrue = details[field] === 'TRUE';
                if (isTrue) {
                    $el.removeClass('bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400')
                       .addClass('bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50');
                } else {
                    $el.removeClass('bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50')
                       .addClass('bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400 border border-transparent');
                }
            }
        });
    }

    static formatDetails(beanInformation = {}) {
        const {
            beanName = '',
            type = 'N/A',
            scope,
            role,
            primary,
            lazyInit,
            autowireCandidate,
            contextId = 'N/A',
            factoryBeanName = '-',
            factoryMethodName = '-',
            initMethodName = '-',
            destroyMethodName = '-'
        } = beanInformation;

        const cleanRole = role ? String(role).replace(/^ROLE_/, '') : '';
        const displayRole = cleanRole ? capitalize(cleanRole) : 'N/A';
        const displayScope = scope ? capitalize(scope) : 'N/A';

        return {
            beanName,
            displayName: beanName,
            type: type || 'N/A',
            scope: displayScope,
            role: displayRole,
            primary: primary ? 'TRUE' : 'FALSE',
            lazyInit: lazyInit ? 'TRUE' : 'FALSE',
            autowired: autowireCandidate ? 'TRUE' : 'FALSE',
            contextId: contextId || '-',
            factoryBean: factoryBeanName || '-',
            factoryMethod: factoryMethodName || '-',
            initMethod: initMethodName || '-',
            destroyMethod: destroyMethodName || '-'
        };
    }

    static updateSidebarIcon(bean, iconSelector = '#sidebar-icon', containerSelector = '#sidebar-icon-container') {
        const { icon, color } = resolveBeanMetadata(bean);

        if (iconSelector) {
            $(iconSelector).text(icon);
        }
        if (containerSelector) {
            $(containerSelector).css({
                backgroundColor: `${color}10`,
                color,
                borderColor: `${color}33`
            });
        }
    }

    static resolveDependencyCategoryColor(beanName, contextId) {
        const record = beanDataStore.findBeanByName(beanName, contextId) || beanDataStore.getBean(beanName);
        if (!record) return 'blue';

        const category = getBeanCategory({
            fullName: beanName,
            meta: { type: record.type }
        });

        return DEPENDENCY_CATEGORY_COLORS[category] ?? 'blue';
    }

    static renderDependencyList($container, beanNames = [], options = {}) {
        if (!$container?.length) return;
        $container.empty();

        const {
            emptyText = 'None',
            emptyTemplateId = null,
            templateId = 'tpl-dep-list-item',
            contextId = '',
            action = null
        } = options;

        if (!beanNames || !beanNames.length) {
            if (emptyTemplateId) {
                const emptyClone = TemplateEngine.clone(emptyTemplateId);
                if (emptyClone) {
                    $(emptyClone).find('[data-field="message"]').text(emptyText);
                    $container.append(emptyClone);
                    return;
                }
            }
            $container.html(`<div class="text-gray-400 dark:text-gray-500 text-xs p-3 italic">${emptyText}</div>`);
            return;
        }

        const fragment = document.createDocumentFragment();
        beanNames.forEach(depName => {
            const clone = TemplateEngine.clone(templateId);
            if (!clone) return;

            const displayName = GraphTreeBuilder._displayName(depName);
            const categoryColor = this.resolveDependencyCategoryColor(depName, contextId);
            const $item = $(clone.firstElementChild);

            if (action) {
                $item.attr('data-action', action);
            }
            $item.attr('data-fullname', depName);
            $item.find('[data-field="dot"]').addClass(`bg-${categoryColor}-500`);
            $item.find('[data-field="name"]').text(displayName).attr('title', depName);

            fragment.appendChild(clone);
        });

        $container.append(fragment);
    }

    static switchTab(activeTab, config = {}) {
        const {
            tabSelector = '.tab-btn',
            tabIdPrefix = 'tab-',
            paneSelector = '.tab-pane',
            paneIdPrefix = 'pane-',
            activeClasses = 'bg-white dark:bg-slate-800 text-primary dark:text-purple-300 shadow-xs font-bold',
            inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium'
        } = config;

        $(tabSelector).each((_, element) => {
            const isSelected = element.id === `${tabIdPrefix}${activeTab}`;
            $(element)
                .toggleClass(activeClasses, isSelected)
                .toggleClass(inactiveClasses, !isSelected);
        });

        $(paneSelector).addClass('hidden');
        $(`#${paneIdPrefix}${activeTab}`).removeClass('hidden');
    }
}
