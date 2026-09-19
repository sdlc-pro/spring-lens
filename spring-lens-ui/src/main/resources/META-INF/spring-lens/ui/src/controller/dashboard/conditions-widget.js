class ConditionsWidget {
    computeMetrics(conditionsResponse) {
        const items = conditionsResponse?.content ?? [];
        const total = conditionsResponse?.totalElements ?? items.length;

        const matched = items.filter(c => c.outcome === 'MATCHED').length;
        const notMatched = items.length - matched;

        const evaluatedTotal = items.length || total || 1;
        const matchedPct = Math.round((matched / evaluatedTotal) * 100);
        const notMatchedPct = 100 - matchedPct;

        const samples = items
            .slice(0, 4)
            .map((cond, index) => this._formatSample(cond, index));

        return {
            total: total.toLocaleString(),
            matched: matched.toLocaleString(),
            matchedPct,
            notMatched: notMatched.toLocaleString(),
            notMatchedPct,
            matchedLabel: `${matched} (${matchedPct}%)`,
            unmatchedLabel: `${notMatched} (${notMatchedPct}%)`,
            evaluatedCount: `${total} Total Checked`,
            samples
        };
    }

    _formatSample(cond, index) {
        const isMatch = cond.outcome === 'MATCHED';
        const source = cond.source?.split('.').pop() || cond.source || '--';

        return {
            id: `${cond.source || 'cond'}_${index}`,
            source,
            fullSource: cond.source || '',
            outcome: cond.outcome || 'UNKNOWN',
            isMatch,
            dotClass: isMatch ? 'bg-emerald-500' : 'bg-slate-400',
            outcomeClass: isMatch
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
        };
    }

    render(conditionsResponse) {
        return this.computeMetrics(conditionsResponse);
    }
}
const conditionsWidget = new ConditionsWidget();
export default conditionsWidget;
