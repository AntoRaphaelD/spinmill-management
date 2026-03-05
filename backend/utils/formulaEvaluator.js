/**
 * DYNAMIC CALCULATION ENGINE
 * @param {string} formula - The string from DB (e.g. "[H]*[igstper]/100")
 * @param {object} ctx - The object containing all 50+ numeric fields
 * @returns {number}
 */
const evaluateDynamicFormula = (formula, ctx) => {
    if (!formula || formula === '-' || formula === '') return 0;
    try {
        let processed = formula;

        // 1. Map all keys from context into the formula string
        Object.keys(ctx).forEach(key => {
            const regex = new RegExp(`\\[${key}\\]`, 'g');
            const val = ctx[key] !== undefined ? ctx[key] : 0;
            processed = processed.replace(regex, val);
        });

        // 2. Safety: Replace any missed brackets with 0
        processed = processed.replace(/\[.*?\]/g, '0');

        // 3. Convert Excel-like Round to JS Math.round
        processed = processed.replace(/Round\(/gi, 'Math.round(');

        // 4. Execute Math
        // eslint-disable-next-line no-eval
        const result = eval(processed);
        return isNaN(result) || !isFinite(result) ? 0 : parseFloat(result.toFixed(2));
    } catch (err) {
        return 0;
    }
};