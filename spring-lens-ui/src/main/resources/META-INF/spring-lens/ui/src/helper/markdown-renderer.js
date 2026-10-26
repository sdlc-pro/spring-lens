const INLINE_TOKEN = /(`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/;

function appendText(parent, value) {
    parent.append(document.createTextNode(value));
}

function appendInline(parent, value) {
    const text = String(value);
    const tokenPattern = new RegExp(INLINE_TOKEN.source, 'g');
    let cursor = 0;
    let match;

    while ((match = tokenPattern.exec(text)) !== null) {
        if (match.index > cursor) appendText(parent, text.slice(cursor, match.index));
        const token = match[0];
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);

        if (link) {
            let url;
            try {
                url = new URL(link[2], document.baseURI);
            } catch {
                appendText(parent, token);
                cursor = tokenPattern.lastIndex;
                continue;
            }
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                appendText(parent, token);
                cursor = tokenPattern.lastIndex;
                continue;
            }
            const anchor = document.createElement('a');
            anchor.href = url.href;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            appendInline(anchor, link[1]);
            parent.append(anchor);
        } else if (token.startsWith('**') || token.startsWith('__')) {
            const strong = document.createElement('strong');
            appendInline(strong, token.slice(2, -2));
            parent.append(strong);
        } else if (token.startsWith('*') || token.startsWith('_')) {
            const emphasis = document.createElement('em');
            appendInline(emphasis, token.slice(1, -1));
            parent.append(emphasis);
        } else {
            const code = document.createElement('code');
            code.className = 'ai-markdown-inline-code';
            code.textContent = token.slice(1, -1);
            parent.append(code);
        }
        cursor = tokenPattern.lastIndex;
    }

    if (cursor < text.length) appendText(parent, text.slice(cursor));
}

function listMarker(line) {
    const bullet = /^ {0,3}[-+*]\s+(.+)$/.exec(line);
    if (bullet) return {type: 'ul', content: bullet[1]};
    const ordered = /^ {0,3}\d+[.)]\s+(.+)$/.exec(line);
    if (ordered) return {type: 'ol', content: ordered[1]};
    return null;
}

function isBlockStart(line) {
    return /^ {0,3}(?:`{3,}|~{3,})/.test(line)
        || /^ {0,3}#{1,6}\s+/.test(line)
        || /^ {0,3}>\s?/.test(line)
        || /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
        || listMarker(line) !== null;
}

function appendParagraph(parent, lines) {
    const paragraph = document.createElement('p');
    paragraph.className = 'ai-markdown-paragraph';
    lines.forEach((line, index) => {
        if (index > 0) {
            const previous = lines[index - 1];
            if (/ {2,}$/.test(previous)) paragraph.append(document.createElement('br'));
            else appendText(paragraph, ' ');
        }
        appendInline(paragraph, line.replace(/\s+$/, ''));
    });
    parent.append(paragraph);
}

/** Render a safe Markdown subset without interpreting raw HTML. */
export function renderMarkdown(container, source) {
    container.replaceChildren();
    const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
            index++;
            continue;
        }

        const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
        if (fence) {
            const marker = fence[1];
            const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`);
            const codeLines = [];
            index++;
            while (index < lines.length && !closing.test(lines[index])) codeLines.push(lines[index++]);
            if (index < lines.length) index++;
            const pre = document.createElement('pre');
            pre.className = 'ai-markdown-codeblock';
            const code = document.createElement('code');
            code.textContent = codeLines.join('\n');
            pre.append(code);
            container.append(pre);
            continue;
        }

        const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
        if (heading) {
            const element = document.createElement(`h${heading[1].length}`);
            element.className = 'ai-markdown-heading';
            appendInline(element, heading[2]);
            container.append(element);
            index++;
            continue;
        }

        if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            const rule = document.createElement('hr');
            rule.className = 'ai-markdown-rule';
            container.append(rule);
            index++;
            continue;
        }

        if (/^ {0,3}>\s?/.test(line)) {
            const quoteLines = [];
            while (index < lines.length && /^ {0,3}>\s?/.test(lines[index])) {
                quoteLines.push(lines[index++].replace(/^ {0,3}>\s?/, ''));
            }
            const quote = document.createElement('blockquote');
            quote.className = 'ai-markdown-quote';
            appendParagraph(quote, quoteLines);
            container.append(quote);
            continue;
        }

        const marker = listMarker(line);
        if (marker) {
            const list = document.createElement(marker.type);
            list.className = marker.type === 'ul' ? 'ai-markdown-list ai-markdown-unordered' : 'ai-markdown-list ai-markdown-ordered';
            while (index < lines.length) {
                const item = listMarker(lines[index]);
                if (!item || item.type !== marker.type) break;
                const listItem = document.createElement('li');
                appendInline(listItem, item.content);
                list.append(listItem);
                index++;
            }
            container.append(list);
            continue;
        }

        const paragraphLines = [];
        while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
            paragraphLines.push(lines[index++]);
        }
        if (paragraphLines.length) {
            appendParagraph(container, paragraphLines);
        } else {
            // Malformed or empty block markers must not stall the parser.
            appendParagraph(container, [lines[index++]]);
        }
    }
}
