class DomUtils {

    static css(variableName) {
        return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    }

    static downloadBlob(filename, blob) {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    static downloadJson(filename, data) {
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        this.downloadBlob(filename, blob);
    }
}

export default DomUtils;
