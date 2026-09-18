export class ThemeManager {

    constructor() {
        throw new TypeError('ThemeManager is a static utility class and cannot be instantiated.');
    }

    static init(toggleSelector = '#theme-toggle') {
        $(toggleSelector).off('click.themeToggle').on('click.themeToggle', () => this.toggle());
    }

    static isDark() {
        return document.documentElement.classList.contains('dark');
    }

    static getTheme() {
        return this.isDark() ? 'dark' : 'light';
    }

    static setTheme(theme) {
        return this.setDark(theme === 'dark');
    }

    static setDark(enableDark) {
        const isDark = Boolean(enableDark);
        const theme = isDark ? 'dark' : 'light';

        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', theme);
        document.dispatchEvent(new CustomEvent('themechanged', {
            detail: { theme, isDark }
        }));

        return isDark;
    }

    static toggle() {
        return this.setDark(!this.isDark());
    }
}

export default ThemeManager;