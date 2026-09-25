export default class Template {
    static clone(templateId) {
        const template = document.getElementById(templateId);
        return template ? template.content.cloneNode(true) : null;
    }
}
