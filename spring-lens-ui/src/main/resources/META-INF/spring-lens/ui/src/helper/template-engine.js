export default class TemplateEngine {
    static clone(templateId) {
        const template = document.getElementById(templateId);
        return template ? template.content.cloneNode(true) : null;
    }

    static renderBooleanIcon(isTrue) {
        return TemplateEngine.clone(isTrue ? 'tpl-icon-check' : 'tpl-icon-uncheck');
    }
}
